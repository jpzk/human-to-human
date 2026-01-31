import type * as Party from "partykit/server";
import {
  isValidAnswerMessage,
  isValidCursorMessage,
  isValidRevealRequestMessage,
  type SyncMessage,
  type PlayerAnsweredMessage,
  type PhaseChangeMessage,
  type ResultsMessage,
  type CompatibilityScore,
  type RevealStatusMessage,
  type RevealMutualMessage,
  type QuestionAdvanceMessage,
} from "./types/messages";
import { GamePhase, PLACEHOLDER_QUESTIONS } from "./types/game";

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

type UserState = {
  name: string;
  color: string;
  answers: Map<string, string>; // questionId → answerId
};

export default class GameServer implements Party.Server {
  private users = new Map<string, UserState>();
  private phase: GamePhase = GamePhase.ANSWERING;
  private currentQuestionIndex: number = 0;
  private revealRequests = new Map<string, Set<string>>(); // requesterId → Set<targetIds>

  constructor(readonly room: Party.Room) {}

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

    const syncMsg: SyncMessage = {
      type: "sync",
      self: connection.id,
      users,
      answeredBy,
      phase: this.phase,
      currentQuestionIndex: this.currentQuestionIndex,
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

    // Handle answer submissions
    if (isValidAnswerMessage(payload)) {
      if (this.phase !== GamePhase.ANSWERING) return;

      const player = this.users.get(sender.id);
      if (!player) return;

      player.answers.set(payload.questionId, payload.answerId);

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

    // Handle transition to reveal phase
    if (payload && typeof payload === "object" && "type" in payload) {
      if (payload.type === "TRANSITION_TO_REVEAL") {
        if (this.phase === GamePhase.RESULTS) {
          this.transitionToReveal();
        }
        return;
      }
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

        const targetConnection = [...this.room.getConnections()].find(
          (c) => c.id === payload.targetId
        );
        if (targetConnection) {
          const targetReveal: RevealMutualMessage = {
            type: "REVEAL_MUTUAL",
            userId: sender.id,
            name: requester.name,
            color: requester.color,
          };
          targetConnection.send(JSON.stringify(targetReveal));
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
  }

  onClose(connection: Party.Connection): void {
    this.leave(connection);
  }

  onError(connection: Party.Connection): void {
    this.leave(connection);
  }

  private leave(connection: Party.Connection): void {
    this.users.delete(connection.id);
    this.revealRequests.delete(connection.id);
    // Remove this user from other users' reveal request sets
    for (const requests of this.revealRequests.values()) {
      requests.delete(connection.id);
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
    if (this.currentQuestionIndex >= PLACEHOLDER_QUESTIONS.length) {
      return false;
    }

    const currentQuestion = PLACEHOLDER_QUESTIONS[this.currentQuestionIndex];

    // All users must have answered the current question
    return connectedUsers.every((conn) => {
      const user = this.users.get(conn.id);
      return user && user.answers.has(currentQuestion.id);
    });
  }

  private advanceToNextQuestion(): void {
    this.currentQuestionIndex++;

    // Check if completed all questions
    if (this.currentQuestionIndex >= PLACEHOLDER_QUESTIONS.length) {
      this.transitionToResults();
      return;
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

    let matches = 0;
    for (const [qId, answerA] of userA.answers) {
      if (userB.answers.get(qId) === answerA) {
        matches++;
      }
    }
    return matches / userA.answers.size; // 0.0 to 1.0
  }

  private transitionToResults(): void {
    if (this.phase !== GamePhase.ANSWERING) return;

    this.phase = GamePhase.RESULTS;

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

  transitionToReveal(): void {
    if (this.phase !== GamePhase.RESULTS) return;

    this.phase = GamePhase.REVEAL;

    const phaseChange: PhaseChangeMessage = {
      type: "PHASE_CHANGE",
      phase: GamePhase.REVEAL,
    };
    this.room.broadcast(JSON.stringify(phaseChange));
  }
}
