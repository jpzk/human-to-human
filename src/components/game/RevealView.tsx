import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Creature } from "@/components/creature/Creature";
import type { CompatibilityScore } from "@/types/messages";

type RevealedUser = {
  userId: string;
  name: string;
  color: string;
};

type RevealViewProps = {
  matches: CompatibilityScore[];
  revealedUsers: Map<string, RevealedUser>;
  users: Record<string, { name: string; color: string }>;
  onRevealRequest: (targetId: string) => void;
  onResetGame?: () => void;
};

function ScoreRing({ score, color }: { score: number; color: string }) {
  const c = 2 * Math.PI * 16;
  return (
    <div className="relative w-12 h-12 shrink-0 grid place-items-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r="16" fill="none" stroke="hsl(var(--flexoki-ui))" strokeWidth="4" />
        <motion.circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <span className="text-[11px] font-bold">{Math.round(score * 100)}%</span>
    </div>
  );
}

export function RevealView({ matches, revealedUsers, users, onRevealRequest, onResetGame }: RevealViewProps) {
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const request = (id: string) => {
    setRequested((prev) => new Set(prev).add(id));
    onRevealRequest(id);
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center max-w-2xl w-[90%] max-h-[80vh] bg-background mobile:relative mobile:top-0 mobile:left-0 mobile:translate-x-0 mobile:translate-y-0 mobile:w-full mobile:h-full mobile:max-h-none">
      <div className="flex flex-col items-center gap-2 p-6 pb-4 flex-shrink-0 mobile:px-5">
        <h2 className="text-3xl font-bold text-center text-foreground mobile:text-2xl">Who do you want to meet?</h2>
        <p className="text-muted-foreground text-center text-sm max-w-md">
          Ask to reveal. Nothing happens unless they ask for you too, then you both see it and can chat.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto w-full px-6 min-h-0 custom-scrollbar mobile:px-4">
        {matches.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No matches to reveal.</div>
        ) : (
          <div className="w-full space-y-3 pb-4">
            {matches.map((m, i) => {
              const revealed = revealedUsers.has(m.userId);
              const pending = requested.has(m.userId) && !revealed;
              const color = users[m.userId]?.color ?? revealedUsers.get(m.userId)?.color ?? "#BEC97E";
              return (
                <motion.div
                  key={m.userId}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, type: "spring", stiffness: 260, damping: 24 }}
                  className={`flex items-center gap-3 p-3 pr-4 border rounded-2xl transition-colors ${revealed ? "border-[#7dd4c0] bg-[#7dd4c0]/10" : "border-border"}`}
                >
                  <div className="relative shrink-0">
                    <Creature name={m.anonymousName} color={color} size={64} pose={revealed ? "cheer" : pending ? "wave" : "idle"} />
                    <span className="absolute -top-1 -left-1 h-6 min-w-6 px-1 rounded-full bg-foreground text-background text-[11px] font-bold grid place-items-center">
                      #{m.rank}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-lg mobile:text-base truncate">{m.anonymousName}</div>
                    {m.connectionReason && <div className="text-xs italic text-muted-foreground truncate">{m.connectionReason}</div>}
                    {revealed && <div className="text-xs font-semibold text-[#3f8f7e] mt-0.5">It's mutual. Say hi in the chat!</div>}
                  </div>
                  <ScoreRing score={m.score} color={color} />
                  <div className="shrink-0 w-[118px] mobile:w-[96px] flex justify-end">
                    {revealed ? (
                      <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-[#7dd4c0]/25 text-[#2f6f61]">Matched</span>
                    ) : pending ? (
                      <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">Waiting…</span>
                    ) : (
                      <Button onClick={() => request(m.userId)} variant="outline" size="sm">
                        Reveal
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {onResetGame && (
        <div className="p-6 pt-4 flex-shrink-0 w-full border-t border-border mobile:px-4">
          <Button onClick={onResetGame} variant="outline" className="w-full" size="lg">
            New Game
          </Button>
        </div>
      )}
    </div>
  );
}
