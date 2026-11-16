import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { CompatibilityScore } from "@/types/messages";
import { useTypewriter } from "@/hooks/useTypewriter";
import { motion } from "framer-motion";
import { Creature } from "@/components/creature/Creature";
import { renderGroupCard, shareOrDownload } from "@/lib/groupCard";

type ResultsViewProps = {
  matches: CompatibilityScore[];
  narrativeStory: string;
  readyCount: number;
  totalPlayers: number;
  isCurrentUserReady: boolean;
  onPlayerReady: () => void;
  users: Record<string, { name: string; color: string }>;
  deckName: string;
};

// Constants for animation timing
const TYPEWRITER_SPEED_MS = 20; // Milliseconds per character

export function ResultsView({ 
  matches, 
  narrativeStory, 
  readyCount,
  totalPlayers,
  isCurrentUserReady,
  onPlayerReady,
  users,
  deckName,
}: ResultsViewProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const people = Object.entries(users);

  const saveCard = async () => {
    const svgs = Array.from(groupRef.current?.querySelectorAll("svg") ?? []) as SVGSVGElement[];
    if (!svgs.length) return;
    setCardBusy(true);
    try {
      const firstSentences = (narrativeStory.match(/[^.!?]+[.!?]+/g) ?? [narrativeStory]).slice(0, 2).join(" ").trim();
      const blob = await renderGroupCard({
        svgs,
        title: `${people.length} strangers, one ${deckName.split(":")[0]} round`,
        subtitle: new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
        excerpt: (firstSentences || "We met as creatures first.").replace(/\s*[—–]\s*/g, ", "),
      });
      await shareOrDownload(blob, "hands-group.png");
    } finally {
      setCardBusy(false);
    }
  };
  const [isNarrativeLoading, setIsNarrativeLoading] = useState(true);
  const [animationSkipped, setAnimationSkipped] = useState(false);
  const hasReceivedStory = useRef(false);

  // Track narrative loading state - only transition from loading to loaded once
  useEffect(() => {
    if (narrativeStory && narrativeStory.length > 0 && !hasReceivedStory.current) {
      hasReceivedStory.current = true;
      setIsNarrativeLoading(false);
      console.log("[ResultsView] Narrative received:", narrativeStory.length, "characters");
      console.log("[ResultsView] Story preview:", narrativeStory.substring(0, 100));
    } else if (!narrativeStory || narrativeStory.length === 0) {
      // Set timeout to show error if story never arrives
      const timeout = setTimeout(() => {
        if (!hasReceivedStory.current) {
          console.warn("[ResultsView] Narrative not received after delay");
          setIsNarrativeLoading(false);
        }
      }, 25000); // 25 second timeout for slow API
      return () => clearTimeout(timeout);
    }
  }, [narrativeStory]);

  const displayedText = useTypewriter({
    text: narrativeStory || "",
    speed: TYPEWRITER_SPEED_MS,
    onComplete: () => {
      // Animation complete
    },
  });

  // Reset only when component first mounts (not on every narrativeStory change)
  useEffect(() => {
    hasReceivedStory.current = false;
    setIsNarrativeLoading(true);
    setAnimationSkipped(false);
  }, []); // Empty deps - only run on mount

  // Skip animation - show full story immediately
  const handleSkipAnimation = () => {
    setAnimationSkipped(true);
  };

  const storyReady = !!narrativeStory && displayedText.length >= narrativeStory.length;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center border border-border rounded-2xl max-w-2xl w-[90%] max-h-[86%] bg-background shadow-[0_24px_60px_-32px_rgba(47,41,37,0.35)] mobile:relative mobile:top-0 mobile:left-0 mobile:translate-x-0 mobile:translate-y-0 mobile:w-full mobile:h-full mobile:max-h-none mobile:border-0 mobile:rounded-none mobile:shadow-none">
      {/* group photo */}
      <div className="w-full flex flex-col items-center pt-6 pb-2 flex-shrink-0">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{deckName.split(":")[0]}</p>
        <h2 className="text-3xl font-bold text-center text-foreground mt-1 mobile:text-2xl">Your group's story</h2>
        <div ref={groupRef} className="flex justify-center items-end mt-3 px-6 max-w-full">
          {people.map(([id, u], i) => (
            <motion.div
              key={id}
              initial={{ y: 30, opacity: 0, scale: 0.6 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 + i * 0.08 }}
              style={{ marginLeft: i ? (people.length > 6 ? -26 : -14) : 0 }}
            >
              <Creature name={u.name} color={u.color} size={people.length > 6 ? 56 : 72} pose={storyReady ? "cheer" : "idle"} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* story */}
      <div className="flex-1 w-full px-8 py-3 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0 mobile:px-5">
        {isNarrativeLoading && (!narrativeStory || narrativeStory.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-2 w-2 rounded-full bg-[#b48bc4] animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground font-medium">Writing your story…</p>
          </div>
        ) : narrativeStory && narrativeStory.length > 0 ? (
          <div>
            <p className="text-[15px] text-[hsl(var(--flexoki-tx-2))] leading-relaxed whitespace-pre-wrap break-words">
              {animationSkipped ? narrativeStory : displayedText}
              {!animationSkipped && displayedText.length < narrativeStory.length && <span className="animate-pulse ml-0.5">|</span>}
            </p>
            {!animationSkipped && displayedText.length < narrativeStory.length && (
              <button onClick={handleSkipAnimation} className="mt-2 text-xs text-muted-foreground hover:text-foreground underline">
                Show all
              </button>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-8 text-center space-y-2">
            <p className="font-medium">No story this time</p>
            <p className="text-xs">The story service did not answer. Your matches are still ready.</p>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="player-only p-5 pt-4 flex-shrink-0 w-full border-t border-border flex gap-3 mobile:flex-col-reverse mobile:px-4">
        <Button variant="outline" size="lg" className="shrink-0" onClick={saveCard} disabled={cardBusy || !narrativeStory}>
          {cardBusy ? "Drawing…" : "Save group card"}
        </Button>
        <Button onClick={onPlayerReady} className="flex-1 mobile:flex-none" size="lg" disabled={isCurrentUserReady}>
          {isCurrentUserReady ? `Waiting for others (${readyCount}/${totalPlayers} ready)` : "See who you match with"}
        </Button>
      </div>
    </div>
  );
}
