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
  LOBBY = "LOBBY",      // NEW: Waiting for players
  ANSWERING = "ANSWERING",
  RESULTS = "RESULTS",
  REVEAL = "REVEAL",
}

export type LobbyConfig = {
  deck?: string;      // Static deck name
  aiTheme?: string;   // OR AI generation theme
};
