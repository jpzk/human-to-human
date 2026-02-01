import { callMinimaxAPI, type MinimaxMessage } from "./minimaxClient";

const SYSTEM_PROMPT = `You generate ultra-concise connection reasons explaining why two people would connect based on their compatibility quiz answers.

Guidelines:
- MAXIMUM 5 words per reason
- Be specific and insightful, not generic
- Focus on what makes their connection interesting (shared values, complementary differences, unique alignment)
- Use natural, conversational language
- Examples: "shared values drive connection", "opposites attract creative sparks", "both value deep conversations", "complementary risk-taking styles"

Return ONLY a JSON object mapping pair keys to reasons. Example format:
{"Alice-Bob": "shared values drive connection", "Alice-Carol": "opposites attract creative sparks"}`;

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
  const parts: string[] = [];
  
  parts.push(`${pair.userAName} & ${pair.userBName} (${Math.round(pair.score * 100)}% match)`);
  
  if (pair.agreements.length > 0) {
    parts.push(`Agreed on: ${pair.agreements.slice(0, 3).join(", ")}${pair.agreements.length > 3 ? "..." : ""}`);
  }
  
  if (pair.differences.length > 0) {
    parts.push(`Differed on: ${pair.differences.slice(0, 2).join(", ")}${pair.differences.length > 2 ? "..." : ""}`);
  }
  
  return parts.join("; ");
}

export async function generateConnectionInsights(
  pairs: ConnectionPair[],
  apiKey?: string
): Promise<Map<string, string>> {
  const key = apiKey ?? process.env.MINIMAX_API_KEY;

  if (!key) {
    throw new Error(
      "Minimax API key is required. Set MINIMAX_API_KEY env var or pass apiKey parameter."
    );
  }

  if (pairs.length === 0) {
    return new Map();
  }

  // Format pairs for prompt
  const pairsDescription = pairs
    .map((pair, index) => `${index + 1}. ${formatPairData(pair)}`)
    .join("\n");

  const pairKeys = pairs.map(p => `${p.userAName}-${p.userBName}`);

  const messages: MinimaxMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Generate connection reasons for these pairs:\n\n${pairsDescription}\n\nReturn JSON object with keys: ${pairKeys.map(k => `"${k}"`).join(", ")}`,
    },
  ];

  try {
    const content = await callMinimaxAPI(messages, key);

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
