import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { CompatibilityScore } from "@/types/messages";
import { useTypewriter } from "@/hooks/useTypewriter";

type ResultsViewProps = {
  matches: CompatibilityScore[];
  narrativeStory: string;
  readyCount: number;
  totalPlayers: number;
  isCurrentUserReady: boolean;
  onPlayerReady: () => void;
};

// Constants for animation timing
const TYPEWRITER_SPEED_MS = 20; // Milliseconds per character

export function ResultsView({ 
  matches, 
  narrativeStory, 
  readyCount,
  totalPlayers,
  isCurrentUserReady,
  onPlayerReady
}: ResultsViewProps) {
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

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center border border-border rounded-lg max-w-2xl w-[90%] max-h-[80vh] bg-background">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 p-6 pb-4 flex-shrink-0">
        <h2 className="text-3xl font-bold text-center text-foreground">
          Compatibility Results
        </h2>
      </div>

      {/* Narrative Story Section */}
      <div className="flex-1 w-full px-6 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0">
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-foreground">The Story</h3>
        </div>
        
        {isNarrativeLoading && (!narrativeStory || narrativeStory.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground font-medium">Creating your story...</p>
            <p className="text-xs text-muted-foreground">Analyzing your answers...</p>
          </div>
        ) : narrativeStory && narrativeStory.length > 0 ? (
          <div className="space-y-3">
            {!animationSkipped && displayedText.length < narrativeStory.length && (
              <button
                onClick={handleSkipAnimation}
                className="text-xs text-muted-foreground hover:text-foreground underline mb-2"
              >
                Skip animation
              </button>
            )}
            <div>
              {animationSkipped ? (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {narrativeStory}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {displayedText}
                  {displayedText.length < narrativeStory.length && (
                    <span className="animate-pulse ml-1">|</span>
                  )}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-8 text-center space-y-2">
            <p className="font-medium">Unable to generate story</p>
            <p className="text-xs">The narrative generation service may be unavailable</p>
          </div>
        )}
      </div>

      {/* Button */}
      <div className="p-6 pt-4 flex-shrink-0 w-full border-t border-border">
        <Button 
          onClick={onPlayerReady} 
          className="w-full" 
          size="lg"
          disabled={isCurrentUserReady}
        >
          {isCurrentUserReady 
            ? `Waiting for others (${readyCount}/${totalPlayers} ready)`
            : "Ready to Continue"
          }
        </Button>
      </div>
    </div>
  );
}
