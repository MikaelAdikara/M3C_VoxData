import type { DefectTypeId } from "@/lib/types";

/**
 * Simulated history of closed sealer Kaizen cases at K2-Body (docs/SEED_DATA.md §9).
 * Written by the team for the prototype: plausible shop-floor wording, no TMMIN data.
 * `rootCauseGroup` is the label used to score similar-case retrieval (Precision@3);
 * the app never shows it as a conclusion.
 */
export type RootCauseGroup =
  | "material-temperature"
  | "nozzle-condition"
  | "camera-lighting"
  | "robot-path-program"
  | "valve-wear"
  | "air-in-supply"
  | "pressure-control"
  | "robot-recovery"
  | "speed-flow-pairing"
  | "body-locating";

export interface HistoryCase {
  id: string;
  closedOn: string;
  stationId: string;
  defectTypeId: DefectTypeId;
  symptom: string;
  rootCause: string;
  rootCauseGroup: RootCauseGroup;
  countermeasure: string;
  /** Seeded Kaizen ticket this case closed, when it is one of the six in lib/seed.ts. */
  ticketId?: string;
  /** Validated knowledge card written from this case, if any. */
  cardId?: string;
}

export const HISTORY_CASES: HistoryCase[] = [
  // material-temperature
  { id: "HC-001", closedOn: "2027-02-20", stationId: "st-04", defectTypeId: "BEAD_THIN", symptom: "Thin bead on door seams at shift start", rootCause: "Sealer viscosity high when material is cold after the overnight stop", rootCauseGroup: "material-temperature", countermeasure: "Warm-up purge of 30 s before the first body; check gun pressure at start-up", ticketId: "KZ-SEAL-001", cardId: "KC-SEAL-014" },
  { id: "HC-002", closedOn: "2025-12-03", stationId: "st-04", defectTypeId: "BEAD_THIN", symptom: "Narrow bead on the first five bodies after the Monday restart", rootCause: "Drum stored near the dock door; material below the viscosity window", rootCauseGroup: "material-temperature", countermeasure: "Store drums in the conditioned area for 24 h before use", },
  { id: "HC-003", closedOn: "2026-01-15", stationId: "st-02", defectTypeId: "BEAD_THIN", symptom: "Bead width under limit on roof ditch during cold mornings", rootCause: "Hose heater set-point drifted low; sealer too stiff at the gun", rootCauseGroup: "material-temperature", countermeasure: "Recalibrate hose heater and add temperature to the start-up check", },
  { id: "HC-004", closedOn: "2026-07-08", stationId: "st-06", defectTypeId: "BEAD_BREAK", symptom: "Bead tears at the start of the seam after a long line stop", rootCause: "Material cooled in the gun during the stop and did not flow evenly", rootCauseGroup: "material-temperature", countermeasure: "Purge after any stop longer than 20 minutes", },
  // nozzle-condition
  { id: "HC-005", closedOn: "2027-02-26", stationId: "st-04", defectTypeId: "BEAD_BREAK", symptom: "Bead break at seam-R-door-07", rootCause: "Nozzle angle drifts after nozzle change", rootCauseGroup: "nozzle-condition", countermeasure: "Angle gauge check after every nozzle change; add to change checklist", ticketId: "KZ-SEAL-002", cardId: "KC-SEAL-021" },
  { id: "HC-006", closedOn: "2025-11-19", stationId: "st-03", defectTypeId: "BEAD_THIN", symptom: "Bead gets thinner along the wheel arch seam during the shift", rootCause: "Partly clogged nozzle tip from cured sealer", rootCauseGroup: "nozzle-condition", countermeasure: "Wipe and inspect the tip every 2 hours; replace at the weekly PM", },
  { id: "HC-007", closedOn: "2026-03-30", stationId: "st-05", defectTypeId: "BEAD_MISSING", symptom: "Short sections with no sealer on the tailgate seam", rootCause: "Nozzle blocked by a cured plug after the lunch break", rootCauseGroup: "nozzle-condition", countermeasure: "Purge shot into the waste cup after breaks; plug check on the first body", },
  { id: "HC-008", closedOn: "2026-09-02", stationId: "st-04", defectTypeId: "BEAD_BREAK", symptom: "Intermittent gaps in the bead on door seams after the tip was replaced", rootCause: "New tip seated off-centre; jet hits the flange edge", rootCauseGroup: "nozzle-condition", countermeasure: "Seat check with the alignment pin after every tip change", },
  // camera-lighting
  { id: "HC-009", closedOn: "2027-01-12", stationId: "st-02", defectTypeId: "BEAD_THIN", symptom: "False alarms on new grey sealer", rootCause: "Lower contrast under current lighting", rootCauseGroup: "camera-lighting", countermeasure: "Add polarising filter; re-validate model as a 4M change", cardId: "KC-SEAL-009" },
  { id: "HC-010", closedOn: "2026-05-21", stationId: "st-04", defectTypeId: "BEAD_EXCESS", symptom: "Camera flags excess sealer that operators reject as reflection", rootCause: "New ceiling lamp creates a glare spot on glossy sealer", rootCauseGroup: "camera-lighting", countermeasure: "Diffuser on the lamp; recheck false alarms per shift for a week", },
  { id: "HC-011", closedOn: "2026-10-14", stationId: "st-01", defectTypeId: "BEAD_OFFSET", symptom: "Offset alerts rejected as within tolerance after the camera was bumped", rootCause: "Camera bracket moved; region of interest no longer on the seam", rootCauseGroup: "camera-lighting", countermeasure: "Pinned bracket and a reference mark check at shift start", },
  // robot-path-program
  { id: "HC-012", closedOn: "2027-03-01", stationId: "st-01", defectTypeId: "BEAD_OFFSET", symptom: "Bead offset after a robot path program change", rootCause: "First-off path verification was skipped after recipe selection", rootCauseGroup: "robot-path-program", countermeasure: "Verify the robot path on the first-off body before normal production", ticketId: "KZ-SEAL-003", cardId: "KC-SEAL-040" },
  { id: "HC-013", closedOn: "2025-10-28", stationId: "st-04", defectTypeId: "BEAD_OFFSET", symptom: "Bead runs off the flange on the new variant only", rootCause: "Variant path points copied from the old variant without re-teach", rootCauseGroup: "robot-path-program", countermeasure: "Re-teach points for each variant; path sign-off before launch", },
  { id: "HC-014", closedOn: "2026-06-12", stationId: "st-03", defectTypeId: "BEAD_MISSING", symptom: "Sealer missing at the end of the sill seam after a program edit", rootCause: "Gun-off point moved earlier during a cycle-time edit", rootCauseGroup: "robot-path-program", countermeasure: "Program change review includes gun on/off points", },
  // valve-wear
  { id: "HC-015", closedOn: "2027-03-02", stationId: "st-02", defectTypeId: "BEAD_EXCESS", symptom: "Excess sealer at the end of the bead", rootCause: "Shut-off response slowed after applicator valve seal wear", rootCauseGroup: "valve-wear", countermeasure: "Inspect valve response and confirm clean cut-off on a trial body", ticketId: "KZ-SEAL-004", cardId: "KC-SEAL-041" },
  { id: "HC-016", closedOn: "2026-02-09", stationId: "st-05", defectTypeId: "BEAD_EXCESS", symptom: "Blob of sealer where the bead ends on the hood seam", rootCause: "Applicator valve closing late; seal kit past its service life", rootCauseGroup: "valve-wear", countermeasure: "Seal kit replacement interval shortened; valve timing check monthly", },
  { id: "HC-017", closedOn: "2026-08-25", stationId: "st-06", defectTypeId: "BEAD_EXCESS", symptom: "Stringing and drips after the gun closes", rootCause: "Worn needle valve leaks after shut-off", rootCauseGroup: "valve-wear", countermeasure: "Replace needle valve; add drip check to the PM sheet", },
  // air-in-supply
  { id: "HC-018", closedOn: "2027-03-05", stationId: "st-05", defectTypeId: "BEAD_MISSING", symptom: "Missing bead immediately after a material cartridge change", rootCause: "An air pocket remained in the supply line after changeover", rootCauseGroup: "air-in-supply", countermeasure: "Purge until flow is continuous and verify the first bead before release", ticketId: "KZ-SEAL-005", cardId: "KC-SEAL-042" },
  { id: "HC-019", closedOn: "2025-12-17", stationId: "st-02", defectTypeId: "BEAD_BREAK", symptom: "Spitting gun and broken bead after the drum swap", rootCause: "Air drawn in at the pump follower plate during the drum change", rootCauseGroup: "air-in-supply", countermeasure: "Bleed the pump after every drum change; check the follower plate seal", },
  { id: "HC-020", closedOn: "2026-04-22", stationId: "st-04", defectTypeId: "BEAD_MISSING", symptom: "Gaps in the bead on the first body after the pump was serviced", rootCause: "Line was not bled after maintenance; air trapped at the regulator", rootCauseGroup: "air-in-supply", countermeasure: "Maintenance release includes bleed and a first-bead check", },
  // pressure-control
  { id: "HC-021", closedOn: "2027-03-08", stationId: "st-06", defectTypeId: "BEAD_THIN", symptom: "Thin bead during rapid pressure fluctuation", rootCause: "Pressure regulator response lagged during demand change", rootCauseGroup: "pressure-control", countermeasure: "Check regulator response and hold pressure within the approved start-up range", ticketId: "KZ-SEAL-006", cardId: "KC-SEAL-043" },
  { id: "HC-022", closedOn: "2026-01-29", stationId: "st-04", defectTypeId: "BEAD_THIN", symptom: "Bead thins when both guns on the line apply at the same time", rootCause: "Shared supply pressure drops below set-point under double demand", rootCauseGroup: "pressure-control", countermeasure: "Separate regulator per gun; pressure trend reviewed weekly", },
  { id: "HC-023", closedOn: "2026-11-05", stationId: "st-05", defectTypeId: "BEAD_EXCESS", symptom: "Wide bead on the first bodies after start-up", rootCause: "Regulator overshoots after the pump starts", rootCauseGroup: "pressure-control", countermeasure: "Soft-start ramp on the pump; pressure check before the first body", },
  // robot-recovery
  { id: "HC-024", closedOn: "2027-02-24", stationId: "st-03", defectTypeId: "BEAD_BREAK", symptom: "Bead break after manual robot recovery", rootCause: "Recovery resumed from the middle of the seam instead of its defined restart point", rootCauseGroup: "robot-recovery", countermeasure: "Return to the defined seam restart point and inspect the recovered bead", cardId: "KC-SEAL-044" },
  { id: "HC-025", closedOn: "2026-03-11", stationId: "st-04", defectTypeId: "BEAD_MISSING", symptom: "Part of the door seam unsealed on a body that was in station during a fault", rootCause: "Robot restarted at the next seam after the fault reset", rootCauseGroup: "robot-recovery", countermeasure: "Fault reset procedure marks the interrupted body for manual sealing check", },
  { id: "HC-026", closedOn: "2026-09-30", stationId: "st-01", defectTypeId: "BEAD_BREAK", symptom: "Double start mark and gap after a collision recovery", rootCause: "Operator jogged the robot back without the restart routine", rootCauseGroup: "robot-recovery", countermeasure: "Recovery routine button on the pendant; training for team members", },
  // speed-flow-pairing
  { id: "HC-027", closedOn: "2027-02-25", stationId: "st-04", defectTypeId: "BEAD_EXCESS", symptom: "Excess bead at a corner transition", rootCause: "Robot speed reduction was not paired with a lower flow command", rootCauseGroup: "speed-flow-pairing", countermeasure: "Pair the corner speed profile with the approved flow setpoint", cardId: "KC-SEAL-045" },
  { id: "HC-028", closedOn: "2025-11-06", stationId: "st-02", defectTypeId: "BEAD_THIN", symptom: "Bead thin on the straight run after a cycle-time improvement", rootCause: "Robot speed raised but flow rate left at the old value", rootCauseGroup: "speed-flow-pairing", countermeasure: "Flow recalculated whenever path speed changes", },
  { id: "HC-029", closedOn: "2026-07-27", stationId: "st-06", defectTypeId: "BEAD_EXCESS", symptom: "Heavy bead where the robot slows near the pillar", rootCause: "Flow command constant while the tool speed drops in the radius", rootCauseGroup: "speed-flow-pairing", countermeasure: "Speed-proportional flow enabled on the controller", },
  // body-locating
  { id: "HC-030", closedOn: "2026-02-18", stationId: "st-04", defectTypeId: "BEAD_OFFSET", symptom: "Bead off path on the left door after the jig was serviced", rootCause: "Locating pin worn; body sits 2 mm off the nominal position", rootCauseGroup: "body-locating", countermeasure: "Pin replaced; pin wear check added to the jig PM", },
  { id: "HC-031", closedOn: "2026-06-30", stationId: "st-06", defectTypeId: "BEAD_OFFSET", symptom: "Offset bead appears on some bodies only, varies by carrier", rootCause: "Two carriers with bent locating brackets", rootCauseGroup: "body-locating", countermeasure: "Carrier ID logged with each alert; brackets straightened and checked", },
  { id: "HC-032", closedOn: "2026-12-10", stationId: "st-01", defectTypeId: "BEAD_THIN", symptom: "Bead thin on one side of the roof when the body sits high", rootCause: "Clamp not fully closed; gun-to-panel distance larger than set", rootCauseGroup: "body-locating", countermeasure: "Clamp-closed sensor interlocked with the sealer start", },
];
