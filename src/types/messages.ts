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
};

export type StartGameMessage = {
  type: "START_GAME";
};


export type PlayerReadyMessage = {
  type: "PLAYER_READY";
};

export type IntroReadyMessage = {
  type: "INTRO_READY";
};

export type NudgeMessage = {
  type: "NUDGE";
  targetId: string;
};

export type ChatMessageSend = {
  type: "CHAT_MESSAGE";
  chatId: string;
  text: string;
};

export type ChatCloseRequestMessage = {
  type: "CHAT_CLOSE_REQUEST";
  chatId: string;
};

export type ClientMessage = 
  | CursorMessage 
  | AnswerMessage 
  | SliderAnswerMessage
  | RevealRequestClientMessage 
  | TransitionToRevealMessage
  | ConfigureLobbyMessage
  | StartGameMessage
  | PlayerReadyMessage
  | IntroReadyMessage
  | NudgeMessage
  | ChatMessageSend
  | ChatCloseRequestMessage;

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
  phase: "LOBBY" | "INTRO" | "ANSWERING" | "RESULTS" | "REVEAL";
  currentQuestionIndex: number;
  lobbyConfig: LobbyConfig | null;
  questions: Question[];
  hostId: string | null;
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
  phase: "LOBBY" | "INTRO" | "ANSWERING" | "RESULTS" | "REVEAL";
};

export type CompatibilityScore = {
  userId: string;
  anonymousName: string;
  score: number; // 0.0 to 1.0
  rank: number; // 1, 2, 3...
  connectionReason?: string; // AI-generated reason (max 5 words)
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

export type NarrativeMessage = {
  type: "NARRATIVE";
  story: string;  // Cohesive narrative story
};

export type ReadyStatusMessage = {
  type: "READY_STATUS";
  readyCount: number;
  totalPlayers: number;
  readyUserIds: string[];
};

export type IntroReadyStatusMessage = {
  type: "INTRO_READY_STATUS";
  readyCount: number;
  totalPlayers: number;
  readyUserIds: string[];
};

export type NudgeStatusMessage = {
  type: "NUDGE_STATUS";
  targetId: string;
  success: boolean;
  cooldownRemaining?: number; // seconds remaining if on cooldown
};

export type NudgeReceivedMessage = {
  type: "NUDGE_RECEIVED";
  senderId: string;
  senderName: string;
  senderColor: string;
};

export type RevealRequestNotificationMessage = {
  type: "REVEAL_REQUEST_NOTIFICATION";
  requesterId: string;
  requesterName: string;
  requesterColor: string;
};

export type ChatStartedMessage = {
  type: "CHAT_STARTED";
  chatId: string;
  partnerId: string;
  partnerName: string;
  partnerColor: string;
};

export type ChatMessageReceive = {
  type: "CHAT_MESSAGE";
  chatId: string;
  fromId: string;
  fromName: string;
  text: string;
  timestamp: number;
};

export type ChatClosedMessage = {
  type: "CHAT_CLOSED";
  chatId: string;
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
  | NarrativeMessage
  | ReadyStatusMessage
  | IntroReadyStatusMessage
  | NudgeStatusMessage
  | NudgeReceivedMessage
  | RevealRequestNotificationMessage
  | ChatStartedMessage
  | ChatMessageReceive
  | ChatClosedMessage;

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
  
  // Must have deck
  const hasDeck = typeof m.deck === "string" && m.deck.length > 0 && m.deck.length <= MAX_ID_LENGTH;
  
  return hasDeck;
}


export function isValidPlayerReadyMessage(msg: unknown): msg is PlayerReadyMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return m.type === "PLAYER_READY";
}

export function isValidIntroReadyMessage(msg: unknown): msg is IntroReadyMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return m.type === "INTRO_READY";
}

export function isValidNudgeMessage(msg: unknown): msg is NudgeMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === "NUDGE" &&
    typeof m.targetId === "string" &&
    m.targetId.length > 0 &&
    m.targetId.length <= MAX_ID_LENGTH
  );
}

export function isValidChatMessageSend(msg: unknown): msg is ChatMessageSend {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === "CHAT_MESSAGE" &&
    typeof m.chatId === "string" &&
    typeof m.text === "string" &&
    m.chatId.length > 0 &&
    m.chatId.length <= MAX_ID_LENGTH * 2 + 1 && // "userId1-userId2"
    m.text.length > 0 &&
    m.text.length <= 500 && // Max 500 characters
    m.text.trim().length > 0 // Must have non-whitespace content
  );
}

export function isValidChatCloseRequestMessage(msg: unknown): msg is ChatCloseRequestMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === "CHAT_CLOSE_REQUEST" &&
    typeof m.chatId === "string" &&
    m.chatId.length > 0 &&
    m.chatId.length <= MAX_ID_LENGTH * 2 + 1
  );
}
