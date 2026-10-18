// Copies the onnxruntime-web WebAssembly runtime into public/ort/ so the camera-model
// page loads it from our own origin (no CDN, no image leaves the browser).
// Runs before `dev` and `build`; public/ort/ is git-ignored.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("onnxruntime-web/wasm"));
const out = join(process.cwd(), "public", "ort");
mkdirSync(out, { recursive: true });
for (const file of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
  copyFileSync(join(dist, file), join(out, file));
}
console.log("onnxruntime-web runtime copied to public/ort/");
