import { Button } from "@/components/ui/button";

type IntroViewProps = {
  introduction: string;
  deckName: string;
  readyCount: number;
  totalPlayers: number;
  isCurrentUserReady: boolean;
  onIntroReady: () => void;
};

export function IntroView({
  introduction,
  deckName,
  readyCount,
  totalPlayers,
  isCurrentUserReady,
  onIntroReady,
}: IntroViewProps) {
  return (
    <div className="flex items-center justify-center h-full w-full bg-background">
      <div className="w-full max-w-2xl px-8 py-12 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">{deckName}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {introduction}
          </p>
        </div>
        
        <Button 
          onClick={onIntroReady} 
          className="w-full" 
          size="lg"
          disabled={isCurrentUserReady}
        >
          {isCurrentUserReady 
            ? `Waiting for others (${readyCount}/${totalPlayers} ready)`
            : "Ready to Start"
          }
        </Button>
      </div>
    </div>
  );
}
