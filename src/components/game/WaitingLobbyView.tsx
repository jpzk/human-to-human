import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "framer-motion";
import { Creature } from "@/components/creature/Creature";
import { Button } from "@/components/ui/button";
import type { LobbyConfig } from "@/types/game";

type User = {
  name: string;
  color: string;
};

type WaitingLobbyViewProps = {
  users: Record<string, User>;
  myId: string | null;
  lobbyConfig: LobbyConfig | null;
  roomLink: string;
  isHost: boolean;
  onStartGame: () => void;
  onCopyLink: () => void;
};

const DECK_LABELS: Record<string, string> = {
  "Friendship Fortunes": "Friendship Fortunes",
  "Love in Harmony": "Love in Harmony",
  "Whispers of the Heart": "Whispers of the Heart",
  "Office Allies: Building Bonds Beyond Cubicles": "Office Allies",
};

export function WaitingLobbyView({
  users,
  myId,
  lobbyConfig,
  roomLink,
  isHost,
  onStartGame,
  onCopyLink,
}: WaitingLobbyViewProps) {
  const [copied, setCopied] = useState(false);
  const playerList = Object.values(users);
  const canStart = playerList.length >= 2 && lobbyConfig !== null;
  const currentUser = myId ? users[myId] : null;

  const handleCopy = async () => {
    await onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-background mobile:h-auto mobile:min-h-full">
      <div className="w-full max-w-4xl px-8 py-12 mobile:px-4 mobile:py-4">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left side: Player list and config */}
          <div className="space-y-6">
            <div className="text-center md:text-left space-y-2">
              <h1 className="text-4xl font-bold">Waiting for Friends</h1>
              <p className="text-muted-foreground">
                Share the link to invite others
              </p>
            </div>

            {/* Lobby Config */}
            {lobbyConfig ? (
              <div className="p-4 border border-border rounded-lg bg-muted/30">
                <div className="text-sm">
                  <span className="text-muted-foreground">Deck: </span>
                  <span className="font-medium">
                    {lobbyConfig.deck
                      ? DECK_LABELS[lobbyConfig.deck] || lobbyConfig.deck
                      : "Unknown"}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Player List */}
            <div className="space-y-3">
              <div className="text-sm font-medium">
                Players ({playerList.length})
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                <AnimatePresence initial={false}>
                  {Object.entries(users).map(([id, player]) => (
                    <motion.div
                      key={id}
                      layout
                      initial={{ opacity: 0, scale: 0.6, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 22 }}
                      className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border bg-background ${id === myId ? "border-foreground/40" : "border-border"}`}
                    >
                      <Creature name={player.name} color={player.color} size={56} />
                      <span className="text-xs font-semibold text-center leading-tight">{player.name}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Start Game Button */}
            <Button
              onClick={onStartGame}
              disabled={!canStart || !isHost}
              className="w-full"
              size="lg"
              effect="expand"
            >
              {!lobbyConfig
                ? "Waiting for host to configure..."
                : !isHost
                ? "Waiting for host to start..."
                : canStart
                ? "Start Game"
                : `Need ${2 - playerList.length} more player${playerList.length === 0 ? "s" : ""}`}
            </Button>
          </div>

          {/* Right side: Share Link */}
          <div className="flex flex-col items-center justify-center space-y-6">
            {/* Your creature */}
            {currentUser && (
              <div className="flex items-center gap-4 p-4 pr-6 rounded-2xl border border-border bg-muted/40 w-full">
                <Creature name={currentUser.name} color={currentUser.color} size={120} pose="wave" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">You are</div>
                  <div className="text-2xl font-bold">{currentUser.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">Nobody knows it is you until you both agree.</div>
                </div>
              </div>
            )}

            <div className="p-3 bg-white rounded-xl border border-border">
              <QRCodeSVG value={roomLink} size={150} fgColor="#2F2925" />
            </div>

            <div className="w-full space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={roomLink}
                  className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background"
                />
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  size="default"
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Share the link to invite players
                {isHost && (
                  <>
                    {" · "}
                    <a href={`${roomLink}&screen`} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                      Open projector screen
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
