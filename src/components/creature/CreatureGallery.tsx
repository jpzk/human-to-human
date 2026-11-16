import { useState } from "react";
import { Creature, type CreaturePose } from "./Creature";
import { ANIMAL_NAMES } from "./animals";
import { ADJECTIVE_NAMES } from "./faces";

const COLORS = ["#F89A8A", "#F9AE77", "#ECCB60", "#BEC97E", "#87D3C3", "#92BFDB", "#C4B9E0", "#F4A4C2"];
const POSES: CreaturePose[] = ["idle", "wave", "cheer", "hf-left", "hf-both", "hf-right"];

// Design sheet for the creature system: every animal, every adjective, poses.
// Open with ?creatures
export function CreatureGallery() {
  const [animal, setAnimal] = useState("Fox");
  const [moving, setMoving] = useState(false);
  return (
    <div className="min-h-screen p-10 text-foreground" style={{ cursor: "auto" }}>
      <h1 className="text-3xl font-bold mb-2">Creatures</h1>
      <p className="text-muted-foreground mb-6">16 animals x 16 adjectives = 256 combinations. Click an animal to see it with every adjective.</p>
      <label className="flex items-center gap-2 mb-6 text-sm">
        <input type="checkbox" checked={moving} onChange={(e) => setMoving(e.target.checked)} /> moving
      </label>
      <section className="grid grid-cols-8 gap-4 mb-10">
        {ANIMAL_NAMES.map((a, i) => (
          <button key={a} onClick={() => setAnimal(a)} className={`flex flex-col items-center gap-1 rounded-xl p-3 border ${a === animal ? "border-foreground" : "border-border"}`}>
            <Creature name={`${ADJECTIVE_NAMES[(i * 5) % 16]} ${a}`} color={COLORS[i % 8]} size={96} moving={moving} />
            <span className="text-sm">{ADJECTIVE_NAMES[(i * 5) % 16]} {a}</span>
          </button>
        ))}
      </section>
      <h2 className="text-xl font-semibold mb-4">{animal} with every adjective</h2>
      <section className="grid grid-cols-8 gap-4 mb-10">
        {ADJECTIVE_NAMES.map((adj, i) => (
          <div key={adj} className="flex flex-col items-center gap-1 rounded-xl p-3 border border-border">
            <Creature name={`${adj} ${animal}`} color={COLORS[i % 8]} size={96} moving={moving} />
            <span className="text-sm">{adj}</span>
          </div>
        ))}
      </section>
      <h2 className="text-xl font-semibold mb-4">Poses</h2>
      <section className="flex gap-6 items-end">
        {POSES.map((pose, i) => (
          <div key={pose} className="flex flex-col items-center gap-1">
            <Creature name={`Happy ${ANIMAL_NAMES[i * 2]}`} color={COLORS[i]} size={110} pose={pose} />
            <span className="text-sm">{pose}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
