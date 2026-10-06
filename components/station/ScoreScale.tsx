/** Anomaly score against the station threshold on one 0 to 1 scale. */
export function ScoreScale({ score, threshold }: { score: number; threshold: number }) {
  const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`;
  return (
    <div
      className="score"
      role="img"
      aria-label={`Anomaly score ${score.toFixed(2)} against threshold ${threshold.toFixed(2)}`}
    >
      <div className="score__nums">
        <span className="score__val num">{score.toFixed(2)}</span>
        <span className="score__thr num">threshold {threshold.toFixed(2)}</span>
      </div>
      <div className="score__scale">
        <span className="score__tick" style={{ left: pct(threshold) }} data-label={threshold.toFixed(2)} />
        <span className="score__mark" style={{ left: pct(score) }} />
      </div>
      <div className="score__ends">
        <span>0</span>
        <span>1.0</span>
      </div>
    </div>
  );
}
