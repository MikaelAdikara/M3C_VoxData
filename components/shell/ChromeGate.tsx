"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Hides the app chrome (top bar, tab bar, footer) on the cover page, which has its own. */
export function ChromeGate({ children }: { children: ReactNode }) {
  return usePathname() === "/" ? null : <>{children}</>;
}
