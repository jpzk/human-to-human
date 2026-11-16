import { memo, type CSSProperties } from "react";
import { ANIMALS, ANIMAL_NAMES, type Palette } from "./animals";
import { ADJECTIVES, ADJECTIVE_NAMES, Face } from "./faces";
import "./creature.css";

export type CreaturePose = "idle" | "hf-left" | "hf-right" | "hf-both" | "wave" | "cheer";

type Props = {
  name: string; // "Swift Panda"
  color: string; // player colour, hex
  size?: number;
  moving?: boolean;
  facingLeft?: boolean;
  clicking?: boolean;
  surprised?: boolean;
  pose?: CreaturePose;
  className?: string;
  style?: CSSProperties;
};

const INK = "#2F2925";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return a;
  const c = x.map((v, i) => Math.round(v * (1 - t) + y[i] * t));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

export function parseCreatureName(name: string) {
  const [a = "", n = ""] = name.split(" ");
  const h = hash(name);
  return {
    adjective: ADJECTIVES[a] ? a : ADJECTIVE_NAMES[h % ADJECTIVE_NAMES.length],
    animal: ANIMALS[n] ? n : ANIMAL_NAMES[(h >> 8) % ANIMAL_NAMES.length],
    seed: h,
  };
}

export const Creature = memo(function Creature({
  name,
  color,
  size = 48,
  moving,
  facingLeft,
  clicking,
  surprised,
  pose = "idle",
  className = "",
  style,
}: Props) {
  const { adjective, animal, seed } = parseCreatureName(name);
  const def = ANIMALS[animal];
  const adj = ADJECTIVES[adjective];
  const rig = def.rig;
  const p: Palette = {
    main: color,
    dark: mix(color, "#3A2F2A", 0.42),
    light: adj.tint ?? mix(color, "#FFFAF2", 0.68),
    ink: INK,
  };
  const [lx, ly] = rig.arms.l;
  const [rx, ry] = rig.arms.r;
  const vars = {
    "--cr-delay": `${-((seed % 1000) / 1000) * 4}s`,
    "--cr-blink": `${3.6 + (seed % 7) * 0.35}s`,
    ...style,
  } as CSSProperties;

  // poses are authored for a creature facing right; mirror them when flipped
  const effPose: CreaturePose = facingLeft
    ? pose === "hf-left" ? "hf-right" : pose === "hf-right" ? "hf-left" : pose
    : pose;
  const classes = [
    "creature",
    `cr-${adjective.toLowerCase()}`,
    moving && "cr-moving",
    clicking && "cr-clicking",
    surprised && "cr-surprised",
    `cr-pose-${effPose}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} style={vars} aria-label={name} role="img">
      <svg viewBox="-8 -10 80 80" width={size} height={size} overflow="visible">
        <g className="cr-motion">
          <g className="cr-squash">
            <g className={`cr-lean${facingLeft ? " cr-flip" : ""}`}>
              {/* invisible frame: pins the fill-box so origins land at x=32, feet at y=62 */}
              <rect x="-16" y="-14" width="96" height="76" fill="none" stroke="none" />
              <g stroke={INK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                {adj.backAccessory?.(p, rig)}
                {def.back?.(p)}
                {def.body(p)}
                <g className="cr-arm cr-arm-l">
                  <circle cx={lx} cy={ly} r="26" fill="none" stroke="none" />
                  {def.arm(p)}
                </g>
                <g className="cr-arm cr-arm-r">
                  <circle cx={rx} cy={ry} r="26" fill="none" stroke="none" />
                  <g transform="translate(64 0) scale(-1 1)">{def.arm(p)}</g>
                </g>
                <g className="cr-head">
                  <circle cx={rig.head.cx} cy={rig.head.cy + rig.head.r} r="34" fill="none" stroke="none" />
                  {def.head(p)}
                  <Face adj={adj} p={p} rig={rig} surprised={surprised} />
                  {def.front?.(p)}
                  <g strokeWidth="1.3">{adj.accessory?.(p, rig)}</g>
                </g>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
});
