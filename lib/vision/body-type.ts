import type { BodyTypeView } from "@/lib/types";

/**
 * Body type of each body, as read by the line's existing model-detection camera
 * (simulated here from the body number). The body type selects the per-body-type
 * bead model, so no separate controller tap is needed for it.
 */
export const BODY_TYPES = [
  { id: "A", name: "Body type A · MPV" },
  { id: "B", name: "Body type B · SUV" },
  { id: "C", name: "Body type C · hatchback" },
] as const;

export function detectBodyType(bodyId: string, modelVersion: string): BodyTypeView {
  const digits = bodyId.replace(/\D/g, "");
  const n = digits ? Number(digits.slice(-4)) : 0;
  const type = BODY_TYPES[n % BODY_TYPES.length];
  return {
    id: type.id,
    name: type.name,
    source: "model_detection_camera",
    confidence: Number((0.96 + (n % 4) / 100).toFixed(2)),
    beadModel: `${modelVersion}-${type.id.toLowerCase()}`,
  };
}
