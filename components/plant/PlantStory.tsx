"use client";

import { useEffect, useRef, useState } from "react";

import { CHAPTERS, storyState } from "./story";

// category colour lives on the kicker text, never on the container
const TONES: Record<string, string> = { caution: "#6b4f00", safe: "#1a7a3d", instruct: "#0066b1" };
// still shown per chapter when WebGL is unavailable
const STILLS = ["style-1-aerial", "style-1-aerial", "style-2-sealer", "style-2-sealer", "style-1-aerial", "style-3-rollout"];
// Phones (and browsers without WebGL) scrub a pre-rendered video of the same story (video-production/web-scrub):
// 720 frames, frame i = storyState(i / 719). FOCUS keeps the subject inside a portrait crop: [p, object-position x %].
const SCRUB_FRAMES = 720, SCRUB_FPS = 30;
const FOCUS: [number, number][] = [[0.0, 50.0], [0.1667, 50.0], [0.225, 41.6], [0.2667, 69.0], [0.3333, 66.9], [0.3583, 31.0], [0.45, 31.0], [0.475, 75.3], [0.5, 75.3], [0.5333, 66.9], [0.5833, 66.9], [0.6333, 54.2], [0.6667, 54.2], [0.7, 58.4], [0.7417, 41.6], [0.775, 69.0], [0.8333, 69.0], [0.8583, 75.3], [0.9333, 62.7], [1.0, 54.2]];
function focusAt(p: number) {
  const i = FOCUS.findIndex(([q]) => q >= p);
  if (i <= 0) return FOCUS[Math.max(0, i)][1];
  const [pa, xa] = FOCUS[i - 1], [pb, xb] = FOCUS[i];
  const k = (p - pa) / (pb - pa || 1), sm = k * k * (3 - 2 * k);
  return xa + (xb - xa) * sm;
}

/**
 * "See it on the floor": the implementation of the three loops on a clay model of the plant.
 * Scroll position scrubs the story (same plant model and story as the v2 video); the
 * plant keeps its small ambient motion while the section is on screen. Not interactive.
 */
export function PlantStory() {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [chapter, setChapter] = useState(0);
  const [mode, setMode] = useState<"webgl" | "video" | "still">("webgl");

  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current, vid = videoRef.current;
    if (!root || !canvas || !vid) return;
    const video: HTMLVideoElement = vid;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const progress = () => {
      const r = root.getBoundingClientRect();
      const span = root.offsetHeight - innerHeight;
      return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    };
    const chapterAt = (p: number) => Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length));

    let disposed = false, visible = false, raf = 0, p = progress();
    let plant: { render: (s: unknown) => void } | null = null;
    let scrub = false;
    const onScroll = () => setChapter(chapterAt(progress()));

    function loop(now: number) {
      raf = 0;
      if (!visible || disposed) return;
      if (scrub) {
        p += (progress() - p) * (reduce ? 1 : 0.18);
        const t = (Math.round(p * (SCRUB_FRAMES - 1)) + 0.5) / SCRUB_FPS;
        if (Math.abs(video.currentTime - t) > 0.5 / SCRUB_FPS) video.currentTime = t;
        video.style.objectPosition = `${focusAt(p).toFixed(1)}% 50%`;
        setChapter(chapterAt(p));
        raf = requestAnimationFrame(loop);
        return;
      }
      if (!plant) return;
      p += (progress() - p) * (reduce ? 1 : 0.12); // eased scrub so wheel steps glide
      const { state, chapter: c } = storyState(p, reduce ? 0 : now / 1000, plant);
      plant.render(state);
      setChapter(c);
      raf = requestAnimationFrame(loop);
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && (plant || scrub) && !raf) raf = requestAnimationFrame(loop);
    }, { rootMargin: "100px" });
    io.observe(root);

    const startScrub = () => {
      scrub = true;
      setMode("video");
      video.preload = "auto";
      video.load();
      video.addEventListener("error", () => { scrub = false; setMode("still"); addEventListener("scroll", onScroll, { passive: true }); }, { once: true });
      if (visible && !raf) raf = requestAnimationFrame(loop);
    };
    if (innerWidth < 720) { startScrub(); return () => { disposed = true; io.disconnect(); cancelAnimationFrame(raf); removeEventListener("scroll", onScroll); }; }

    import("./plant3d")
      .then(({ createPlant }) => createPlant(canvas, { width: 1920, height: 1080, modelBase: "/models", ao: true, pixelRatio: 1 }))
      .then((api) => {
        if (disposed) return;
        plant = api as unknown as { render: (s: unknown) => void };
        if (visible && !raf) raf = requestAnimationFrame(loop);
      })
      .catch(() => {
        if (!disposed) startScrub();   // no WebGL: the pre-rendered story instead
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
    <section ref={rootRef} className="floor" id="floor" aria-labelledby="floor-title" style={{ ["--n" as string]: CHAPTERS.length, ["--tone-ink" as string]: TONES[ch.tone ?? ""] ?? "#5f5f5f" }} data-mode={mode}>
      <div className="floor__sticky">
        <canvas ref={canvasRef} className="floor__canvas" width={1920} height={1080} aria-hidden="true" />
        <video ref={videoRef} className="floor__video" muted playsInline preload="none" poster="/landing/plant/floor-scrub.jpg" aria-hidden="true">
          <source src="/landing/plant/floor-scrub.mp4" type="video/mp4" />
          <source src="/landing/plant/floor-scrub.webm" type="video/webm" />
        </video>
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
