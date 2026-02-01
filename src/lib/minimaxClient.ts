const MINIMAX_API_URL = "https://api.minimax.io/v1/text/chatcompletion_v2";

export interface MinimaxMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MinimaxResponse {
  choices: Array<{
    message: {
      content: string;
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

export async function callMinimaxAPI(
  messages: MinimaxMessage[],
  apiKey: string,
  retryCount = 0
): Promise<string> {
  try {
    const requestBody = {
      model: "MiniMax-M2.1-lightning",
      messages,
      temperature: 0.8,
    };
    
    const fetchPromise = fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      const error = new Error(`Minimax API error (${response.status}): ${errorText}`);
      
      // Retry on 5xx errors or rate limit (429)
      if ((response.status >= 500 || response.status === 429) && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
        await sleep(delay);
        return callMinimaxAPI(messages, apiKey, retryCount + 1);
      }
      
      throw error;
    }

    const data: MinimaxResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      const error = new Error("No response from Minimax API");
      // Retry on empty response
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        await sleep(delay);
        return callMinimaxAPI(messages, apiKey, retryCount + 1);
      }
      throw error;
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("[minimaxClient] API call failed:", error instanceof Error ? error.message : String(error));
    
    // Retry on network errors
    if (retryCount < MAX_RETRIES && error instanceof TypeError) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      await sleep(delay);
      return callMinimaxAPI(messages, apiKey, retryCount + 1);
    }
    
    // Retry on timeout errors
    if (retryCount < MAX_RETRIES && error instanceof Error && error.message.includes("timeout")) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      await sleep(delay);
      return callMinimaxAPI(messages, apiKey, retryCount + 1);
    }
    
    throw error;
  }
}
