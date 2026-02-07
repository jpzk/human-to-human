import { Button } from "@/components/ui/button";
import type { CompatibilityScore } from "@/types/messages";

type ResultsViewProps = {
  matches: CompatibilityScore[];
  readyCount: number;
  totalPlayers: number;
  isCurrentUserReady: boolean;
  onPlayerReady: () => void;
};

export function ResultsView({ 
  matches, 
  readyCount,
  totalPlayers,
  isCurrentUserReady,
  onPlayerReady
}: ResultsViewProps) {

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center border border-border rounded-lg max-w-2xl w-[90%] max-h-[80vh] bg-background">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 p-6 pb-4 flex-shrink-0">
        <h2 className="text-3xl font-bold text-center text-foreground">
          Compatibility Results
        </h2>
      </div>

      {/* Compatibility Scores Section */}
      <div className="flex-1 w-full px-6 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0">
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-foreground">Your Matches</h3>
        </div>
        
        {matches.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            <p>No matches found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div
                key={match.userId}
                className="flex items-center justify-between p-3 border border-border rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {match.anonymousName}
                  </p>
                  {match.connectionReason && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {match.connectionReason}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">
                    {Math.round(match.score * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground">#{match.rank}</p>
                </div>
              </div>
            ))}
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
