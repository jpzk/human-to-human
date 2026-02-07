const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export interface GeminiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export const LLM_TIMEOUT_MS = 15000; // 15 second timeout
export const MAX_RETRIES = 2;
export const RETRY_DELAY_MS = 1000; // Initial delay of 1 second

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTimeoutPromise(): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("LLM request timeout after 15 seconds")), LLM_TIMEOUT_MS)
  );
}

export async function callGeminiAPI(
  messages: GeminiMessage[],
  apiKey: string,
  retryCount = 0
): Promise<string> {
  try {
    // Separate system instruction from user/assistant messages
    const systemMessages = messages.filter(m => m.role === "system");
    const conversationMessages = messages.filter(m => m.role !== "system");
    
    // Extract system instruction (use first system message if present)
    const systemInstruction = systemMessages.length > 0
      ? { parts: [{ text: systemMessages[0].content }] }
      : undefined;
    
    // Convert conversation messages to Gemini format
    const contents = conversationMessages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
    
    const requestBody: {
      systemInstruction?: { parts: Array<{ text: string }> };
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      generationConfig?: { temperature: number };
    } = {
      contents,
      generationConfig: {
        temperature: 0.8,
      },
    };
    
    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }
    
    const fetchPromise = fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    
    // Race between fetch and timeout
    const response = await Promise.race([
      fetchPromise,
      createTimeoutPromise(),
    ]);
    
    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Gemini API error (${response.status}): ${errorText}`);
      
      // Retry on 5xx errors or rate limit (429)
      if ((response.status >= 500 || response.status === 429) && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
        await sleep(delay);
        return callGeminiAPI(messages, apiKey, retryCount + 1);
      }
      
      throw error;
    }

    const data: GeminiResponse = await response.json();

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
      const error = new Error("No response from Gemini API");
      // Retry on empty response
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        await sleep(delay);
        return callGeminiAPI(messages, apiKey, retryCount + 1);
      }
      throw error;
    }

    return data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error("[geminiClient] API call failed:", error instanceof Error ? error.message : String(error));
    
    // Retry on network errors
    if (retryCount < MAX_RETRIES && error instanceof TypeError) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      await sleep(delay);
      return callGeminiAPI(messages, apiKey, retryCount + 1);
    }
    
    // Retry on timeout errors
    if (retryCount < MAX_RETRIES && error instanceof Error && error.message.includes("timeout")) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      await sleep(delay);
      return callGeminiAPI(messages, apiKey, retryCount + 1);
    }
    
    throw error;
  }
}
