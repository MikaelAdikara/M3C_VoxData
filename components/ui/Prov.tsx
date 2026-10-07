import { Icon, type IconName } from "@/components/ui/Icon";
import type { Provenance } from "@/lib/types";

const KIND: Record<Provenance, { label: string; icon: IconName }> = {
  case_data: { label: "Case data", icon: "book-open" },
  target: { label: "Target", icon: "flag" },
  simulated: { label: "Simulated", icon: "cpu" },
  illustration: { label: "Illustration", icon: "pen-nib" },
  benchmark: { label: "Benchmark", icon: "ruler" },
};

/** Where a number comes from. Every figure on screen carries one. */
export function Prov({ p, label }: { p: Provenance; label?: string }) {
  const k = KIND[p];
  return (
    <span className="prov" data-k={p === "case_data" ? "case" : p} title={label ? `${k.label}: ${label}` : k.label}>
      <Icon name={k.icon} />
      {label ? `${k.label} · ${label}` : k.label}
    </span>
  );
}
