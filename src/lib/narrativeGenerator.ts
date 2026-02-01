import type { NarrativeData } from "@/services/narrativeService";
import { callMinimaxAPI, type MinimaxMessage } from "./minimaxClient";

const SYSTEM_PROMPT = `Write a brief story (2-3 paragraphs) about how this group connected through their answers. Use the data provided to extract genuine insights about where they agreed, differed, hesitated, or found unique connections. NO titles. NO markdown. NO formatting. Just plain text paragraphs separated by a single blank line.`;

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
): Promise<string> {
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
      content: `Here's the game data:\n\n${dataDescription}\n\nWrite a brief narrative story based on this data.`,
    },
  ];

  try {
    const content = await callMinimaxAPI(messages, key);
    
    console.log("[narrativeGenerator] Raw content received:", content.substring(0, 200));

    // Clean up the content - remove ALL formatting
    let cleanedContent = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .replace(/^["']|["']$/g, "") // Remove surrounding quotes
      .replace(/^#+\s+.+$/gm, "") // Remove markdown headers (# Title)
      .replace(/^\*\*(.+)\*\*$/gm, "$1") // Remove bold (**text**)
      .replace(/\*\*(.+?)\*\*/g, "$1") // Remove inline bold
      .replace(/\*([^*]+)\*/g, "$1") // Remove italic/emphasis (*text*)
      .replace(/_([^_]+)_/g, "$1") // Remove underline emphasis (_text_)
      .replace(/\.undefined\b/g, ".") // Remove .undefined
      .replace(/\bundefined\b/g, "") // Remove standalone undefined
      .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines to double
      .trim()
      .split("\n")
      .filter(line => line.trim().length > 0) // Remove empty lines
      .join("\n\n"); // Rejoin with double newlines between paragraphs
    
    console.log("[narrativeGenerator] Cleaned content:", cleanedContent.substring(0, 200));
    if (cleanedContent.length > 0) {
      console.log("[narrativeGenerator] First char code:", cleanedContent.charCodeAt(0), "char:", cleanedContent.charAt(0));
    }
    
    // Validate length (reasonable bounds for a story)
    const minLength = 80; // Minimum reasonable story length
    const maxLength = 600; // Maximum reasonable story length
    
    if (cleanedContent.length < minLength) {
      // If too short, use fallback
      throw new Error("Generated story too short");
    }
    
    if (cleanedContent.length > maxLength) {
      // Truncate if too long, but try to end at a sentence boundary
      cleanedContent = cleanedContent.substring(0, maxLength);
      const lastPeriod = cleanedContent.lastIndexOf(".");
      if (lastPeriod > maxLength * 0.8) {
        cleanedContent = cleanedContent.substring(0, lastPeriod + 1);
      } else {
        cleanedContent = cleanedContent.trim() + "...";
      }
    }
    
    return cleanedContent;
  } catch (error) {
    console.error("[narrativeGenerator] Failed to generate narrative:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Generate a fallback narrative when LLM fails
 */
export function generateFallbackNarrative(narrativeData: NarrativeData): string {
  const parts: string[] = [];
  
  // Opening paragraph
  parts.push(`This group started where many connections do — with simple questions about preferences and everyday choices. ${narrativeData.totalPlayers} people came together to answer ${narrativeData.totalQuestions} questions, each one a small window into who they are.`);
  
  // Middle paragraph - shift to deeper questions
  parts.push(`As the questions went deeper, something shifted. Beneath the surface of hobbies and preferences, patterns emerged. Some found common ground, while others revealed the beautiful diversity within the group.`);
  
  // Observation paragraph
  const observations: string[] = [];
  if (narrativeData.consensus) {
    observations.push(`there was clear agreement on "${narrativeData.consensus.answer}"`);
  }
  if (narrativeData.maverick) {
    observations.push(`${narrativeData.maverick.name} brought unique perspectives`);
  }
  if (narrativeData.secretPair) {
    observations.push(`${narrativeData.secretPair.names[0]} and ${narrativeData.secretPair.names[1]} discovered a special connection`);
  }
  
  if (observations.length > 0) {
    parts.push(`What stands out is not just what was chosen, but how varied the answers were — ${observations.join(", ")}. This group was willing to keep going anyway, to see what would emerge.`);
  } else {
    parts.push(`What stands out is not what was chosen, but how varied the answers were — and how willing this group was to keep going anyway.`);
  }
  
  // Closing paragraph
  parts.push(`This moment wasn't about knowing each other perfectly. It was about showing up, side by side, and letting a bit of honesty into the room. Whatever happens next, this was a real start.`);
  
  return parts.join(" ");
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
