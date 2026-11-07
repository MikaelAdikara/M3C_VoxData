"use client";

import { useEffect, useRef, useState } from "react";

import { CHAPTERS, storyState } from "./story";

// category colour lives on the kicker text, never on the container
const TONES: Record<string, string> = { caution: "#6b4f00", safe: "#1a7a3d", instruct: "#0066b1" };
// still shown per chapter when WebGL is unavailable
const STILLS = ["style-1-aerial", "style-1-aerial", "style-2-sealer", "style-2-sealer", "style-1-aerial", "style-3-rollout"];

/**
 * "See it on the floor": the implementation of the three loops on a clay model of the plant.
 * Scroll position scrubs the story (same plant model and story as the v2 video); the
 * plant keeps its small ambient motion while the section is on screen. Not interactive.
 */
export function PlantStory() {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chapter, setChapter] = useState(0);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current;
    if (!root || !canvas) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const progress = () => {
      const r = root.getBoundingClientRect();
      const span = root.offsetHeight - innerHeight;
      return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    };
    const chapterAt = (p: number) => Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length));

    let disposed = false, visible = false, raf = 0, p = progress();
    let plant: { render: (s: unknown) => void } | null = null;
    const onScroll = () => setChapter(chapterAt(progress()));

    function loop(now: number) {
      raf = 0;
      if (!visible || !plant || disposed) return;
      p += (progress() - p) * (reduce ? 1 : 0.12); // eased scrub so wheel steps glide
      const { state, chapter: c } = storyState(p, reduce ? 0 : now / 1000, plant);
      plant.render(state);
      setChapter(c);
      raf = requestAnimationFrame(loop);
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && plant && !raf) raf = requestAnimationFrame(loop);
    }, { rootMargin: "100px" });
    io.observe(root);

    const small = innerWidth < 720;
    import("./plant3d")
      .then(({ createPlant }) => createPlant(canvas, { width: small ? 1280 : 1920, height: small ? 720 : 1080, modelBase: "/models", ao: !small, pixelRatio: 1 }))
      .then((api) => {
        if (disposed) return;
        plant = api as unknown as { render: (s: unknown) => void };
        if (visible && !raf) raf = requestAnimationFrame(loop);
      })
      .catch(() => {
        if (disposed) return;
        setFallback(true);
        addEventListener("scroll", onScroll, { passive: true });
      });

    return () => {
      disposed = true;
      io.disconnect();
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
    };
  }, []);

  const ch = CHAPTERS[chapter];
  return (
    <section ref={rootRef} className="floor" id="floor" aria-labelledby="floor-title" style={{ ["--n" as string]: CHAPTERS.length, ["--tone-ink" as string]: TONES[ch.tone ?? ""] ?? "#5f5f5f" }} data-fallback={fallback || undefined}>
      <div className="floor__sticky">
        <canvas ref={canvasRef} className="floor__canvas" width={1920} height={1080} aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="floor__fallback" src={`/landing/plant/${STILLS[chapter]}.jpg`} alt="White clay model of the Karawang plant with the loops drawn as routes" />
        <div className="floor__veil" />
        <div className="floor__head">
          <div className="floor__eyebrow">How it works in the plant</div>
          <h2 className="display floor__h" id="floor-title">See it on the floor</h2>
        </div>
        <div className="floor__card" aria-live="polite">
          <div className="floor__text" key={ch.id}>
            <div className="floor__kicker">{ch.kicker}</div>
            <h3 className="floor__title">{ch.title}</h3>
            <p className="floor__body">{ch.body}</p>
          </div>
        </div>
        <ol className="floor__dots" aria-label="Chapters">
          {CHAPTERS.map((c, i) => <li key={c.id} aria-current={i === chapter ? "step" : undefined}><span className="sr-only">{c.title}</span></li>)}
        </ol>
        <span className="floor__tag">Concept animation, simulated data</span>
      </div>
    </section>
  );
}
