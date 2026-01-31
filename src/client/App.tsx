import { useEffect, useRef, useState } from "react";
import { AnsweringView } from "@/components/game/AnsweringView";
import { ResultsView } from "@/components/game/ResultsView";
import { RevealView } from "@/components/game/RevealView";
import { GamePhase } from "@/types/game";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useGameState } from "@/hooks/useGameState";
import { getTotalPlayers } from "@/services/gameService";
import { generateRoomId, getRoomIdFromUrl, setRoomIdInUrl, getRoomLink } from "@/lib/roomUtils";
import { Button } from "@/components/ui/button";
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

  // Initialize roomId from URL or generate new one
  const [roomId, setRoomId] = useState<string>(() => {
    const urlRoomId = getRoomIdFromUrl();
    if (urlRoomId) {
      return urlRoomId;
    }
    const newRoomId = generateRoomId();
    setRoomIdInUrl(newRoomId);
    return newRoomId;
  });

  // Use custom hooks for game state and WebSocket
  const gameState = useGameState();
  const { status, sendMessage } = useWebSocket({
    roomId,
    onMessage: gameState.handleMessage,
  });

  const {
    users,
    myId,
    currentQuestionIndex,
    currentQuestion,
    answeredBy,
    phase,
    results,
    revealedUsers,
  } = gameState;

  const totalPlayers = getTotalPlayers(users);
  const myName = myId ? users[myId]?.name : null;
  const myColor = myId ? users[myId]?.color : null;
  const cursorSize = isClicking ? CURSOR_SIZE_CLICKED : CURSOR_SIZE_DEFAULT;
  const cursorStyle = myColor ? { cursor: cursorDataUrl(myColor, cursorSize) } : undefined;

  const handleAnswer = (questionId: string, answerId: string) => {
    sendMessage({ type: "ANSWER", questionId, answerId });
  };

  const handleResetGame = () => {
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    setRoomIdInUrl(newRoomId);
  };

  const handleCopyRoomLink = async () => {
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

  const handleContinueToReveal = () => {
    sendMessage({ type: "TRANSITION_TO_REVEAL" });
  };

  // Sync roomId with URL changes (browser navigation)
  useEffect(() => {
    const handlePopState = () => {
      const urlRoomId = getRoomIdFromUrl();
      if (urlRoomId && urlRoomId !== roomId) {
        setRoomId(urlRoomId);
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
          {phase === GamePhase.ANSWERING && (
            <AnsweringView
              currentQuestion={currentQuestion}
              currentQuestionIndex={currentQuestionIndex}
              totalPlayers={totalPlayers}
              answeredBy={answeredBy}
              myId={myId}
              myName={myName}
              onAnswer={handleAnswer}
            />
          )}
          {phase === GamePhase.RESULTS && (
            <ResultsView matches={results} onContinue={handleContinueToReveal} />
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
            {Object.entries(users)
              .filter(([id]) => id !== myId)
              .map(
                ([id, u]) =>
                  u.x != null &&
                  u.y != null && (
                    <div
                      key={id}
                      className="cursor"
                      style={
                        {
                          left: u.x,
                          top: u.y,
                          "--color": u.color,
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
                  )
              )}
          </div>
        </div>
      </div>
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
    </>
  );
}
