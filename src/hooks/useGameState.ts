import { useState, useCallback } from "react";
import { GamePhase, PLACEHOLDER_QUESTIONS } from "@/types/game";
import type {
  ServerMessage,
  CompatibilityScore,
  SyncMessage,
  PhaseChangeMessage,
  ResultsMessage,
  RevealMutualMessage,
  QuestionAdvanceMessage,
} from "@/types/messages";

type User = { name: string; color: string; x: number | null; y: number | null };

export function useGameState() {
  const [users, setUsers] = useState<Record<string, User>>({});
  const [myId, setMyId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answeredBy, setAnsweredBy] = useState<Record<string, string[]>>({});
  const [phase, setPhase] = useState<GamePhase>(GamePhase.ANSWERING);
  const [results, setResults] = useState<CompatibilityScore[]>([]);
  const [revealedUsers, setRevealedUsers] = useState<
    Map<string, { userId: string; name: string; color: string }>
  >(new Map());

  const handleMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === "sync") {
      const syncMsg = msg as SyncMessage;
      setMyId(syncMsg.self ?? null);
      if (syncMsg.answeredBy) setAnsweredBy(syncMsg.answeredBy);
      if (syncMsg.phase) setPhase(syncMsg.phase as GamePhase);
      if (typeof syncMsg.currentQuestionIndex === "number") {
        setCurrentQuestionIndex(syncMsg.currentQuestionIndex);
      }
      const map: Record<string, User> = {};
      for (const u of syncMsg.users ?? []) {
        map[u.id] = { name: u.name, color: u.color, x: null, y: null };
      }
      setUsers(map);
      setResults([]);
      setRevealedUsers(new Map());
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
          next[msg.id] = { name: msg.name, color: msg.color, x: null, y: null };
          return next;
        }
        if (msg.type === "leave") {
          delete next[msg.id];
          return next;
        }
        if (msg.type === "cursor" && next[msg.id]) {
          next[msg.id] = { ...next[msg.id], x: msg.x, y: msg.y };
          return next;
        }
        return prev;
      });
    }
  }, []);

  const currentQuestion = PLACEHOLDER_QUESTIONS[currentQuestionIndex];

  return {
    users,
    myId,
    currentQuestionIndex,
    currentQuestion,
    answeredBy,
    phase,
    results,
    revealedUsers,
    handleMessage,
  };
}
