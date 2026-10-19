import autovi from "@/lib/vision/autovi-summary.json";
import meta from "@/lib/vision/bead-model.json";
import type { CameraModelTypeResult, CameraModelView } from "@/lib/types";

const TYPES: Pick<CameraModelTypeResult, "defectTypeId" | "key" | "name">[] = [
  { defectTypeId: "BEAD_MISSING", key: "missing", name: "Missing bead" },
  { defectTypeId: "BEAD_BREAK", key: "break", name: "Broken bead" },
  { defectTypeId: "BEAD_THIN", key: "thin", name: "Thin bead" },
  { defectTypeId: "BEAD_OFFSET", key: "offset", name: "Bead off path" },
  { defectTypeId: "BEAD_EXCESS", key: "excess", name: "Excess sealer" },
];

/** View model for /cameras/model, built from the metrics that ml/train_eval.py writes. */
export function buildCameraModelView(): CameraModelView {
  const ev = meta.evaluation;
  return {
    stationId: "st-04",
    modelVersion: meta.modelVersion,
    modelUrl: "/models/bead_patchcore.onnx",
    seams: meta.seams.map((s, index) => ({ index, id: s.id, threshold: s.threshold })),
    falseAlarmBudget: meta.falseAlarmBudget,
    bodiesPerShift: meta.bodiesPerShift,
    evaluation: {
      goodTestCrops: ev.goodTestCrops,
      falseAlarms: ev.falseAlarms,
      expectedFalseAlarmsPerShift: ev.expectedFalseAlarmsPerShift,
      expectedFalseAlarmsPerShift95: [ev.expectedFalseAlarmsPerShift95[0], ev.expectedFalseAlarmsPerShift95[1]],
      perType: TYPES.map((t) => {
        const r = ev.perType[t.defectTypeId as keyof typeof ev.perType];
        return {
          ...t,
          criticality: r.criticality === "leak_critical" ? "leak_critical" : "non_critical",
          limitDetected: r.limitDetected,
          limitN: r.limitN,
          randomDetected: r.randomDetected,
          randomN: r.randomN,
          auroc: r.auroc,
        };
      }),
      strongReflection: ev.strongReflection,
      cpuMs: ev.cpuMs,
      modelMegabytes: Math.round((ev.onnxBytes / 1_048_576) * 10) / 10,
    },
    provenance: "simulated",
    sourceLabel: `Synthetic bead images, evaluated ${meta.evaluatedOn}; not TMMIN line data`,
    realImages: autovi,
  };
}
