import { Deck, getDecks } from "./decks";

const MINIMAX_API_URL = "https://api.minimax.chat/v1/text/chatcompletion_v2";

interface MinimaxMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface MinimaxResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const SYSTEM_PROMPT = `You are a deck generator for a social connection game. Generate question decks that help people get to know each other better.

Each deck must follow this exact JSON format:
{
  "deck_name": "deck name here",
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
- Each deck has exactly 5 cards
- "buttons" type cards have exactly 4 answers
- "slider" type cards have exactly 2 answers (representing opposite ends of a spectrum)
- Mix button and slider types (roughly 3 buttons, 2 sliders)
- Questions should be thought-provoking but not too personal
- card_name should be snake_case and descriptive

Return ONLY valid JSON, no markdown or explanation.`;

export async function generateDeck(
  theme: string,
  apiKey?: string
): Promise<Deck> {
  const key = apiKey ?? process.env.MINIMAX_API_KEY;

  if (!key) {
    throw new Error(
      "Minimax API key is required. Set MINIMAX_API_KEY env var or pass apiKey parameter."
    );
  }

  const exampleDeck = getDecks()[0];

  const messages: MinimaxMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Here's an example deck for reference:\n${JSON.stringify(exampleDeck, null, 2)}\n\nNow generate a new deck with the theme: "${theme}"`,
    },
  ];

  const response = await fetch(MINIMAX_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "MiniMax-Text-01",
      messages,
      temperature: 0.7,
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
    const deck: Deck = JSON.parse(content);
    return deck;
  } catch {
    throw new Error(`Failed to parse deck JSON: ${content}`);
  }
}
