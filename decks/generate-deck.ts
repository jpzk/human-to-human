#!/usr/bin/env npx tsx
/**
 * Deck Generator Script
 * 
 * Generates a complete deck with questions and TTS audio files.
 * 
 * Usage:
 *   npx tsx decks/generate-deck.ts --theme "friends" --questions 10
 *   npx tsx decks/generate-deck.ts -t "couples" -q 8
 * 
 * Output:
 *   decks/<deck-name>/
 *     deck.json          - Deck data with audio file references
 *     intro.mp3          - Introduction narration
 *     q1_<name>.mp3      - Question 1 audio
 *     q2_<name>.mp3      - Question 2 audio
 *     ...
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env file
function loadEnv() {
  // Try multiple possible locations for .env
  const possiblePaths = [
    path.join(process.cwd(), ".env"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env"),
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      console.log(`📄 Loading environment from: ${envPath}`);
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith("#")) continue;
        const equalIndex = trimmedLine.indexOf("=");
        if (equalIndex > 0) {
          const key = trimmedLine.slice(0, equalIndex).trim();
          const value = trimmedLine.slice(equalIndex + 1).trim();
          if (key && value) {
            process.env[key] = value;
          }
        }
      }
      return true;
    }
  }
  return false;
}

loadEnv();

// API Configuration
const MINIMAX_API_URL = "https://api.minimax.io/v1/text/chatcompletion_v2";
const HUME_API_URL = "https://api.hume.ai/v0/tts";

// Voice configuration for narrator
const NARRATOR_VOICE = {
  name: "Dacher",  // Friendly, warm narrator voice from Hume AI
  provider: "HUME_AI",
};

// Types
interface Card {
  card_name: string;
  question: string;
  type: "buttons" | "slider";
  answers: string[];
  hideCursors?: boolean;
  audioFile?: string;
}

interface GeneratedDeck {
  deck_name: string;
  introduction: string;
  introAudioFile?: string;
  cards: Card[];
}

interface MinimaxResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface HumeTTSResponse {
  generations: Array<{
    audio: string;
    duration: number;
  }>;
}

// Parse command line arguments
function parseArgs(): { theme: string; questions: number } {
  const args = process.argv.slice(2);
  let theme = "";
  let questions = 10;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--theme" || args[i] === "-t") {
      theme = args[i + 1] || "";
      i++;
    } else if (args[i] === "--questions" || args[i] === "-q") {
      questions = parseInt(args[i + 1] || "10", 10);
      i++;
    }
  }

  if (!theme) {
    console.error("Error: --theme is required");
    console.error("Usage: npx tsx decks/generate-deck.ts --theme <theme> [--questions <number>]");
    console.error("Example: npx tsx decks/generate-deck.ts --theme friends --questions 10");
    process.exit(1);
  }

  return { theme, questions };
}

// Generate deck using Minimax API
async function generateDeckContent(theme: string, numQuestions: number): Promise<GeneratedDeck> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY not set in environment");
  }

  const systemPrompt = `You are a deck generator for a social connection game. Generate question decks that help people get to know each other better.

Each deck must follow this exact JSON format:
{
  "deck_name": "Deck Name Here",
  "introduction": "A warm, inviting introduction that the narrator will read to set the mood for this deck. 2-3 sentences that explain what players will explore together.",
  "cards": [
    {
      "card_name": "short_snake_case_name",
      "question": "The question text?",
      "type": "buttons",
      "answers": ["Answer 1", "Answer 2", "Answer 3", "Answer 4"]
    },
    {
      "card_name": "another_name", 
      "question": "Another question?",
      "type": "slider",
      "answers": ["Left extreme", "Right extreme"]
    }
  ]
}

Rules:
- Each deck has exactly ${numQuestions} cards
- "buttons" type cards have exactly 4 answers
- "slider" type cards have exactly 2 answers (representing opposite ends of a spectrum)
- Mix button and slider types (roughly 60-70% buttons, 30-40% sliders)
- card_name should be snake_case and descriptive
- CRITICAL: Order questions from LEAST intimate to MOST intimate:
  * First third: Light, casual, easy to answer (hobbies, preferences, daily life)
  * Middle third: Medium depth (values, dreams, aspirations, relationships)  
  * Final third: Deep and vulnerable (fears, regrets, emotional truths, personal struggles)
- The last 2-3 questions should include "hideCursors": true for privacy on sensitive questions
- The introduction should be warm and set expectations for the journey ahead

Return ONLY valid JSON, no markdown or explanation.`;

  console.log(`\n📝 Generating deck content for theme: "${theme}" with ${numQuestions} questions...`);

  const response = await fetch(MINIMAX_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "MiniMax-Text-01",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate a deck with the theme: "${theme}"` },
      ],
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Minimax API error (${response.status}): ${errorText}`);
  }

  const data: MinimaxResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response from Minimax API");
  }

  const content = data.choices[0].message.content;

  try {
    const deck: GeneratedDeck = JSON.parse(content);
    console.log(`✅ Generated deck: "${deck.deck_name}" with ${deck.cards.length} questions`);
    return deck;
  } catch {
    throw new Error(`Failed to parse deck JSON: ${content}`);
  }
}

// Generate TTS audio using Hume AI
async function generateAudio(text: string, outputPath: string): Promise<void> {
  const apiKey = process.env.HUME_API_KEY;
  if (!apiKey) {
    throw new Error("HUME_API_KEY not set in environment");
  }

  const response = await fetch(HUME_API_URL, {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "2",
      utterances: [
        {
          text,
          voice: NARRATOR_VOICE,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hume TTS API error (${response.status}): ${errorText}`);
  }

  const data: HumeTTSResponse = await response.json();

  if (!data.generations || data.generations.length === 0) {
    throw new Error("No audio generated from Hume TTS API");
  }

  // Decode base64 and save as MP3
  const audioBuffer = Buffer.from(data.generations[0].audio, "base64");
  fs.writeFileSync(outputPath, audioBuffer);
}

// Create slug from deck name
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Main function
async function main() {
  const { theme, questions } = parseArgs();

  console.log("\n🎴 Deck Generator");
  console.log("================");
  console.log(`Theme: ${theme}`);
  console.log(`Questions: ${questions}`);

  // Validate API keys early
  if (!process.env.MINIMAX_API_KEY) {
    throw new Error(
      "MINIMAX_API_KEY not found.\n" +
      "Make sure your .env file exists in the project root and contains:\n" +
      "MINIMAX_API_KEY=your-api-key"
    );
  }
  if (!process.env.HUME_API_KEY) {
    throw new Error(
      "HUME_API_KEY not found.\n" +
      "Make sure your .env file exists in the project root and contains:\n" +
      "HUME_API_KEY=your-api-key"
    );
  }
  console.log("✅ API keys loaded");

  // Step 1: Generate deck content
  const deck = await generateDeckContent(theme, questions);

  // Step 2: Create output directory
  const deckSlug = slugify(deck.deck_name);
  const outputDir = path.join(__dirname, deckSlug);
  
  if (fs.existsSync(outputDir)) {
    console.log(`\n⚠️  Directory already exists: ${outputDir}`);
    console.log("   Overwriting existing files...");
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\n📁 Output directory: ${outputDir}`);

  // Step 3: Generate introduction audio
  console.log("\n🎙️  Generating audio files...");
  console.log("   [1/${questions + 1}] Introduction...");
  
  const introAudioFile = "intro.mp3";
  await generateAudio(deck.introduction, path.join(outputDir, introAudioFile));
  deck.introAudioFile = introAudioFile;

  // Step 4: Generate audio for each question
  for (let i = 0; i < deck.cards.length; i++) {
    const card = deck.cards[i];
    const audioFile = `q${i + 1}_${card.card_name}.mp3`;
    
    console.log(`   [${i + 2}/${questions + 1}] ${card.card_name}...`);
    
    await generateAudio(card.question, path.join(outputDir, audioFile));
    card.audioFile = audioFile;
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Step 5: Save deck JSON
  const jsonPath = path.join(outputDir, "deck.json");
  fs.writeFileSync(jsonPath, JSON.stringify(deck, null, 2));

  console.log("\n✅ Deck generation complete!");
  console.log(`\n📦 Output files:`);
  console.log(`   ${jsonPath}`);
  console.log(`   ${path.join(outputDir, introAudioFile)}`);
  for (const card of deck.cards) {
    console.log(`   ${path.join(outputDir, card.audioFile!)}`);
  }

  console.log("\n🎉 Done!\n");
}

// Run
main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
