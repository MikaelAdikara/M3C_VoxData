"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Plate } from "@/components/ui/Plate";
import type { CameraModelView } from "@/lib/types";
import { assessCrop, heatOpacity } from "@/lib/vision/assessment";
import {
  BEAD_H,
  BEAD_W,
  limitSeverity,
  nominalParams,
  renderBead,
  seamGeometry,
  type BeadDefectType,
  type BeadParams,
} from "@/lib/vision/beadsynth";
import { loadBeadModel, scoreBead, type BeadScore } from "@/lib/vision/model-client";

type DefectChoice = "none" | BeadDefectType;
type Tool = "off" | "erase" | "add";

const DEFECTS: { key: DefectChoice; label: string }[] = [
  { key: "none", label: "Good" },
  { key: "missing", label: "Missing" },
  { key: "break", label: "Break" },
  { key: "thin", label: "Thin" },
  { key: "offset", label: "Off path" },
  { key: "excess", label: "Excess" },
];

/** Gross end of each defect's size slider (the other end is the synthetic spec limit). */
function grossSeverity(type: BeadDefectType, seam: number) {
  const w0 = seamGeometry(seam).width0;
  return {
    missing: { length: 90, severity: 0 },
    break: { length: 16, severity: 0 },
    thin: { length: 70, severity: 0.35 },
    offset: { length: 80, severity: 1.2 * w0 },
    excess: { length: 50, severity: 2.2 },
  }[type];
}

const BRUSH = 4;

export function CameraModelScreen({ view }: { view: CameraModelView }) {
  const [seam, setSeam] = useState(6); // seam-R-door-07, the seam in the Kaizen story
  const [defect, setDefect] = useState<DefectChoice>("none");
  const [size, setSize] = useState(0); // 0 = at the spec limit, 1 = gross
  const [pos, setPos] = useState(110);
  const [gain, setGain] = useState(1);
  const [noise, setNoise] = useState(0.012);
  const [glare, setGlare] = useState(0);
  const [variation, setVariation] = useState<Partial<BeadParams>>({});
  const [tool, setTool] = useState<Tool>("off");
  const [edits, setEdits] = useState(() => ({ erase: new Float32Array(BEAD_W * BEAD_H), add: new Float32Array(BEAD_W * BEAD_H), n: 0 }));
  const [showHeat, setShowHeat] = useState(true);
  const [model, setModel] = useState<"loading" | "ready" | "error">("loading");
  const [result, setResult] = useState<BeadScore | null>(null);

  const imgRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const seamInfo = view.seams[seam];

  const params: BeadParams = useMemo(() => {
    const p: BeadParams = { ...nominalParams(seam), ...variation, seam, gain, noise };
    if (glare > 0) Object.assign(p, { glare, glareX: pos + 30, glareY: BEAD_H / 2 - 6, glareR: 9 });
    if (defect !== "none") {
      const lo = limitSeverity(defect, seam);
      const hi = grossSeverity(defect, seam);
      const length = lo.length + size * (hi.length - lo.length);
      const severity = lo.severity + size * (hi.severity - lo.severity);
      p.defect = { type: defect, x0: Math.min(pos, BEAD_W - 20 - length), length, severity };
    }
    return p;
  }, [seam, variation, gain, noise, glare, pos, defect, size]);

  const rgba = useMemo(() => renderBead(params, edits.n ? edits : undefined), [params, edits]);

  useEffect(() => {
    loadBeadModel().then(() => setModel("ready"), () => setModel("error"));
  }, []);

  // draw the crop
  useEffect(() => {
    const ctx = imgRef.current?.getContext("2d");
    if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), BEAD_W, BEAD_H), 0, 0);
  }, [rgba]);

  // score it (debounced while sliders move or the brush paints)
  useEffect(() => {
    if (model !== "ready") return;
    let live = true;
    const id = window.setTimeout(() => {
      scoreBead(rgba, seam).then((r) => live && setResult(r), () => live && setModel("error"));
    }, 120);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [rgba, seam, model]);

  // heatmap overlay in caution yellow, scaled to this seam's threshold
  useEffect(() => {
    const ctx = heatRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, BEAD_W, BEAD_H);
    if (!result || !showHeat) return;
    const img = ctx.createImageData(BEAD_W, BEAD_H);
    for (let i = 0; i < BEAD_W * BEAD_H; i++) {
      img.data[i * 4] = 242;
      img.data[i * 4 + 1] = 183;
      img.data[i * 4 + 2] = 5;
      img.data[i * 4 + 3] = Math.round(heatOpacity(result.heatmap[i], seamInfo.threshold) * 190);
    }
    ctx.putImageData(img, 0, 0);
  }, [result, showHeat, seamInfo.threshold]);

  function paint(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "off") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * BEAD_W;
    const cy = ((e.clientY - rect.top) / rect.height) * BEAD_H;
    const key = tool === "erase" ? "erase" : "add";
    setEdits((prev) => {
      const target = Float32Array.from(prev[key]);
      for (let y = Math.max(0, Math.floor(cy - BRUSH)); y <= Math.min(BEAD_H - 1, Math.ceil(cy + BRUSH)); y++) {
        for (let x = Math.max(0, Math.floor(cx - BRUSH)); x <= Math.min(BEAD_W - 1, Math.ceil(cx + BRUSH)); x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d <= BRUSH) target[y * BEAD_W + x] = Math.max(target[y * BEAD_W + x], Math.min(1, BRUSH + 0.5 - d));
        }
      }
      return { ...prev, [key]: target, n: prev.n + 1 };
    });
  }

  function clearEdits() {
    setEdits({ erase: new Float32Array(BEAD_W * BEAD_H), add: new Float32Array(BEAD_W * BEAD_H), n: 0 });
  }

  function newVariation() {
    const u = (a: number, b: number) => a + Math.random() * (b - a);
    setVariation({
      seed: Math.floor(u(1, 2 ** 31 - 2)),
      gradX: u(-0.15, 0.15),
      gradY: u(-0.15, 0.15),
      light: u(-1, 1),
      shiftX: u(-6, 6),
      shiftY: u(-3, 3),
      widthScale: u(0.93, 1.07),
      sealerTone: u(0.78, 0.86),
    });
    setGain(Math.round(u(0.8, 1.2) * 100) / 100);
    setNoise(Math.round(u(0.006, 0.025) * 1000) / 1000);
  }

  const verdict = result ? assessCrop(result.score, seamInfo.threshold) : null;
  const scaleMax = seamInfo.threshold * 2;
  const pct = (v: number) => `${Math.max(0, Math.min(1, v / scaleMax)) * 100}%`;
  const ev = view.evaluation;

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Camera model · {view.stationId} sealer</h1>
          <p className="page__sub">
            A trained anomaly model scores a sealer-bead crop in this browser. It flags; the operator confirms; the team leader decides.
          </p>
        </div>
        <div className="cam-head">
          <Link className="btn btn--ghost" href="/cameras"><Icon name="video-camera" />Cameras</Link>
          <span className="loop loop--shift">Shift loop</span>
        </div>
      </div>

      <div className="cm">
        <section className="panel" aria-labelledby="cm-crop">
          <div className="panel__head">
            <h2 id="cm-crop">Camera crop · <span className="mono">{seamInfo.id}</span></h2>
            <label className="cm-check">
              <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
              <span>Heatmap</span>
            </label>
          </div>
          <div className="panel__body">
            <div className="cm-canvas" data-tool={tool}>
              <canvas ref={imgRef} width={BEAD_W} height={BEAD_H} aria-label={`Synthetic sealer bead on ${seamInfo.id}`} role="img" />
              <canvas
                ref={heatRef}
                width={BEAD_W}
                height={BEAD_H}
                aria-hidden="true"
                onPointerDown={(e) => {
                  painting.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  paint(e);
                }}
                onPointerMove={(e) => painting.current && paint(e)}
                onPointerUp={() => (painting.current = false)}
                onPointerCancel={() => (painting.current = false)}
              />
            </div>

            <div className="cm-tools">
              <div className="seg seg--sm" role="radiogroup" aria-label="Brush">
                {([
                  ["off", "View"],
                  ["erase", "Remove sealer"],
                  ["add", "Add sealer"],
                ] as const).map(([k, label]) => (
                  <label key={k}>
                    <input type="radio" name="cm-tool" checked={tool === k} onChange={() => setTool(k)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <button type="button" className="btn btn--quiet" onClick={clearEdits} disabled={!edits.n}>
                <Icon name="arrow-counter-clockwise" />Clear brush
              </button>
              <button type="button" className="btn btn--ghost" onClick={newVariation}>
                <Icon name="camera" />New normal variation
              </button>
            </div>

            <div className="cm-controls">
              <div className="field">
                <label htmlFor="cm-seam">Seam</label>
                <select id="cm-seam" className="input" value={seam} onChange={(e) => setSeam(Number(e.target.value))}>
                  {view.seams.map((s) => <option key={s.id} value={s.index}>{s.id}</option>)}
                </select>
              </div>
              <div className="field cm-span">
                <span className="cm-label" id="cm-defect">Defect</span>
                <div className="seg seg--sm" role="radiogroup" aria-labelledby="cm-defect">
                  {DEFECTS.map((d) => (
                    <label key={d.key}>
                      <input type="radio" name="cm-defect" checked={defect === d.key} onChange={() => setDefect(d.key)} />
                      <span>{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Range id="cm-size" label="Defect size" value={size} min={0} max={1} step={0.05} disabled={defect === "none"}
                onChange={setSize} show={size === 0 ? "at spec limit" : size === 1 ? "gross" : `${Math.round(size * 100)}% to gross`} />
              <Range id="cm-pos" label="Position along seam" value={pos} min={20} max={200} step={1} disabled={defect === "none" && glare === 0}
                onChange={setPos} show={`${pos} px`} />
              <Range id="cm-gain" label="Lighting" value={gain} min={0.7} max={1.3} step={0.01} onChange={setGain}
                show={`${Math.round(gain * 100)}%`} hint={gain < 0.8 || gain > 1.2 ? "outside training range" : undefined} />
              <Range id="cm-noise" label="Sensor noise" value={noise} min={0.004} max={0.05} step={0.001} onChange={setNoise}
                show={noise.toFixed(3)} hint={noise > 0.025 ? "outside training range" : undefined} />
              <Range id="cm-glare" label="Reflection" value={glare} min={0} max={0.3} step={0.01} onChange={setGlare}
                show={glare === 0 ? "none" : glare.toFixed(2)} hint={glare > 0.08 ? "stronger than any in training" : undefined} />
            </div>
          </div>
        </section>

        <aside className="cm-side">
          {model === "error" ? (
            <Plate tone="neutral" title="Model did not load" subtitle="Reload the page to try again">
              <p>This browser could not start the WebAssembly runtime. The rest of the prototype still works.</p>
            </Plate>
          ) : !verdict || !result ? (
            <Plate tone="neutral" title="Loading the model" subtitle={`${ev.modelMegabytes} MB, once per visit`} icon="cpu" />
          ) : (
            <Plate
              tone={verdict.flagged ? "caution" : "neutral"}
              title={verdict.flagged ? "Alert to operator" : "No alert"}
              subtitle={`${view.stationId} · ${seamInfo.id}`}
              icon={verdict.flagged ? "warning" : "check-circle"}
            >
              <div className="score" role="img" aria-label={`Anomaly score ${result.score.toFixed(2)} against threshold ${seamInfo.threshold.toFixed(2)}`}>
                <div className="score__nums">
                  <span className="score__val num">{result.score.toFixed(2)}</span>
                  <span className="score__thr num">threshold {seamInfo.threshold.toFixed(2)}</span>
                </div>
                <div className="score__scale">
                  <span className="score__tick" style={{ left: pct(seamInfo.threshold) }} data-label={seamInfo.threshold.toFixed(2)} />
                  <span className="score__mark" style={{ left: pct(result.score) }} />
                </div>
                <div className="score__ends"><span>0</span><span className="num">{scaleMax.toFixed(1)}</span></div>
              </div>
              <p className="cm-next">{verdict.nextStep}</p>
              <dl className="facts">
                <dt>Model</dt><dd className="mono">{view.modelVersion}</dd>
                <dt>Scored in</dt><dd className="num">{Math.round(result.ms)} ms, in this browser</dd>
                <dt>Image upload</dt><dd>None</dd>
              </dl>
            </Plate>
          )}
          <p className="cm-honest">
            <span className="badge badge--outline">Synthetic data</span>
            Trained and tested on generated bead images. This proves the workflow and the way we measure, not accuracy on TMMIN lines. Real accuracy is shown only at Checkpoint 0 and Gate 1.
          </p>
          <p className="cm-honest">
            <span className="badge badge--outline">Score scale</span>
            This page shows the model&apos;s raw distance score against each seam&apos;s own threshold. The Station and Shift board screens replay the pilot&apos;s simulated alerts on a 0 to 1 scale.
          </p>
        </aside>
      </div>

      <section className="panel cm-eval" aria-labelledby="cm-eval">
        <div className="panel__head">
          <h2 id="cm-eval">Evaluation at the false-alarm budget</h2>
          <span className="muted">{view.sourceLabel}</span>
        </div>
        <div className="panel__body">
          <div className="cm-kpis">
            <div>
              <b className="num">{ev.expectedFalseAlarmsPerShift.toFixed(1)}</b>
              <span>expected false alarms per station per shift (budget {view.falseAlarmBudget}; 95% range {ev.expectedFalseAlarmsPerShift95[0].toFixed(1)}–{ev.expectedFalseAlarmsPerShift95[1].toFixed(1)})</span>
            </div>
            <div>
              <b className="num">{ev.falseAlarms} / {ev.goodTestCrops.toLocaleString("en-US")}</b>
              <span>good test crops flagged; thresholds set per seam on a separate calibration set</span>
            </div>
            <div>
              <b className="num">{ev.cpuMs.toFixed(0)} ms</b>
              <span>per crop on one laptop CPU thread</span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table cm-table">
              <thead>
                <tr>
                  <th scope="col">Defect type</th>
                  <th scope="col">Criticality</th>
                  <th scope="col" className="r">Limit samples detected</th>
                  <th scope="col" className="r">Random sizes detected</th>
                  <th scope="col" className="r"><abbr title="Area under the ROC curve: how well scores separate good from defective crops over every possible threshold (1.0 = perfect)">AUROC</abbr></th>
                </tr>
              </thead>
              <tbody>
                {ev.perType.map((t) => (
                  <tr key={t.defectTypeId}>
                    <td>{t.name} <span className="mono muted">{t.defectTypeId}</span></td>
                    <td>
                      {t.criticality === "leak_critical"
                        ? <span className="badge badge--stop">Leak-critical · manual check stays</span>
                        : <span className="badge badge--outline">Non-critical</span>}
                    </td>
                    <td className="r num">{t.limitDetected} / {t.limitN}</td>
                    <td className="r num">{t.randomDetected} / {t.randomN}</td>
                    <td className="r num">{t.auroc.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted cm-foot">
            Limit samples sit exactly at our synthetic spec limit (59 per type, as in the Gate 1 test). AUROC can be near 1.0 while detection at the strict threshold is lower: thin beads at the limit score just under it. Strong reflections that never appeared in training were flagged {ev.strongReflection.flagged} of {ev.strongReflection.n} times: the operator rejects these with reason REFLECTION, and a station over budget is flagged for model review.
          </p>
        </div>
      </section>

      <section className="panel cm-eval" id="autovi" aria-labelledby="cm-real">
        <div className="panel__head">
          <h2 id="cm-real">Same method on real production images</h2>
          <span className="muted">{view.realImages.dataset}</span>
        </div>
        <div className="panel__body">
          <p className="cm-real-lead">
            AutoVI is a public set of images taken on Renault Group assembly lines. It has no sealer beads, so it checks the method on real lighting and part-to-part variation, not sealer accuracy. No defective image was used for training. Images stay with the dataset owner; only our scores are shown.
          </p>
          <div className="table-wrap">
            <table className="table cm-table">
              <thead>
                <tr>
                  <th scope="col">Category (defects)</th>
                  <th scope="col" className="r">Good training images</th>
                  <th scope="col" className="r"><abbr title="Area under the ROC curve: how well scores separate good from defective images (1.0 = perfect, 0.5 = chance)">AUROC</abbr></th>
                  <th scope="col" className="r">Caught if 5% of good flagged</th>
                  <th scope="col" className="r">Caught if 1% of good flagged</th>
                  <th scope="col" className="r">Strict threshold: caught · false alarms</th>
                </tr>
              </thead>
              <tbody>
                {view.realImages.categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name} <span className="muted">({c.defects})</span></td>
                    <td className="r num">{c.trainGood}</td>
                    <td className="r num">{c.aurocPatchcoreLike.toFixed(2)}</td>
                    <td className="r num">{Math.round(c.caughtAt5pct * 100)}%</td>
                    <td className="r num">{Math.round(c.caughtAt1pct * 100)}%</td>
                    <td className="r num">{c.strictCaught} / {c.testDefective} · {c.strictFalseAlarms} / {c.testGood}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted cm-foot">
            The method ranks real defects above good parts, but with about 100 good images a strict false-alarm threshold catches few of them. Certifying 0.042% per seam region needs at least 2,400 good images, which is why Checkpoint 0 collects them in shadow mode before any live alert. PatchCore-like settings (layers 2 and 3); the sealer-bead settings score {view.realImages.categories.map((c) => c.aurocBeadConfig.toFixed(2)).join(" / ")}.
          </p>
        </div>
      </section>
    </main>
  );
}

function Range({
  id, label, value, min, max, step, onChange, show, hint, disabled,
}: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; show: string; hint?: string; disabled?: boolean;
}) {
  return (
    <div className="field cm-range">
      <label htmlFor={id}>{label} <span className="muted num">{show}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))} />
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
