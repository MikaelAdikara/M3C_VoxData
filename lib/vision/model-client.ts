/**
 * Browser-side runner for the sealer-bead model (ONNX, exported by ml/train_eval.py).
 * Runs on onnxruntime-web's WebAssembly backend from our own origin, so the image never
 * leaves the visitor's browser. Import only from client components.
 */
import type { InferenceSession } from "onnxruntime-web";

import { BEAD_H, BEAD_W, toModelInput } from "@/lib/vision/beadsynth";

export const MODEL_URL = "/models/bead_patchcore.onnx";

let session: Promise<{ ort: typeof import("onnxruntime-web/wasm"); session: InferenceSession }> | null = null;

export function loadBeadModel() {
  session ??= (async () => {
    const ort = await import("onnxruntime-web/wasm");
    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.wasm.numThreads = 1;
    const s = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
    return { ort, session: s };
  })();
  session.catch(() => {
    session = null;
  });
  return session;
}

export interface BeadScore {
  score: number;
  heatmap: Float32Array;
  ms: number;
}

export async function scoreBead(rgba: Uint8ClampedArray, seam: number): Promise<BeadScore> {
  const { ort, session: s } = await loadBeadModel();
  const image = new ort.Tensor("float32", toModelInput(rgba), [1, 3, BEAD_H, BEAD_W]);
  const seamT = new ort.Tensor("int64", BigInt64Array.from([BigInt(seam)]), [1]);
  const t0 = performance.now();
  const out = await s.run({ image, seam: seamT });
  const ms = performance.now() - t0;
  return {
    score: (out.score.data as Float32Array)[0],
    heatmap: out.heatmap.data as Float32Array,
    ms,
  };
}
