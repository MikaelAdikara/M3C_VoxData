import type { PilotScenarioView } from "@/lib/types";

// Approved curation metadata only. UI-4 resolves asset IDs after copying reviewed
// media into public/. These IDs never drive scores, alerts, or KPIs.
export const pilotScenarios: PilotScenarioView[] = [
  { id: "normal-reference", visualClass: "NORMAL", defectTypeId: null, expectedHumanStep: "Use as a visual normal reference only", media: { assetId: "normal-01", sourceType: "public_reference", provenance: "illustration", sourceLabel: "Roboflow Universe, CC BY 4.0 · public inspection visual reference" } },
  { id: "bead-break-reference", visualClass: "BEAD_BREAK", defectTypeId: "BEAD_BREAK", expectedHumanStep: "Operator confirms or rejects the simulated alert", media: { assetId: "break-ref-01", sourceType: "public_reference", provenance: "illustration", sourceLabel: "Roboflow Universe gap class, CC BY 4.0 · visual reference only", externalClass: "gap" } },
  { id: "bead-excess-reference", visualClass: "BEAD_EXCESS", defectTypeId: "BEAD_EXCESS", expectedHumanStep: "Operator confirms or rejects the simulated alert", media: { assetId: "excess-ref-01", sourceType: "public_reference", provenance: "illustration", sourceLabel: "Roboflow Universe overlap class, CC BY 4.0 · visual reference only", externalClass: "overlap" } },
  { id: "bead-thin-simulation", visualClass: "BEAD_THIN", defectTypeId: "BEAD_THIN", expectedHumanStep: "Operator confirms or rejects the simulated alert", media: { assetId: "bead-thin", sourceType: "generated_simulation", provenance: "illustration", sourceLabel: "Generated prototype illustration · simulated" } },
  { id: "bead-missing-simulation", visualClass: "BEAD_MISSING", defectTypeId: "BEAD_MISSING", expectedHumanStep: "Operator confirms or rejects the simulated alert", media: { assetId: "bead-missing", sourceType: "generated_simulation", provenance: "illustration", sourceLabel: "Generated prototype illustration · simulated" } },
  { id: "bead-offset-simulation", visualClass: "BEAD_OFFSET", defectTypeId: "BEAD_OFFSET", expectedHumanStep: "Operator confirms or rejects the simulated alert", media: { assetId: "bead-offset", sourceType: "generated_simulation", provenance: "illustration", sourceLabel: "Generated prototype illustration · simulated" } },
  { id: "reflection-false-alarm", visualClass: "REFLECTION", defectTypeId: null, expectedHumanStep: "Operator rejects with reason reflection; team leader verifies the rejection", media: { assetId: "reflection", sourceType: "generated_simulation", provenance: "illustration", sourceLabel: "Generated prototype illustration · simulated" } },
];

export const curatedVisualReferences = [
  { visualClass: "NORMAL", assetId: "normal-01", externalClass: "good" },
  { visualClass: "NORMAL", assetId: "normal-02", externalClass: "good" },
  { visualClass: "BEAD_BREAK", assetId: "break-ref-01", externalClass: "gap" },
  { visualClass: "BEAD_BREAK", assetId: "break-ref-02", externalClass: "gap" },
  { visualClass: "BEAD_BREAK", assetId: "break-ref-03", externalClass: "gap" },
  { visualClass: "BEAD_EXCESS", assetId: "excess-ref-01", externalClass: "overlap" },
  { visualClass: "BEAD_EXCESS", assetId: "excess-ref-02", externalClass: "overlap" },
] as const;

export const externalPilotClasses = [
  { sourceClass: "bead_rolloff", mappingStatus: "needs_domain_review" },
  { sourceClass: "bead_falloff", mappingStatus: "needs_domain_review" },
  { sourceClass: "not_adhered", mappingStatus: "external_only" },
  { sourceClass: "nozzle_drag", mappingStatus: "external_only" },
  { sourceClass: "swirl", mappingStatus: "external_only" },
] as const;
