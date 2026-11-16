import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Creature } from "@/components/creature/Creature";

type Users = Record<string, { name: string; color: string }>;

// Projector screen (?screen): a big join code and the crowd of creatures.
// It watches the room and never plays, so it shows no buttons.

function Crowd({ users, size, pose = "idle" }: { users: Users; size: number; pose?: "idle" | "wave" | "cheer" }) {
  return (
    <div className="flex flex-wrap justify-center items-end gap-x-4 gap-y-2">
      <AnimatePresence>
        {Object.entries(users).map(([id, u], i) => (
          <motion.div
            key={id}
            layout
            initial={{ opacity: 0, y: 40, scale: 0.4 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: Math.min(i, 8) * 0.04 }}
            className="flex flex-col items-center"
          >
            <Creature name={u.name} color={u.color} size={size} pose={pose} />
            <span className="text-sm font-semibold -mt-1">{u.name}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ScreenLobby({ users, joinLink, deckName }: { users: Users; joinLink: string; deckName: string }) {
  const n = Object.keys(users).length;
  const host = joinLink.replace(/^https?:\/\//, "");
  return (
    <div className="absolute inset-0 grid grid-cols-[420px_1fr] gap-10 items-center px-14">
      <div className="flex flex-col items-center gap-5">
        <div className="p-5 bg-white rounded-3xl border border-border shadow-[0_20px_50px_-30px_rgba(47,41,37,0.4)]">
          <QRCodeSVG value={joinLink} size={320} fgColor="#2F2925" />
        </div>
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Scan to join</div>
          <div className="mt-1 text-lg font-semibold break-all">{host}</div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-6">
        {deckName && <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">{deckName.split(":")[0]}</div>}
        <h1 className="text-5xl font-bold text-center leading-tight">
          {n === 0 ? "Waiting for the first player" : n === 1 ? "1 creature is here" : `${n} creatures are here`}
        </h1>
        <p className="text-muted-foreground -mt-2">Everyone gets a secret creature. Names stay hidden until two people both say yes.</p>
        <div className="max-h-[420px] overflow-hidden w-full pt-2">
          <Crowd users={users} size={n > 12 ? 72 : 100} pose="wave" />
        </div>
      </div>
    </div>
  );
}

export function ScreenReveal({ users }: { users: Users }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-14">
      <h1 className="text-5xl font-bold text-center">Check your phones</h1>
      <p className="text-xl text-muted-foreground text-center max-w-2xl">
        Everyone now picks who they want to meet. A name only shows when both people choose each other.
      </p>
      <div className="mt-6">
        <Crowd users={users} size={Object.keys(users).length > 12 ? 72 : 100} pose="cheer" />
      </div>
    </div>
  );
}
