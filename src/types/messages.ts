// Client → Server Messages
export type CursorMessage = {
  type: "cursor";
  x: number;
  y: number;
};

export type AnswerMessage = {
  type: "ANSWER";
  questionId: string;
  answerId: string;
};

export type SliderAnswerMessage = {
  type: "SLIDER_ANSWER";
  questionId: string;
  value: number; // 0-100 normalized value
};

export type RevealRequestClientMessage = {
  type: "REVEAL_REQUEST";
  targetId: string;
};

export type TransitionToRevealMessage = {
  type: "TRANSITION_TO_REVEAL";
};

export type ClientMessage = 
  | CursorMessage 
  | AnswerMessage 
  | SliderAnswerMessage
  | RevealRequestClientMessage 
  | TransitionToRevealMessage;

// Server → Client Messages
export type UserInfo = {
  id: string;
  name: string;
  color: string;
};

export type SyncMessage = {
  type: "sync";
  self: string;
  users: UserInfo[];
  answeredBy: Record<string, string[]>;
  phase: "ANSWERING" | "RESULTS" | "REVEAL";
  currentQuestionIndex: number;
};

export type JoinMessage = {
  type: "join";
  id: string;
  name: string;
  color: string;
};

export type LeaveMessage = {
  type: "leave";
  id: string;
};

export type CursorBroadcast = {
  type: "cursor";
  id: string;
  x: number;
  y: number;
  name: string;
  color: string;
};

export type PlayerAnsweredMessage = {
  type: "PLAYER_ANSWERED";
  anonymousName: string;
  questionId: string;
};

export type PhaseChangeMessage = {
  type: "PHASE_CHANGE";
  phase: "ANSWERING" | "RESULTS" | "REVEAL";
};

export type CompatibilityScore = {
  userId: string;
  anonymousName: string;
  score: number; // 0.0 to 1.0
  rank: number; // 1, 2, 3...
};

export type ResultsMessage = {
  type: "RESULTS";
  matches: CompatibilityScore[];
};

export type RevealRequestMessage = {
  type: "REVEAL_REQUEST";
  targetId: string;
};

export type RevealStatusMessage = {
  type: "REVEAL_STATUS";
  targetId: string;
  status: "pending" | "mutual";
  targetName?: string;
  targetColor?: string;
};

export type RevealMutualMessage = {
  type: "REVEAL_MUTUAL";
  userId: string;
  name: string;
  color: string;
};

export type QuestionAdvanceMessage = {
  type: "QUESTION_ADVANCE";
  questionIndex: number;
};

export type ServerMessage =
  | SyncMessage
  | JoinMessage
  | LeaveMessage
  | CursorBroadcast
  | PlayerAnsweredMessage
  | PhaseChangeMessage
  | ResultsMessage
  | RevealStatusMessage
  | RevealMutualMessage
  | QuestionAdvanceMessage;

// Type Guards (validators)
const MAX_ID_LENGTH = 64;

export function isValidAnswerMessage(msg: unknown): msg is AnswerMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === "ANSWER" &&
    typeof m.questionId === "string" &&
    typeof m.answerId === "string" &&
    m.questionId.length > 0 &&
    m.questionId.length <= MAX_ID_LENGTH &&
    m.answerId.length > 0 &&
    m.answerId.length <= MAX_ID_LENGTH
  );
}

export function isValidCursorMessage(msg: unknown): msg is CursorMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === "cursor" &&
    typeof m.x === "number" &&
    typeof m.y === "number" &&
    Number.isFinite(m.x) &&
    Number.isFinite(m.y)
  );
}

export function isValidRevealRequestMessage(msg: unknown): msg is RevealRequestClientMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === "REVEAL_REQUEST" &&
    typeof m.targetId === "string" &&
    m.targetId.length > 0 &&
    m.targetId.length <= MAX_ID_LENGTH
  );
}

export function isValidSliderAnswerMessage(msg: unknown): msg is SliderAnswerMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === "SLIDER_ANSWER" &&
    typeof m.questionId === "string" &&
    typeof m.value === "number" &&
    m.questionId.length > 0 &&
    m.questionId.length <= MAX_ID_LENGTH &&
    Number.isFinite(m.value) &&
    m.value >= 0 &&
    m.value <= 100
  );
}
