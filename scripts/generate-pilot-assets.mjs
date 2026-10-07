import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const pilotRoot = resolve(here, "../../M3C-Pilot-Data");
const generated = resolve(pilotRoot, "generated");
if (relative(pilotRoot, generated).startsWith("..")) throw new Error("Output must stay in M3C-Pilot-Data.");
await mkdir(generated, { recursive: true });

const scenarios = ["bead-thin", "bead-missing", "bead-offset", "reflection"];
const hashes = {};
const beadPath = "M70 168 C113 152 151 136 190 127 S272 110 324 99 S412 83 478 64";
const standardBead = `<path d="${beadPath}" fill="none" stroke="#6b6254" stroke-width="17" stroke-linecap="round" opacity=".42" transform="translate(2 4)"/><path d="${beadPath}" fill="none" stroke="#d3c6a9" stroke-width="13" stroke-linecap="round"/>`;
function bead(scenario) {
  if (scenario === "bead-thin") return `${standardBead}<path d="M255 114 C278 108 302 103 327 98" fill="none" stroke="#8c8f91" stroke-width="17"/><path d="M255 114 C278 108 302 103 327 98" fill="none" stroke="#d3c6a9" stroke-width="4" stroke-linecap="round"/>`;
  if (scenario === "bead-missing") return `${standardBead}<path d="M249 115 C274 108 300 102 331 97" fill="none" stroke="#8c8f91" stroke-width="25"/><path d="M249 115 C274 108 300 102 331 97" fill="none" stroke="#444b50" stroke-width="2" opacity=".6"/>`;
  if (scenario === "bead-offset") return `<path d="${beadPath}" fill="none" stroke="#39434b" stroke-width="2" stroke-dasharray="5 6"/><path d="M70 168 C113 152 151 136 190 127 S272 128 324 117 S412 83 478 64" fill="none" stroke="#6b6254" stroke-width="17" stroke-linecap="round" opacity=".42" transform="translate(2 4)"/><path d="M70 168 C113 152 151 136 190 127 S272 128 324 117 S412 83 478 64" fill="none" stroke="#d3c6a9" stroke-width="13" stroke-linecap="round"/>`;
  return `${standardBead}<path d="M221 80 C250 95 278 104 316 104" fill="none" stroke="url(#glare)" stroke-width="22" opacity=".72"/>`;
}

function panel(scenario) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 240" role="img" aria-label="Generated simulated sealer bead illustration">
<defs><linearGradient id="steel" x2="0" y2="1"><stop stop-color="#a4a9ad"/><stop offset=".52" stop-color="#838b90"/><stop offset="1" stop-color="#626b70"/></linearGradient><linearGradient id="glare" x2="1" y2="0"><stop stop-color="#dce8ed" stop-opacity="0"/><stop offset=".48" stop-color="#fff" stop-opacity=".92"/><stop offset="1" stop-color="#dce8ed" stop-opacity="0"/></linearGradient></defs>
<rect width="540" height="240" fill="#586066"/><path d="M0 22 L540 0 V236 L0 240 Z" fill="url(#steel)"/><path d="M27 203 C119 174 210 139 322 108 S429 84 511 45" fill="none" stroke="#4b5358" stroke-width="25" opacity=".45"/><path d="M27 203 C119 174 210 139 322 108 S429 84 511 45" fill="none" stroke="#b2b9bb" stroke-width="3" opacity=".65"/><path d="M30 35 L505 18" stroke="#c5c9c9" stroke-width="2" opacity=".5"/>${[68,149,235,407,471].map((x) => `<circle cx="${x}" cy="31" r="4" fill="#737a7c" stroke="#bfc5c6"/>`).join("")}
${bead(scenario)}</svg>`;
}

function mask(scenario) {
  const x = scenario === "bead-offset" ? 304 : scenario === "reflection" ? 270 : 291;
  const color = scenario === "reflection" ? "#38a4d8" : "#f3a832";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 240" role="img" aria-label="Generated prototype heatmap overlay, not model ground truth"><defs><radialGradient id="heat"><stop stop-color="${color}" stop-opacity=".67"/><stop offset=".48" stop-color="${color}" stop-opacity=".33"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><ellipse cx="${x}" cy="108" rx="68" ry="49" fill="url(#heat)"/></svg>`;
}

for (const scenario of scenarios) {
  const image = panel(scenario);
  const overlay = mask(scenario);
  await writeFile(resolve(generated, `${scenario}.svg`), image, "utf8");
  await writeFile(resolve(generated, `${scenario}-mask.svg`), overlay, "utf8");
  hashes[`${scenario}.svg`] = createHash("sha256").update(image).digest("hex");
  hashes[`${scenario}-mask.svg`] = createHash("sha256").update(overlay).digest("hex");
}
await writeFile(resolve(generated, "README.md"), `# Generated prototype visuals\n\nThese deterministic SVGs are generated prototype illustrations for a simulated demo. They are not camera frames, trained-model outputs, or ground-truth masks. The overlays are illustrative only.\n\nScenarios: BEAD_THIN, BEAD_MISSING, BEAD_OFFSET, and false-alarm REFLECTION. Expected human step for REFLECTION: reject with reason \`reflection\`.\n\nRegenerate from the application repository with \`node scripts/generate-pilot-assets.mjs\`. UI-4 owns any reviewed copies placed in application \`public/\`.\n`, "utf8");
await writeFile(resolve(pilotRoot, "manifests/generated-prototype.json"), JSON.stringify({
  sourceType: "generated_simulation",
  provenance: "illustration",
  sourceLabel: "Generated prototype illustration · simulated",
  isTmminData: false,
  isTrainedModelGroundTruth: false,
  usedForKpi: false,
  filesSha256: hashes,
}, null, 2) + "\n", "utf8");
process.stdout.write(`Generated ${scenarios.length * 2} SVGs in ${generated}\n`);
