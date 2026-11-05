import type { LineSignal, WalkCheckSymptom } from "@/lib/types";

/**
 * Simulated equipment, controller codes and walk-check symptoms. Generic names only:
 * the codes are invented for the demo and match no real controller's code list.
 */
export interface Equipment {
  id: string;
  stationId: string;
  name: string;
  kind: "robot" | "pump" | "hose";
}

const SEALER_STATIONS = ["st-01", "st-02", "st-04"] as const;

export const EQUIPMENT: Equipment[] = SEALER_STATIONS.flatMap((stationId) => [
  { id: `${stationId}/robot-1`, stationId, name: "Sealer robot 1", kind: "robot" as const },
  { id: `${stationId}/robot-2`, stationId, name: "Multifunction robot 2 (handling and sealer)", kind: "robot" as const },
  { id: `${stationId}/pump`, stationId, name: "Sealer pump unit", kind: "pump" as const },
  { id: `${stationId}/hose`, stationId, name: "Sealer hose and cable carrier", kind: "hose" as const },
]);

export const ROBOT_CODES: { code: string; label: string }[] = [
  { code: "E-1043", label: "Servo following error, auto-recovered" },
  { code: "E-2210", label: "Applicator valve response slow" },
  { code: "W-0317", label: "Collision detection near its limit" },
  { code: "E-0562", label: "Encoder communication retry" },
];

export const WALK_CHECK_SYMPTOMS: { value: WalkCheckSymptom; label: string }[] = [
  { value: "noise", label: "Unusual noise" },
  { value: "leak", label: "Leak" },
  { value: "cable_wear", label: "Cable or hose wear" },
  { value: "loose_fixing", label: "Loose fixing" },
  { value: "overheating", label: "Running hot" },
  { value: "other", label: "Other" },
];

export const SIGNAL_SOURCE_LABEL: Record<"bead" | LineSignal["source"], string> = {
  bead: "Bead alert",
  robot_error: "Robot error code",
  walk_check: "Walk-check",
};

export function equipmentById(id: string): Equipment | undefined {
  return EQUIPMENT.find((item) => item.id === id);
}

export function isWalkCheckSymptom(value: unknown): value is WalkCheckSymptom {
  return WALK_CHECK_SYMPTOMS.some((item) => item.value === value);
}

/** Plain-words label for a signal, e.g. "E-2210 applicator valve response slow". */
export function signalLabel(signal: Pick<LineSignal, "source" | "code">): string {
  if (signal.source === "robot_error") {
    const known = ROBOT_CODES.find((item) => item.code === signal.code);
    return known ? `${signal.code} ${known.label.charAt(0).toLowerCase()}${known.label.slice(1)}` : signal.code;
  }
  return WALK_CHECK_SYMPTOMS.find((item) => item.value === signal.code)?.label ?? signal.code;
}

/** Ticket title for a repeated signal. */
export function signalSubject(signal: Pick<LineSignal, "source" | "code" | "equipmentId">): string {
  const equipment = equipmentById(signal.equipmentId)?.name ?? signal.equipmentId;
  return signal.source === "robot_error"
    ? `Robot minor error ${signal.code} on ${equipment}`
    : `Walk-check: ${signalLabel(signal).toLowerCase()} on ${equipment}`;
}
