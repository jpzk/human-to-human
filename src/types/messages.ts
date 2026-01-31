import type { Question, LobbyConfig } from "./game";

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

export type ConfigureLobbyMessage = {
  type: "CONFIGURE_LOBBY";
  deck?: string;
  aiTheme?: string;
};

export type StartGameMessage = {
  type: "START_GAME";
};

export type TTSRequestMessage = {
  type: "TTS_REQUEST";
  text: string;
  requestId: string;
};

export type PlayerReadyMessage = {
  type: "PLAYER_READY";
};

export type ClientMessage = 
  | CursorMessage 
  | AnswerMessage 
  | SliderAnswerMessage
  | RevealRequestClientMessage 
  | TransitionToRevealMessage
  | ConfigureLobbyMessage
  | StartGameMessage
  | TTSRequestMessage
  | PlayerReadyMessage;

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
  phase: "LOBBY" | "ANSWERING" | "RESULTS" | "REVEAL";
  currentQuestionIndex: number;
  lobbyConfig: LobbyConfig | null;
  questions: Question[];
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
  phase: "LOBBY" | "ANSWERING" | "RESULTS" | "REVEAL";
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

export type DeckGeneratingMessage = {
  type: "DECK_GENERATING";
  theme: string;
};

export type DeckReadyMessage = {
  type: "DECK_READY";
  deckName: string;
  questionCount: number;
};

export type TTSResponseMessage = {
  type: "TTS_RESPONSE";
  requestId: string;
  audio: string;      // base64 encoded audio
  durationMs: number;
  error?: string;
};

export type NarrativeMessage = {
  type: "NARRATIVE";
  insights: string[];  // Array of narrative strings
};

export type ReadyStatusMessage = {
  type: "READY_STATUS";
  readyCount: number;
  totalPlayers: number;
  readyUserIds: string[];
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
  | QuestionAdvanceMessage
  | DeckGeneratingMessage
  | DeckReadyMessage
  | TTSResponseMessage
  | NarrativeMessage
  | ReadyStatusMessage;

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

export function isValidConfigureLobbyMessage(msg: unknown): msg is ConfigureLobbyMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (m.type !== "CONFIGURE_LOBBY") return false;
  
  // Must have either deck or aiTheme, but not both
  const hasDeck = typeof m.deck === "string" && m.deck.length > 0 && m.deck.length <= MAX_ID_LENGTH;
  const hasAiTheme = typeof m.aiTheme === "string" && m.aiTheme.length > 0 && m.aiTheme.length <= 200;
  
  return (hasDeck || hasAiTheme) && !(hasDeck && hasAiTheme);
}

export function isValidTTSRequestMessage(msg: unknown): msg is TTSRequestMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === "TTS_REQUEST" &&
    typeof m.text === "string" &&
    typeof m.requestId === "string" &&
    m.text.length > 0 &&
    m.text.length <= 1000 && // Reasonable limit for TTS
    m.requestId.length > 0 &&
    m.requestId.length <= MAX_ID_LENGTH
  );
}

export function isValidPlayerReadyMessage(msg: unknown): msg is PlayerReadyMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return m.type === "PLAYER_READY";
}
