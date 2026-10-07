import { BeadLitFilter } from "@/components/station/BeadIllustration";

const WELDS: [number, number][] = [[86, 92], [112, 74], [178, 56], [214, 55], [246, 55]];
const BEAD = "M70 118 C 74 84, 100 66, 150 63 L 244 62";

/**
 * Drawn view of a sealer cell for stations without footage: a door panel
 * passes at takt, the robot nozzle lays the bead, the camera cone sweeps.
 * Only animated when `animated` (focused feed) and motion is allowed.
 */
export function SealerScene({ id, animated = false }: { id: string; animated?: boolean }) {
  const sid = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      className={`scene${animated ? " scene--live" : ""}`}
      viewBox="0 0 320 180"
      role="img"
      aria-label="Simulated view of the sealer cell: a door panel passes the nozzle and the camera"
    >
      <defs>
        <linearGradient id={`${sid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a3a" /><stop offset="1" stopColor="#262626" />
        </linearGradient>
        <linearGradient id={`${sid}-panel`} x1="0" y1="0" x2=".6" y2="1">
          <stop offset="0" stopColor="#9ba0a5" /><stop offset=".6" stopColor="#7d8287" /><stop offset="1" stopColor="#63676c" />
        </linearGradient>
        <BeadLitFilter id={`${sid}-lit`} />
      </defs>
      <rect width="320" height="180" fill={`url(#${sid}-bg)`} />
      <g opacity=".35" stroke="#6a6a6a" strokeWidth="1">
        <path d="M0 150 H320" /><path d="M0 160 H320" />
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${i * 30} 150 v10`} />)}
      </g>
      <g className="scene__body">
        <path d="M40 140 C 40 80, 80 50, 150 46 L 250 44 C 268 44, 276 60, 276 80 L 276 140 Z" fill={`url(#${sid}-panel)`} stroke="#2c2c2c" strokeWidth="2" />
        <path d="M58 140 C 58 92, 92 66, 150 62 L 252 60 C 262 60, 266 70, 266 82 L 266 140" fill="none" stroke="#b9bdc1" strokeWidth="1" opacity=".55" />
        {WELDS.map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.6" fill="#7a7e83" stroke="#9fa3a8" strokeWidth=".8" />)}
        <path d={BEAD} fill="none" stroke="#000" strokeWidth="7" strokeLinecap="round" opacity=".35" transform="translate(1 2)" />
        <g filter={`url(#${sid}-lit)`}>
          <path className="scene__bead" d={BEAD} fill="none" stroke="#cbc2ab" strokeWidth="5.5" strokeLinecap="round" pathLength={100} />
        </g>
      </g>
      <g className="scene__robot" stroke="#1d1d1d" strokeWidth="2">
        <rect x="196" y="0" width="22" height="18" fill="#4a4a4a" />
        <path d="M207 18 L 207 34 L 196 46" fill="none" stroke="#5a5a5a" strokeWidth="6" strokeLinecap="round" />
        <circle cx="196" cy="48" r="4" fill="#d9d3c3" />
      </g>
      <path className="scene__cone" d="M300 8 L 120 150 L 300 150 Z" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.18)" strokeDasharray="3 4" />
      <rect x="292" y="2" width="18" height="10" rx="2" fill="#555" />
    </svg>
  );
}
