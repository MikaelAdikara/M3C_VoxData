import { SealerScene } from "@/components/cctv/SealerScene";
import { plantTime } from "@/components/format";
import { BeadIllustration } from "@/components/station/BeadIllustration";
import type { CameraView, DefectTypeId } from "@/lib/types";

export type FeedCamera = CameraView["cameras"][number];

/* Public reference clips copied into public/cams (Pexels, see design/ASSETS.md). */
const CLIPS: Record<string, string> = {
  "industrial-context-st-03": "body-weld-a",
  "industrial-context-st-05": "body-weld-b",
  "industrial-context-final-01": "body-hall",
};

const DEFECT_BY_NAME: Record<string, DefectTypeId> = {
  "Broken bead": "BEAD_BREAK",
  "Missing bead": "BEAD_MISSING",
  "Thin bead": "BEAD_THIN",
  "Bead off path": "BEAD_OFFSET",
  "Excess sealer": "BEAD_EXCESS",
};
/** Defect type of a camera "Alert · <name>" event, for drawing its frame. */
export const defectOfEvent = (label: string): DefectTypeId => DEFECT_BY_NAME[label.replace(/^Alert · /, "")] ?? "BEAD_BREAK";

export function feedTone(cam: FeedCamera) {
  if (cam.state === "offline") return "stop";
  if (cam.pendingDecisionAlertIds.length || cam.openAlertIds.length) return "caution";
  if (cam.modelReviewNeeded || cam.state === "attention") return "instruct";
  return "ok";
}

/**
 * One station camera, honest about its source: a public test clip never
 * carries a box, a drawn scene says it is simulated, and only our own
 * illustrated alert frame carries a heatmap.
 */
export function CameraFeed({
  cam,
  focus = false,
  compact = false,
  alertFrame,
}: {
  cam: FeedCamera;
  focus?: boolean;
  compact?: boolean;
  /** Show the frozen frame of an alert instead of the live source. */
  alertFrame?: { at: string; defect: DefectTypeId; id: string } | null;
}) {
  const offline = cam.state === "offline";
  const tone = feedTone(cam);
  const clip = cam.media ? CLIPS[cam.media.assetId] : undefined;
  const showAlert = Boolean(alertFrame) && !offline;

  let media;
  let source: string;
  if (showAlert && alertFrame) {
    media = <BeadIllustration defect={alertFrame.defect} id={`frame-${alertFrame.id}`} />;
    source = `Alert frame ${plantTime(alertFrame.at)} · simulated`;
  } else if (clip) {
    media = (
      <video src={`/cams/${clip}.mp4`} poster={`/cams/${clip}.jpg`} muted loop playsInline preload="none" autoPlay={focus} aria-hidden="true" />
    );
    source = "Test clip · no annotation";
  } else if (cam.media) {
    media = <SealerScene id={`scene-${cam.id}`} animated={focus && !compact && !offline} />;
    source = "Simulated scene";
  } else {
    media = <div className="feed__tablet">Tablet findings · no CCTV feed</div>;
    source = "No camera";
  }

  return (
    <div className="feed" data-tone={tone} data-offline={offline}>
      {media}
      {focus && !offline && !compact && cam.media ? <span className="feed__sweep" aria-hidden="true" /> : null}
      {offline ? (
        <div className="feed__lost">
          <strong>Signal lost</strong>
          <span>{cam.note ?? "No frames"}</span>
        </div>
      ) : null}
      <div className="feed__top">
        <span className="feed__chip">
          <span className="feed__pip" data-tone={tone} />
          <span className="mono">{cam.stationId}</span>
          {compact ? null : ` · ${cam.name}`}
        </span>
        {offline || !cam.media ? null : <span className="feed__chip num">{showAlert && alertFrame ? plantTime(alertFrame.at) : "LIVE"}</span>}
      </div>
      {compact || offline ? null : (
        <div className="feed__bottom">
          <span className="feed__chip feed__chip--quiet">{source}</span>
          {cam.media ? (
            <span className="feed__chip feed__rec"><span className="feed__pip" data-tone="stop" />REC</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
