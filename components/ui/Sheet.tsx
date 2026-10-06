"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * Native <dialog>: bottom sheet on phones, centred card on desktop
 * (styles in globals.css). Escape and the close button call onClose.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="sheet" aria-label={title} onClose={onClose}>
      <div className="sheet__head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <i className="ph ph-x" aria-hidden="true" />
        </button>
      </div>
      <div className="sheet__body">{children}</div>
      {footer ? <div className="sheet__foot">{footer}</div> : null}
    </dialog>
  );
}
