"use client";

import { useState } from "react";

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

/** Health tone of the camera now: offline, alert waiting, needs attention, or fine. */
export function feedTone(cam: FeedCamera) {
  if (cam.state === "offline") return "stop";
  if (cam.pendingDecisionAlertIds.length || cam.openAlertIds.length) return "caution";
  if (cam.modelReviewNeeded || cam.state === "attention") return "instruct";
  return "ok";
}

export type FeedReplay =
  /** An alert from the shift, drawn as our illustration (never a recorded frame). */
  | { kind: "alert"; at: string; defect: DefectTypeId; id: string }
  /** The playhead sits inside a recording gap: nothing was recorded. */
  | { kind: "gap"; at: string; reason?: string };

/**
 * One station camera, honest about what it shows:
 * - current view: a public reference clip (never boxed) or a generated scene;
 * - replay: an alert illustration with its time, or "no recording" in a gap.
 * Current health (offline, signal lost) is shown only in the current view, and
 * nothing is labelled LIVE or REC, because there is no real stream.
 */
export function CameraFeed({
  cam,
  focus = false,
  compact = false,
  replay,
}: {
  cam: FeedCamera;
  focus?: boolean;
  compact?: boolean;
  replay?: FeedReplay | null;
}) {
  const offline = cam.state === "offline";
  const tone = feedTone(cam);
  const clip = cam.media ? CLIPS[cam.media.assetId] : undefined;
  const [clipFailed, setClipFailed] = useState(false);

  let media;
  let source: string;
  let corner: string | null = null;
  if (replay?.kind === "alert") {
    media = <BeadIllustration defect={replay.defect} id={`frame-${replay.id}`} />;
    source = "Alert replay · illustration, simulated";
    corner = plantTime(replay.at);
  } else if (replay?.kind === "gap") {
    media = <div className="feed__blank" />;
    source = "Recording gap";
    corner = plantTime(replay.at);
  } else if (!cam.media) {
    media = <div className="feed__tablet">Tablet findings · no CCTV feed</div>;
    source = "Body-map tablet";
  } else if (clip && !clipFailed) {
    media = (
      <video
        src={`/cams/${clip}.mp4`}
        poster={`/cams/${clip}.jpg`}
        muted
        loop
        playsInline
        preload="none"
        autoPlay={focus && !offline}
        onError={() => setClipFailed(true)}
        aria-hidden="true"
      />
    );
    source = "Public visual reference · not TMMIN footage";
  } else {
    media = <SealerScene id={`scene-${cam.id}`} animated={focus && !compact && !offline} />;
    source = "Generated simulation";
  }

  const showLost = offline && !replay;

  return (
    <div className="feed" data-tone={tone} data-offline={offline} data-replay={replay?.kind ?? "none"}>
      {media}
      {focus && !offline && !compact && cam.media && !replay ? <span className="feed__sweep" aria-hidden="true" /> : null}
      {showLost ? (
        <div className="feed__lost">
          <strong>Signal lost</strong>
          <span>{cam.note ?? "No frames"}</span>
        </div>
      ) : null}
      {replay?.kind === "gap" ? (
        <div className="feed__lost feed__lost--gap">
          <strong>No recording</strong>
          <span>{replay.reason ?? "The camera recorded nothing at this time."}</span>
        </div>
      ) : null}
      <div className="feed__top">
        <span className="feed__chip">
          <span className="feed__pip" data-tone={tone} />
          <span className="mono">{cam.stationId}</span>
          {compact ? null : ` · ${cam.name}`}
        </span>
        {corner ? <span className="feed__chip num">{corner}</span> : null}
      </div>
      {compact || showLost ? null : (
        <div className="feed__bottom">
          <span className="feed__chip feed__chip--quiet">{source}</span>
        </div>
      )}
    </div>
  );
}
