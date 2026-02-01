import type * as Party from "partykit/server";
import {
  isValidAnswerMessage,
  isValidCursorMessage,
  isValidRevealRequestMessage,
  isValidSliderAnswerMessage,
  isValidConfigureLobbyMessage,
  isValidPlayerReadyMessage,
  isValidIntroReadyMessage,
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
  type NarrativeMessage,
  type ReadyStatusMessage,
  type IntroReadyMessage,
  type IntroReadyStatusMessage,
  type NudgeStatusMessage,
  type NudgeReceivedMessage,
  type RevealRequestNotificationMessage,
  type ChatStartedMessage,
  type ChatMessageReceive,
  type ChatClosedMessage,
} from "./types/messages";
import { GamePhase, QuestionType, type LobbyConfig, type Question } from "./types/game";
import { getDeck, deckToQuestions } from "./services/deckService";
import { aggregateNarrativeData, type UserAnswerData, type AnswerWithMeta } from "./services/narrativeService";
import { generateNarrative, generateFallbackNarrative, testMinimaxConnection } from "./lib/narrativeGenerator";
import { generateConnectionInsights, generateFallbackConnectionInsight } from "./lib/connectionInsightGenerator";

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

// Color conversion utilities for generating unique color variants
function hexToHSL(hex: string): [number, number, number] {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number, s: number, l: number;
  
  l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
      default: h = 0;
    }
  }
  
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  h = h / 360;
  s = s / 100;
  l = l / 100;
  
  let r: number, g: number, b: number;
  
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
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
function getQuestions(config: LobbyConfig | null): Question[] {
  if (!config || !config.deck) return [];
  
  const deck = getDeck(config.deck);
  return deck ? deckToQuestions(deck) : [];
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
  private narrativeStory: string | null = null; // Cached narrative story
  private narrativeGenerationPromise: Promise<void> | null = null; // Track ongoing narrative generation
  private resultsReadyPlayers = new Set<string>(); // Track who's ready on results screen
  private introReadyPlayers = new Set<string>(); // Track who's ready on intro screen
  private connectionInsights: Map<string, Map<string, string>> = new Map(); // userId → (otherUserId → reason)
  private connectionInsightsGenerationPromise: Promise<void> | null = null; // Track ongoing connection insights generation
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

  /**
   * Gets a unique color for a new player.
   * Prioritizes unused colors from the base FLEXOKI_200 palette to maintain theme consistency.
   * When all base colors are taken, generates variants by rotating hue while preserving saturation and lightness.
   * Guarantees no duplicate colors by checking against all currently used colors.
   */
  private getUniqueColor(): string {
    // Get all currently used colors
    const usedColors = new Set<string>();
    for (const user of this.users.values()) {
      usedColors.add(user.color);
    }

    // First, try to use an unused color from the base palette (preserves original theme)
    for (const baseColor of FLEXOKI_200) {
      if (!usedColors.has(baseColor)) {
        return baseColor;
      }
    }

    // All base colors are taken - generate a variant
    // Use the number of users to determine which base color to vary and how much
    const userCount = this.users.size;
    const baseColorIndex = userCount % FLEXOKI_200.length;
    let variantIndex = Math.floor(userCount / FLEXOKI_200.length);
    const baseColor = FLEXOKI_200[baseColorIndex];
    
    // Rotate hue by 30° increments for each variant
    // Keep generating variants until we find one that's not in use (ensures no duplicates)
    let variantColor: string;
    do {
      const [h, s, l] = hexToHSL(baseColor);
      const hueRotation = variantIndex * 30;
      const newHue = (h + hueRotation) % 360;
      variantColor = hslToHex(newHue, s, l);
      variantIndex++;
    } while (usedColors.has(variantColor));
    
    return variantColor;
  }

  onConnect(connection: Party.Connection, _ctx: Party.ConnectionContext): void {
    // Assign random name and unique color
    const name = randomName();
    const color = this.getUniqueColor();
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
      if (this.narrativeStory) {
        // Narrative already generated, send immediately
        const narrativeMsg: NarrativeMessage = {
          type: "NARRATIVE",
          story: this.narrativeStory,
        };
        connection.send(JSON.stringify(narrativeMsg));
      } else if (this.narrativeGenerationPromise) {
        // Narrative is still being generated, wait for it
        this.narrativeGenerationPromise
          .then(() => {
            if (this.narrativeStory) {
              const narrativeMsg: NarrativeMessage = {
                type: "NARRATIVE",
                story: this.narrativeStory,
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
        
        // Transition to INTRO phase (will transition to ANSWERING when 75% ready)
        this.phase = GamePhase.INTRO;
        this.introReadyPlayers.clear();
        
        const phaseChange: PhaseChangeMessage = {
          type: "PHASE_CHANGE",
          phase: GamePhase.INTRO as "INTRO",
        };
        this.room.broadcast(JSON.stringify(phaseChange));
        
        // Broadcast initial intro ready status
        this.broadcastIntroReadyStatus();
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

      // Handle intro ready
      if (isValidIntroReadyMessage(payload)) {
        if (this.phase === GamePhase.INTRO) {
          this.introReadyPlayers.add(sender.id);
          this.broadcastIntroReadyStatus();
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
        // Calculate chatId first to check for existing chat
        const chatId = this.getChatId(sender.id, payload.targetId);
        
        // Check if chat already exists (idempotency guard to prevent race condition)
        if (this.activeChats.has(chatId)) {
          // Chat already created by concurrent handler, skip duplicate processing
          return;
        }

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

        // Create chat session (now protected from race condition)
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
    this.narrativeStory = null;
    // Clear ready players sets
    this.resultsReadyPlayers.clear();
    this.introReadyPlayers.clear();
    this.narrativeGenerationPromise = null;
    // Clear user answers (but keep users for lobby)
    for (const user of this.users.values()) {
      user.answers.clear();
    }
    // Reset question index
    this.currentQuestionIndex = 0;
  }

  private handleConfigureLobby(payload: { deck?: string }): void {
    // Clear previous game state when configuring new lobby
    this.clearGameState();
    
    if (payload.deck) {
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

    // Generate connection insights (async, non-blocking)
    this.generateConnectionInsights().catch(err => {
      console.error("[Server] Failed to generate connection insights:", err);
    });
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
          console.warn("[Server] Not enough users for narrative generation:", this.users.size);
          this.narrativeStory = "";
          const emptyMsg: NarrativeMessage = { type: "NARRATIVE", story: "" };
          this.room.broadcast(JSON.stringify(emptyMsg));
          return;
        }
        
        if (this.questions.length === 0) {
          console.warn("[Server] No questions for narrative generation");
          this.narrativeStory = "";
          const emptyMsg: NarrativeMessage = { type: "NARRATIVE", story: "" };
          this.room.broadcast(JSON.stringify(emptyMsg));
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

        // Aggregate narrative data
        const narrativeData = aggregateNarrativeData(userAnswerData, this.questions);
        
        // Validate narrative data
        if (narrativeData.totalPlayers < 2 || narrativeData.totalQuestions === 0) {
          console.warn("[Server] Invalid narrative data:", narrativeData.totalPlayers, "players,", narrativeData.totalQuestions, "questions");
          this.narrativeStory = "";
          const emptyMsg: NarrativeMessage = { type: "NARRATIVE", story: "" };
          this.room.broadcast(JSON.stringify(emptyMsg));
          return;
        }

        // Generate narrative story using LLM
        let story: string;
        try {
          story = await generateNarrative(narrativeData);
          console.log("[Server] Generated story length:", story.length);
          console.log("[Server] Story starts with:", story.substring(0, 50));
        } catch (llmError) {
          console.error("[Server] LLM API failed, using fallback narrative:", llmError);
          // Generate fallback narrative instead of empty
          story = generateFallbackNarrative(narrativeData);
          console.log("[Server] Fallback story length:", story.length);
          console.log("[Server] Fallback story starts with:", story.substring(0, 50));
        }

        // Cache story for late joiners
        this.narrativeStory = story;

        // Send narrative to all connections
        const narrativeMsg: NarrativeMessage = {
          type: "NARRATIVE",
          story,
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
          this.narrativeStory = fallback;
          const fallbackMsg: NarrativeMessage = {
            type: "NARRATIVE",
            story: fallback,
          };
          this.room.broadcast(JSON.stringify(fallbackMsg));
        } catch (fallbackError) {
          // Last resort: send empty story so UI knows to stop loading
          this.narrativeStory = "";
          const emptyMsg: NarrativeMessage = {
            type: "NARRATIVE",
            story: "",
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

  private getConnectionInsight(userId: string, otherUserId: string): string | undefined {
    return this.connectionInsights.get(userId)?.get(otherUserId);
  }

  private async generateConnectionInsights(): Promise<void> {
    // If already generating, don't start another
    if (this.connectionInsightsGenerationPromise) {
      return;
    }

    this.connectionInsightsGenerationPromise = (async () => {
      try {
        // Validate we have enough data
        if (this.users.size < 2) {
          return;
        }
        
        if (this.questions.length === 0) {
          return;
        }

        const connectedUsers = [...this.room.getConnections()];
        const pairs: Array<{
          userAId: string;
          userBId: string;
          userAName: string;
          userBName: string;
          score: number;
          agreements: string[];
          differences: string[];
        }> = [];

        // Collect all pairs with their agreements/differences
        for (let i = 0; i < connectedUsers.length; i++) {
          const userAConn = connectedUsers[i];
          const userA = this.users.get(userAConn.id);
          if (!userA) continue;

          for (let j = i + 1; j < connectedUsers.length; j++) {
            const userBConn = connectedUsers[j];
            const userB = this.users.get(userBConn.id);
            if (!userB) continue;

            const score = this.calculateCompatibility(userA, userB);
            const agreements: string[] = [];
            const differences: string[] = [];

            // Analyze agreements and differences
            for (const [qId, answerMetaA] of userA.answers) {
              const answerMetaB = userB.answers.get(qId);
              if (!answerMetaB) continue;

              const question = this.questions.find((q) => q.id === qId);
              if (!question) continue;

              const answerA = answerMetaA.value;
              const answerB = answerMetaB.value;

              let isAgreement = false;
              if (answerA.type === "choice" && answerB.type === "choice") {
                isAgreement = answerA.answerId === answerB.answerId;
              } else if (answerA.type === "slider" && answerB.type === "slider") {
                // Consider agreement if within 20% of range (already have question from line 1066)
                if (question.type === QuestionType.SLIDER) {
                  const maxPosition = question.config.positions - 1;
                  if (maxPosition > 0) {
                    const normalizedA = answerA.value / maxPosition;
                    const normalizedB = answerB.value / maxPosition;
                    const diff = Math.abs(normalizedA - normalizedB);
                    isAgreement = diff <= 0.2;
                  } else {
                    isAgreement = answerA.value === answerB.value;
                  }
                }
              }

              if (isAgreement) {
                agreements.push(question.text);
              } else {
                differences.push(question.text);
              }
            }

            // Generate insights for all pairs (batch API call)
            pairs.push({
              userAId: userAConn.id,
              userBId: userBConn.id,
              userAName: userA.name,
              userBName: userB.name,
              score,
              agreements: agreements.slice(0, 3), // Limit to top 3 agreements
              differences: differences.slice(0, 2), // Limit to top 2 differences
            });
          }
        }

        if (pairs.length === 0) {
          return;
        }

        // Generate insights using LLM
        let insightsMap: Map<string, string>;
        try {
          insightsMap = await generateConnectionInsights(pairs);
        } catch (llmError) {
          console.error("[Server] Connection insights LLM API failed, using fallback:", llmError);
          // Use fallback for all pairs
          insightsMap = new Map();
          for (const pair of pairs) {
            const key = `${pair.userAName}-${pair.userBName}`;
            insightsMap.set(key, generateFallbackConnectionInsight(pair.score));
          }
        }

        // Store insights in both directions (A→B and B→A)
        for (const pair of pairs) {
          const key = `${pair.userAName}-${pair.userBName}`;
          const reason = insightsMap.get(key) || generateFallbackConnectionInsight(pair.score);

          // Store A→B
          if (!this.connectionInsights.has(pair.userAId)) {
            this.connectionInsights.set(pair.userAId, new Map());
          }
          this.connectionInsights.get(pair.userAId)!.set(pair.userBId, reason);

          // Store B→A (same reason)
          if (!this.connectionInsights.has(pair.userBId)) {
            this.connectionInsights.set(pair.userBId, new Map());
          }
          this.connectionInsights.get(pair.userBId)!.set(pair.userAId, reason);
        }

        // Re-send results to all connections with updated connection reasons
        // Only if we're still in RESULTS or REVEAL phase
        if (this.phase === GamePhase.RESULTS || this.phase === GamePhase.REVEAL) {
          for (const connection of this.room.getConnections()) {
            this.sendResultsToConnection(connection);
          }
        }
      } catch (error) {
        console.error("[Server] Connection insights generation failed:", error instanceof Error ? error.message : String(error));
      } finally {
        // Clear promise so late joiners know generation is complete
        this.connectionInsightsGenerationPromise = null;
      }
    })();

    return this.connectionInsightsGenerationPromise;
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
        connectionReason: this.getConnectionInsight(connection.id, otherConn.id),
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

  private broadcastIntroReadyStatus(): void {
    const readyMsg: IntroReadyStatusMessage = {
      type: "INTRO_READY_STATUS",
      readyCount: this.introReadyPlayers.size,
      totalPlayers: this.users.size,
      readyUserIds: Array.from(this.introReadyPlayers),
    };
    this.room.broadcast(JSON.stringify(readyMsg));
    
    // Auto-advance when 75% ready
    const readyPercentage = this.users.size > 0 
      ? (this.introReadyPlayers.size / this.users.size) * 100 
      : 0;
    
    if (readyPercentage >= 75 && this.phase === GamePhase.INTRO) {
      this.transitionToAnswering();
    }
  }

  private transitionToAnswering(): void {
    this.phase = GamePhase.ANSWERING;
    this.currentQuestionIndex = 0;
    this.introReadyPlayers.clear();
    
    // Record start time for first question
    const firstQuestion = this.questions[0];
    if (firstQuestion) {
      this.questionStartTimes.set(firstQuestion.id, Date.now());
      this.answerOrderCounters.set(firstQuestion.id, 0);
    }
    
    const phaseChange: PhaseChangeMessage = {
      type: "PHASE_CHANGE",
      phase: GamePhase.ANSWERING,
    };
    this.room.broadcast(JSON.stringify(phaseChange));
  }
}
