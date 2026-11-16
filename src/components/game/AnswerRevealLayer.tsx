import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Creature, type CreaturePose } from "@/components/creature/Creature";
import type { AnswerRevealMessage } from "@/types/messages";

type Props = {
  reveal: AnswerRevealMessage;
  starts: Record<string, { x: number; y: number } | undefined>; // stage coords of each cursor
  sliderPositions?: number;
};

type Spark = { key: string; x: number; y: number; delay: number };
type Placed = { id: string; name: string; color: string; x: number; y: number; sx: number; sy: number; pose: CreaturePose; size: number; delay: number };

// Row poses: edge creatures high-five inwards, middle ones both ways.
function poseFor(i: number, n: number): CreaturePose {
  if (n === 1) return "cheer";
  if (i === 0) return "hf-right";
  if (i === n - 1) return "hf-left";
  return "hf-both";
}

// Everyone answered: each creature leaves its cursor, flies to the answer it
// picked, lines up with the others who picked it, and neighbours high-five.
export function AnswerRevealLayer({ reveal, starts, sliderPositions }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [landed, setLanded] = useState(false);
  const [sparks, setSparks] = useState<Spark[]>([]);

  useLayoutEffect(() => {
    const layer = ref.current;
    const root = layer?.parentElement;
    if (!layer || !root) return;
    const lr = layer.getBoundingClientRect();
    const scale = lr.width / layer.offsetWidth || 1;
    const local = (r: DOMRect) => ({
      left: (r.left - lr.left) / scale,
      top: (r.top - lr.top) / scale,
      width: r.width / scale,
      height: r.height / scale,
    });

    // group answers by target
    const groups = new Map<string, AnswerRevealMessage["answers"]>();
    for (const a of reveal.answers) {
      const key = a.answerId ?? `v${a.value}`;
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }

    const track = root.querySelector("[data-slider-track]");
    const out: Placed[] = [];
    const sp: Spark[] = [];
    let order = 0;
    for (const [key, members] of groups) {
      let anchor: { x: number; y: number; along: number; size: number; side: boolean } | null = null;
      if (key.startsWith("v") && track && sliderPositions) {
        const t = local(track.getBoundingClientRect());
        const v = Number(key.slice(1));
        const size = t.width > 420 ? 60 : 46;
        // creatures stand on the track at their value
        anchor = { x: t.left + (v / Math.max(1, sliderPositions - 1)) * t.width, y: t.top - size * 0.8, along: t.width * 0.7, size, side: false };
      } else {
        const card = root.querySelector(`[data-answer-id="${key}"]`);
        if (card) {
          const c = local(card.getBoundingClientRect());
          const side = c.height < 100; // short phone cards: row on the right
          const size = side ? 42 : 72;
          anchor = side
            ? { x: c.left + c.width - 12 - (Math.min(members.length, 5) * size * 0.62) / 2, y: c.top + c.height / 2 - size * 0.6, along: c.width * 0.5, size, side }
            : { x: c.left + c.width / 2, y: c.top + c.height - size * 0.9, along: c.width - 16, size, side };
        }
      }
      if (!anchor) continue;
      // 0.55 x size puts neighbours' raised paws together
      const step = Math.min(anchor.size * 0.55, anchor.along / Math.max(1, members.length));
      const n = members.length;
      for (let i = 0; i < n - 1; i++) {
        sp.push({ key: `${key}-${i}`, x: anchor.x + (i + 0.5 - (n - 1) / 2) * step, y: anchor.y + anchor.size * 0.2, delay: 0 });
      }
      members.forEach((m, i) => {
        const x = anchor!.x + (i - (n - 1) / 2) * step - anchor!.size / 2;
        const start = starts[m.id];
        out.push({
          id: m.id,
          name: m.name,
          color: m.color,
          x,
          y: anchor!.y,
          sx: start ? start.x + 6 : x,
          sy: start ? start.y + 10 : anchor!.y + 60,
          pose: poseFor(i, n),
          size: anchor!.size,
          delay: order++ * 0.06,
        });
      });
    }
    setPlaced(out);
    setSparks(sp);
    setLanded(false);
    const t = setTimeout(() => setLanded(true), 900 + order * 60);
    return () => clearTimeout(t);
    // starts are read once, when the reveal arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, sliderPositions]);

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none z-20" aria-hidden>
      {placed.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-0 top-0"
          initial={{ x: p.sx, y: p.sy, scale: 0.6, opacity: 0 }}
          animate={{ x: p.x, y: p.y, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 16, delay: p.delay }}
        >
          <Creature name={p.name} color={p.color} size={p.size} pose={landed ? p.pose : "idle"} moving={!landed} />
        </motion.div>
      ))}
      {landed && sparks.map((s) => <span key={s.key} className="hf-spark" style={{ left: s.x, top: s.y }} />)}
    </div>
  );
}
