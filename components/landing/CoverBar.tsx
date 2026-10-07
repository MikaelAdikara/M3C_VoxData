"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/shell/ThemeToggle";

/** Cover bar: dark glass over the hero video, light glass once the hero scrolls away. */
export function CoverBar() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setLight(!e.isIntersecting), { rootMargin: "-64px 0px 0px 0px" });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <header className="cover-bar" data-light={light}>
      <div className="cover-bar__inner">
        <a className="brand" href="#hero">
          <span className="brand__name">Learning Line</span>
          <span className="brand__site">Case: PT Toyota Motor Manufacturing Indonesia (TMMIN)</span>
        </a>
        <nav className="cover-bar__nav" aria-label="Sections">
          <a href="#a3">The case</a>
          <a href="#try">Try it</a>
        </nav>
        <ThemeToggle />
        <Link className="btn btn--light" href="/station">
          Enter the prototype
        </Link>
      </div>
    </header>
  );
}
