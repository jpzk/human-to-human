import type { ReactNode } from "react";
import type { Palette, Rig } from "./animals";

// An adjective gives a creature its face (eyes, brows, mouth, cheeks), an
// optional accessory and a motion personality (a CSS class in creature.css).

type EyeKind = "dot" | "sleepy" | "closed" | "wide" | "line" | "sparkle" | "squint" | "soft" | "dart" | "shine" | "focus";
type MouthKind = "smile" | "grin" | "open" | "flat" | "zip" | "cat" | "teeth" | "tiny" | "smirk";

export type AdjectiveDef = {
  eyes: EyeKind;
  mouth: MouthKind;
  brows?: "angry" | "up" | "flat";
  cheeks?: string;
  glasses?: boolean;
  accessory?: (p: Palette, rig: Rig) => ReactNode;
  backAccessory?: (p: Palette, rig: Rig) => ReactNode;
  tint?: string; // overrides the light tone (Frosty)
};

const INK_W = 1.7;

function Eye({ kind, ink, side }: { kind: EyeKind; ink: string; side: 1 | -1 }) {
  switch (kind) {
    case "sleepy":
      return <path d="M-2.7 -0.6 Q0 2.2 2.7 -0.6" fill="none" stroke={ink} strokeWidth={INK_W} />;
    case "closed":
      return <path d="M-2.6 0.8 Q0 -2.2 2.6 0.8" fill="none" stroke={ink} strokeWidth={INK_W} />;
    case "wide":
      return (
        <g>
          <circle r="3.3" fill="#FFFFFF" stroke={ink} strokeWidth="1.1" />
          <circle className="cr-pupil" r="1.7" fill={ink} stroke="none" />
        </g>
      );
    case "line":
      return <path d="M-2.4 0 L2.4 0" stroke={ink} strokeWidth={INK_W} />;
    case "squint":
      return side === 1 ? (
        <path d="M-2.2 -1.6 L1.6 0 L-2.2 1.6" fill="none" stroke={ink} strokeWidth={INK_W} />
      ) : (
        <g>
          <circle r="2.4" fill={ink} stroke="none" />
          <circle cx="0.8" cy="-0.8" r="0.8" fill="#FFFFFF" stroke="none" />
        </g>
      );
    case "soft":
      return (
        <g>
          <ellipse rx="1.9" ry="2.6" fill={ink} stroke="none" />
          <circle cx="0.6" cy="-1" r="0.7" fill="#FFFFFF" stroke="none" />
          <path d={`M${side * -1.6} -2.2 L${side * -3} -3.4`} stroke={ink} strokeWidth="1.1" />
        </g>
      );
    case "sparkle":
      return (
        <g>
          <circle r="2.6" fill={ink} stroke="none" />
          <path d="M0.9 -1.9 L1.2 -1.1 L2 -0.9 L1.2 -0.6 L0.9 0.2 L0.6 -0.6 L-0.2 -0.9 L0.6 -1.1 Z" fill="#FFFFFF" stroke="none" />
        </g>
      );
    case "dart":
      return (
        <g>
          <circle r="2.8" fill="#FFFFFF" stroke={ink} strokeWidth="1" />
          <circle className="cr-dart" r="1.5" fill={ink} stroke="none" />
        </g>
      );
    case "shine":
      return (
        <g>
          <circle r="2.7" fill={ink} stroke="none" />
          <circle cx="0.9" cy="-0.9" r="1" fill="#FFFFFF" stroke="none" />
          <circle cx="-0.9" cy="0.9" r="0.5" fill="#FFFFFF" stroke="none" />
        </g>
      );
    case "focus":
      return (
        <g>
          <ellipse rx="2.3" ry="2" fill={ink} stroke="none" />
          <circle cx="0.7" cy="-0.6" r="0.7" fill="#FFFFFF" stroke="none" />
        </g>
      );
    default:
      return (
        <g>
          <circle r="2.3" fill={ink} stroke="none" />
          <circle cx="0.8" cy="-0.8" r="0.8" fill="#FFFFFF" stroke="none" />
        </g>
      );
  }
}

function Mouth({ kind, ink }: { kind: MouthKind; ink: string }) {
  switch (kind) {
    case "grin":
      return <path d="M-3.4 -0.6 Q0 0 3.4 -0.6 Q3 3.4 0 3.6 Q-3 3.4 -3.4 -0.6 Z" fill={ink} stroke="none" />;
    case "open":
      return (
        <g>
          <path d="M-3 -0.8 Q0 -0.2 3 -0.8 Q2.6 3.6 0 3.8 Q-2.6 3.6 -3 -0.8 Z" fill={ink} stroke="none" />
          <path d="M-1.7 2.6 Q0 1.4 1.7 2.6 Q1 3.5 0 3.5 Q-1 3.5 -1.7 2.6 Z" fill="#E98A8A" stroke="none" />
        </g>
      );
    case "flat":
      return <path d="M-2 0.6 L2 0.6" stroke={ink} strokeWidth={INK_W} />;
    case "zip":
      return (
        <g stroke={ink} strokeWidth="1.2">
          <path d="M-3 0.6 L3 0.6" strokeWidth={INK_W} />
          <path d="M-2 -0.4 L-2 1.6 M0 -0.4 L0 1.6 M2 -0.4 L2 1.6" />
        </g>
      );
    case "cat":
      return <path d="M-2.6 0 Q-1.3 1.8 0 0 Q1.3 1.8 2.6 0" fill="none" stroke={ink} strokeWidth={INK_W} />;
    case "teeth":
      return (
        <g>
          <path d="M-3.4 -0.4 Q0 0.2 3.4 -0.4 Q3 3.4 0 3.6 Q-3 3.4 -3.4 -0.4 Z" fill={ink} stroke="none" />
          <path d="M-2.4 -0.1 L-1.6 1.2 L-0.8 0.05 Z M2.4 -0.1 L1.6 1.2 L0.8 0.05 Z" fill="#FFFFFF" stroke="none" />
        </g>
      );
    case "tiny":
      return <path d="M-1.3 0.2 Q0 1.4 1.3 0.2" fill="none" stroke={ink} strokeWidth={INK_W} />;
    case "smirk":
      return <path d="M-2.4 0.8 Q0.5 1.4 2.6 -0.6" fill="none" stroke={ink} strokeWidth={INK_W} />;
    default:
      return <path d="M-2.3 0 Q0 2.2 2.3 0" fill="none" stroke={ink} strokeWidth={INK_W} />;
  }
}

function Brows({ kind, ink, sp }: { kind: AdjectiveDef["brows"]; ink: string; sp: number }) {
  if (!kind) return null;
  const d =
    kind === "angry"
      ? `M${-sp - 2.6} -5.2 L${-sp + 2.4} -3.6 M${sp + 2.6} -5.2 L${sp - 2.4} -3.6`
      : kind === "up"
        ? `M${-sp - 2.4} -4 L${-sp + 2} -5.4 M${sp + 2.4} -4 L${sp - 2} -5.4`
        : `M${-sp - 2.4} -4.6 L${-sp + 2.2} -4.6 M${sp + 2.4} -4.6 L${sp - 2.2} -4.6`;
  return <path d={d} stroke={ink} strokeWidth={kind === "angry" ? 2 : 1.5} />;
}

export function Face({ adj, p, rig, surprised }: { adj: AdjectiveDef; p: Palette; rig: Rig; surprised?: boolean }) {
  const { x, y, s, sp, md } = rig.face;
  const eyes: EyeKind = surprised ? "wide" : adj.eyes;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {adj.cheeks && (
        <g fill={adj.cheeks} stroke="none">
          <ellipse cx={-sp - 2.4} cy="3.6" rx="2.4" ry="1.5" />
          <ellipse cx={sp + 2.4} cy="3.6" rx="2.4" ry="1.5" />
        </g>
      )}
      <g className="cr-eyes">
        <g transform={`translate(${-sp} 0)`}>
          <g className="cr-blink"><Eye kind={eyes} ink={p.ink} side={-1} /></g>
        </g>
        <g transform={`translate(${sp} 0)`}>
          <g className="cr-blink"><Eye kind={eyes} ink={p.ink} side={1} /></g>
        </g>
      </g>
      {adj.glasses && (
        <g fill="none" stroke={p.ink} strokeWidth="1.2">
          <circle cx={-sp} r="4.3" fill="#FFFFFF" fillOpacity="0.25" />
          <circle cx={sp} r="4.3" fill="#FFFFFF" fillOpacity="0.25" />
          <path d={`M${-sp + 4.3} -0.4 Q0 -2 ${sp - 4.3} -0.4`} />
        </g>
      )}
      <Brows kind={surprised ? "up" : adj.brows} ink={p.ink} sp={sp} />
      {!rig.beak && (
        <g transform={`translate(0 ${md})`}>
          <Mouth kind={surprised ? "open" : adj.mouth} ink={p.ink} />
        </g>
      )}
    </g>
  );
}

const BLUSH = "rgba(233, 120, 120, 0.45)";

const topOf = (rig: Rig) => ({ x: rig.head.cx, y: rig.head.cy - rig.head.r });

export const ADJECTIVES: Record<string, AdjectiveDef> = {
  Swift: {
    eyes: "focus",
    mouth: "smirk",
    brows: "angry",
    backAccessory: (p) => (
      <g className="cr-speedlines" stroke={p.dark} strokeWidth="2" fill="none">
        <path d="M2 30 L-8 30 M4 38 L-10 38 M3 46 L-6 46" />
      </g>
    ),
  },
  Cozy: {
    eyes: "sleepy",
    mouth: "tiny",
    cheeks: BLUSH,
    accessory: (p, rig) => (
      <g>
        <path
          d={`M${rig.head.cx - 11} ${rig.neckY - 1} Q${rig.head.cx} ${rig.neckY + 4} ${rig.head.cx + 11} ${rig.neckY - 1} L${rig.head.cx + 11} ${rig.neckY + 3} Q${rig.head.cx} ${rig.neckY + 8} ${rig.head.cx - 11} ${rig.neckY + 3} Z`}
          fill="#D9644A"
        />
        <path d={`M${rig.head.cx + 5} ${rig.neckY + 3} L${rig.head.cx + 8} ${rig.neckY + 12} L${rig.head.cx + 11.5} ${rig.neckY + 11} L${rig.head.cx + 9} ${rig.neckY + 2}`} fill="#D9644A" />
      </g>
    ),
  },
  Bold: {
    eyes: "dot",
    mouth: "grin",
    brows: "flat",
    backAccessory: (_p, rig) => (
      <path className="cr-cape" d={`M${rig.head.cx - 9} ${rig.neckY} L${rig.head.cx - 15} 58 Q${rig.head.cx} 62 ${rig.head.cx + 15} 58 L${rig.head.cx + 9} ${rig.neckY} Z`} fill="#C9443A" />
    ),
  },
  Calm: { eyes: "closed", mouth: "smile", cheeks: BLUSH },
  Rusty: {
    eyes: "squint",
    mouth: "smirk",
    accessory: (_p, rig) => {
      const t = topOf(rig);
      return (
        <g transform={`translate(${t.x + 6} ${t.y + 6}) rotate(35)`}>
          <rect x="-4.5" y="-1.6" width="9" height="3.2" rx="1.6" fill="#E8C39E" />
          <rect x="-1.3" y="-1.6" width="2.6" height="3.2" fill="#D9A877" stroke="none" />
        </g>
      );
    },
  },
  Frosty: {
    eyes: "dot",
    mouth: "flat",
    cheeks: "rgba(120, 170, 230, 0.55)",
    tint: "#E3EEF8",
    accessory: (_p, rig) => {
      const t = topOf(rig);
      return (
        <g transform={`translate(${t.x - 7} ${t.y + 1})`} stroke="#5E8FC9" strokeWidth="1.4" fill="none">
          <path d="M0 -4 L0 4 M-3.5 -2 L3.5 2 M-3.5 2 L3.5 -2" />
        </g>
      );
    },
  },
  Nimble: { eyes: "wide", mouth: "smile", brows: "up" },
  Silent: { eyes: "line", mouth: "zip" },
  Happy: { eyes: "closed", mouth: "open", cheeks: BLUSH },
  Lucky: {
    eyes: "sparkle",
    mouth: "cat",
    accessory: (_p, rig) => {
      const t = topOf(rig);
      return (
        <g transform={`translate(${t.x + 2} ${t.y - 1})`}>
          <path d="M0 0 Q1 3 0 5" fill="none" stroke="#3E7D4F" strokeWidth="1.4" />
          {[0, 90, 180, 270].map((a) => (
            <circle key={a} cx="0" cy="-2.6" r="2.3" fill="#5BA36B" transform={`rotate(${a} 0 0) translate(0 0)`} />
          ))}
        </g>
      );
    },
  },
  Brave: {
    eyes: "focus",
    mouth: "grin",
    brows: "angry",
    accessory: (_p, rig) => {
      const { cx, cy, r } = rig.head;
      const y = cy - r * 0.55;
      return (
        <g>
          <path d={`M${cx - r * 0.82} ${y + 1} Q${cx} ${y - 3} ${cx + r * 0.82} ${y + 1}`} fill="none" stroke="#C9443A" strokeWidth="3.4" />
          <path d={`M${cx + r * 0.8} ${y} L${cx + r + 5} ${y - 3} M${cx + r * 0.8} ${y + 1} L${cx + r + 4} ${y + 5}`} stroke="#C9443A" strokeWidth="2.2" />
        </g>
      );
    },
  },
  Wise: { eyes: "dot", mouth: "tiny", glasses: true, brows: "flat" },
  Bright: {
    eyes: "shine",
    mouth: "smile",
    cheeks: BLUSH,
    backAccessory: (_p, rig) => <circle className="cr-glow" cx={rig.head.cx} cy={rig.head.cy} r={rig.head.r + 7} fill="#FFE9A8" stroke="none" />,
  },
  Wild: {
    eyes: "wide",
    mouth: "teeth",
    accessory: (p, rig) => {
      const t = topOf(rig);
      return <path d={`M${t.x - 5} ${t.y + 2} L${t.x - 4} ${t.y - 5} L${t.x - 1} ${t.y + 1} L${t.x + 1} ${t.y - 6} L${t.x + 3} ${t.y + 1} L${t.x + 6} ${t.y - 4} L${t.x + 5} ${t.y + 2.5}`} fill={p.dark} />;
    },
  },
  Gentle: {
    eyes: "soft",
    mouth: "smile",
    cheeks: BLUSH,
    accessory: (_p, rig) => {
      const t = topOf(rig);
      return (
        <g transform={`translate(${t.x - 9} ${t.y + 3})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx="0" cy="-2.2" r="1.9" fill="#F4B6C8" transform={`rotate(${a})`} />
          ))}
          <circle r="1.3" fill="#F2C94C" stroke="none" />
        </g>
      );
    },
  },
  Quick: { eyes: "dart", mouth: "open", brows: "up" },
};

export const ADJECTIVE_NAMES = Object.keys(ADJECTIVES);
