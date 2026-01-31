import type * as Party from "partykit/server";
import {
  isValidAnswerMessage,
  isValidCursorMessage,
  isValidRevealRequestMessage,
  isValidSliderAnswerMessage,
  isValidConfigureLobbyMessage,
  isValidTTSRequestMessage,
  isValidPlayerReadyMessage,
  isValidNudgeMessage,
  isValidChatMessageSend,
  isValidChatCloseRequestMessage,
  type SyncMessage,
  type PlayerAnsweredMessage,
  type PhaseChangeMessage,
  type ResultsMessage,
  type CompatibilityScore,
  type RevealStatusMessage,
  type RevealMutualMessage,
  type QuestionAdvanceMessage,
  type DeckGeneratingMessage,
  type DeckReadyMessage,
  type DeckErrorMessage,
  type TTSResponseMessage,
  type NarrativeMessage,
  type ReadyStatusMessage,
  type NudgeStatusMessage,
  type NudgeReceivedMessage,
  type RevealRequestNotificationMessage,
  type ChatStartedMessage,
  type ChatMessageReceive,
  type ChatClosedMessage,
} from "./types/messages";
import { GamePhase, QuestionType, type LobbyConfig, type Question } from "./types/game";
import { getDeck, generateDeck, deckToQuestions } from "./services/deckService";
import { textToSpeech } from "./lib/tts";
import { aggregateNarrativeData, type UserAnswerData, type AnswerWithMeta } from "./services/narrativeService";
import { generateNarrative, generateFallbackNarrative, testMinimaxConnection } from "./lib/narrativeGenerator";

// Name generation
const ADJECTIVES = [
  "Swift", "Cozy", "Bold", "Calm", "Rusty", "Frosty", "Nimble", "Silent",
  "Happy", "Lucky", "Brave", "Wise", "Bright", "Wild", "Gentle", "Quick",
];
const NOUNS = [
  "Panda", "Fox", "Owl", "Wolf", "Bear", "Hawk", "Deer", "Lynx",
  "Moth", "Crow", "Dove", "Seal", "Crab", "Frog", "Ant", "Bee",
];

// Flexoki 200 accent palette – https://github.com/kepano/flexoki
const FLEXOKI_200 = [
  "#F89A8A", /* red-200 */
  "#F9AE77", /* orange-200 */
  "#ECCB60", /* yellow-200 */
  "#BEC97E", /* green-200 */
  "#87D3C3", /* cyan-200 */
  "#92BFDB", /* blue-200 */
  "#C4B9E0", /* purple-200 */
  "#F4A4C2", /* magenta-200 */
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

function randomColor(): string {
  return pick(FLEXOKI_200);
}

// Nudge configuration
const NUDGE_COOLDOWN_MS = 10_000; // 10 seconds per-player cooldown

// Answer value discriminated union to support multiple question types
type AnswerValue = 
  | { type: "choice"; answerId: string }
  | { type: "slider"; value: number };

type UserState = {
  name: string;
  color: string;
  answers: Map<string, AnswerWithMeta>; // questionId → answer with metadata
};

// Abstracted question retrieval function - now uses DeckService
async function getQuestions(config: LobbyConfig | null): Promise<Question[]> {
  if (!config) return [];
  
  if (config.aiTheme) {
    // Generate AI deck
    const deck = await generateDeck(config.aiTheme);
    return deckToQuestions(deck);
  } else if (config.deck) {
    // Get static deck
    const deck = getDeck(config.deck);
    return deck ? deckToQuestions(deck) : [];
  }
  
  return [];
}

export default class GameServer implements Party.Server {
  private users = new Map<string, UserState>();
  private phase: GamePhase = GamePhase.LOBBY;
  private currentQuestionIndex: number = 0;
  private revealRequests = new Map<string, Set<string>>(); // requesterId → Set<targetIds>
  private lobbyConfig: LobbyConfig | null = null;
  private questions: Question[] = [];
  private questionStartTimes = new Map<string, number>(); // questionId → timestamp when shown
  private answerOrderCounters = new Map<string, number>(); // questionId → counter for answer order
  private narrativeInsights: string[] | null = null; // Cached narrative insights
  private narrativeGenerationPromise: Promise<void> | null = null; // Track ongoing narrative generation
  private resultsReadyPlayers = new Set<string>(); // Track who's ready on results screen
  private nudgeCooldowns = new Map<string, Map<string, number>>(); // senderId → (targetId → timestamp)
  private hostId: string | null = null; // Track the host (initiator who configured the lobby)
  
  // Chat session management
  private activeChats = new Map<string, { participants: [string, string]; startedAt: number }>(); // chatId → session
  private chatMessageCounts = new Map<string, Map<string, number>>(); // chatId → (userId → message count)
  private chatMessageTimestamps = new Map<string, Map<string, number>>(); // chatId → (userId → last message timestamp)

  constructor(readonly room: Party.Room) {
    // Validate API key at startup (non-blocking warning)
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      console.warn("[Server] MINIMAX_API_KEY not set - narrative generation will use fallback");
    } else {
      // Test Minimax connection on startup (non-blocking)
      testMinimaxConnection(apiKey).catch((error) => {
        console.warn("[Server] Minimax connection test failed:", error);
      });
    }
  }

  onConnect(connection: Party.Connection, _ctx: Party.ConnectionContext): void {
    // Assign random name and color
    const name = randomName();
    const color = randomColor();
    this.users.set(connection.id, { name, color, answers: new Map() });

    // Broadcast join to others
    this.room.broadcast(
      JSON.stringify({ type: "join", id: connection.id, name, color }),
      [connection.id]
    );

    // Send sync payload to new connection
    const users = [...this.room.getConnections()].map((c) => {
      const u = this.users.get(c.id);
      return {
        id: c.id,
        name: u?.name ?? "Unknown",
        color: u?.color ?? "#999",
      };
    });

    const answeredBy: Record<string, string[]> = {};
    for (const [, u] of this.users) {
      for (const [qId] of u.answers) {
        if (!answeredBy[qId]) answeredBy[qId] = [];
        answeredBy[qId].push(u.name);
      }
    }

    // If in RESULTS or REVEAL phase, send narrative if available or wait for generation
    if (this.phase === GamePhase.RESULTS || this.phase === GamePhase.REVEAL) {
      if (this.narrativeInsights) {
        // Narrative already generated, send immediately
        const narrativeMsg: NarrativeMessage = {
          type: "NARRATIVE",
          insights: this.narrativeInsights,
        };
        connection.send(JSON.stringify(narrativeMsg));
      } else if (this.narrativeGenerationPromise) {
        // Narrative is still being generated, wait for it
        this.narrativeGenerationPromise
          .then(() => {
            if (this.narrativeInsights) {
              const narrativeMsg: NarrativeMessage = {
                type: "NARRATIVE",
                insights: this.narrativeInsights,
              };
              connection.send(JSON.stringify(narrativeMsg));
            }
          })
          .catch((error) => {
            console.error("[Server] Failed to send narrative to late joiner:", error);
          });
      }
    }

    const syncMsg: SyncMessage = {
      type: "sync",
      self: connection.id,
      users,
      answeredBy,
      phase: this.phase,
      currentQuestionIndex: this.currentQuestionIndex,
      lobbyConfig: this.lobbyConfig,
      questions: this.questions,
      hostId: this.hostId,
    };
    connection.send(JSON.stringify(syncMsg));

    // If in RESULTS or REVEAL phase, send appropriate data
    if (this.phase === GamePhase.RESULTS || this.phase === GamePhase.REVEAL) {
      this.sendResultsToConnection(connection);
    }
  }

  onMessage(message: string | ArrayBuffer, sender: Party.Connection): void {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    // Handle cursor updates (broadcast to others)
    if (isValidCursorMessage(payload)) {
      const u = this.users.get(sender.id);
      if (!u) return;
      this.room.broadcast(
        JSON.stringify({
          type: "cursor",
          id: sender.id,
          x: payload.x,
          y: payload.y,
          name: u.name,
          color: u.color,
        }),
        [sender.id]
      );
      return;
    }

    // Handle multiple-choice answer submissions
    if (isValidAnswerMessage(payload)) {
      if (this.phase !== GamePhase.ANSWERING) return;

      const player = this.users.get(sender.id);
      if (!player) return;

      // First answer wins - no changes allowed
      if (player.answers.has(payload.questionId)) return;

      const now = Date.now();
      const questionStartTime = this.questionStartTimes.get(payload.questionId) || now;
      const timeToAnswer = (now - questionStartTime) / 1000; // Convert to seconds
      
      // Increment answer order counter for this question
      const currentOrder = this.answerOrderCounters.get(payload.questionId) || 0;
      const answerOrder = currentOrder + 1;
      this.answerOrderCounters.set(payload.questionId, answerOrder);

      player.answers.set(payload.questionId, {
        value: { type: "choice", answerId: payload.answerId },
        timestamp: now,
        timeToAnswer,
        answerOrder,
      });

      const event: PlayerAnsweredMessage = {
        type: "PLAYER_ANSWERED",
        anonymousName: player.name,
        questionId: payload.questionId,
      };
      this.room.broadcast(JSON.stringify(event));

      // Auto-advance if all players answered current question
      if (this.checkAllAnsweredCurrentQuestion()) {
        this.advanceToNextQuestion();
      }
      return;
    }

    // Handle slider answer submissions
    if (isValidSliderAnswerMessage(payload)) {
      if (this.phase !== GamePhase.ANSWERING) return;

      const player = this.users.get(sender.id);
      if (!player) return;

      // First answer wins - no changes allowed
      if (player.answers.has(payload.questionId)) return;

      const now = Date.now();
      const questionStartTime = this.questionStartTimes.get(payload.questionId) || now;
      const timeToAnswer = (now - questionStartTime) / 1000; // Convert to seconds
      
      // Increment answer order counter for this question
      const currentOrder = this.answerOrderCounters.get(payload.questionId) || 0;
      const answerOrder = currentOrder + 1;
      this.answerOrderCounters.set(payload.questionId, answerOrder);

      player.answers.set(payload.questionId, {
        value: { type: "slider", value: payload.value },
        timestamp: now,
        timeToAnswer,
        answerOrder,
      });

      const event: PlayerAnsweredMessage = {
        type: "PLAYER_ANSWERED",
        anonymousName: player.name,
        questionId: payload.questionId,
      };
      this.room.broadcast(JSON.stringify(event));

      // Auto-advance if all players answered current question
      if (this.checkAllAnsweredCurrentQuestion()) {
        this.advanceToNextQuestion();
      }
      return;
    }

    // Handle TTS request
    if (isValidTTSRequestMessage(payload)) {
      this.handleTTSRequest(payload, sender);
      return;
    }

    // Handle lobby configuration
    if (isValidConfigureLobbyMessage(payload)) {
      if (this.phase !== GamePhase.LOBBY) return;
      // Only allow configuring if not already configured (first one wins)
      if (this.lobbyConfig) return;
      
      // Set hostId to the connection that configured the lobby
      this.hostId = sender.id;
      
      // Handle async deck loading
      this.handleConfigureLobby(payload);
      return;
    }

    if (payload && typeof payload === "object" && "type" in payload) {

      // Handle start game (transition from LOBBY to ANSWERING)
      if (payload.type === "START_GAME") {
        if (this.phase !== GamePhase.LOBBY) return;
        // Only allow host to start the game
        if (this.hostId === null || sender.id !== this.hostId) return;
        const connectedUsers = [...this.room.getConnections()];
        // Require at least 2 players to start
        if (connectedUsers.length < 2) return;
        // Ensure lobby is configured
        if (!this.lobbyConfig) return;
        
        // Clear any previous game state before starting new game
        this.clearGameState();
        
        // Record start time for first question BEFORE phase change to prevent race condition
        const firstQuestion = this.questions[0];
        const questionStartTime = Date.now();
        if (firstQuestion) {
          this.questionStartTimes.set(firstQuestion.id, questionStartTime);
          this.answerOrderCounters.set(firstQuestion.id, 0);
        }
        
        this.phase = GamePhase.ANSWERING;
        this.currentQuestionIndex = 0;
        
        const phaseChange: PhaseChangeMessage = {
          type: "PHASE_CHANGE",
          phase: GamePhase.ANSWERING,
        };
        this.room.broadcast(JSON.stringify(phaseChange));
        return;
      }

      // Handle transition to reveal phase
      if (payload.type === "TRANSITION_TO_REVEAL") {
        if (this.phase === GamePhase.RESULTS) {
          this.transitionToReveal();
        }
        return;
      }

      // Handle player ready for results
      if (isValidPlayerReadyMessage(payload)) {
        if (this.phase === GamePhase.RESULTS) {
          this.resultsReadyPlayers.add(sender.id);
          this.broadcastReadyStatus();
        }
        return;
      }
    }

    // Handle nudge requests
    if (isValidNudgeMessage(payload)) {
      const senderId = sender.id;
      const targetId = payload.targetId;
      
      // Prevent self-nudging
      if (senderId === targetId) {
        const status: NudgeStatusMessage = {
          type: "NUDGE_STATUS",
          targetId,
          success: false,
        };
        sender.send(JSON.stringify(status));
        return;
      }
      
      // Validate target exists
      const target = this.users.get(targetId);
      const senderUser = this.users.get(senderId);
      if (!target || !senderUser) {
        // Send failure status
        const status: NudgeStatusMessage = {
          type: "NUDGE_STATUS",
          targetId,
          success: false,
        };
        sender.send(JSON.stringify(status));
        return;
      }
      
      // Check per-player cooldown
      const now = Date.now();
      const senderCooldowns = this.nudgeCooldowns.get(senderId) || new Map();
      const lastNudge = senderCooldowns.get(targetId) || 0;
      const timeSinceLastNudge = now - lastNudge;
      
      if (timeSinceLastNudge < NUDGE_COOLDOWN_MS) {
        // Still on cooldown - send status to sender
        const cooldownRemaining = Math.ceil((NUDGE_COOLDOWN_MS - timeSinceLastNudge) / 1000);
        const status: NudgeStatusMessage = {
          type: "NUDGE_STATUS",
          targetId,
          success: false,
          cooldownRemaining,
        };
        sender.send(JSON.stringify(status));
        return;
      }
      
      // Update cooldown
      senderCooldowns.set(targetId, now);
      this.nudgeCooldowns.set(senderId, senderCooldowns);
      
      // Send notification to target
      const targetConn = Array.from(this.room.getConnections()).find(c => c.id === targetId);
      if (targetConn) {
        const nudgeReceived: NudgeReceivedMessage = {
          type: "NUDGE_RECEIVED",
          senderId: senderId,
          senderName: senderUser.name,
          senderColor: senderUser.color,
        };
        targetConn.send(JSON.stringify(nudgeReceived));
      }
      
      // Send success status to sender
      const status: NudgeStatusMessage = {
        type: "NUDGE_STATUS",
        targetId,
        success: true,
      };
      sender.send(JSON.stringify(status));
      
      return;
    }

    // Handle reveal requests
    if (isValidRevealRequestMessage(payload)) {
      if (this.phase !== GamePhase.REVEAL) return;

      const requester = this.users.get(sender.id);
      const target = this.users.get(payload.targetId);
      if (!requester || !target) return;

      // Add reveal request
      if (!this.revealRequests.has(sender.id)) {
        this.revealRequests.set(sender.id, new Set());
      }
      this.revealRequests.get(sender.id)!.add(payload.targetId);

      // Send notification to target user
      const targetConnection = [...this.room.getConnections()].find(
        (c) => c.id === payload.targetId
      );
      if (targetConnection) {
        const notification: RevealRequestNotificationMessage = {
          type: "REVEAL_REQUEST_NOTIFICATION",
          requesterId: sender.id,
          requesterName: requester.name,
          requesterColor: requester.color,
        };
        targetConnection.send(JSON.stringify(notification));
      }

      // Check for mutual reveal
      if (this.isMutualReveal(sender.id, payload.targetId)) {
        // Send mutual reveal to both parties
        const requesterReveal: RevealMutualMessage = {
          type: "REVEAL_MUTUAL",
          userId: payload.targetId,
          name: target.name,
          color: target.color,
        };
        sender.send(JSON.stringify(requesterReveal));

        if (targetConnection) {
          const targetReveal: RevealMutualMessage = {
            type: "REVEAL_MUTUAL",
            userId: sender.id,
            name: requester.name,
            color: requester.color,
          };
          targetConnection.send(JSON.stringify(targetReveal));
        }

        // Create chat session
        const chatId = this.getChatId(sender.id, payload.targetId);
        this.createChatSession(chatId, sender.id, payload.targetId);

        // Send CHAT_STARTED to both users
        const requesterChatStart: ChatStartedMessage = {
          type: "CHAT_STARTED",
          chatId,
          partnerId: payload.targetId,
          partnerName: target.name,
          partnerColor: target.color,
        };
        sender.send(JSON.stringify(requesterChatStart));

        if (targetConnection) {
          const targetChatStart: ChatStartedMessage = {
            type: "CHAT_STARTED",
            chatId,
            partnerId: sender.id,
            partnerName: requester.name,
            partnerColor: requester.color,
          };
          targetConnection.send(JSON.stringify(targetChatStart));
        }
      } else {
        // Send pending status
        const status: RevealStatusMessage = {
          type: "REVEAL_STATUS",
          targetId: payload.targetId,
          status: "pending",
        };
        sender.send(JSON.stringify(status));
      }
      return;
    }

    // Handle chat messages
    if (isValidChatMessageSend(payload)) {
      const chatSession = this.activeChats.get(payload.chatId);
      if (!chatSession) return; // Chat doesn't exist

      // Verify sender is a participant
      if (chatSession.participants[0] !== sender.id && chatSession.participants[1] !== sender.id) {
        return; // Not a participant
      }

      // Rate limiting: max 10 messages per 10 seconds per user
      const now = Date.now();
      const userCounts = this.chatMessageCounts.get(payload.chatId) || new Map();
      const userTimestamps = this.chatMessageTimestamps.get(payload.chatId) || new Map();
      
      const userCount = userCounts.get(sender.id) || 0;
      const lastTimestamp = userTimestamps.get(sender.id) || 0;
      
      if (now - lastTimestamp < 10000) {
        // Within 10 second window
        if (userCount >= 10) {
          return; // Rate limited
        }
        userCounts.set(sender.id, userCount + 1);
      } else {
        // New 10 second window
        userCounts.set(sender.id, 1);
      }
      userTimestamps.set(sender.id, now);
      this.chatMessageCounts.set(payload.chatId, userCounts);
      this.chatMessageTimestamps.set(payload.chatId, userTimestamps);

      // Sanitize message (already validated length and non-empty by validator)
      const sanitizedText = payload.text.trim();

      // Find partner
      const partnerId = chatSession.participants[0] === sender.id 
        ? chatSession.participants[1] 
        : chatSession.participants[0];
      
      const partnerConnection = [...this.room.getConnections()].find(
        (c) => c.id === partnerId
      );
      
      const senderUser = this.users.get(sender.id);
      if (!senderUser || !partnerConnection) return;

      // Send message to partner
      const chatMessage: ChatMessageReceive = {
        type: "CHAT_MESSAGE",
        chatId: payload.chatId,
        fromId: sender.id,
        fromName: senderUser.name,
        text: sanitizedText,
        timestamp: now,
      };
      partnerConnection.send(JSON.stringify(chatMessage));
      return;
    }

    // Handle chat close requests
    if (isValidChatCloseRequestMessage(payload)) {
      const chatSession = this.activeChats.get(payload.chatId);
      if (!chatSession) return; // Chat doesn't exist

      // Verify sender is a participant
      if (chatSession.participants[0] !== sender.id && chatSession.participants[1] !== sender.id) {
        return; // Not a participant
      }

      // Close immediately for both participants
      const closedMsg: ChatClosedMessage = {
        type: "CHAT_CLOSED",
        chatId: payload.chatId,
      };
      
      // Send to both participants
      const participant0 = [...this.room.getConnections()].find(
        (c) => c.id === chatSession.participants[0]
      );
      const participant1 = [...this.room.getConnections()].find(
        (c) => c.id === chatSession.participants[1]
      );
      
      if (participant0) participant0.send(JSON.stringify(closedMsg));
      if (participant1) participant1.send(JSON.stringify(closedMsg));

      // Clean up chat session
      this.closeChatSession(payload.chatId);
      return;
    }
  }

  private clearGameState(): void {
    // Clear timing and answer tracking maps
    this.questionStartTimes.clear();
    this.answerOrderCounters.clear();
    // Clear narrative state
    this.narrativeInsights = null;
    this.narrativeGenerationPromise = null;
    // Clear user answers (but keep users for lobby)
    for (const user of this.users.values()) {
      user.answers.clear();
    }
    // Reset question index
    this.currentQuestionIndex = 0;
  }

  private async handleConfigureLobby(payload: { deck?: string; aiTheme?: string }): Promise<void> {
    // Clear previous game state when configuring new lobby
    this.clearGameState();
    
    if (payload.aiTheme) {
      // Generate AI deck
      const generatingMsg: DeckGeneratingMessage = {
        type: "DECK_GENERATING",
        theme: payload.aiTheme,
      };
      this.room.broadcast(JSON.stringify(generatingMsg));
      
      try {
        const deck = await generateDeck(payload.aiTheme);
        this.questions = deckToQuestions(deck);
        this.lobbyConfig = { aiTheme: payload.aiTheme };
        
        const readyMsg: DeckReadyMessage = {
          type: "DECK_READY",
          deckName: deck.deck_name,
          questionCount: this.questions.length,
        };
        this.room.broadcast(JSON.stringify(readyMsg));
      } catch (error) {
        console.error("Failed to generate deck:", error);
        // Reset config on error
        this.lobbyConfig = null;
        this.questions = [];
        
        // Notify clients of the error
        const errorMsg: DeckErrorMessage = {
          type: "DECK_ERROR",
          error: error instanceof Error ? error.message : "Failed to generate deck",
        };
        this.room.broadcast(JSON.stringify(errorMsg));
        return;
      }
    } else if (payload.deck) {
      // Get static deck
      const deck = getDeck(payload.deck);
      if (deck) {
        this.questions = deckToQuestions(deck);
        this.lobbyConfig = { deck: payload.deck };
      } else {
        // Invalid deck name
        this.lobbyConfig = null;
        this.questions = [];
        return;
      }
    }
    
    // Send updated config to all players
    const allUsers = [...this.room.getConnections()].map((c) => {
      const u = this.users.get(c.id);
      return {
        id: c.id,
        name: u?.name ?? "Unknown",
        color: u?.color ?? "#999",
      };
    });
    const answeredBy: Record<string, string[]> = {};
    for (const connection of this.room.getConnections()) {
      const syncMsg: SyncMessage = {
        type: "sync",
        self: connection.id,
        users: allUsers,
        answeredBy,
        phase: this.phase,
        currentQuestionIndex: this.currentQuestionIndex,
        lobbyConfig: this.lobbyConfig,
        questions: this.questions,
        hostId: this.hostId,
      };
      connection.send(JSON.stringify(syncMsg));
    }
  }

  onClose(connection: Party.Connection): void {
    this.leave(connection);
  }

  onError(connection: Party.Connection): void {
    this.leave(connection);
  }

  private leave(connection: Party.Connection): void {
    const userId = connection.id;
    
    // Close any active chats this user is in
    for (const [chatId, session] of this.activeChats.entries()) {
      if (session.participants[0] === userId || session.participants[1] === userId) {
        // Notify partner
        const partnerId = session.participants[0] === userId 
          ? session.participants[1] 
          : session.participants[0];
        
        const partnerConnection = [...this.room.getConnections()].find(
          (c) => c.id === partnerId
        );
        
        if (partnerConnection) {
          const closedMsg: ChatClosedMessage = {
            type: "CHAT_CLOSED",
            chatId,
          };
          partnerConnection.send(JSON.stringify(closedMsg));
        }
        
        // Clean up chat session
        this.closeChatSession(chatId);
      }
    }
    
    this.users.delete(userId);
    this.revealRequests.delete(userId);
    this.nudgeCooldowns.delete(connection.id);
    // Remove this user from other users' reveal request sets
    for (const requests of this.revealRequests.values()) {
      requests.delete(connection.id);
    }
    // Remove from ready players if in RESULTS phase
    const wasReady = this.resultsReadyPlayers.delete(connection.id);
    if (wasReady && this.phase === GamePhase.RESULTS) {
      this.broadcastReadyStatus();
    }
    this.room.broadcast(JSON.stringify({ type: "leave", id: connection.id }));

    // Recalculate if in ANSWERING phase
    if (this.phase === GamePhase.ANSWERING && this.checkAllAnsweredCurrentQuestion()) {
      this.advanceToNextQuestion();
    }
  }

  private checkAllAnsweredCurrentQuestion(): boolean {
    const connectedUsers = [...this.room.getConnections()];

    // Need at least 2 players
    if (connectedUsers.length < 2) return false;

    // Check if we've already answered all questions
    if (this.currentQuestionIndex >= this.questions.length) {
      return false;
    }

    const currentQuestion = this.questions[this.currentQuestionIndex];

    // All users must have answered the current question
    return connectedUsers.every((conn) => {
      const user = this.users.get(conn.id);
      return user && user.answers.has(currentQuestion.id);
    });
  }

  private advanceToNextQuestion(): void {
    this.currentQuestionIndex++;

    // Check if completed all questions
    if (this.currentQuestionIndex >= this.questions.length) {
      this.transitionToResults();
      return;
    }

    // Record start time for the new question
    const currentQuestion = this.questions[this.currentQuestionIndex];
    if (currentQuestion) {
      this.questionStartTimes.set(currentQuestion.id, Date.now());
      this.answerOrderCounters.set(currentQuestion.id, 0);
    }

    // Broadcast question advance
    const advanceMsg: QuestionAdvanceMessage = {
      type: "QUESTION_ADVANCE",
      questionIndex: this.currentQuestionIndex,
    };
    this.room.broadcast(JSON.stringify(advanceMsg));
  }

  private calculateCompatibility(userA: UserState, userB: UserState): number {
    if (userA.answers.size === 0) return 0;

    let totalScore = 0;
    let questionCount = 0;

    for (const [qId, answerMetaA] of userA.answers) {
      const answerMetaB = userB.answers.get(qId);
      if (!answerMetaB) continue;

      const answerA = answerMetaA.value;
      const answerB = answerMetaB.value;

      questionCount++;

      if (answerA.type === "choice" && answerB.type === "choice") {
        // Exact match for multiple choice
        totalScore += answerA.answerId === answerB.answerId ? 1 : 0;
      } else if (answerA.type === "slider" && answerB.type === "slider") {
        // Proximity score for slider: normalize to 0-1 range based on question positions
        // Find the question to get its positions count
        const question = this.questions.find((q) => q.id === qId);
        if (question && question.type === QuestionType.SLIDER) {
          const maxPosition = question.config.positions - 1;
          if (maxPosition > 0) {
            // Normalize both values to 0-1 range for fair comparison
            const normalizedA = answerA.value / maxPosition;
            const normalizedB = answerB.value / maxPosition;
            const diff = Math.abs(normalizedA - normalizedB);
            totalScore += 1 - diff;
          } else {
            // Fallback: exact match if only one position
            totalScore += answerA.value === answerB.value ? 1 : 0;
          }
        } else {
          // Fallback: treat as 0-100 range for backward compatibility
          const diff = Math.abs(answerA.value - answerB.value);
          totalScore += 1 - diff / 100;
        }
      }
      // If answer types don't match (shouldn't happen), count as 0
    }

    return questionCount > 0 ? totalScore / questionCount : 0; // 0.0 to 1.0
  }

  private transitionToResults(): void {
    if (this.phase !== GamePhase.ANSWERING) return;

    this.phase = GamePhase.RESULTS;
    
    // Clear ready players when entering RESULTS phase
    this.resultsReadyPlayers.clear();

    // Broadcast phase change
    const phaseChange: PhaseChangeMessage = {
      type: "PHASE_CHANGE",
      phase: GamePhase.RESULTS,
    };
    this.room.broadcast(JSON.stringify(phaseChange));

    // Send personalized results to each connection
    for (const connection of this.room.getConnections()) {
      this.sendResultsToConnection(connection);
    }

    // Broadcast initial ready status (0 ready)
    this.broadcastReadyStatus();

    // Generate and send narrative (async, non-blocking)
    this.generateAndSendNarrative();
  }

  private async generateAndSendNarrative(): Promise<void> {
    // If already generating, don't start another
    if (this.narrativeGenerationPromise) {
      return;
    }

    this.narrativeGenerationPromise = (async () => {
      try {
        // Validate we have enough data
        if (this.users.size < 2) {
          this.narrativeInsights = [];
          return;
        }
        
        if (this.questions.length === 0) {
          this.narrativeInsights = [];
          return;
        }
        
        // Convert users to UserAnswerData format
        const userAnswerData: UserAnswerData[] = [];
        for (const [userId, userState] of this.users) {
          userAnswerData.push({
            userId,
            name: userState.name,
            answers: userState.answers,
          });
        }

        // Aggregate narrative insights
        const narrativeData = aggregateNarrativeData(userAnswerData, this.questions);
        
        // Validate narrative data
        if (narrativeData.totalPlayers < 2 || narrativeData.totalQuestions === 0) {
          this.narrativeInsights = [];
          return;
        }

        // Generate narrative text using LLM
        let insights: string[];
        try {
          insights = await generateNarrative(narrativeData);
        } catch (llmError) {
          console.error("[Server] LLM API failed, using fallback narrative:", llmError);
          // Generate fallback narrative instead of empty
          insights = generateFallbackNarrative(narrativeData);
        }

        // Cache insights for late joiners
        this.narrativeInsights = insights;

        // Send narrative to all connections
        const narrativeMsg: NarrativeMessage = {
          type: "NARRATIVE",
          insights,
        };
        this.room.broadcast(JSON.stringify(narrativeMsg));
      } catch (error) {
        console.error("[Server] Narrative generation failed:", error instanceof Error ? error.message : String(error));
        
        // Try to generate fallback narrative even on complete failure
        try {
          const fallback = generateFallbackNarrative(aggregateNarrativeData(
            Array.from(this.users.entries()).map(([userId, userState]) => ({
              userId,
              name: userState.name,
              answers: userState.answers,
            })),
            this.questions
          ));
          this.narrativeInsights = fallback;
          const fallbackMsg: NarrativeMessage = {
            type: "NARRATIVE",
            insights: fallback,
          };
          this.room.broadcast(JSON.stringify(fallbackMsg));
        } catch (fallbackError) {
          // Last resort: send empty insights so UI knows to stop loading
          this.narrativeInsights = [];
          const emptyMsg: NarrativeMessage = {
            type: "NARRATIVE",
            insights: [],
          };
          this.room.broadcast(JSON.stringify(emptyMsg));
        }
      } finally {
        // Clear promise so late joiners know generation is complete
        this.narrativeGenerationPromise = null;
      }
    })();

    return this.narrativeGenerationPromise;
  }

  private sendResultsToConnection(connection: Party.Connection): void {
    const user = this.users.get(connection.id);
    if (!user) return;

    const connectedUsers = [...this.room.getConnections()];
    const scores: CompatibilityScore[] = [];

    // Calculate compatibility with all other users
    for (const otherConn of connectedUsers) {
      if (otherConn.id === connection.id) continue;

      const otherUser = this.users.get(otherConn.id);
      if (!otherUser) continue;

      const score = this.calculateCompatibility(user, otherUser);
      scores.push({
        userId: otherConn.id,
        anonymousName: otherUser.name,
        score,
        rank: 0,
      });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Assign ranks
    scores.forEach((score, index) => {
      score.rank = index + 1;
    });

    const resultsMsg: ResultsMessage = {
      type: "RESULTS",
      matches: scores,
    };
    connection.send(JSON.stringify(resultsMsg));
  }

  private isMutualReveal(userA: string, userB: string): boolean {
    return (
      this.revealRequests.get(userA)?.has(userB) === true &&
      this.revealRequests.get(userB)?.has(userA) === true
    );
  }

  private getChatId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('-');
  }

  private createChatSession(chatId: string, userId1: string, userId2: string): void {
    this.activeChats.set(chatId, {
      participants: [userId1, userId2].sort() as [string, string],
      startedAt: Date.now(),
    });
    // Initialize rate limiting maps
    this.chatMessageCounts.set(chatId, new Map());
    this.chatMessageTimestamps.set(chatId, new Map());
  }

  private closeChatSession(chatId: string): void {
    this.activeChats.delete(chatId);
    this.chatMessageCounts.delete(chatId);
    this.chatMessageTimestamps.delete(chatId);
  }

  private async handleTTSRequest(
    payload: { type: string; text: string; requestId: string },
    sender: Party.Connection
  ): Promise<void> {
    // Get voice ID from env or use default
    // Can be either a UUID or a Voice Library name (e.g., "Dacher", "Kora")
    // If using a name, it will be treated as a HUME_AI provider voice
    const voiceId = process.env.HUME_VOICE_ID || "Dacher"; // Default to Dacher voice from Voice Library

    try {
      const { audio, durationMs } = await textToSpeech(payload.text, voiceId);
      
      // Audio is already base64 string
      const audioBase64 = audio;

      const response: TTSResponseMessage = {
        type: "TTS_RESPONSE",
        requestId: payload.requestId,
        audio: audioBase64,
        durationMs,
      };

      // Send response only to the requesting client
      sender.send(JSON.stringify(response));
    } catch (error) {
      console.error("[Server TTS] Error:", error instanceof Error ? error.message : String(error));
      
      const errorResponse: TTSResponseMessage = {
        type: "TTS_RESPONSE",
        requestId: payload.requestId,
        audio: "",
        durationMs: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      sender.send(JSON.stringify(errorResponse));
    }
  }

  transitionToReveal(): void {
    if (this.phase !== GamePhase.RESULTS) return;

    this.phase = GamePhase.REVEAL;

    const phaseChange: PhaseChangeMessage = {
      type: "PHASE_CHANGE",
      phase: GamePhase.REVEAL,
    };
    this.room.broadcast(JSON.stringify(phaseChange));
  }

  private broadcastReadyStatus(): void {
    const readyMsg: ReadyStatusMessage = {
      type: "READY_STATUS",
      readyCount: this.resultsReadyPlayers.size,
      totalPlayers: this.users.size,
      readyUserIds: Array.from(this.resultsReadyPlayers),
    };
    this.room.broadcast(JSON.stringify(readyMsg));
    
    // Auto-advance when 75% ready
    const readyPercentage = this.users.size > 0 
      ? (this.resultsReadyPlayers.size / this.users.size) * 100 
      : 0;
    
    if (readyPercentage >= 75 && this.phase === GamePhase.RESULTS) {
      this.transitionToReveal();
    }
  }
}
