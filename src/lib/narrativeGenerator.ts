import type { NarrativeData } from "@/services/narrativeService";
import { callMinimaxAPI, type MinimaxMessage } from "./minimaxClient";

const SYSTEM_PROMPT = `You are a creative storyteller for a social connection game. Write 3-4 ultra-concise, punchy narrative insights about how players answered questions together.

Guidelines:
- ONE sentence per insight, maximum 15 words
- Be sharp, witty, and memorable
- Mix tones: playful for speed, thoughtful for connections, dramatic for outliers
- Use player names naturally
- Focus on the most striking observation
- No fluff or repetition

Return ONLY a JSON array of strings, no markdown. Example format:
["insight 1", "insight 2", "insight 3"]`;

function formatNarrativeData(data: NarrativeData): string {
  const parts: string[] = [];

  parts.push(`Total players: ${data.totalPlayers}`);
  parts.push(`Total questions: ${data.totalQuestions}`);

  if (data.consensus) {
    parts.push(
      `\nCONSENSUS: On "${data.consensus.questionText}", ${data.consensus.matchCount} out of ${data.totalPlayers} players chose "${data.consensus.answer}".`
    );
  }

  if (data.divider) {
    parts.push(
      `\nDIVIDER: "${data.divider.questionText}" had the highest variance (${data.divider.variance.toFixed(2)}), showing the most disagreement.`
    );
  }

  if (data.maverick) {
    parts.push(
      `\nMAVERICK: ${data.maverick.name} had ${data.maverick.outlierCount} outlier answers, standing apart from the group.`
    );
  }

  if (data.quickdraw) {
    parts.push(
      `\nQUICKDRAW: ${data.quickdraw.name} answered fastest with an average time of ${data.quickdraw.avgTime.toFixed(1)} seconds per question.`
    );
  }

  if (data.hesitation) {
    parts.push(
      `\nHESITATION: ${data.hesitation.name} took the longest time (${data.hesitation.time.toFixed(1)} seconds) to answer "${data.hesitation.question}".`
    );
  }

  if (data.secretPair) {
    parts.push(
      `\nSECRET CONNECTION: ${data.secretPair.names[0]} and ${data.secretPair.names[1]} uniquely matched on "${data.secretPair.question}" with answer "${data.secretPair.answer}".`
    );
  }

  return parts.join("\n");
}

export async function generateNarrative(
  narrativeData: NarrativeData,
  apiKey?: string
): Promise<string[]> {
  const key = apiKey ?? process.env.MINIMAX_API_KEY;

  if (!key) {
    throw new Error(
      "Minimax API key is required. Set MINIMAX_API_KEY env var or pass apiKey parameter."
    );
  }

  // Format the narrative data into a readable prompt
  const dataDescription = formatNarrativeData(narrativeData);

  const messages: MinimaxMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Here's the game data:\n\n${dataDescription}\n\nWrite 3-5 engaging narrative insights based on this data.`,
    },
  ];

  try {
    const content = await callMinimaxAPI(messages, key);

    // Try to parse as JSON array
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const insights: unknown = JSON.parse(cleanedContent);
      
      // Validate it's an array of strings
      if (Array.isArray(insights)) {
        // Filter and validate each element
        const validInsights = insights
          .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
          .map((i) => i.trim())
          .slice(0, 5); // Limit to 5 insights max
        
        if (validInsights.length > 0) {
          return validInsights;
        }
      }
      
      throw new Error("Invalid response format: not an array of strings");
    } catch (parseError) {
      // Fallback: try to extract insights from plain text
      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("```"));
      
      if (lines.length > 0) {
        return lines.slice(0, 5);
      }
      
      // Last resort: validate content isn't too long and return as single insight
      const maxLength = 500; // Reasonable max length for a single insight
      if (content.length > maxLength) {
        return [content.substring(0, maxLength) + "..."];
      }
      
      return [content];
    }
  } catch (error) {
    console.error("[narrativeGenerator] Failed to generate narrative:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Generate a fallback narrative when LLM fails
 */
export function generateFallbackNarrative(narrativeData: NarrativeData): string[] {
  const insights: string[] = [];
  
  insights.push(`${narrativeData.totalPlayers} players answered ${narrativeData.totalQuestions} questions together.`);
  
  if (narrativeData.consensus) {
    insights.push(`Everyone agreed on one thing: "${narrativeData.consensus.answer}" when asked "${narrativeData.consensus.questionText}".`);
  }
  
  if (narrativeData.maverick) {
    insights.push(`${narrativeData.maverick.name} stood out with ${narrativeData.maverick.outlierCount} unique answers.`);
  }
  
  if (narrativeData.quickdraw) {
    insights.push(`${narrativeData.quickdraw.name} was the fastest, answering in an average of ${narrativeData.quickdraw.avgTime.toFixed(1)} seconds.`);
  }
  
  if (narrativeData.secretPair) {
    insights.push(`${narrativeData.secretPair.names[0]} and ${narrativeData.secretPair.names[1]} uniquely matched on "${narrativeData.secretPair.question}".`);
  }
  
  return insights.length > 0 ? insights : ["The game has ended. Thanks for playing!"];
}

/**
 * Test Minimax API connection with a simple request
 */
export async function testMinimaxConnection(apiKey?: string): Promise<void> {
  const key = apiKey ?? process.env.MINIMAX_API_KEY;
  
  if (!key) {
    throw new Error("No API key");
  }
  
  const simpleMessages: MinimaxMessage[] = [
    { role: "user", content: "Say hello in one sentence" }
  ];
  
  try {
    await callMinimaxAPI(simpleMessages, key);
  } catch (error) {
    console.error("[testMinimax] Connection test failed:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
