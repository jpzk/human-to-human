import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Creature } from "@/components/creature/Creature";
import { getDecks } from "@/lib/decks";
import { HeroStage } from "./HeroStage";
import "./landing.css";

type Props = {
  onCreateLobby: (config: { deck?: string }) => void;
};

const REPO = "https://github.com/jpzk/human-to-human";
// set on copies hosted elsewhere (e.g. a v2 demo) to link back to the original site
const ORIGINAL_SITE = import.meta.env.VITE_ORIGINAL_SITE as string | undefined;

const DECK_INFO: Record<string, { label: string; tagline: string; color: string; mascot: string }> = {
  "Friendship Fortunes": {
    label: "Friendship Fortunes",
    tagline: "Old friends or new ones. Light questions that slowly go deeper.",
    color: "#F9AE77",
    mascot: "Happy Fox",
  },
  "Love in Harmony": {
    label: "Love in Harmony",
    tagline: "For couples and the curious. How do you love, and how do you want to be loved?",
    color: "#F4A4C2",
    mascot: "Gentle Dove",
  },
  "Whispers of the Heart": {
    label: "Whispers of the Heart",
    tagline: "The deep end. For groups that are ready to be honest.",
    color: "#C4B9E0",
    mascot: "Calm Moth",
  },
  "Office Allies: Building Bonds Beyond Cubicles": {
    label: "Office Allies",
    tagline: "Team building without trust falls. Work habits, hopes and fears.",
    color: "#92BFDB",
    mascot: "Wise Owl",
  },
};

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function StepScene({ step }: { step: number }) {
  if (step === 0)
    return (
      <div className="scene">
        <div className="scene-qr" />
        <Creature className="scene-pop scene-pop-1" name="Happy Panda" color="#F89A8A" size={64} pose="cheer" />
        <Creature className="scene-pop scene-pop-2" name="Nimble Frog" color="#BEC97E" size={64} pose="wave" />
      </div>
    );
  if (step === 1)
    return (
      <div className="scene">
        <div className="scene-cards">
          <span>Coffee</span>
          <span className="scene-picked">Tea</span>
        </div>
        <Creature className="scene-hover" name="Silent Lynx" color="#87D3C3" size={60} />
      </div>
    );
  if (step === 2)
    return (
      <div className="scene">
        <Creature name="Bright Seal" color="#92BFDB" size={64} />
        <div className="scene-ring">
          <svg viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="hsl(var(--flexoki-ui))" strokeWidth="4" />
            <circle className="scene-ring-fill" cx="20" cy="20" r="16" fill="none" stroke="#7dd4c0" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <b>87%</b>
        </div>
        <Creature name="Cozy Bear" color="#C4B9E0" size={64} facingLeft />
      </div>
    );
  return (
    <div className="scene scene-tight">
      <Creature name="Brave Wolf" color="#F9AE77" size={72} pose="hf-right" />
      <Creature name="Lucky Crab" color="#F89A8A" size={72} pose="hf-left" />
    </div>
  );
}

const STEPS = [
  { title: "Join in seconds", text: "Scan the QR code. No sign up. You arrive as a random creature, like Happy Panda." },
  { title: "Answer honestly", text: "Everyone answers the same questions at once. Nobody knows which creature is you." },
  { title: "See who thinks like you", text: "Answers turn into compatibility, and a short story about your group." },
  { title: "Reveal, only together", text: "If two people both choose to reveal, they see each other and can chat." },
];

export function Landing({ onCreateLobby }: Props) {
  const decks = getDecks();
  const [deck, setDeck] = useState(decks[0]?.deck_name ?? "Friendship Fortunes");
  const [stageRef, stage] = useSize<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "hands: meet people before you know who they are";
  }, []);

  const go = (id: string) => scroller.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div ref={scroller} className="landing h-screen overflow-y-auto overflow-x-hidden">
      {/* nav */}
      <nav className="sticky top-0 z-30 backdrop-blur-md bg-background/75 border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
          <img src="/logo-name.svg" alt="hands" className="h-7" />
          <div className="flex items-center gap-1 sm:gap-4 text-[13px]">
            <button className="hidden sm:inline px-2 py-1 text-muted-foreground hover:text-foreground" onClick={() => go("how")}>
              How it works
            </button>
            <button className="hidden sm:inline px-2 py-1 text-muted-foreground hover:text-foreground" onClick={() => go("decks")}>
              Decks
            </button>
            <a className="hidden sm:inline px-2 py-1 text-muted-foreground hover:text-foreground" href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <button className="btn-signature-gradient rounded-full px-4 py-1.5 font-semibold shadow-sm hover:scale-105 transition-transform" onClick={() => go("decks")}>
              Start a group
            </button>
          </div>
        </div>
      </nav>

      {/* hero */}
      <header className="relative mx-auto max-w-6xl px-5 pt-8 sm:pt-12 pb-6 grid lg:grid-cols-[1fr_1.1fr] gap-8 items-center">
        <motion.div {...reveal}>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-[12px] text-muted-foreground mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7dd4c0]" /> An anonymous party game for real life events
          </p>
          <h1 className="text-[30px] sm:text-[46px] leading-[1.05] font-bold tracking-tight">
            Meet people as they are,
            <br />
            <span className="hero-gradient">before you know who they are.</span>
          </h1>
          <p className="mt-5 text-[15px] sm:text-[16px] leading-relaxed text-[hsl(var(--flexoki-tx-2))] max-w-[34rem]">
            Everyone in the room answers honest questions as a little creature. hands shows who thinks like you, and you reveal yourselves only when you both agree.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className="btn-signature-gradient rounded-xl px-6 py-3 text-[15px] font-semibold shadow hover:scale-[1.03] transition-transform" onClick={() => go("decks")}>
              Start a group
            </button>
            <button className="rounded-xl px-6 py-3 text-[15px] font-medium border border-border bg-background hover:bg-muted/60 transition-colors" onClick={() => go("how")}>
              How it works
            </button>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted-foreground">
            <span>No accounts</span>
            <span>Nothing stored</span>
            <span>Mutual reveal only</span>
          </div>
        </motion.div>

        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}>
          <div ref={stageRef} className="hero-stage relative h-[320px] sm:h-[420px] rounded-3xl border border-border overflow-hidden">
            <div className="hero-question">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Question 3 of 10</span>
              <b>Coffee or tea?</b>
            </div>
            {stage.width > 0 && <HeroStage width={stage.width} height={stage.height} />}
          </div>
        </motion.div>
      </header>

      {/* how it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-16 scroll-mt-14">
        <motion.h2 {...reveal} className="text-[26px] sm:text-[32px] font-bold tracking-tight">
          How it works
        </motion.h2>
        <motion.p {...reveal} className="mt-2 text-[15px] text-muted-foreground max-w-xl">
          One shared screen or everyone on their phone. A round takes about ten minutes.
        </motion.p>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              {...reveal}
              transition={{ ...reveal.transition, delay: i * 0.08 }}
              className="rounded-2xl border border-border bg-background p-5 flex flex-col"
            >
              <StepScene step={i} />
              <div className="mt-4 text-[11px] font-semibold text-muted-foreground">STEP {i + 1}</div>
              <h3 className="mt-1 text-[17px] font-semibold">{s.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--flexoki-tx-2))]">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* decks + create */}
      <section id="decks" className="mx-auto max-w-6xl px-5 py-16 scroll-mt-14">
        <motion.h2 {...reveal} className="text-[26px] sm:text-[32px] font-bold tracking-tight">
          Pick a deck, start a group
        </motion.h2>
        <motion.p {...reveal} className="mt-2 text-[15px] text-muted-foreground max-w-xl">
          Ten questions each, read aloud if you like. You get a link and a QR code to share.
        </motion.p>
        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          {decks.map((d, i) => {
            const info = DECK_INFO[d.deck_name] ?? { label: d.deck_name, tagline: "", color: "#BEC97E", mascot: "Happy Frog" };
            const selected = d.deck_name === deck;
            const sample = d.cards[Math.min(4, d.cards.length - 1)]?.question;
            return (
              <motion.button
                key={d.deck_name}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.06 }}
                type="button"
                onClick={() => setDeck(d.deck_name)}
                className={`deck-card text-left rounded-2xl border p-5 flex gap-4 items-start transition-all ${selected ? "deck-card-selected" : "border-border hover:border-foreground/30"}`}
                style={{ "--deck": info.color } as React.CSSProperties}
                aria-pressed={selected}
              >
                <div className="deck-mascot shrink-0 rounded-xl grid place-items-center">
                  <Creature name={info.mascot} color={info.color} size={64} pose={selected ? "cheer" : "idle"} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h3 className="text-[17px] font-semibold">{info.label}</h3>
                    <span className="text-[11px] text-muted-foreground">{d.cards.length} questions</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--flexoki-tx-2))]">{info.tagline}</p>
                  {sample && <p className="mt-2 text-[12px] italic text-muted-foreground line-clamp-2">"{sample}"</p>}
                </div>
              </motion.button>
            );
          })}
        </div>
        <motion.div {...reveal} className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            className="btn-signature-gradient rounded-xl px-8 py-3.5 text-[16px] font-semibold shadow hover:scale-[1.02] transition-transform"
            onClick={() => onCreateLobby({ deck })}
          >
            Start a group with {DECK_INFO[deck]?.label ?? deck}
          </button>
          <span className="text-[12px] text-muted-foreground">You will be the host. Two players are enough to start.</span>
        </motion.div>
      </section>

      {/* credits */}
      <footer className="border-t border-border mt-8">
        <div className="mx-auto max-w-6xl px-5 py-10 grid sm:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="max-w-2xl">
            <img src="/logo-name.svg" alt="hands" className="h-6 opacity-80" />
            <p className="mt-3 text-[13px] leading-relaxed text-[hsl(var(--flexoki-tx-2))]">
              hands was created in 10 hours by a team of three at the Cursor AI Hackathon Hamburg 2026, by{" "}
              <a className="underline underline-offset-2" href="https://github.com/jpzk" target="_blank" rel="noreferrer">jpzk</a>,{" "}
              <a className="underline underline-offset-2" href="https://github.com/hi-aryan" target="_blank" rel="noreferrer">hi-aryan</a> and their teammate. The idea, the
              questions, the game and the server are theirs.
            </p>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Built with Cursor, MiniMax and Hume.ai. Original project:{" "}
              <a className="underline underline-offset-2" href={REPO} target="_blank" rel="noreferrer">github.com/jpzk/human-to-human</a>
              {" · "}
              <a className="underline underline-offset-2" href={`${REPO}/graphs/contributors`} target="_blank" rel="noreferrer">all contributors</a>
              {ORIGINAL_SITE && (
                <>
                  {" · "}
                  <a className="underline underline-offset-2" href={ORIGINAL_SITE} target="_blank" rel="noreferrer">play the original</a>
                </>
              )}
            </p>
          </div>
          <div className="flex -space-x-3">
            {["Happy Panda", "Wise Owl", "Lucky Bee"].map((n, i) => (
              <Creature key={n} name={n} color={["#F89A8A", "#92BFDB", "#ECCB60"][i]} size={52} pose="wave" />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
