import { Button } from "@/components/ui/button";
import type { CompatibilityScore } from "@/types/messages";

type ResultsViewProps = {
  matches: CompatibilityScore[];
  onContinue: () => void;
};

export function ResultsView({ matches, onContinue }: ResultsViewProps) {
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
      <div className="flex-1 overflow-y-auto w-full px-6 min-h-0">
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

      {/* Button */}
      <div className="p-6 pt-4 flex-shrink-0 w-full border-t border-border">
        <Button onClick={onContinue} className="w-full" size="lg">
          Continue to Reveal
        </Button>
      </div>
    </div>
  );
}
