import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { AnsweringView } from "@/components/game/AnsweringView";
import { ResultsView } from "@/components/game/ResultsView";
import { RevealView } from "@/components/game/RevealView";
import { Landing } from "@/components/landing/Landing";
import { WaitingLobbyView } from "@/components/game/WaitingLobbyView";
import { IntroView } from "@/components/game/IntroView";
import { NudgeNotification } from "@/components/game/NudgeNotification";
import { RevealRequestNotification } from "@/components/game/RevealRequestNotification";
import { ChatModal } from "@/components/game/ChatModal";
import { Cursor } from "@/components/game/Cursor";
import { Creature } from "@/components/creature/Creature";
import { PresenceStrip } from "@/components/game/PresenceStrip";
import { ScreenLobby, ScreenReveal } from "@/components/game/ScreenViews";
import { MutualRevealCelebration } from "@/components/game/MutualRevealCelebration";
import { AnimatePresence } from "framer-motion";
import { GamePhase } from "@/types/game";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useGameState } from "@/hooks/useGameState";
import { useAudio } from "@/hooks/useAudio";
import { getTotalPlayers } from "@/services/gameService";
import { generateRoomId, getRoomIdFromUrl, setRoomIdInUrl, getRoomLink } from "@/lib/roomUtils";
import { getDeck } from "@/services/deckService";
import { Button } from "@/components/ui/button";
import type { ServerMessage, ReadyStatusMessage, IntroReadyStatusMessage, NudgeMessage, ChatMessageSend, ChatCloseRequestMessage } from "@/types/messages";
import "./App.css";

const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function useIsMobile() {
  const query = "(max-width: 760px)";
  const [m, setM] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

export default function App() {
  const isMobile = useIsMobile();
  // projector screen: watches the room, never plays
  const isScreen = useMemo(() => new URLSearchParams(location.search).has("screen"), []);
  const [scale, setScale] = useState(1);
  const [isClicking, setIsClicking] = useState(false);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastSendRef = useRef(0);
  const THROTTLE_MS = 1000 / 30; // 30 FPS cursor updates
  
  // Cache cursor identity to survive reconnection transitions
  // These refs act as fallback when live values are temporarily undefined
  const stableMyName = useRef<string | null>(null);
  const stableMyColor = useRef<string | null>(null);

  // Initialize roomId from URL - don't auto-generate
  const [roomId, setRoomId] = useState<string | null>(() => {
    return getRoomIdFromUrl();
  });

  // Store pending lobby config when creating a new lobby
  const [pendingLobbyConfig, setPendingLobbyConfig] = useState<{ deck?: string } | null>(null);

  // Audio enabled state (default ON for prerecorded audio)
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Results ready state tracking
  const [resultsReadyCount, setResultsReadyCount] = useState(0);
  const [resultsTotalPlayers, setResultsTotalPlayers] = useState(0);
  const [isCurrentUserReady, setIsCurrentUserReady] = useState(false);
  
  // Intro ready state tracking
  const [introReadyCount, setIntroReadyCount] = useState(0);
  const [introTotalPlayers, setIntroTotalPlayers] = useState(0);
  const [isCurrentUserIntroReady, setIsCurrentUserIntroReady] = useState(false);
  
  // Track dismissed reveal notifications locally
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());

  // Track drop ripple events per user (one per question per user)
  const [dropEventIds, setDropEventIds] = useState<Record<string, number>>({});
  const previousAnsweredByRef = useRef<Record<string, string[]>>({});
  const dropEventCounterRef = useRef(0);
  const myIdRef = useRef<string | null>(null);

  // Use custom hooks for game state and WebSocket (only connect if roomId exists)
  const gameState = useGameState();

  // Audio hook for playing prerecorded MP3 files (not TTS generation)
  const { state: audioState, playPrerecordedAudio, stop: audioStop } = useAudio();

  // Wrap message handler to also handle ready status
  const handleMessage = useCallback((msg: ServerMessage) => {
    gameState.handleMessage(msg);
    
    // Handle ready status updates
    if (msg.type === "READY_STATUS") {
      const readyMsg = msg as ReadyStatusMessage;
      setResultsReadyCount(readyMsg.readyCount);
      setResultsTotalPlayers(readyMsg.totalPlayers);
      setIsCurrentUserReady(readyMsg.readyUserIds.includes(myIdRef.current || ""));
    }
    
    // Handle intro ready status updates
    if (msg.type === "INTRO_READY_STATUS") {
      const readyMsg = msg as IntroReadyStatusMessage;
      setIntroReadyCount(readyMsg.readyCount);
      setIntroTotalPlayers(readyMsg.totalPlayers);
      setIsCurrentUserIntroReady(readyMsg.readyUserIds.includes(myIdRef.current || ""));
    }
  }, [gameState.handleMessage]);

  const { status, sendMessage } = useWebSocket({
    roomId: roomId || "",
    onMessage: handleMessage,
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
    lobbyConfig,
    questions,
    narrativeStory,
    nudgeCooldowns,
    revealNotifications,
    activeChat,
    chatMessages,
    hostId,
    answerReveal,
    addChatMessageLocally,
  } = gameState;

  // Mutual reveal celebration: fires once per newly revealed partner
  const [celebration, setCelebration] = useState<{ name: string; color: string } | null>(null);
  const seenRevealsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const [id, r] of revealedUsers) {
      if (seenRevealsRef.current.has(id)) continue;
      seenRevealsRef.current.add(id);
      setCelebration({ name: r.name, color: r.color });
    }
  }, [revealedUsers]);
  const endCelebration = useCallback(() => setCelebration(null), []);

  // Update myId ref when it changes
  useEffect(() => {
    myIdRef.current = myId || null;
  }, [myId]);

  // Track drop ripple triggers when users answer
  useEffect(() => {
    if (phase !== GamePhase.ANSWERING || !currentQuestion) {
      // Clear drop events when not in answering phase
      setDropEventIds({});
      previousAnsweredByRef.current = {};
      return;
    }

    const questionId = currentQuestion.id;
    const currentAnswered = answeredBy[questionId] || [];
    const previousAnswered = previousAnsweredByRef.current[questionId] || [];

    // Find newly answered users
    const newAnswers = currentAnswered.filter(name => !previousAnswered.includes(name));
    
    if (newAnswers.length > 0) {
      // Generate drop event IDs for newly answered users
      setDropEventIds(prev => {
        const updated = { ...prev };
        newAnswers.forEach(name => {
          dropEventCounterRef.current += 1;
          updated[name] = dropEventCounterRef.current;
        });
        return updated;
      });
    }

    // Update previous state
    previousAnsweredByRef.current = { ...answeredBy };
  }, [phase, currentQuestion?.id, answeredBy]);

  // Initialize mouse position immediately on mount
  useEffect(() => {
    let initialized = false;
    
    const initMousePosition = (e: MouseEvent) => {
      if (!initialized) {
        setMousePosition({ x: e.clientX, y: e.clientY });
        initialized = true;
      }
    };
    
    // Capture on first movement
    document.addEventListener('mousemove', initMousePosition, { once: true });
    
    // Fallback: set to center after brief delay if no movement detected
    const timeout = setTimeout(() => {
      if (!initialized && !mousePosition) {
        setMousePosition({ 
          x: window.innerWidth / 2, 
          y: window.innerHeight / 2 
        });
        initialized = true;
      }
    }, 100);
    
    return () => {
      document.removeEventListener('mousemove', initMousePosition);
      clearTimeout(timeout);
    };
  }, []); // Only run once on mount

  const totalPlayers = getTotalPlayers(users);
  const myName = myId ? users[myId]?.name : null;
  const myColor = myId ? users[myId]?.color : null;
  const isHost = myId !== null && myId === hostId;
  
  // Cache cursor identity to survive reconnection transitions
  // Clears on room change, updates when live values are available
  useEffect(() => {
    if (!roomId) {
      stableMyName.current = null;
      stableMyColor.current = null;
      return;
    }
    if (myName) stableMyName.current = myName;
    if (myColor) stableMyColor.current = myColor;
  }, [roomId, myName, myColor]);
  
  // Use live values with fallback to cached values during reconnection transitions
  const displayName = myName || stableMyName.current;
  const displayColor = myColor || stableMyColor.current;
  
  // Hide native cursor when we have cursor identity (using stable values)
  const cursorStyle = displayColor && displayName && !isScreen ? { cursor: "none" } : undefined;

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

  const handleCreateLobby = (config: { deck?: string }) => {
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
        isScreen
          ? Math.min(window.innerWidth / VIEWPORT_W, window.innerHeight / (VIEWPORT_H * 1.22)) // projectors: fill the wall
          : Math.min(window.innerWidth / VIEWPORT_W, window.innerHeight / VIEWPORT_H, 1)
      );
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isScreen]);

  // Cursor tracking - decoupled local rendering from server updates
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // ALWAYS update local position for smooth rendering, regardless of connection status
      setMousePosition({ x: e.clientX, y: e.clientY });
      
      // Only send updates to server when connected and viewport is available
      const el = viewportRef.current;
      if (!el || status !== "connected") return;
      
      // Calculate viewport coordinates for server updates
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
      
      // Throttle server updates to 30 FPS
      const now = Date.now();
      if (now - lastSendRef.current < THROTTLE_MS) return;
      lastSendRef.current = now;
      sendMessage({ type: "cursor", x, y });
    };
    if (isScreen) return;
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

  // Helper to get deck slug from deck name
  const getDeckSlug = useCallback((deckName: string): string => {
    // Map deck names to their folder slugs
    const slugMap: Record<string, string> = {
      "Friendship Fortunes": "friendship-fortunes",
      "Love in Harmony": "love-in-harmony",
      "Whispers of the Heart": "whispers-of-the-heart",
      "Office Allies: Building Bonds Beyond Cubicles": "office-allies-building-bonds-beyond-cubicles",
    };
    return slugMap[deckName] || deckName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }, []);

  // Auto-play prerecorded audio when question changes (if audio enabled)
  useEffect(() => {
    if (!audioEnabled || !currentQuestion || phase !== GamePhase.ANSWERING) return;

    // Play prerecorded audio file for this question
    if (currentQuestion.audioFile && lobbyConfig?.deck) {
      const deckSlug = getDeckSlug(lobbyConfig.deck);
      const audioUrl = `/decks/${deckSlug}/${currentQuestion.audioFile}`;
      playPrerecordedAudio(audioUrl);
    }
  }, [currentQuestion?.id, audioEnabled, phase, playPrerecordedAudio, lobbyConfig, getDeckSlug]);

  // Play deck introduction audio when entering INTRO phase (if audio enabled)
  useEffect(() => {
    if (audioEnabled && phase === GamePhase.INTRO && lobbyConfig?.deck) {
      const deck = getDeck(lobbyConfig.deck);
      if (deck?.introAudioFile) {
        const deckSlug = getDeckSlug(lobbyConfig.deck);
        const introUrl = `/decks/${deckSlug}/${deck.introAudioFile}`;
        playPrerecordedAudio(introUrl);
      }
    }
  }, [phase, audioEnabled, lobbyConfig, getDeckSlug, playPrerecordedAudio]);

  // Stop audio and reset ready state when leaving RESULTS phase
  useEffect(() => {
    if (phase !== GamePhase.RESULTS) {
      audioStop();
      setIsCurrentUserReady(false);
      setResultsReadyCount(0);
    }
  }, [phase, audioStop]);

  // Reset intro ready state when leaving INTRO phase
  useEffect(() => {
    if (phase !== GamePhase.INTRO) {
      setIsCurrentUserIntroReady(false);
      setIntroReadyCount(0);
    }
  }, [phase]);

  // Audio toggle handler
  const handleAudioToggle = useCallback(() => {
    if (audioEnabled) {
      audioStop(); // Stop current playback when disabling
    }
    setAudioEnabled(!audioEnabled);
  }, [audioEnabled, audioStop]);

  // Handle player ready for results
  const handlePlayerReady = useCallback(() => {
    if (!isCurrentUserReady && sendMessage) {
      sendMessage({ type: "PLAYER_READY" });
      setIsCurrentUserReady(true);
    }
  }, [isCurrentUserReady, sendMessage]);

  // Handle intro ready
  const handleIntroReady = useCallback(() => {
    if (!isCurrentUserIntroReady && sendMessage) {
      sendMessage({ type: "INTRO_READY" });
      setIsCurrentUserIntroReady(true);
    }
  }, [isCurrentUserIntroReady, sendMessage]);

  // If no roomId in URL, show the landing page (deck picker included)
  if (!roomId) {
    return <Landing onCreateLobby={handleCreateLobby} />;
  }

  // where each creature leaves from at the answer reveal (stage coordinates)
  const revealStarts: Record<string, { x: number; y: number } | undefined> = {};
  if (answerReveal && !isMobile) {
    for (const [id, u] of Object.entries(users)) {
      if (u.x != null && u.y != null) revealStarts[id] = { x: u.x, y: u.y };
    }
    const vp = viewportRef.current?.getBoundingClientRect();
    if (myId && vp && mousePosition) {
      revealStarts[myId] = {
        x: ((mousePosition.x - vp.left) / vp.width) * VIEWPORT_W,
        y: ((mousePosition.y - vp.top) / vp.height) * VIEWPORT_H,
      };
    }
  }
  const awayIds = new Set(answerReveal ? answerReveal.answers.map((a) => a.id) : []);

  const views = (
    <>
          {phase === GamePhase.LOBBY && roomId && isScreen && (
            <ScreenLobby users={users} joinLink={getRoomLink(roomId)} deckName={lobbyConfig?.deck || ""} />
          )}
          {phase === GamePhase.REVEAL && isScreen && <ScreenReveal users={users} />}
          {phase === GamePhase.LOBBY && roomId && !isScreen && (
            <WaitingLobbyView
              users={users}
              myId={myId}
              lobbyConfig={lobbyConfig}
              roomLink={getRoomLink(roomId)}
              isHost={isHost}
              onStartGame={handleStartGame}
              onCopyLink={handleCopyRoomLink}
            />
          )}
          {phase === GamePhase.INTRO && (
            <IntroView
                introduction={getDeck(lobbyConfig?.deck || "")?.introduction || ""}
                deckName={lobbyConfig?.deck || ""}
                readyCount={introReadyCount}
                totalPlayers={introTotalPlayers}
                isCurrentUserReady={isCurrentUserIntroReady}
                onIntroReady={handleIntroReady}
              />
          )}
          {phase === GamePhase.ANSWERING && (
            <AnsweringView
                currentQuestion={currentQuestion}
                currentQuestionIndex={currentQuestionIndex}
                questions={questions}
                totalPlayers={totalPlayers}
                answeredBy={answeredBy}
                myId={myId}
                myName={displayName}
                myColor={displayColor}
                onAnswer={handleAnswer}
                onSliderAnswer={handleSliderAnswer}
                answerReveal={answerReveal}
                revealStarts={revealStarts}
              />
          )}
          {phase === GamePhase.RESULTS && (
            <ResultsView 
              matches={results} 
              narrativeStory={narrativeStory} 
              readyCount={resultsReadyCount}
              totalPlayers={resultsTotalPlayers}
              isCurrentUserReady={isCurrentUserReady}
              onPlayerReady={handlePlayerReady}
              users={users}
              deckName={lobbyConfig?.deck || ""}
            />
          )}
          {phase === GamePhase.REVEAL && !isScreen && (
            <RevealView
              matches={results}
              revealedUsers={revealedUsers}
              users={users}
              onRevealRequest={handleRevealRequest}
              onResetGame={handleResetGame}
            />
          )}
    </>
  );

  const overlays = (
    <>
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

      <AnimatePresence>
        {celebration && myName && myColor && (
          <MutualRevealCelebration me={{ name: myName, color: myColor }} partner={celebration} onDone={endCelebration} />
        )}
      </AnimatePresence>

      {/* Show chat modal (after the celebration) */}
      {activeChat && !celebration && (
        <ChatModal
          chatId={activeChat.chatId}
          partnerName={activeChat.partnerName}
          partnerColor={activeChat.partnerColor}
          messages={chatMessages}
          onSendMessage={handleSendChatMessage}
          onCloseRequest={handleCloseChat}
        />
      )}
      

    </>
  );

  if (isMobile && !isScreen) {
    return (
      <>
        <div className="mobile-shell">
          <header className="mobile-header">
            <img src="/logo-name.svg" alt="hands" className="h-6" />
            {myName && myColor && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">You are</span>
                <span className="font-bold">{myName}</span>
                <Creature name={myName} color={myColor} size={34} />
              </div>
            )}
          </header>
          {phase !== GamePhase.LOBBY && (
            <PresenceStrip
              users={users}
              myId={myId}
              answered={phase === GamePhase.ANSWERING && currentQuestion ? answeredBy[currentQuestion.id] : undefined}
            />
          )}
          <main className="mobile-stage">{views}</main>
        </div>
        {overlays}
      </>
    );
  }

  return (
    <>
      <div className={`viewport-container${isScreen ? " screen-mode" : ""}`} style={cursorStyle}>
        <img 
          src="/logo-name.svg" 
          alt="Logo" 
          className="absolute" 
          style={{ 
            height: `${64 * scale}px`,
            top: `calc(50% - ${(VIEWPORT_H * scale) / 2 + 80 * scale}px)`
          }} 
        />
        <div
          ref={viewportRef}
          className="viewport"
          style={{
            width: VIEWPORT_W,
            height: VIEWPORT_H,
            transform: `scale(${scale})`,
          }}
        >
          {views}
          <div className="cursors" aria-hidden>
            {Object.entries(users)
              .filter(([id]) => id !== myId)
              .map(([id, u]) => {
                if (u.x == null || u.y == null) return null;
                
                const cooldownCheck = (nudgeCooldowns[id] ?? 0) > Date.now();
                const dropEventId = dropEventIds[u.name];
                
                return (
                  <div
                    key={id}
                    className="cursor-wrapper clickable"
                    style={{
                      left: u.x,
                      top: u.y,
                    } as React.CSSProperties}
                    onClick={() => handleNudge(id)}
                    title={
                      cooldownCheck
                        ? "Wait before nudging again"
                        : `Click to nudge ${u.name}`
                    }
                  >
                    <Cursor
                      name={u.name}
                      color={u.color}
                      x={u.x}
                      y={u.y}
                      velocity={u.velocity}
                      dropEventId={dropEventId}
                      isOnCooldown={cooldownCheck}
                      away={awayIds.has(id)}
                    />
                  </div>
                );
              })}
          </div>
        </div>
        <p 
          className="absolute text-sm text-muted-foreground"
          style={{
            top: `calc(50% + ${(VIEWPORT_H * scale) / 2 + 16 * scale}px)`
          }}
        >
          created with <span className="font-bold">Cursor</span>, <span className="font-bold">MiniMax</span> and <span className="font-bold">Hume.ai</span>
        </p>
      </div>
      
      {/* Local player cursor - rendered like remote cursors for consistency */}
      {!isScreen &&
        displayName &&
        displayColor &&
        mousePosition && (() => {
          const dropEventId = displayName ? dropEventIds[displayName] : undefined;
          return (
            <div
              className="local-cursor-wrapper"
              style={{
                left: mousePosition.x,
                top: mousePosition.y,
                transform: `translate(-4px, -4px) scale(${scale})`,
              }}
            >
              <Cursor
                name={displayName}
                color={displayColor}
                x={mousePosition.x}
                y={mousePosition.y}
                dropEventId={dropEventId}
                isClicking={isClicking}
                surprised={!!(myId && users[myId]?.nudgeNotification)}
                away={!!myId && awayIds.has(myId)}
              />
            </div>
          );
        })()}
      
      {!isScreen && overlays}

      {/* players on phones send no cursor; show them so desktop players still see everyone */}
      {(() => {
        const phoneUsers = Object.fromEntries(
          Object.entries(users).filter(([id, u]) => id !== myId && (u.x == null || u.y == null)),
        );
        if (Object.keys(phoneUsers).length === 0 || phase === GamePhase.LOBBY || (isScreen && phase === GamePhase.REVEAL)) return null;
        return (
          <div className={`fixed bottom-2 right-3 z-10 flex items-center gap-1 rounded-2xl bg-background/80 backdrop-blur border border-border pl-3${isScreen ? " origin-bottom-right scale-150" : ""}`}>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">On phones</span>
            <PresenceStrip
              users={phoneUsers}
              myId={myId}
              answered={phase === GamePhase.ANSWERING && currentQuestion ? answeredBy[currentQuestion.id] : undefined}
            />
          </div>
        );
      })()}

      {roomId && myName && myColor && phase !== GamePhase.LOBBY && !isScreen && (
        <div className="status-bar">
          <div className="flex items-center gap-2">
            <Creature name={myName} color={myColor} size={36} />
            <span className="text-sm text-muted-foreground">You are</span>
            <span
              className="text-sm font-bold"
              style={{ color: myColor }}
            >
              {myName}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
