"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AssistantPanel } from "@/components/knowledge/AssistantPanel";
import { Icon } from "@/components/ui/Icon";

/**
 * "Ask the line": the same grounded assistant, reachable from every screen.
 * Hidden on Knowledge (it has the assistant built in) and on the cover page.
 */
export function AssistantDock() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const fab = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); fab.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (path === "/" || path.startsWith("/knowledge")) return null;

  return (
    <div className="dock">
      {open ? (
        <section className="dock__panel" role="dialog" aria-modal="false" aria-label="Ask the line">
          <button className="dock__close" type="button" aria-label="Close assistant" onClick={() => { setOpen(false); fab.current?.focus(); }}>
            <Icon name="x" weight="bold" />
          </button>
          <AssistantPanel />
        </section>
      ) : null}
      <button ref={fab} className="dock__fab" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} hidden={open}>
        <Icon name="chat-circle-text" weight="bold" />
        <span>Ask the line</span>
      </button>
    </div>
  );
}
