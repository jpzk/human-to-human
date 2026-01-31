import { useEffect, useRef, useState, useCallback } from "react";
import { AnsweringView } from "@/components/game/AnsweringView";
import { ResultsView } from "@/components/game/ResultsView";
import { RevealView } from "@/components/game/RevealView";
import { CreateLobbyView } from "@/components/game/CreateLobbyView";
import { WaitingLobbyView } from "@/components/game/WaitingLobbyView";
import { TTSToggle } from "@/components/game/TTSToggle";
import { HiddenCursorOverlay } from "@/components/game/HiddenCursorOverlay";
import { NudgeNotification } from "@/components/game/NudgeNotification";
import { RevealRequestNotification } from "@/components/game/RevealRequestNotification";
import { ChatModal } from "@/components/game/ChatModal";
import { GamePhase } from "@/types/game";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useGameState } from "@/hooks/useGameState";
import { useTTS } from "@/hooks/useTTS";
import { getTotalPlayers } from "@/services/gameService";
import { generateRoomId, getRoomIdFromUrl, setRoomIdInUrl, getRoomLink } from "@/lib/roomUtils";
import { Button } from "@/components/ui/button";
import type { ServerMessage, TTSResponseMessage, ReadyStatusMessage, NudgeMessage, ChatMessageSend, ChatCloseRequestMessage } from "@/types/messages";
import "./App.css";

const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;

const CURSOR_PATH =
  "M10 11V8.99c0-.88.59-1.64 1.44-1.86h.05A1.99 1.99 0 0 1 14 9.05V12v-2c0-.88.6-1.65 1.46-1.87h.05A1.98 1.98 0 0 1 18 10.06V13v-1.94a2 2 0 0 1 1.51-1.94h0A2 2 0 0 1 22 11.06V14c0 .6-.08 1.27-.21 1.97a7.96 7.96 0 0 1-7.55 6.48 54.98 54.98 0 0 1-4.48 0 7.96 7.96 0 0 1-7.55-6.48C2.08 15.27 2 14.59 2 14v-1.49c0-1.11.9-2.01 2.01-2.01h0a2 2 0 0 1 2.01 2.03l-.01.97v-10c0-1.1.9-2 2-2h0a2 2 0 0 1 2 2V11Z";

const CURSOR_SIZE_DEFAULT = 32;
const CURSOR_SIZE_CLICKED = 26;
const CURSOR_HOTSPOT_RATIO = 8;

function cursorDataUrl(color: string, size: number): string {
  const hotspot = size / CURSOR_HOTSPOT_RATIO;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" d="${CURSOR_PATH}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspot} ${hotspot}, auto`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function App() {
  const [scale, setScale] = useState(1);
  const [isClicking, setIsClicking] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastSendRef = useRef(0);
  const THROTTLE_MS = 1000 / 30; // 30 FPS cursor updates

  // Initialize roomId from URL - don't auto-generate
  const [roomId, setRoomId] = useState<string | null>(() => {
    return getRoomIdFromUrl();
  });

  // Store pending lobby config when creating a new lobby
  const [pendingLobbyConfig, setPendingLobbyConfig] = useState<{ deck: string } | null>(null);

  // TTS enabled state (default ON)
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Results ready state tracking
  const [resultsReadyCount, setResultsReadyCount] = useState(0);
  const [resultsTotalPlayers, setResultsTotalPlayers] = useState(0);
  const [isCurrentUserReady, setIsCurrentUserReady] = useState(false);
  
  // Track dismissed reveal notifications locally
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());

  // Use custom hooks for game state and WebSocket (only connect if roomId exists)
  const gameState = useGameState();

  // Create TTS instance first - useTTS uses refs internally for sendMessage
  // We'll use a ref-based approach to avoid circular dependency with useWebSocket
  const sendMessageRef = useRef<((msg: any) => void) | null>(null);
  const myIdRef = useRef<string | null>(null);
  const ttsSendMessage = useCallback((msg: { type: string; text: string; requestId: string }) => {
    if (sendMessageRef.current) {
      sendMessageRef.current(msg);
    }
  }, []);

  const { state: ttsState, speak: ttsSpeak, stop: ttsStop, handleTTSResponse } = useTTS({ 
    sendMessage: ttsSendMessage 
  });

  // Wrap message handler to also handle TTS responses and ready status
  const handleMessage = useCallback((msg: ServerMessage) => {
    gameState.handleMessage(msg);
    
    // Handle TTS responses
    if (msg.type === "TTS_RESPONSE") {
      handleTTSResponse(msg as TTSResponseMessage);
    }
    
    // Handle ready status updates
    if (msg.type === "READY_STATUS") {
      const readyMsg = msg as ReadyStatusMessage;
      setResultsReadyCount(readyMsg.readyCount);
      setResultsTotalPlayers(readyMsg.totalPlayers);
      setIsCurrentUserReady(readyMsg.readyUserIds.includes(myIdRef.current || ""));
    }
  }, [gameState.handleMessage, handleTTSResponse]);

  const { status, sendMessage } = useWebSocket({
    roomId: roomId || "",
    onMessage: handleMessage,
  });

  // Update refs
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const {
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
    narrativeInsights,
    nudgeCooldowns,
    revealNotifications,
    activeChat,
    chatMessages,
    addChatMessageLocally,
  } = gameState;

  // Update myId ref when it changes
  useEffect(() => {
    myIdRef.current = myId || null;
  }, [myId]);

  const totalPlayers = getTotalPlayers(users);
  const myName = myId ? users[myId]?.name : null;
  const myColor = myId ? users[myId]?.color : null;
  const cursorSize = isClicking ? CURSOR_SIZE_CLICKED : CURSOR_SIZE_DEFAULT;
  const cursorStyle = myColor ? { cursor: cursorDataUrl(myColor, cursorSize) } : undefined;

  const handleAnswer = (questionId: string, answerId: string) => {
    sendMessage({ type: "ANSWER", questionId, answerId });
  };

  const handleSliderAnswer = (questionId: string, value: number) => {
    sendMessage({ type: "SLIDER_ANSWER", questionId, value });
  };

  const handleResetGame = () => {
    // Navigate back to lobby creation instead of creating unconfigured room
    setRoomId(null);
    setPendingLobbyConfig(null);
    // Clear room from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.pushState({}, "", url);
  };

  const handleCopyRoomLink = async () => {
    if (!roomId) return;
    const roomLink = getRoomLink(roomId);
    try {
      await navigator.clipboard.writeText(roomLink);
    } catch (err) {
      console.error("Failed to copy room link:", err);
    }
  };

  const handleRevealRequest = (targetId: string) => {
    sendMessage({ type: "REVEAL_REQUEST", targetId });
  };

  const handleSendChatMessage = (text: string) => {
    if (!activeChat || !myId || !myName) return;
    
    // Add message locally immediately (optimistic update)
    const localMessage = {
      fromId: myId,
      fromName: myName,
      text: text,
      timestamp: Date.now(),
      isOwn: true,
    };
    addChatMessageLocally(localMessage);
    
    // Send to server for partner
    sendMessage({
      type: "CHAT_MESSAGE",
      chatId: activeChat.chatId,
      text,
    } as ChatMessageSend);
  };

  const handleCloseChat = () => {
    if (!activeChat) return;
    sendMessage({
      type: "CHAT_CLOSE_REQUEST",
      chatId: activeChat.chatId,
    } as ChatCloseRequestMessage);
  };

  const handleDismissRevealNotification = (requesterId: string) => {
    // Track dismissed notifications locally
    setDismissedNotifications((prev) => new Set(prev).add(requesterId));
  };

  const handleNudge = useCallback((targetId: string) => {
    sendMessage({ type: "NUDGE", targetId } as NudgeMessage);
  }, [sendMessage]);

  const handleContinueToReveal = () => {
    sendMessage({ type: "TRANSITION_TO_REVEAL" });
  };

  const handleCreateLobby = (config: { deck: string }) => {
    const newRoomId = generateRoomId();
    setPendingLobbyConfig(config);
    setRoomId(newRoomId);
    setRoomIdInUrl(newRoomId);
  };

  const handleStartGame = () => {
    sendMessage({ type: "START_GAME" });
  };

  // Send lobby config when room is created and WebSocket is connected
  useEffect(() => {
    if (roomId && status === "connected" && phase === GamePhase.LOBBY && pendingLobbyConfig && !lobbyConfig) {
      sendMessage({
        type: "CONFIGURE_LOBBY",
        deck: pendingLobbyConfig.deck,
      });
      setPendingLobbyConfig(null);
    }
  }, [roomId, status, phase, pendingLobbyConfig, lobbyConfig, sendMessage]);

  // Sync roomId with URL changes (browser navigation)
  useEffect(() => {
    const handlePopState = () => {
      const urlRoomId = getRoomIdFromUrl();
      if (urlRoomId !== roomId) {
        setRoomId(urlRoomId);
        if (!urlRoomId) {
          setPendingLobbyConfig(null);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [roomId]);

  // Viewport scaling
  useEffect(() => {
    const onResize = () => {
      setScale(
        Math.min(window.innerWidth / VIEWPORT_W, window.innerHeight / VIEWPORT_H, 1)
      );
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Cursor tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = viewportRef.current;
      if (!el || status !== "connected") return;
      const now = Date.now();
      if (now - lastSendRef.current < THROTTLE_MS) return;
      lastSendRef.current = now;
      const rect = el.getBoundingClientRect();
      const x = clamp(
        ((e.clientX - rect.left) / rect.width) * VIEWPORT_W,
        0,
        VIEWPORT_W
      );
      const y = clamp(
        ((e.clientY - rect.top) / rect.height) * VIEWPORT_H,
        0,
        VIEWPORT_H
      );
      sendMessage({ type: "cursor", x, y });
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, [status, sendMessage]);

  // Click state tracking
  useEffect(() => {
    const onDown = () => setIsClicking(true);
    const onUp = () => setIsClicking(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Auto-speak when question changes and TTS is enabled
  useEffect(() => {
    if (ttsEnabled && currentQuestion && phase === GamePhase.ANSWERING) {
      ttsSpeak(currentQuestion.text);
    }
  }, [currentQuestion?.id, ttsEnabled, phase, ttsSpeak]);

  // Stop TTS and reset ready state when leaving RESULTS phase
  useEffect(() => {
    if (phase !== GamePhase.RESULTS) {
      ttsStop();
      setIsCurrentUserReady(false);
      setResultsReadyCount(0);
    }
  }, [phase, ttsStop]);

  // Toggle handler
  const handleTTSToggle = useCallback(() => {
    if (ttsEnabled) {
      ttsStop(); // Stop current playback when disabling
    }
    setTtsEnabled(!ttsEnabled);
  }, [ttsEnabled, ttsStop]);

  // Memoize TTS stop callback to prevent unnecessary re-renders
  const handleTTSStop = useCallback(() => {
    ttsStop();
  }, [ttsStop]);

  // Handle player ready for results
  const handlePlayerReady = useCallback(() => {
    if (!isCurrentUserReady && sendMessage) {
      sendMessage({ type: "PLAYER_READY" });
      setIsCurrentUserReady(true);
    }
  }, [isCurrentUserReady, sendMessage]);

  // If no roomId in URL, show create lobby view
  if (!roomId) {
    return (
      <div className="viewport-container">
        <div
          className="viewport"
          style={{
            width: VIEWPORT_W,
            height: VIEWPORT_H,
            transform: `scale(${scale})`,
          }}
        >
          <CreateLobbyView onCreateLobby={handleCreateLobby} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="viewport-container" style={cursorStyle}>
        <div
          ref={viewportRef}
          className="viewport"
          style={{
            width: VIEWPORT_W,
            height: VIEWPORT_H,
            transform: `scale(${scale})`,
          }}
        >
          {phase === GamePhase.LOBBY && roomId && (
            <WaitingLobbyView
              users={users}
              lobbyConfig={lobbyConfig}
              roomLink={getRoomLink(roomId)}
              onStartGame={handleStartGame}
              onCopyLink={handleCopyRoomLink}
            />
          )}
          {phase === GamePhase.ANSWERING && (
            <>
              <TTSToggle
                enabled={ttsEnabled}
                ttsState={ttsState}
                onToggle={handleTTSToggle}
              />
              <HiddenCursorOverlay isHidden={currentQuestion?.hideCursors ?? false} />
              <AnsweringView
                currentQuestion={currentQuestion}
                currentQuestionIndex={currentQuestionIndex}
                questions={questions}
                totalPlayers={totalPlayers}
                answeredBy={answeredBy}
                myId={myId}
                myName={myName}
                onAnswer={handleAnswer}
                onSliderAnswer={handleSliderAnswer}
              />
            </>
          )}
          {phase === GamePhase.RESULTS && (
            <ResultsView 
              matches={results} 
              narrativeInsights={narrativeInsights} 
              ttsEnabled={ttsEnabled}
              ttsState={ttsState}
              onTTSToggle={handleTTSToggle}
              onTTSSpeak={ttsSpeak}
              onTTSStop={handleTTSStop}
              readyCount={resultsReadyCount}
              totalPlayers={resultsTotalPlayers}
              isCurrentUserReady={isCurrentUserReady}
              onPlayerReady={handlePlayerReady}
            />
          )}
          {phase === GamePhase.REVEAL && (
            <RevealView
              matches={results}
              revealedUsers={revealedUsers}
              onRevealRequest={handleRevealRequest}
              onResetGame={handleResetGame}
            />
          )}
          <div className="cursors" aria-hidden>
            {!currentQuestion?.hideCursors &&
              Object.entries(users)
                .filter(([id]) => id !== myId)
                .map(
                  ([id, u]) =>
                    u.x != null &&
                    u.y != null && (
                      <div
                        key={id}
                        className="cursor-wrapper clickable"
                        style={{
                          left: u.x,
                          top: u.y,
                        } as React.CSSProperties}
                        onClick={() => handleNudge(id)}
                        title={
                          (nudgeCooldowns[id] ?? 0) > Date.now()
                            ? "Wait before nudging again"
                            : `Click to nudge ${u.name}`
                        }
                      >
                        <div
                          className={`cursor ${(nudgeCooldowns[id] ?? 0) > Date.now() ? 'on-cooldown' : ''}`}
                          style={
                            {
                              "--color": u.color,
                              "--velocity": u.velocity,
                            } as React.CSSProperties
                          }
                        >
                          <svg
                            className="cursor-icon"
                            xmlns="http://www.w3.org/2000/svg"
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                          >
                            <path
                              fill="none"
                              stroke={u.color}
                              strokeWidth={2}
                              strokeLinejoin="round"
                              d={CURSOR_PATH}
                            />
                          </svg>
                          <span className="cursor-name">{u.name}</span>
                        </div>
                      </div>
                    )
                )}
          </div>
        </div>
      </div>
      
      {/* Show nudge notification as fixed top-center banner */}
      {myId && users[myId]?.nudgeNotification && (
        <NudgeNotification
          from={users[myId].nudgeNotification.from}
          color={users[myId].nudgeNotification.color}
        />
      )}

      {/* Show reveal request notifications */}
      {Array.from(revealNotifications.entries())
        .filter(([requesterId]) => !dismissedNotifications.has(requesterId))
        .map(([requesterId, notification], index) => (
          <RevealRequestNotification
            key={requesterId}
            requesterId={notification.requesterId}
            requesterName={notification.requesterName}
            requesterColor={notification.requesterColor}
            onDismiss={() => handleDismissRevealNotification(requesterId)}
            top={20 + index * 80}
          />
        ))}

      {/* Show chat modal */}
      {activeChat && (
        <ChatModal
          chatId={activeChat.chatId}
          partnerName={activeChat.partnerName}
          partnerColor={activeChat.partnerColor}
          messages={chatMessages}
          onSendMessage={handleSendChatMessage}
          onCloseRequest={handleCloseChat}
        />
      )}
      
      {roomId && (
        <div className="status-bar">
          <div className="flex items-center gap-4">
            <span>{status}</span>
            <span className="text-sm text-muted-foreground">Phase: {phase}</span>
            <span className="text-sm text-muted-foreground">Room: {roomId}</span>
            <span className="text-sm text-muted-foreground">Players: {totalPlayers}</span>
            <Button
              onClick={handleCopyRoomLink}
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              Copy Link
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
