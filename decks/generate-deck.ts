#!/usr/bin/env npx tsx
/**
 * Deck Generator Script
 * 
 * Generates a complete deck with questions and TTS audio files.
 * 
 * Usage:
 *   npx tsx decks/generate-deck.ts --theme "friends" --questions 10
 *   npx tsx decks/generate-deck.ts -t "couples" -q 8 --voice <voice-id>
 *   npx tsx decks/generate-deck.ts -t "work" -v ee96fb5f-ec1a-4f41-a9ba-6d119e64c8fd
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Default voice ID for narrator (Hume AI custom voice)
const DEFAULT_VOICE_ID = "ee96fb5f-ec1a-4f41-a9ba-6d119e64c8fd";

// Types
interface Card {
  card_name: string;
  question: string;
  type: "buttons" | "slider";
  answers: string[];
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
function parseArgs(): { theme: string; questions: number; voiceId: string } {
  const args = process.argv.slice(2);
  let theme = "";
  let questions = 10;
  let voiceId = DEFAULT_VOICE_ID;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--theme" || args[i] === "-t") {
      theme = args[i + 1] || "";
      i++;
    } else if (args[i] === "--questions" || args[i] === "-q") {
      questions = parseInt(args[i + 1] || "10", 10);
      i++;
    } else if (args[i] === "--voice" || args[i] === "-v") {
      voiceId = args[i + 1] || DEFAULT_VOICE_ID;
      i++;
    }
  }

  if (!theme) {
    console.error("Error: --theme is required");
    console.error("Usage: npx tsx decks/generate-deck.ts --theme <theme> [--questions <number>] [--voice <voice-id>]");
    console.error("Example: npx tsx decks/generate-deck.ts --theme friends --questions 10");
    process.exit(1);
  }

  return { theme, questions, voiceId };
}

// Extract JSON from potentially markdown-wrapped response
function extractJson(content: string): string {
  // Remove markdown code blocks if present
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  return content.trim();
}

// Call Minimax API with a prompt, with retry on parse failure
async function callMinimax(systemPrompt: string, userPrompt: string, maxRetries = 2): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY not set in environment");
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "MiniMax-M2.1-lightning",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
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

    const content = extractJson(data.choices[0].message.content);
    
    // Validate it's parseable JSON
    try {
      JSON.parse(content);
      return content;
    } catch {
      if (attempt < maxRetries) {
        console.log(`   ⚠️  Invalid JSON, retrying (${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        throw new Error(`Failed to get valid JSON after ${maxRetries + 1} attempts: ${content}`);
      }
    }
  }

  throw new Error("Unexpected error in callMinimax");
}

// Generate deck intro (name and introduction)
async function generateDeckIntro(theme: string): Promise<{ deck_name: string; introduction: string }> {
  const systemPrompt = `You generate deck metadata for a social connection game.
Return ONLY valid JSON with exactly these fields:
{
  "deck_name": "A catchy deck name",
  "introduction": "A warm, inviting introduction (2-3 sentences) that the narrator will read to set the mood."
}
No markdown, no explanation, just JSON.`;

  const content = await callMinimax(systemPrompt, `Theme: "${theme}"`);
  
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse deck intro JSON: ${content}`);
  }
}

// Generate a single question
async function generateQuestion(
  theme: string,
  questionNumber: number,
  totalQuestions: number,
  previousQuestions: string[]
): Promise<Card> {
  // Determine intimacy level based on position
  const position = questionNumber / totalQuestions;
  let intimacyLevel: string;
  if (position <= 0.33) {
    intimacyLevel = "LIGHT - casual, easy to answer (hobbies, preferences, daily life)";
  } else if (position <= 0.66) {
    intimacyLevel = "MEDIUM - values, dreams, aspirations, relationships";
  } else {
    intimacyLevel = "DEEP - vulnerable, fears, regrets, emotional truths, personal struggles";
  }

  // Determine if this should be a slider (roughly 30-40% sliders)
  const shouldBeSlider = Math.random() < 0.35;
  const questionType = shouldBeSlider ? "slider" : "buttons";
  
  const previousList = previousQuestions.length > 0 
    ? `\nPrevious questions (DO NOT repeat similar topics):\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";

  const systemPrompt = `You generate questions for a social connection game about "${theme}".
A warm, playful narrator reads these aloud to players.

Return ONLY valid JSON with exactly these fields:
{
  "card_name": "short_snake_case_name",
  "question": "The question text?",
  "answers": ["answer1", "answer2", ...]
}

Rules:
- Question type: ${questionType}
- ${questionType === "buttons" ? "Provide exactly 4 answers" : "Provide exactly 2 answers (opposite ends of a spectrum)"}
- Intimacy level: ${intimacyLevel}
- card_name must be snake_case and descriptive
- Add brief narrator personality: a short lead-in, observation, or playful aside (e.g. "Alright, here's a fun one..." or "This one might surprise you...")
- Keep it concise - one short sentence of personality + the core question (max 25 words total)
- Make the question thought-provoking and conversation-starting
${previousList}

No markdown, no explanation, just JSON.`;

  const content = await callMinimax(
    systemPrompt,
    `Generate question ${questionNumber} of ${totalQuestions} for the "${theme}" deck.`
  );

  try {
    const parsed = JSON.parse(content);
    return {
      card_name: parsed.card_name,
      question: parsed.question,
      type: questionType,
      answers: parsed.answers,
    };
  } catch {
    throw new Error(`Failed to parse question JSON: ${content}`);
  }
}

// Generate deck using Minimax API (question by question)
async function generateDeckContent(theme: string, numQuestions: number): Promise<GeneratedDeck> {
  console.log(`\n📝 Generating deck content for theme: "${theme}" with ${numQuestions} questions...`);

  // Step 1: Generate deck name and introduction
  console.log("   Generating deck intro...");
  const intro = await generateDeckIntro(theme);
  console.log(`   ✅ Deck name: "${intro.deck_name}"`);

  // Step 2: Generate each question
  const cards: Card[] = [];
  const previousQuestions: string[] = [];

  for (let i = 1; i <= numQuestions; i++) {
    console.log(`   Generating question ${i}/${numQuestions}...`);
    const card = await generateQuestion(theme, i, numQuestions, previousQuestions);
    cards.push(card);
    previousQuestions.push(card.question);
    console.log(`   ✅ ${card.card_name} (${card.type})`);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const deck: GeneratedDeck = {
    deck_name: intro.deck_name,
    introduction: intro.introduction,
    cards,
  };

  console.log(`\n✅ Generated deck: "${deck.deck_name}" with ${deck.cards.length} questions`);
  return deck;
}

// Generate TTS audio using Hume AI with exponential backoff retry
async function generateAudio(text: string, outputPath: string, voiceId: string): Promise<void> {
  const apiKey = process.env.HUME_API_KEY;
  if (!apiKey) {
    throw new Error("HUME_API_KEY not set in environment");
  }

  const maxRetries = 5;
  let delay = 1000; // Start with 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(HUME_API_URL, {
      method: "POST",
      headers: {
        "X-Hume-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        utterances: [
          {
            text,
            voice: {
              id: voiceId,
            },
          },
        ],
      }),
    });

    // Check for rate limiting (429) or service unavailable (503)
    if (response.status === 429 || response.status === 503) {
      if (attempt < maxRetries) {
        console.log(`   ⚠️  Rate limited (${response.status}), retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
    }

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
    return;
  }

  throw new Error(`Hume TTS API rate limited after ${maxRetries + 1} attempts`);
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
  const { theme, questions, voiceId } = parseArgs();

  console.log("\n🎴 Deck Generator");
  console.log("================");
  console.log(`Theme: ${theme}`);
  console.log(`Questions: ${questions}`);
  console.log(`Voice ID: ${voiceId}`);

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
  console.log(`   [1/${questions + 1}] Introduction...`);
  
  const introAudioFile = "intro.mp3";
  await generateAudio(deck.introduction, path.join(outputDir, introAudioFile), voiceId);
  deck.introAudioFile = introAudioFile;

  // Step 4: Generate audio for each question
  for (let i = 0; i < deck.cards.length; i++) {
    const card = deck.cards[i];
    const audioFile = `q${i + 1}_${card.card_name}.mp3`;
    
    console.log(`   [${i + 2}/${questions + 1}] ${card.card_name}...`);
    
    await generateAudio(card.question, path.join(outputDir, audioFile), voiceId);
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
