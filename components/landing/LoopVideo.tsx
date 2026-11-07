"use client";

import { useEffect, useRef } from "react";

/**
 * A short, muted, seamless loop rendered for the cover (video-production/web-loops).
 * Loads nothing until it is near the viewport, plays only while visible (and, when
 * `active` is given, only while active), and stays on its poster with reduced motion.
 */
export function LoopVideo({
  src,
  active,
  label = "Simulated",
  className,
}: {
  /** path without extension, e.g. "/landing/loops/trail-2-operator" (.mp4, .webm, .jpg next to it) */
  src: string;
  active?: boolean;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const visible = useRef(false);
  const activeRef = useRef(active);

  const sync = () => {
    const v = ref.current;
    if (!v) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const want = visible.current && activeRef.current !== false && !reduce;
    if (want) {
      if (v.preload !== "auto") v.preload = "auto";
      v.play().catch(() => {});
    } else if (!v.paused) {
      v.pause();
    }
  };

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; sync(); }, { rootMargin: "200px 0px" });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  useEffect(() => { activeRef.current = active; sync(); }, [active]);

  return (
    <figure className={`loop${className ? ` ${className}` : ""}`}>
      <video ref={ref} muted loop playsInline preload="none" poster={`${src}.jpg`} aria-hidden="true">
        <source src={`${src}.webm`} type="video/webm" />
        <source src={`${src}.mp4`} type="video/mp4" />
      </video>
      {label ? <figcaption className="loop__label">{label}</figcaption> : null}
    </figure>
  );
}
