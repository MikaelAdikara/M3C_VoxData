import Link from "next/link";

import type { Role } from "@/lib/types";

import { NavLinks } from "./NavLinks";
import { RoleSwitcher } from "./RoleSwitcher";
import { ShiftClock } from "./ShiftClock";
import { ThemeToggle } from "./ThemeToggle";

/** Sticky top bar: red brand strip, product name, screens, theme, role, shift clock. */
export function TopBar({ role, shiftLabel, site }: { role: Role; shiftLabel: string; site: string }) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Link className="brand" href="/">
          <span className="brand__name">Learning Line</span>
          <span className="brand__site">{site}</span>
        </Link>
        <NavLinks variant="top" />
        <div className="topbar__end">
          <ThemeToggle />
          <RoleSwitcher current={role} />
          <ShiftClock shiftLabel={shiftLabel} />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return <footer className="footer">Concept prototype · simulated data · not connected to TMMIN systems</footer>;
}
