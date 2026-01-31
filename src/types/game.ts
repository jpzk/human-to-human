export type Answer = {
  id: string;
  text: string;
};

// Question type discriminator for polymorphic question system
export enum QuestionType {
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  SLIDER = "SLIDER",
  // Future: DRAG_AND_DROP = "DRAG_AND_DROP"
}

// Slider configuration for categorical sliders with discrete snapping
export type SliderConfig = {
  positions: number;                    // Number of snap positions (e.g., 5 or 6)
  labels: string[];                     // Full labels array (one per position)
  labelStyle?: "all" | "edges";         // "all" = show all, "edges" = first/last only (default: "all")
};

// Base question properties shared by all question types
type BaseQuestion = {
  id: string;
  text: string;
};

// Multiple choice question with discrete answer options
export type MultipleChoiceQuestion = BaseQuestion & {
  type: QuestionType.MULTIPLE_CHOICE;
  answers: Answer[];
};

// Slider question with categorical snapping positions
export type SliderQuestion = BaseQuestion & {
  type: QuestionType.SLIDER;
  config: SliderConfig;
};

// Discriminated union of all question types
export type Question = MultipleChoiceQuestion | SliderQuestion;

export enum GamePhase {
  ANSWERING = "ANSWERING",
  RESULTS = "RESULTS",
  REVEAL = "REVEAL",
}

// Example placeholder questions (replace with your game content)
export const PLACEHOLDER_QUESTIONS: Question[] = [
  {
    id: "q1",
    type: QuestionType.MULTIPLE_CHOICE,
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
    type: QuestionType.SLIDER,
    text: "How adventurous are you?",
    config: {
      positions: 5,
      labels: ["Not at all", "A little", "Somewhat", "Very", "Extremely"],
      labelStyle: "all",
    },
  },
  {
    id: "q3",
    type: QuestionType.MULTIPLE_CHOICE,
    text: "What's your ideal weekend activity?",
    answers: [
      { id: "a1", text: "Adventure outdoors" },
      { id: "a2", text: "Cozy at home" },
      { id: "a3", text: "Socializing with friends" },
      { id: "a4", text: "Learning something new" },
    ],
  },
  {
    id: "q4",
    type: QuestionType.SLIDER,
    text: "Do you prefer planning or spontaneity?",
    config: {
      positions: 5,
      labels: ["Strict planner", "Mostly plan", "Balanced", "Mostly spontaneous", "Fully spontaneous"],
      labelStyle: "all",
    },
  },
  {
    id: "q6",
    type: QuestionType.SLIDER,
    text: "Do you tend to be stuck in the past or future?",
    config: {
      positions: 6,
      labels: ["Past", "", "", "", "", "Future"],
      labelStyle: "edges",
    },
  },
  {
    id: "q5",
    type: QuestionType.MULTIPLE_CHOICE,
    text: "Pineapple on pizza?",
    answers: [
      { id: "a1", text: "Absolutely yes!" },
      { id: "a2", text: "Hard no" },
      { id: "a3", text: "Never tried it" },
      { id: "a4", text: "Depends on the mood" },
    ],
  },
];
