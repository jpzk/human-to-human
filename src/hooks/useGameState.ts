import { useState, useCallback } from "react";
import { GamePhase, type LobbyConfig, type Question } from "@/types/game";
import type {
  ServerMessage,
  CompatibilityScore,
  SyncMessage,
  PhaseChangeMessage,
  ResultsMessage,
  RevealMutualMessage,
  QuestionAdvanceMessage,
  DeckGeneratingMessage,
  DeckReadyMessage,
  NarrativeMessage,
} from "@/types/messages";

type User = { 
  name: string; 
  color: string; 
  x: number | null; 
  y: number | null;
  velocity: number; // normalized 0-1
};

const MAX_DISTANCE = 150; // pixels at 30fps for fast movement

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function calculateVelocity(
  prevX: number | null,
  prevY: number | null,
  currX: number,
  currY: number
): number {
  if (prevX === null || prevY === null) return 0;
  const dx = currX - prevX;
  const dy = currY - prevY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const normalized = distance / MAX_DISTANCE;
  return clamp(normalized, 0, 1);
}

export function useGameState() {
  const [users, setUsers] = useState<Record<string, User>>({});
  const [myId, setMyId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answeredBy, setAnsweredBy] = useState<Record<string, string[]>>({});
  const [phase, setPhase] = useState<GamePhase>(GamePhase.LOBBY);
  const [results, setResults] = useState<CompatibilityScore[]>([]);
  const [revealedUsers, setRevealedUsers] = useState<
    Map<string, { userId: string; name: string; color: string }>
  >(new Map());
  const [lobbyConfig, setLobbyConfig] = useState<LobbyConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isGeneratingDeck, setIsGeneratingDeck] = useState(false);
  const [narrativeInsights, setNarrativeInsights] = useState<string[]>([]);

  const handleMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === "sync") {
      const syncMsg = msg as SyncMessage;
      setMyId(syncMsg.self ?? null);
      if (syncMsg.answeredBy) setAnsweredBy(syncMsg.answeredBy);
      if (syncMsg.phase) setPhase(syncMsg.phase as GamePhase);
      if (typeof syncMsg.currentQuestionIndex === "number") {
        setCurrentQuestionIndex(syncMsg.currentQuestionIndex);
      }
      if (syncMsg.lobbyConfig !== undefined) {
        setLobbyConfig(syncMsg.lobbyConfig);
      }
      if (syncMsg.questions) {
        setQuestions(syncMsg.questions);
      }
      const map: Record<string, User> = {};
      for (const u of syncMsg.users ?? []) {
        map[u.id] = { name: u.name, color: u.color, x: null, y: null, velocity: 0 };
      }
      setUsers(map);
      setResults([]);
      setRevealedUsers(new Map());
      setIsGeneratingDeck(false);
      setNarrativeInsights([]);
      return;
    }

    if (msg.type === "DECK_GENERATING") {
      const generatingMsg = msg as DeckGeneratingMessage;
      setIsGeneratingDeck(true);
      return;
    }

    if (msg.type === "DECK_READY") {
      const readyMsg = msg as DeckReadyMessage;
      setIsGeneratingDeck(false);
      return;
    }

    if (msg.type === "PHASE_CHANGE") {
      const phaseMsg = msg as PhaseChangeMessage;
      setPhase(phaseMsg.phase as GamePhase);
      return;
    }

    if (msg.type === "QUESTION_ADVANCE") {
      const advanceMsg = msg as QuestionAdvanceMessage;
      setCurrentQuestionIndex(advanceMsg.questionIndex);
      return;
    }

    if (msg.type === "RESULTS") {
      const resultsMsg = msg as ResultsMessage;
      setResults(resultsMsg.matches ?? []);
      return;
    }

    if (msg.type === "NARRATIVE") {
      const narrativeMsg = msg as NarrativeMessage;
      const insights = narrativeMsg.insights ?? [];
      console.log("[useGameState] Narrative received:", insights.length, "insights");
      if (insights.length > 0) {
        console.log("[useGameState] Narrative insights:", insights);
      } else {
        console.warn("[useGameState] Empty narrative insights received");
      }
      setNarrativeInsights(insights);
      return;
    }

    if (msg.type === "REVEAL_MUTUAL") {
      const revealMsg = msg as RevealMutualMessage;
      setRevealedUsers((prev) => {
        const next = new Map(prev);
        next.set(revealMsg.userId, {
          userId: revealMsg.userId,
          name: revealMsg.name,
          color: revealMsg.color,
        });
        return next;
      });
      return;
    }

    if (msg.type === "PLAYER_ANSWERED") {
      setAnsweredBy((prev) => {
        const qId = msg.questionId as string;
        const name = msg.anonymousName as string;
        const list = prev[qId] ?? [];
        if (list.includes(name)) return prev;
        return { ...prev, [qId]: [...list, name] };
      });
      return;
    }

    // Handle user join/leave/cursor updates
    if (msg.type === "join" || msg.type === "leave" || msg.type === "cursor") {
      setUsers((prev) => {
        const next = { ...prev };
        if (msg.type === "join") {
          next[msg.id] = { name: msg.name, color: msg.color, x: null, y: null, velocity: 0 };
          return next;
        }
        if (msg.type === "leave") {
          delete next[msg.id];
          return next;
        }
        if (msg.type === "cursor" && next[msg.id]) {
          const prev = next[msg.id];
          const velocity = calculateVelocity(prev.x, prev.y, msg.x, msg.y);
          next[msg.id] = { ...next[msg.id], x: msg.x, y: msg.y, velocity };
          return next;
        }
        return prev;
      });
    }
  }, []);

  const currentQuestion = questions[currentQuestionIndex] ?? null;

  return {
    users,
    myId,
    currentQuestionIndex,
    currentQuestion,
    answeredBy,
    phase,
    results,
    revealedUsers,
    lobbyConfig,
    questions,
    isGeneratingDeck,
    narrativeInsights,
    handleMessage,
  };
}
