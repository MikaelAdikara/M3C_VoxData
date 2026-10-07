"use client";

import Link from "next/link";

import { ThemeToggle } from "@/components/shell/ThemeToggle";

/** Cover bar: light glass over the line model and the sections below. */
export function CoverBar() {
  return (
    <header className="cover-bar" data-light="true">
      <div className="cover-bar__inner">
        <a className="brand" href="#hero">
          <span className="brand__name">Learning Line</span>
          <span className="brand__site">Case: PT Toyota Motor Manufacturing Indonesia (TMMIN)</span>
        </a>
        <nav className="cover-bar__nav" aria-label="Sections">
          <a href="#trail">How it works</a>
          <a href="#cams">Cameras</a>
          <a href="#a3">The case</a>
        </nav>
        <ThemeToggle />
        <Link className="btn btn--light" href="/station">
          Enter the prototype
        </Link>
      </div>
    </header>
  );
}
