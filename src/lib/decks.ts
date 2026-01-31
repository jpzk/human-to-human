export interface ButtonCard {
  card_name: string;
  question: string;
  type: "buttons";
  answers: [string, string, string, string];
}

export interface SliderCard {
  card_name: string;
  question: string;
  type: "slider";
  answers: [string, string];
}

export type Card = ButtonCard | SliderCard;

export interface Deck {
  deck_name: string;
  cards: Card[];
}

const decks: Deck[] = [
  {
    deck_name: "(not yet) friends",
    cards: [
      {
        card_name: "happiness",
        question: "What makes you happy in life?",
        type: "buttons",
        answers: [
          "Time with friends",
          "Working on my goals",
          "Good food",
          "Seeing new places",
        ],
      },
      {
        card_name: "focus_strengths_vs_weaknesses",
        question: "I tend to focus on my...",
        type: "slider",
        answers: ["Weaknesses", "Strengths"],
      },
      {
        card_name: "inspiration",
        question: "Where do you get inspiration from?",
        type: "buttons",
        answers: [
          "Other humans",
          "Time in Nature",
          "My hobbies",
          "Beautiful things",
        ],
      },
      {
        card_name: "past_vs_future",
        question: "I tend to...",
        type: "slider",
        answers: ["Reflect on the past", "Envision the future"],
      },
      {
        card_name: "fear",
        question: "What are you most scared of?",
        type: "buttons",
        answers: [
          "Public speaking",
          "Asking someone for a date",
          "Making big life decisions",
          "Admitting a mistake",
        ],
      },
    ],
  },
];

export function getDecks(): Deck[] {
  return decks;
}

export function getDeck(deckName: string): Deck | undefined {
  return decks.find((d) => d.deck_name === deckName);
}
