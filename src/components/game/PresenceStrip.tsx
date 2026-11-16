import { Creature } from "@/components/creature/Creature";

type Props = {
  users: Record<string, { name: string; color: string }>;
  myId: string | null;
  answered?: string[]; // names that answered the current question
};

// Phones have no cursors, so presence is a strip of everyone's creature.
// Players who already answered cheer and get a tick.
export function PresenceStrip({ users, myId, answered = [] }: Props) {
  const list = Object.entries(users);
  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 py-2 no-scrollbar" aria-label="Players">
      {list.map(([id, u]) => {
        const done = answered.includes(u.name);
        return (
          <div key={id} className="relative flex flex-col items-center shrink-0 w-12" title={u.name}>
            <Creature name={u.name} color={u.color} size={40} pose={done ? "cheer" : "idle"} />
            {done && (
              <span className="absolute top-0 right-0.5 h-4 w-4 rounded-full bg-[#4fae9a] text-white text-[10px] grid place-items-center font-bold">
                ✓
              </span>
            )}
            <span className={`text-[9px] leading-tight truncate w-full text-center ${id === myId ? "font-bold" : "text-muted-foreground"}`}>
              {id === myId ? "You" : u.name.split(" ")[1]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
