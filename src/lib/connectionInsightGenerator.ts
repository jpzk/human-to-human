import { callGeminiAPI, type GeminiMessage } from "./geminiClient";

const SYSTEM_PROMPT = `Write ultra-short (2-5 words) reasons two people should connect. 
Use the agreements/differences provided. Be specific and insightful, not generic.
use natural, conversational language. focus on what makes the connection interesting.  
Return ONLY a JSON object mapping pair keys to reasons.`;

interface ConnectionPair {
  userAId: string;
  userBId: string;
  userAName: string;
  userBName: string;
  score: number;
  agreements: string[]; // Questions they agreed on
  differences: string[]; // Questions they differed on
}

function formatPairData(pair: ConnectionPair): string {
  const score = Math.round(pair.score * 100);
  const agreements = pair.agreements.length > 0 ? pair.agreements.join(", ") : "-";
  const differences = pair.differences.length > 0 ? pair.differences.join(", ") : "-";
  return `${pair.userAName}-${pair.userBName} | ${score}% | Agreements: ${agreements} | Differences: ${differences}`;
}

export async function generateConnectionInsights(
  pairs: ConnectionPair[],
  apiKey?: string
): Promise<Map<string, string>> {
  const key = apiKey ?? process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      "Gemini API key is required. Set GEMINI_API_KEY env var or pass apiKey parameter."
    );
  }

  if (pairs.length === 0) {
    return new Map();
  }

  // Format pairs for prompt
  const pairsDescription = pairs
    .map((pair, index) => `${index + 1}. ${formatPairData(pair)}`)
    .join("\n");

  const messages: GeminiMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Pairs:\n${pairsDescription}\nReturn JSON using the same keys (left of |).`,
    },
  ];

  try {
    const content = await callGeminiAPI(messages, key);

    // Try to parse as JSON object
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const insights: unknown = JSON.parse(cleanedContent);
      
      // Validate it's an object with string values
      if (insights && typeof insights === "object" && !Array.isArray(insights)) {
        const result = new Map<string, string>();
        
        for (const pair of pairs) {
          const key = `${pair.userAName}-${pair.userBName}`;
          const reason = (insights as Record<string, unknown>)[key];
          
          if (typeof reason === "string" && reason.trim().length > 0) {
            // Validate max 5 words
            const words = reason.trim().split(/\s+/);
            if (words.length < 2) {
              // Too short for our requirement; let fallback handle it
              continue;
            }
            if (words.length <= 5) {
              result.set(key, reason.trim());
            } else {
              // Truncate to 5 words if needed
              result.set(key, words.slice(0, 5).join(" "));
            }
          }
        }
        
        if (result.size > 0) {
          return result;
        }
      }
      
      throw new Error("Invalid response format: not an object with string values");
    } catch (parseError) {
      console.warn("[connectionInsightGenerator] Failed to parse JSON, using fallback:", parseError);
      // Fallback: return empty map (will use generic fallback in server)
      return new Map();
    }
  } catch (error) {
    console.error("[connectionInsightGenerator] Failed to generate connection insights:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Generate fallback connection reasons based on compatibility score
 */
export function generateFallbackConnectionInsight(score: number): string {
  if (score >= 0.7) {
    return "high compatibility match";
  } else if (score >= 0.5) {
    return "interesting different perspectives";
  } else {
    return "complementary opposites attract";
  }
}
