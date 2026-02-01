import { useState } from "react";
import { Button } from "@/components/ui/button";

type CreateLobbyViewProps = {
  onCreateLobby: (config: { deck?: string }) => void;
};

const DECKS = [
  { value: "Friendship Fortunes", label: "Friendship Fortunes" },
  { value: "Love in Harmony", label: "Love in Harmony" },
  { value: "Whispers of the Heart", label: "Whispers of the Heart" },
  { value: "Office Allies: Building Bonds Beyond Cubicles", label: "Office Allies" },
];

export function CreateLobbyView({ onCreateLobby }: CreateLobbyViewProps) {
  const [deck, setDeck] = useState("Friendship Fortunes");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateLobby({ deck });
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-background">
      <div className="w-full max-w-md px-8 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Create a Group</h1>
          <p className="text-muted-foreground">
            Configure your quiz deck and invite others to join
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Deck</label>
            <div className="grid grid-cols-2 gap-3">
              {DECKS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDeck(d.value)}
                  className={`px-4 py-3 rounded-md border transition-all relative ${
                    deck === d.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background hover:border-primary/50"
                  }`}
                >
                  <span>{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" effect="expand">
            Create Group
          </Button>
        </form>
      </div>
    </div>
  );
}
