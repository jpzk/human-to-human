export type Answer = {
  id: string;
  text: string;
};

export type Question = {
  id: string;
  text: string;
  answers: Answer[];
};

export enum GamePhase {
  ANSWERING = "ANSWERING",
  RESULTS = "RESULTS",
  REVEAL = "REVEAL",
}

// Example placeholder questions (replace with your game content)
export const PLACEHOLDER_QUESTIONS: Question[] = [
  {
    id: "q1",
    text: "How u feeling right now?",
    answers: [
      { id: "a1", text: "Great!" },
      { id: "a2", text: "Good" },
      { id: "a3", text: "Meh" },
      { id: "a4", text: "Tired" },
    ],
  },
  {
    id: "q2",
    text: "What's your ideal weekend activity?",
    answers: [
      { id: "a1", text: "Adventure outdoors" },
      { id: "a2", text: "Cozy at home" },
      { id: "a3", text: "Socializing with friends" },
      { id: "a4", text: "Learning something new" },
    ],
  },
  {
    id: "q3",
    text: "Pineapple on pizza?",
    answers: [
      { id: "a1", text: "Absolutely yes!" },
      { id: "a2", text: "Hard no" },
      { id: "a3", text: "Never tried it" },
      { id: "a4", text: "Depends on the mood" },
    ],
  },
];
