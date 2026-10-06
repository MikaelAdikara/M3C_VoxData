"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { ReasonCodeOption } from "@/lib/types";

/** Reason-code sheet preview: the pattern the station screen will use in UI-1. */
export function SheetDemo({ reasonCodes }: { reasonCodes: ReasonCodeOption[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} icon={<i className="ph-bold ph-x" aria-hidden="true" />}>
        Reject: false alarm
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Why is this a false alarm?"
        footer={
          <Button size="xl" block disabled={!picked} onClick={() => setOpen(false)}>
            Reject with reason
          </Button>
        }
      >
        <fieldset className="choices choices--big" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">Reason code</legend>
          {reasonCodes.map((r) => (
            <label key={r.value} className="choice">
              <input type="radio" name="rc" value={r.value} onChange={() => setPicked(r.value)} />
              {r.label}
            </label>
          ))}
        </fieldset>
      </Sheet>
    </>
  );
}
