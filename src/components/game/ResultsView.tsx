import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { CompatibilityScore } from "@/types/messages";
import { useTypewriter } from "@/hooks/useTypewriter";
import { TTSToggle } from "@/components/game/TTSToggle";

type ResultsViewProps = {
  matches: CompatibilityScore[];
  narrativeInsights: string[];
  ttsEnabled: boolean;
  ttsState: "idle" | "loading" | "playing" | "error";
  onTTSToggle: () => void;
  onTTSSpeak: (text: string) => void;
  onTTSStop: () => void;
  readyCount: number;
  totalPlayers: number;
  isCurrentUserReady: boolean;
  onPlayerReady: () => void;
};

// Constants for animation timing
const TYPEWRITER_SPEED_MS = 20; // Milliseconds per character (faster: 2x speed)
const INSIGHT_PAUSE_MS = 1000; // Pause between insights in milliseconds

export function ResultsView({ 
  matches, 
  narrativeInsights, 
  ttsEnabled,
  ttsState,
  onTTSToggle,
  onTTSSpeak,
  onTTSStop,
  readyCount,
  totalPlayers,
  isCurrentUserReady,
  onPlayerReady
}: ResultsViewProps) {
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
  const [completedInsights, setCompletedInsights] = useState<Set<number>>(new Set());
  const [narrativeError, setNarrativeError] = useState(false);
  const [isNarrativeLoading, setIsNarrativeLoading] = useState(true);
  const [animationSkipped, setAnimationSkipped] = useState(false);

  // Track narrative loading/error states
  useEffect(() => {
    if (narrativeInsights.length > 0) {
      setIsNarrativeLoading(false);
      setNarrativeError(false);
      console.log("[ResultsView] Narrative received:", narrativeInsights.length, "insights");
    } else {
      // If we're in RESULTS phase but no insights after a delay, might be error
      const timeout = setTimeout(() => {
        if (narrativeInsights.length === 0) {
          console.warn("[ResultsView] Narrative not received after delay - may have failed");
          // Don't set error immediately, might still be loading
        }
      }, 5000); // 5 second timeout
      return () => clearTimeout(timeout);
    }
  }, [narrativeInsights]);

  const currentInsight = narrativeInsights[currentInsightIndex] || "";
  const displayedText = useTypewriter({
    text: currentInsight,
    speed: TYPEWRITER_SPEED_MS,
    onComplete: () => {
      // Mark current insight as completed
      setCompletedInsights((prev) => new Set(prev).add(currentInsightIndex));
      
      // Speak the completed insight if TTS is enabled
      if (ttsEnabled && currentInsight) {
        onTTSSpeak(currentInsight);
      }
      
      // Move to next insight after a short pause
      if (currentInsightIndex < narrativeInsights.length - 1) {
        setTimeout(() => {
          setCurrentInsightIndex((prev) => prev + 1);
        }, INSIGHT_PAUSE_MS);
      }
    },
  });

  // Reset when narrativeInsights change
  useEffect(() => {
    setCurrentInsightIndex(0);
    setCompletedInsights(new Set());
    setIsNarrativeLoading(true);
    setNarrativeError(false);
    setAnimationSkipped(false);
    // Stop TTS when narrative changes
    onTTSStop();
  }, [narrativeInsights, onTTSStop]);

  // Skip animation - show all insights immediately
  const handleSkipAnimation = () => {
    setAnimationSkipped(true);
    setCurrentInsightIndex(narrativeInsights.length);
    const allCompleted = new Set(narrativeInsights.map((_, i) => i));
    setCompletedInsights(allCompleted);
  };

  const formatScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return "text-green-500";
    if (score >= 0.6) return "text-yellow-500";
    if (score >= 0.4) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center border border-border rounded-lg max-w-2xl w-[90%] max-h-[80vh] bg-background">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 p-6 pb-4 flex-shrink-0">
        <h2 className="text-3xl font-bold text-center text-foreground">
          Compatibility Results
        </h2>
        <p className="text-muted-foreground text-center text-sm">
          Your matches ranked by compatibility
        </p>
      </div>

      {/* Scrollable matches */}
      <div className="flex-1 overflow-y-auto custom-scrollbar w-full px-6 min-h-0">
        {matches.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No other players found.</p>
          </div>
        ) : (
          <div className="w-full space-y-4 pb-4">
            {matches.map((match) => (
              <div
                key={match.userId}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg flex-shrink-0">
                    #{match.rank}
                  </div>
                  <div>
                    <div className="font-semibold text-lg">
                      {match.anonymousName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Match #{match.rank}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-2xl font-bold flex-shrink-0 ${getScoreColor(match.score)}`}
                >
                  {formatScore(match.score)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Narrative Story Section */}
      <div className="w-full px-6 py-4 border-t border-border flex-shrink-0 bg-muted/20">
        <div className="mb-3 flex items-center justify-between relative">
          <h3 className="text-lg font-semibold text-foreground">The Story</h3>
          {narrativeInsights.length > 0 && (
            <TTSToggle
              enabled={ttsEnabled}
              ttsState={ttsState}
              onToggle={onTTSToggle}
            />
          )}
        </div>
        
        {isNarrativeLoading && narrativeInsights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Analyzing your answers...</p>
          </div>
        ) : narrativeError ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            <p>Unable to generate story at this time.</p>
          </div>
        ) : narrativeInsights.length > 0 ? (
          <div className="space-y-3">
            {!animationSkipped && (
              <button
                onClick={handleSkipAnimation}
                className="text-xs text-muted-foreground hover:text-foreground underline mb-2"
              >
                Skip animation
              </button>
            )}
            <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
              {animationSkipped ? (
                // Show all insights immediately when skipped
                narrativeInsights.map((insight, index) => (
                  <p
                    key={index}
                    className="text-sm text-muted-foreground leading-relaxed"
                  >
                    {insight}
                  </p>
                ))
              ) : (
                // Show typewriter animation
                narrativeInsights.map((insight, index) => {
                  const isCurrent = index === currentInsightIndex;
                  const isCompleted = completedInsights.has(index);
                  
                  if (isCompleted) {
                    // Show completed insight
                    return (
                      <p
                        key={index}
                        className="text-sm text-muted-foreground leading-relaxed"
                      >
                        {insight}
                      </p>
                    );
                  } else if (isCurrent) {
                    // Show currently typing insight
                    return (
                      <p
                        key={index}
                        className="text-sm text-muted-foreground leading-relaxed"
                      >
                        {displayedText}
                        <span className="animate-pulse ml-1">|</span>
                      </p>
                    );
                  } else {
                    // Future insight, don't show yet
                    return null;
                  }
                })
              )}
            </div>
          </div>
        ) : null}
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
