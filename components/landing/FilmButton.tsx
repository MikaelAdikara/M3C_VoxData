"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";

const FILM = "/landing/film/learning-line-720.mp4";

/**
 * "Watch the film": opens the 2:25 concept film in a native modal <dialog>.
 * Escape and the close button stop playback; focus returns to the button.
 */
export function FilmButton() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const d = dialog.current, v = video.current;
    if (!d || !v) return;
    if (open && !d.open) {
      d.showModal();
      v.play().catch(() => {});
    }
    if (!open && d.open) d.close();
    if (!open) v.pause();
  }, [open]);

  return (
    <>
      <button type="button" className="btn btn--xl btn--ghost" onClick={() => setOpen(true)}>
        <Icon name="play" weight="fill" />
        Watch the film <span className="film-len">2:25</span>
      </button>
      <dialog ref={dialog} className="film" aria-label="Learning Line concept film" onClose={() => setOpen(false)}>
        <div className="film__head">
          <p>The Learning Line, concept film with simulated data</p>
          <button type="button" className="icon-btn" aria-label="Close film" onClick={() => setOpen(false)}>
            <Icon name="x" />
          </button>
        </div>
        <video ref={video} controls playsInline preload="none" poster="/landing/film/poster.jpg">
          <source src={FILM} type="video/mp4" />
          <track kind="captions" src="/landing/film/captions-en.vtt" srcLang="en" label="English" />
        </video>
      </dialog>
    </>
  );
}
