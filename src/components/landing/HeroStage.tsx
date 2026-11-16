import { useEffect, useRef, useState } from "react";
import { Cursor } from "@/components/game/Cursor";
import type { CreaturePose } from "@/components/creature/Creature";

// A tiny live simulation for the landing hero: creatures wander like real
// players' cursors, and every few seconds two of them meet and high-five.

type Agent = {
  name: string;
  color: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number; // ms left idling at the target
  pose: CreaturePose;
  busy: boolean; // walking to / doing a high-five
};

const CAST: [string, string][] = [
  ["Happy Panda", "#F89A8A"],
  ["Swift Fox", "#F9AE77"],
  ["Lucky Bee", "#ECCB60"],
  ["Calm Frog", "#BEC97E"],
  ["Gentle Seal", "#87D3C3"],
  ["Wise Owl", "#92BFDB"],
  ["Cozy Bear", "#C4B9E0"],
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// a free spot at least `gap` px from every other agent's target, so name
// pills do not pile up (best of a few random tries)
function freeSpot(list: Agent[], self: Agent | null, w: number, h: number, gap = 120) {
  let best = { x: rand(10, w - 170), y: rand(10, h - 120) };
  let bestD = -1;
  for (let i = 0; i < 12; i++) {
    const c = { x: rand(10, w - 170), y: rand(10, h - 120) };
    const d = Math.min(...list.filter((o) => o !== self).map((o) => Math.hypot(o.tx - c.x, (o.ty - c.y) * 1.6)), 9999);
    if (d > bestD) { best = c; bestD = d; }
    if (d > gap) break;
  }
  return best;
}

export function HeroStage({ width, height }: { width: number; height: number }) {
  const agents = useRef<Agent[]>([]);
  const [, setTick] = useState(0);

  if (agents.current.length === 0 && width > 0) {
    const list: Agent[] = [];
    for (const [name, color] of CAST.slice(0, width < 520 ? 4 : CAST.length)) {
      const s = freeSpot(list, null, width, height, 150);
      list.push({ name, color, x: s.x, y: s.y, tx: s.x, ty: s.y, wait: rand(0, 1500), pose: "idle", busy: false });
    }
    agents.current = list;
  }

  useEffect(() => {
    if (width === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let last = performance.now();
    let sinceMeet = 0;
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      sinceMeet += dt;
      const list = agents.current;

      if (sinceMeet > 4200) {
        sinceMeet = 0;
        const free = list.filter((a) => !a.busy);
        if (free.length >= 2) {
          const a = free[Math.floor(Math.random() * free.length)];
          const others = free.filter((o) => o !== a);
          const b = others[Math.floor(Math.random() * others.length)];
          const spot = freeSpot(list, null, width - 50, height, 140);
          const mx = spot.x;
          const my = spot.y;
          Object.assign(a, { tx: mx, ty: my, busy: true, wait: 0 });
          Object.assign(b, { tx: mx + 42, ty: my, busy: true, wait: 0 });
          (a as Agent & { partner?: Agent }).partner = b;
          (b as Agent & { partner?: Agent }).partner = a;
        }
      }

      for (const a of list as (Agent & { partner?: Agent; hf?: number })[]) {
        const dx = a.tx - a.x;
        const dy = a.ty - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          const speed = (a.busy ? 0.16 : 0.09) * dt;
          const k = Math.min(1, speed / d);
          a.x += dx * k;
          a.y += dy * k;
          continue;
        }
        if (a.busy && a.partner) {
          const p = a.partner as typeof a;
          const pd = Math.hypot(p.tx - p.x, p.ty - p.y);
          if (pd <= 1 && a.hf === undefined) {
            a.hf = 1100;
            a.pose = a.x < p.x ? "hf-right" : "hf-left";
          }
          if (a.hf !== undefined) {
            a.hf -= dt;
            if (a.hf <= 0) {
              a.hf = undefined;
              a.pose = "idle";
              a.busy = false;
              a.partner = undefined;
              a.wait = rand(600, 1400);
            }
          }
          continue;
        }
        a.wait -= dt;
        if (a.wait <= 0) {
          const spot = freeSpot(list, a, width, height);
          a.tx = spot.x;
          a.ty = spot.y;
          a.wait = rand(900, 2600);
        }
      }
      setTick((t) => (t + 1) % 1_000_000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return (
    <div className="absolute inset-0" aria-hidden>
      {agents.current.map((a) => (
        <div key={a.name} className="absolute" style={{ left: 0, top: 0, transform: `translate(${a.x}px, ${a.y}px)` }}>
          <Cursor name={a.name} color={a.color} x={Math.round(a.x)} y={Math.round(a.y)} pose={a.pose} showName={!a.busy} />
        </div>
      ))}
    </div>
  );
}
