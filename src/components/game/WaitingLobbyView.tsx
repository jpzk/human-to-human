import { useState } from "react";
// import { QRCodeSVG } from "qrcode.react"; // Commented out for future use
import { Button } from "@/components/ui/button";
import type { LobbyConfig } from "@/types/game";

type User = {
  name: string;
  color: string;
};

type WaitingLobbyViewProps = {
  users: Record<string, User>;
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
  lobbyConfig,
  roomLink,
  isHost,
  onStartGame,
  onCopyLink,
}: WaitingLobbyViewProps) {
  const [copied, setCopied] = useState(false);
  const playerList = Object.values(users);
  const canStart = playerList.length >= 2 && lobbyConfig !== null;

  const handleCopy = async () => {
    await onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-background">
      <div className="w-full max-w-4xl px-8 py-12">
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
              <div className="space-y-2">
                {playerList.map((player, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 border border-border rounded-lg bg-background"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: player.color }}
                    />
                    <span className="font-medium">{player.name}</span>
                  </div>
                ))}
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
            {/* QR Code - Commented out for future use
            <div className="p-6 bg-white rounded-lg border border-border">
              <QRCodeSVG value={roomLink} size={200} />
            </div>
            */}

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
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
