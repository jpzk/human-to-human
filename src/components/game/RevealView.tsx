import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CompatibilityScore } from "@/types/messages";

type RevealedUser = {
  userId: string;
  name: string;
  color: string;
};

type RevealViewProps = {
  matches: CompatibilityScore[];
  revealedUsers: Map<string, RevealedUser>;
  onRevealRequest: (targetId: string) => void;
  onResetGame?: () => void;
};

export function RevealView({
  matches,
  revealedUsers,
  onRevealRequest,
  onResetGame,
}: RevealViewProps) {
  const [requestedReveals, setRequestedReveals] = useState<Set<string>>(new Set());

  const handleRevealRequest = (targetId: string) => {
    setRequestedReveals((prev) => new Set(prev).add(targetId));
    onRevealRequest(targetId);
  };

  const isRevealed = (userId: string): boolean => {
    return revealedUsers.has(userId);
  };

  const isRequested = (userId: string): boolean => {
    return requestedReveals.has(userId);
  };

  const formatScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center border border-border rounded-lg max-w-2xl w-[90%] max-h-[80vh] bg-background">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 p-6 pb-4 flex-shrink-0">
        <h2 className="text-3xl font-bold text-center text-foreground">
          Reveal Identities
        </h2>
        <p className="text-muted-foreground text-center text-sm">
          Request to reveal identities with your matches. Both players must
          request to see each other's identity.
        </p>
      </div>

      {/* Scrollable matches */}
      <div className="flex-1 overflow-y-auto w-full px-6 min-h-0">
        {matches.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No matches to reveal.</p>
          </div>
        ) : (
          <div className="w-full space-y-4 pb-4">
            {matches.map((match) => {
              const revealed = isRevealed(match.userId);
              const requested = isRequested(match.userId);
              const revealData = revealedUsers.get(match.userId);

              return (
                <div
                  key={match.userId}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg">
                      #{match.rank}
                    </div>
                    <div className="flex-1">
                      {revealed && revealData ? (
                        <>
                          <div
                            className="font-semibold text-lg flex items-center gap-2"
                            style={{ color: revealData.color }}
                          >
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: revealData.color }}
                            />
                            {revealData.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Identity revealed!
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold text-lg">
                            {match.anonymousName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatScore(match.score)} match
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {revealed ? (
                      <div className="px-4 py-2 text-sm font-medium text-green-600 bg-green-100 rounded-md">
                        Revealed
                      </div>
                    ) : requested ? (
                      <div className="px-4 py-2 text-sm font-medium text-yellow-600 bg-yellow-100 rounded-md">
                        Pending...
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleRevealRequest(match.userId)}
                        variant="outline"
                        size="sm"
                      >
                        Request Reveal
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Buttons */}
      {onResetGame && (
        <div className="p-6 pt-4 flex-shrink-0 w-full border-t border-border">
          <Button
            onClick={onResetGame}
            variant="outline"
            className="w-full"
            size="lg"
          >
            New Game
          </Button>
        </div>
      )}
    </div>
  );
}
