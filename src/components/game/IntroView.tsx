import { motion } from "framer-motion";
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
    <div className="flex items-center justify-center h-full w-full bg-background mobile:min-h-full mobile:h-auto">
      <div className="w-full max-w-2xl px-8 py-12 space-y-8 mobile:px-5">
        <div className="text-center space-y-4">
          <p className="text-3xl text-black leading-relaxed font-bold mobile:text-[20px]">
            {introduction}
          </p>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex justify-center player-only"
        >
          <Button 
            onClick={onIntroReady} 
            size="lg"
            disabled={isCurrentUserReady}
          >
            {isCurrentUserReady 
              ? `Waiting for others (${readyCount}/${totalPlayers} ready)`
              : "Ready to Start"
            }
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
