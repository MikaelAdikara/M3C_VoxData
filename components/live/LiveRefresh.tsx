"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Light polling for live screens: refreshes server data about every 2 s
 * while the tab is visible. Client state (open sheets, typed notes) is kept.
 */
export function LiveRefresh({ intervalMs = 2000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let id: number | undefined;
    const start = () => {
      if (id === undefined) id = window.setInterval(() => router.refresh(), intervalMs);
    };
    const stop = () => {
      window.clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
