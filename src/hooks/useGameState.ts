import { useState, useCallback, useRef, useEffect } from "react";
import { GamePhase, type LobbyConfig, type Question } from "@/types/game";
import type {
  ServerMessage,
  CompatibilityScore,
  SyncMessage,
  PhaseChangeMessage,
  ResultsMessage,
  RevealMutualMessage,
  QuestionAdvanceMessage,
  NarrativeMessage,
  NudgeStatusMessage,
  NudgeReceivedMessage,
  RevealRequestNotificationMessage,
  ChatStartedMessage,
  ChatMessageReceive,
  ChatClosedMessage,
} from "@/types/messages";

type User = { 
  name: string; 
  color: string; 
  x: number | null; 
  y: number | null;
  velocity: number; // normalized 0-1
  nudgeNotification?: { from: string; color: string; timestamp: number };
};

const MAX_DISTANCE = 150; // pixels at 30fps for fast movement
const NUDGE_NOTIFICATION_DURATION_MS = 2000; // 2 seconds
const NUDGE_COOLDOWN_MS = 10000; // 10 seconds (must match server constant)

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
  const [deckError, setDeckError] = useState<string | null>(null);
  const [narrativeStory, setNarrativeStory] = useState<string>("");
  const [nudgeCooldowns, setNudgeCooldowns] = useState<Record<string, number>>({});
  const [revealNotifications, setRevealNotifications] = useState<Map<string, { requesterId: string; requesterName: string; requesterColor: string }>>(new Map());
  const [activeChat, setActiveChat] = useState<{ chatId: string; partnerId: string; partnerName: string; partnerColor: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ fromId: string; fromName: string; text: string; timestamp: number; isOwn: boolean }>>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const myIdRef = useRef<string | null>(null);
  const nudgeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === "sync") {
      const syncMsg = msg as SyncMessage;
      const currentMyId = syncMsg.self ?? null;
      setMyId(currentMyId);
      myIdRef.current = currentMyId;
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
      if (syncMsg.hostId !== undefined) {
        setHostId(syncMsg.hostId);
      }
      const map: Record<string, User> = {};
      for (const u of syncMsg.users ?? []) {
        map[u.id] = { name: u.name, color: u.color, x: null, y: null, velocity: 0 };
      }
      setUsers(map);
      setNudgeCooldowns({});
      setResults([]);
      setRevealedUsers(new Map());
      setNarrativeStory("");
      setRevealNotifications(new Map());
      setActiveChat(null);
      setChatMessages([]);
      // Clear nudge timeout on sync (room reset)
      if (nudgeTimeoutRef.current) {
        clearTimeout(nudgeTimeoutRef.current);
        nudgeTimeoutRef.current = null;
      }
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
      const story = narrativeMsg.story ?? "";
      console.log("[useGameState] Narrative received:", story.length > 0 ? "story present" : "empty story");
      if (story.length > 0) {
        console.log("[useGameState] Narrative story length:", story.length, "characters");
      } else {
        console.warn("[useGameState] Empty narrative story received");
      }
      setNarrativeStory(story);
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
      // Clear reveal notification for this user
      setRevealNotifications((prev) => {
        const next = new Map(prev);
        next.delete(revealMsg.userId);
        return next;
      });
      return;
    }

    if (msg.type === "REVEAL_REQUEST_NOTIFICATION") {
      const notificationMsg = msg as RevealRequestNotificationMessage;
      setRevealNotifications((prev) => {
        const next = new Map(prev);
        next.set(notificationMsg.requesterId, {
          requesterId: notificationMsg.requesterId,
          requesterName: notificationMsg.requesterName,
          requesterColor: notificationMsg.requesterColor,
        });
        return next;
      });
      return;
    }

    if (msg.type === "CHAT_STARTED") {
      const chatMsg = msg as ChatStartedMessage;
      setActiveChat({
        chatId: chatMsg.chatId,
        partnerId: chatMsg.partnerId,
        partnerName: chatMsg.partnerName,
        partnerColor: chatMsg.partnerColor,
      });
      setChatMessages([]);
      // Clear reveal notification for this partner
      setRevealNotifications((prev) => {
        const next = new Map(prev);
        next.delete(chatMsg.partnerId);
        return next;
      });
      return;
    }

    if (msg.type === "CHAT_MESSAGE") {
      const chatMsg = msg as ChatMessageReceive;
      const currentMyId = myIdRef.current;
      if (!currentMyId) return;
      
      setChatMessages((prev) => {
        const newMessages = [...prev];
        newMessages.push({
          fromId: chatMsg.fromId,
          fromName: chatMsg.fromName,
          text: chatMsg.text,
          timestamp: chatMsg.timestamp,
          isOwn: chatMsg.fromId === currentMyId,
        });
        return newMessages;
      });
      return;
    }

    if (msg.type === "CHAT_CLOSED") {
      setActiveChat(null);
      setChatMessages([]);
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

    if (msg.type === "NUDGE_RECEIVED") {
      const nudgeMsg = msg as NudgeReceivedMessage;
      
      // Clear any existing timeout
      if (nudgeTimeoutRef.current) {
        clearTimeout(nudgeTimeoutRef.current);
        nudgeTimeoutRef.current = null;
      }
      
      const currentMyId = myIdRef.current;
      if (currentMyId) {
        setUsers((prev) => {
          const updated = { ...prev };
          if (updated[currentMyId]) {
            updated[currentMyId] = {
              ...updated[currentMyId],
              nudgeNotification: {
                from: nudgeMsg.senderName,
                color: nudgeMsg.senderColor,
                timestamp: Date.now(),
              },
            };
          }
          return updated;
        });
        
        // Auto-dismiss notification after duration
        // Use myIdRef.current inside callback to avoid stale closure
        nudgeTimeoutRef.current = setTimeout(() => {
          const myIdAtTimeout = myIdRef.current;
          if (myIdAtTimeout) {
            setUsers((prevUsers) => {
              const updatedUsers = { ...prevUsers };
              if (updatedUsers[myIdAtTimeout]) {
                updatedUsers[myIdAtTimeout] = {
                  ...updatedUsers[myIdAtTimeout],
                  nudgeNotification: undefined,
                };
              }
              return updatedUsers;
            });
          }
          nudgeTimeoutRef.current = null;
        }, NUDGE_NOTIFICATION_DURATION_MS);
      }
      return;
    }

    if (msg.type === "NUDGE_STATUS") {
      const statusMsg = msg as NudgeStatusMessage;
      const cooldownRemaining = statusMsg.cooldownRemaining;
      if (!statusMsg.success && cooldownRemaining !== undefined) {
        // Update cooldown state for UI feedback
        setNudgeCooldowns((prev) => ({
          ...prev,
          [statusMsg.targetId]: Date.now() + (cooldownRemaining * 1000),
        }));
      } else if (statusMsg.success) {
        // Update cooldown locally using shared constant
        setNudgeCooldowns((prev) => ({
          ...prev,
          [statusMsg.targetId]: Date.now() + NUDGE_COOLDOWN_MS,
        }));
      }
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (nudgeTimeoutRef.current) {
        clearTimeout(nudgeTimeoutRef.current);
        nudgeTimeoutRef.current = null;
      }
    };
  }, []);

  const currentQuestion = questions[currentQuestionIndex] ?? null;

  const addChatMessageLocally = useCallback((message: { fromId: string; fromName: string; text: string; timestamp: number; isOwn: boolean }) => {
    setChatMessages((prev) => [...prev, message]);
  }, []);

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
    narrativeStory,
    nudgeCooldowns,
    revealNotifications,
    activeChat,
    chatMessages,
    hostId,
    handleMessage,
    addChatMessageLocally,
  };
}
