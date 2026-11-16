import { useEffect } from "react";
import { motion } from "framer-motion";
import { Creature } from "@/components/creature/Creature";

type Who = { name: string; color: string };

const CONFETTI = ["#F89A8A", "#F9AE77", "#ECCB60", "#BEC97E", "#87D3C3", "#92BFDB", "#C4B9E0", "#F4A4C2"];

// Both asked to reveal: the two creatures run in from each side and
// high-five in the middle. Dismisses itself (or on tap), then the chat shows.
export function MutualRevealCelebration({ me, partner, onDone }: { me: Who; partner: Who; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [onDone]);

  const size = Math.min(170, window.innerWidth * 0.36);
  const half = size * 0.275; // half of the paw-touch spacing (0.55 x size)

  return (
    <motion.div
      className="fixed inset-0 z-[2500] grid place-items-center bg-[hsl(var(--flexoki-bg)/0.86)] backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
      role="dialog"
      aria-label={`It's mutual with ${partner.name}`}
    >
      <div className="relative flex flex-col items-center text-center px-6">
        <motion.p
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          It's mutual
        </motion.p>
        <motion.h2
          className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          You and {partner.name} want to meet
        </motion.h2>

        <div className="relative mt-8" style={{ width: size * 2.4, height: size }}>
          <motion.div
            className="absolute top-0"
            style={{ left: `calc(50% - ${half + size / 2}px)` }}
            initial={{ x: -window.innerWidth * 0.5 }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 15, delay: 0.25 }}
          >
            <Creature name={me.name} color={me.color} size={size} pose="hf-right" />
          </motion.div>
          <motion.div
            className="absolute top-0"
            style={{ left: `calc(50% + ${half - size / 2}px)` }}
            initial={{ x: window.innerWidth * 0.5 }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 15, delay: 0.25 }}
          >
            <Creature name={partner.name} color={partner.color} size={size} pose="hf-left" facingLeft={false} />
          </motion.div>
          <span className="hf-spark hf-spark-big" style={{ left: "50%", top: size * 0.2 }} />
          {CONFETTI.flatMap((c, i) =>
            [0, 1].map((k) => {
              const angle = ((i * 2 + k) / 16) * Math.PI * 2;
              const dist = size * (0.9 + (k ? 0.35 : 0));
              return (
                <motion.span
                  key={`${i}-${k}`}
                  className="absolute rounded-full"
                  style={{ left: "50%", top: size * 0.2, width: 8, height: 8, background: c }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * 0.7, opacity: [0, 1, 0], scale: 1 }}
                  transition={{ delay: 1.05, duration: 1.3, ease: "easeOut" }}
                />
              );
            }),
          )}
        </div>

        <motion.p
          className="mt-6 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          Opening your chat…
        </motion.p>
      </div>
    </motion.div>
  );
}
