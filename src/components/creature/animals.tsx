import type { ReactNode } from "react";

// Every animal is drawn on the same 64x64 rig so any adjective face fits any
// body: head centre, face slot, neck and the two arm pivots (used for waving
// and high-fives) are declared per animal, the shapes themselves are free.

export type Palette = {
  main: string; // player colour
  dark: string; // markings
  light: string; // belly, muzzle
  ink: string; // outline
};

export type Rig = {
  head: { cx: number; cy: number; r: number };
  face: { x: number; y: number; s: number; sp: number; md: number };
  neckY: number;
  beak?: boolean; // the animal draws its own mouth (beak)
  arms: { l: [number, number]; r: [number, number] }; // pivots
};

export type AnimalDef = {
  rig: Rig;
  back?: (p: Palette) => ReactNode; // behind the body (tail, wings)
  body: (p: Palette) => ReactNode; // body + feet
  arm: (p: Palette) => ReactNode; // left arm, mirrored for the right
  head: (p: Palette) => ReactNode; // ears + head + markings
  front?: (p: Palette) => ReactNode; // above the face (beak, whiskers)
};

const mirror = (n: ReactNode) => <g transform="translate(64 0) scale(-1 1)">{n}</g>;
const both = (n: ReactNode) => (
  <>
    {n}
    {mirror(n)}
  </>
);

const RIG: Rig = {
  head: { cx: 32, cy: 24, r: 15 },
  face: { x: 32, y: 25, s: 1, sp: 6, md: 6 },
  neckY: 37,
  arms: { l: [22, 41], r: [42, 41] },
};

// shared pieces
const feet = (fill: string) => both(<ellipse cx="26.5" cy="57.5" rx="4.6" ry="3" fill={fill} />);
const bean = (p: Palette, belly = true) => (
  <>
    <ellipse cx="32" cy="46" rx="12" ry="10.5" fill={p.main} />
    {belly && <ellipse cx="32" cy="48" rx="7" ry="6.5" fill={p.light} stroke="none" />}
  </>
);
const pawArm = (fill: string) => <ellipse cx="20" cy="45.5" rx="3.6" ry="5.6" fill={fill} transform="rotate(22 20 45.5)" />;
const wingArm = (fill: string) => (
  <path d="M22 40 C15 42 13 49 15 53 C18 51 21 48 23 45 Z" fill={fill} />
);
const roundHead = (p: Palette, r = 15) => <circle cx="32" cy="24" r={r} fill={p.main} />;
const pointyEar = (fill: string, inner?: string) => (
  <>
    <path d="M19.5 18 L20.5 3.5 L29.5 11 Z" fill={fill} />
    {inner && <path d="M21.6 13.5 L22 7.5 L26 11 Z" fill={inner} stroke="none" />}
  </>
);
const insectLeg = (ink: string) => <path d="M22 44 Q16 45 14 50" fill="none" stroke={ink} />;

export const ANIMALS: Record<string, AnimalDef> = {
  Panda: {
    rig: RIG,
    body: (p) => (
      <>
        {feet(p.dark)}
        <ellipse cx="32" cy="46" rx="12" ry="10.5" fill={p.light} />
      </>
    ),
    arm: (p) => pawArm(p.dark),
    head: (p) => (
      <>
        {both(<circle cx="20.5" cy="12" r="5" fill={p.dark} />)}
        {roundHead({ ...p, main: p.light })}
        {both(<ellipse cx="25.5" cy="25" rx="4.4" ry="5.4" fill={p.dark} stroke="none" transform="rotate(25 25.5 25)" />)}
        <ellipse cx="32" cy="30.5" rx="2" ry="1.4" fill={p.ink} stroke="none" />
      </>
    ),
  },
  Bear: {
    rig: { ...RIG, face: { ...RIG.face, md: 7.5 } },
    body: (p) => (
      <>
        {feet(p.dark)}
        {bean(p)}
      </>
    ),
    arm: (p) => pawArm(p.main),
    head: (p) => (
      <>
        {both(
          <>
            <circle cx="20" cy="12" r="5.2" fill={p.main} />
            <circle cx="20" cy="12" r="2.6" fill={p.light} stroke="none" />
          </>,
        )}
        {roundHead(p)}
        <ellipse cx="32" cy="31" rx="6.5" ry="4.8" fill={p.light} stroke="none" />
        <ellipse cx="32" cy="28.6" rx="2.2" ry="1.5" fill={p.ink} stroke="none" />
      </>
    ),
  },
  Fox: {
    rig: { ...RIG, face: { ...RIG.face, md: 7 } },
    back: (p) => (
      <>
        <path d="M42 50 C52 50 58 42 56 32 C52 38 46 41 41 43 Z" fill={p.main} />
        <path d="M56 32 C55.5 36 53 38.5 50.5 39.5 C52 36 53.5 34 56 32 Z" fill={p.light} stroke="none" />
      </>
    ),
    body: (p) => (
      <>
        {feet(p.dark)}
        {bean(p)}
      </>
    ),
    arm: (p) => pawArm(p.main),
    head: (p) => (
      <>
        {both(pointyEar(p.main, p.dark))}
        <path d="M17 22 C17 13 24 9 32 9 C40 9 47 13 47 22 C47 31 40 38 32 38 C24 38 17 31 17 22 Z" fill={p.main} />
        <path d="M18.5 26 C22 26 27 28 32 33 C37 28 42 26 45.5 26 C44 33 38 38 32 38 C26 38 20 33 18.5 26 Z" fill={p.light} stroke="none" />
        <ellipse cx="32" cy="30" rx="1.9" ry="1.4" fill={p.ink} stroke="none" />
      </>
    ),
  },
  Wolf: {
    rig: { ...RIG, face: { ...RIG.face, md: 7.5 } },
    back: (p) => <path d="M41 50 C50 52 57 47 58 38 C53 42 47 43 41 44 Z" fill={p.dark} />,
    body: (p) => (
      <>
        {feet(p.dark)}
        {bean(p)}
      </>
    ),
    arm: (p) => pawArm(p.main),
    head: (p) => (
      <>
        {both(pointyEar(p.dark, p.light))}
        <path d="M17 23 C17 14 24 10 32 10 C40 10 47 14 47 23 L44.5 27 L47 30 C44 36 38 39 32 39 C26 39 20 36 17 30 L19.5 27 Z" fill={p.main} />
        <path d="M24 29 C27 28 30 29 32 31 C34 29 37 28 40 29 C39 35 36 38 32 38 C28 38 25 35 24 29 Z" fill={p.light} stroke="none" />
        <path d="M32 14 L30 19 L32 18 L34 19 Z" fill={p.dark} stroke="none" />
        <ellipse cx="32" cy="30.4" rx="2.1" ry="1.5" fill={p.ink} stroke="none" />
      </>
    ),
  },
  Lynx: {
    rig: { ...RIG, face: { ...RIG.face, md: 7 } },
    back: (p) => <ellipse cx="44" cy="52" rx="4" ry="3" fill={p.main} />,
    body: (p) => (
      <>
        {feet(p.main)}
        {bean(p)}
        <circle cx="25" cy="42" r="1.1" fill={p.dark} stroke="none" />
        <circle cx="39" cy="44" r="1.1" fill={p.dark} stroke="none" />
        <circle cx="36" cy="40" r="0.9" fill={p.dark} stroke="none" />
      </>
    ),
    arm: (p) => pawArm(p.main),
    head: (p) => (
      <>
        {both(
          <>
            {pointyEar(p.main, p.light)}
            <path d="M20.5 3.5 L19.5 -2" fill="none" stroke={p.ink} />
          </>,
        )}
        <path d="M17 22 C17 14 24 10 32 10 C40 10 47 14 47 22 L49 27 L45.5 28 L47.5 32 L43 32 C40 36 36 38 32 38 C28 38 24 36 21 32 L16.5 32 L18.5 28 L15 27 Z" fill={p.main} />
        <ellipse cx="32" cy="31" rx="6" ry="4.5" fill={p.light} stroke="none" />
        <path d="M32 29 L30.4 27.6 L33.6 27.6 Z" fill={p.ink} stroke="none" />
      </>
    ),
  },
  Deer: {
    rig: { ...RIG, face: { ...RIG.face, md: 7.5 } },
    body: (p) => (
      <>
        {feet(p.dark)}
        {bean(p)}
        <circle cx="26" cy="41" r="1.2" fill={p.light} stroke="none" />
        <circle cx="38.5" cy="42" r="1.2" fill={p.light} stroke="none" />
      </>
    ),
    arm: (p) => pawArm(p.main),
    head: (p) => (
      <>
        {both(
          <>
            <path d="M24 11 C23 6 21 3 18 0 M22 6.5 C19.5 6 17.5 4.5 16 2.5" fill="none" stroke={p.dark} strokeWidth="2.8" />
            <ellipse cx="15" cy="17" rx="6" ry="3" fill={p.main} transform="rotate(-20 15 17)" />
          </>,
        )}
        {roundHead(p, 14)}
        <ellipse cx="32" cy="31" rx="5.5" ry="4.2" fill={p.light} stroke="none" />
        <ellipse cx="32" cy="29.2" rx="2.2" ry="1.6" fill={p.ink} stroke="none" />
      </>
    ),
  },
  Seal: {
    rig: { ...RIG, face: { ...RIG.face, y: 26, md: 6.5 }, arms: { l: [21, 44], r: [43, 44] } },
    body: (p) => (
      <>
        {both(<path d="M30 55 C26 58 21 60 18 59 C20 56 24 54 28 53 Z" fill={p.dark} />)}
        <path d="M18 26 C18 14 46 14 46 26 C47 40 46 54 32 56 C18 54 17 40 18 26 Z" fill={p.main} />
        <ellipse cx="32" cy="47" rx="8" ry="7" fill={p.light} stroke="none" />
      </>
    ),
    arm: (p) => <path d="M21 42 C16 45 13 50 13 53 C17 52 20 49 23 47 Z" fill={p.dark} />,
    head: (p) => (
      <>
        <ellipse cx="32" cy="31" rx="5.5" ry="3.6" fill={p.light} stroke="none" />
        <ellipse cx="32" cy="29.4" rx="2" ry="1.4" fill={p.ink} stroke="none" />
      </>
    ),
    front: (p) =>
      both(
        <g fill={p.ink} stroke="none">
          <circle cx="28.5" cy="31.5" r="0.5" />
          <circle cx="27" cy="30.6" r="0.5" />
          <circle cx="27.4" cy="32.6" r="0.5" />
        </g>,
      ),
  },
  Owl: {
    rig: { ...RIG, beak: true, face: { ...RIG.face, y: 23, sp: 6.5 }, arms: { l: [21, 38], r: [43, 38] } },
    body: (p) => (
      <>
        {both(<path d="M25 56 L23 60 M27 56.5 L27 60.5 M29 56 L31 60" fill="none" stroke={p.ink} />)}
        <path d="M17 20 C17 10 47 10 47 20 C49 36 46 56 32 56 C18 56 15 36 17 20 Z" fill={p.main} />
        <path d="M24 42 Q26 44 28 42 M30 46 Q32 48 34 46 M36 42 Q38 44 40 42 M27 50 Q29 52 31 50 M33 50 Q35 52 37 50" fill="none" stroke={p.dark} strokeWidth="1.4" />
      </>
    ),
    arm: (p) => <path d="M21 33 C14 37 13 46 16 51 C19 47 21 42 22 38 Z" fill={p.dark} />,
    head: (p) => (
      <>
        {both(<path d="M18 14 L17 5 L24.5 11 Z" fill={p.dark} />)}
        {both(<circle cx="25.5" cy="23" r="6.2" fill={p.light} stroke="none" />)}
      </>
    ),
    front: () => <path d="M30.2 26.5 L33.8 26.5 L32 30.5 Z" fill="#E9B44C" />,
  },
  Hawk: {
    rig: { ...RIG, beak: true, face: { ...RIG.face, y: 22 } },
    back: (p) => <path d="M28 54 L26 61 L32 58 L38 61 L36 54 Z" fill={p.dark} />,
    body: (p) => (
      <>
        {both(<path d="M27 56 L25.5 59.5 M28.5 56 L28.5 60" fill="none" stroke={p.ink} />)}
        {bean(p)}
      </>
    ),
    arm: (p) => wingArm(p.dark),
    head: (p) => (
      <>
        {roundHead(p)}
        <path d="M18 17 C24 14 28 16 32 19 C36 16 40 14 46 17 L45 20 C41 18 37 19 32 22 C27 19 23 18 19 20 Z" fill={p.dark} stroke="none" />
      </>
    ),
    front: () => <path d="M29 26 C29 24 35 24 35 26.5 C35 29.5 33.5 31.5 31.8 32.5 C32.3 30.5 31 29.5 29.5 28.5 Z" fill="#E9B44C" />,
  },
  Crow: {
    rig: { ...RIG, beak: true },
    body: (p) => (
      <>
        {both(<path d="M27 56 L25.5 59.5 M28.5 56 L28.5 60" fill="none" stroke={p.ink} />)}
        <ellipse cx="32" cy="46" rx="12" ry="10.5" fill={p.dark} />
      </>
    ),
    arm: (p) => wingArm(p.dark),
    head: (p) => (
      <>
        <path d="M30 10 C29 5 31 3 33 2 C32.5 4.5 34 6 36 6.5 C34 7.5 33.5 9 33.5 10" fill={p.dark} />
        <circle cx="32" cy="24" r="15" fill={p.dark} />
        {both(<circle cx="26" cy="25" r="4.4" fill={p.main} stroke="none" />)}
      </>
    ),
    front: (p) => <path d="M28.5 28 L35.5 28 L32 34 Z" fill={p.ink} stroke={p.ink} />,
  },
  Dove: {
    rig: { ...RIG, beak: true },
    back: (p) => <path d="M40 50 C46 52 52 50 55 46 C50 46 45 45 41 44 Z" fill={p.light} />,
    body: (p) => (
      <>
        {both(<path d="M27 56 L25.5 59.5 M28.5 56 L28.5 60" fill="none" stroke={p.ink} />)}
        <ellipse cx="32" cy="46" rx="12" ry="10.5" fill={p.light} />
      </>
    ),
    arm: (p) => <path d="M22 40 C16 41 13 46 15 50 C18 49 21 47 23 45 Z" fill={p.main} />,
    head: (p) => (
      <>
        <circle cx="32" cy="24" r="15" fill={p.light} />
        <path d="M20 14 C24 10 40 10 44 14" fill="none" stroke={p.main} strokeWidth="3" />
      </>
    ),
    front: (p) => <path d="M30 28.5 L34 28.5 L32 31.5 Z" fill={p.dark} />,
  },
  Moth: {
    rig: { ...RIG, face: { ...RIG.face, md: 5.5 } },
    back: (p) =>
      both(
        <>
          <path d="M26 38 C14 26 4 30 4 40 C4 48 14 50 24 46 Z" fill={p.light} />
          <circle cx="12" cy="40" r="3.2" fill={p.dark} stroke="none" />
          <path d="M26 46 C18 50 14 56 18 59 C22 61 26 56 28 50 Z" fill={p.light} />
        </>,
      ),
    body: (p) => (
      <>
        <ellipse cx="32" cy="47" rx="8.5" ry="10.5" fill={p.main} />
        <path d="M25 44 Q32 46 39 44 M25.5 50 Q32 52 38.5 50" fill="none" stroke={p.dark} strokeWidth="1.6" />
      </>
    ),
    arm: (p) => insectLeg(p.ink),
    head: (p) => (
      <>
        {both(
          <>
            <path d="M27 12 C25 6 22 3 18 2" fill="none" stroke={p.ink} />
            <path d="M24 6 L21 7.5 M22 4 L19.5 5.5 M25.5 9 L22.5 10" fill="none" stroke={p.ink} strokeWidth="1.4" />
          </>,
        )}
        <path d="M18.5 30 C17 26 18 21 20 19 C19 14 24 10 32 10 C40 10 45 14 44 19 C46 21 47 26 45.5 30 C42 36 22 36 18.5 30 Z" fill={p.main} />
        <path d="M21 33 Q24 37 27 34.5 Q29.5 38 32 35 Q34.5 38 37 34.5 Q40 37 43 33" fill={p.light} stroke={p.ink} strokeWidth="1.6" />
      </>
    ),
  },
  Ant: {
    rig: { ...RIG, head: { cx: 32, cy: 23, r: 13 }, face: { x: 32, y: 24, s: 0.9, sp: 5.5, md: 5.5 }, neckY: 35, arms: { l: [26, 40], r: [38, 40] } },
    body: (p) => (
      <>
        {both(
          <>
            <path d="M26 47 Q19 49 17 55" fill="none" stroke={p.ink} />
            <path d="M27 52 Q22 56 23 60" fill="none" stroke={p.ink} />
          </>,
        )}
        <ellipse cx="32" cy="40" rx="5" ry="4.5" fill={p.dark} />
        <ellipse cx="32" cy="51" rx="9" ry="8" fill={p.main} />
      </>
    ),
    arm: (p) => <path d="M27 39 Q20 38 17 42" fill="none" stroke={p.ink} />,
    head: (p) => (
      <>
        {both(<path d="M27 12 L24 5 L18 3" fill="none" stroke={p.ink} />)}
        {both(<circle cx="18" cy="3" r="1.6" fill={p.dark} />)}
        <circle cx="32" cy="23" r="13" fill={p.main} />
      </>
    ),
  },
  Bee: {
    rig: { ...RIG, head: { cx: 32, cy: 24, r: 14 } },
    back: (p) =>
      both(
        <ellipse cx="20" cy="36" rx="7" ry="10" fill="#FFFFFF" fillOpacity="0.75" transform="rotate(-35 20 36)" />,
      ),
    body: (p) => (
      <>
        <path d="M32 60 L30.5 56 L33.5 56 Z" fill={p.ink} />
        <ellipse cx="32" cy="47" rx="11" ry="10" fill={p.main} />
        <path d="M22 45 C28 47 36 47 42 45 L42.6 49 C36 51 28 51 21.4 49 Z" fill={p.dark} stroke="none" />
        <path d="M24.5 53 C29 54.5 35 54.5 39.5 53 L37.5 55.5 C34 56.5 30 56.5 26.5 55.5 Z" fill={p.dark} stroke="none" />
      </>
    ),
    arm: (p) => insectLeg(p.ink),
    head: (p) => (
      <>
        {both(<path d="M27 11 C26 6 24 4 21 3" fill="none" stroke={p.ink} />)}
        {both(<circle cx="21" cy="3" r="1.8" fill={p.dark} />)}
        <circle cx="32" cy="24" r="14" fill={p.main} />
      </>
    ),
  },
  Crab: {
    rig: {
      head: { cx: 32, cy: 40, r: 16 },
      face: { x: 32, y: 21, s: 1, sp: 7.5, md: 21 },
      neckY: 52,
      arms: { l: [17, 42], r: [47, 42] },
    },
    body: (p) => (
      <>
        {both(
          <>
            <path d="M20 48 Q14 52 13 57 M22 51 Q18 55 18 60" fill="none" stroke={p.ink} />
          </>,
        )}
        {both(<path d="M27 32 L24.5 22" fill="none" stroke={p.ink} />)}
        <path d="M14 40 C14 30 50 30 50 40 C50 50 42 54 32 54 C22 54 14 50 14 40 Z" fill={p.main} />
        <path d="M22 38 Q24 36.5 26 38 M38 38 Q40 36.5 42 38" fill="none" stroke={p.dark} strokeWidth="1.4" />
      </>
    ),
    arm: (p) => (
      <>
        <path d="M17 42 Q11 40 9.5 34" fill="none" stroke={p.ink} />
        <path d="M9.5 34 C4 33 3 26 7 23 L9 29 L11.5 24 C15 27 14 33 9.5 34 Z" fill={p.main} />
      </>
    ),
    head: (p) => both(<circle cx="24.5" cy="21" r="4.6" fill="#FFFFFF" />),
  },
  Frog: {
    rig: { ...RIG, head: { cx: 32, cy: 27, r: 16 }, face: { x: 32, y: 18, s: 1, sp: 8.5, md: 13 } },
    body: (p) => (
      <>
        {both(<path d="M27 55 C23 56 19 59 17 60 L25 60 C27 59 29 58 30 57 Z" fill={p.main} />)}
        <ellipse cx="32" cy="48" rx="12" ry="9.5" fill={p.main} />
        <ellipse cx="32" cy="50" rx="7.5" ry="6" fill={p.light} stroke="none" />
      </>
    ),
    arm: (p) => pawArm(p.main),
    head: (p) => (
      <>
        <path d="M15 30 C15 22 18 18 22 16 C22 9 30 9 31 15 L33 15 C34 9 42 9 42 16 C46 18 49 22 49 30 C49 37 41 40 32 40 C23 40 15 37 15 30 Z" fill={p.main} />
        {both(<circle cx="23.5" cy="17.5" r="5" fill="#FFFFFF" stroke="none" />)}
        {both(<circle cx="19" cy="30" r="1.8" fill={p.dark} stroke="none" />)}
      </>
    ),
  },
};

export const ANIMAL_NAMES = Object.keys(ANIMALS);
