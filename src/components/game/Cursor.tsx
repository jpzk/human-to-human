import React, { useEffect, useRef, useState } from "react";
import { Creature, type CreaturePose } from "@/components/creature/Creature";

// Arrow tip sits at (4,4): the hotspot the wrappers offset by.
const POINTER_PATH = "M4 4 L4 19.5 L8.4 15.4 L11.4 21.6 L14.2 20.3 L11.2 14.2 L17.2 13.8 Z";

type CursorProps = {
  name: string;
  color: string;
  x?: number;
  y?: number;
  velocity?: number;
  dropEventId?: number;
  isClicking?: boolean;
  isOnCooldown?: boolean;
  surprised?: boolean;
  pose?: CreaturePose;
  showName?: boolean;
  away?: boolean; // creature is off at the answer reveal
};

// Derives "moving" and facing from successive positions, touching React state
// only when one of them flips (positions arrive at up to 30 fps).
function useMotion(x?: number, y?: number) {
  const prev = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [moving, setMoving] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);

  useEffect(() => {
    if (x == null || y == null) return;
    const p = prev.current;
    prev.current = { x, y };
    if (!p) return;
    const dx = x - p.x;
    const dist = Math.hypot(dx, y - p.y);
    if (dist < 1.5) return;
    if (Math.abs(dx) > 1.5) setFacingLeft(dx < 0);
    setMoving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoving(false), 180);
  }, [x, y]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { moving, facingLeft };
}

export function Cursor({
  name,
  color,
  x,
  y,
  velocity = 0,
  dropEventId,
  isClicking = false,
  isOnCooldown = false,
  surprised = false,
  pose,
  showName = true,
  away = false,
}: CursorProps) {
  const { moving, facingLeft } = useMotion(x, y);
  return (
    <div
      className={`cursor ${isOnCooldown ? "on-cooldown" : ""} ${isClicking ? "clicking" : ""}`}
      style={{ "--color": color, "--velocity": velocity } as React.CSSProperties}
    >
      {dropEventId !== undefined && <div key={dropEventId} className="cursor-ripple" />}
      <svg className="cursor-icon" width="24" height="24" viewBox="0 0 24 24">
        <path d={POINTER_PATH} fill={color} stroke="#2F2925" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <Creature
        className={`cursor-creature${away ? " cursor-creature-away" : ""}`}
        name={name}
        color={color}
        size={60}
        moving={moving}
        facingLeft={facingLeft}
        clicking={isClicking}
        surprised={surprised}
        pose={pose}
      />
      <span className={`cursor-name${showName ? "" : " cursor-name-hidden"}`}>{name}</span>
    </div>
  );
}
