"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";

import { SCREENS } from "./nav";

/** Screen navigation: top tabs on desktop, bottom tab bar on phones. */
export function NavLinks({ variant }: { variant: "top" | "tabbar" }) {
  const pathname = usePathname();
  return (
    <nav className={variant === "top" ? "nav" : "tabbar"} aria-label="Screens">
      {SCREENS.map((s) => {
        const current = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link key={s.href} href={s.href} aria-current={current ? "page" : undefined}>
            <Icon name={s.icon} />
            {variant === "top" ? <span>{s.label}</span> : s.label}
          </Link>
        );
      })}
    </nav>
  );
}
