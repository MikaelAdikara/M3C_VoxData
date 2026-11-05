import { Icon, type IconName } from "@/components/ui/Icon";

type Node = { label: string; note?: string; icon: IconName };

const CAMERA_PATH: Node[] = [
  { label: "Existing CCTV camera", icon: "video-camera" },
  { label: "NVR", note: "already recording", icon: "film-strip" },
  { label: "RTSP stream", icon: "arrow-right" },
  { label: "Bead model service", note: "model picked by body type", icon: "cpu" },
];

const OTHER_SOURCES: Node[] = [
  { label: "Model-detection camera", note: "body type for each body; selects the bead model", icon: "camera" },
  { label: "Robot controller error codes", note: "minor codes, weekly Pareto, before any breakdown", icon: "wrench" },
  { label: "Member walk-check", note: "tablet finding opens a work order", icon: "clipboard-text" },
];

const OUTPUTS: Node[] = [
  { label: "Andon screen at the station", icon: "bell-ringing" },
  { label: "Shift board", note: "standard step from a validated card", icon: "squares-four" },
  { label: "Kaizen ticket", note: "bead: third repeat in a shift · robot code: rises in the weekly Pareto · walk-check: back after its work order closed", icon: "clipboard-text" },
  { label: "Chat webhook", note: "Teams/Slack-compatible", icon: "chat-circle-text" },
];

function Step({ node }: { node: Node }) {
  return (
    <li className="plug__node">
      <Icon name={node.icon} />
      <span>
        {node.label}
        {node.note ? <small>{node.note}</small> : null}
      </span>
    </li>
  );
}

/**
 * How the learning layer sits on tools a plant already runs. Generic wording only;
 * every arrow is simulated in this prototype.
 */
export function PlugsIn() {
  return (
    <section className="panel plug" aria-labelledby="plug-title">
      <div className="panel__head">
        <h2 id="plug-title">How it plugs in</h2>
        <span className="muted">A learning layer on the plant&apos;s existing tools · simulated here</span>
      </div>
      <div className="panel__body plug__body">
        <div className="plug__col">
          <h3>Sources</h3>
          <ol className="plug__chain" aria-label="Camera path">
            {CAMERA_PATH.map((n) => <Step key={n.label} node={n} />)}
          </ol>
          <ul className="plug__chain plug__chain--side" aria-label="Other sources into the same outbox">
            {OTHER_SOURCES.map((n) => <Step key={n.label} node={n} />)}
          </ul>
        </div>
        <div className="plug__hub" aria-hidden="false">
          <Icon name="arrow-right" />
          <strong>Event outbox</strong>
          <small>one JSON event per step · each source keeps its own trigger rule</small>
          <Icon name="arrow-right" />
        </div>
        <div className="plug__col">
          <h3>Where people see it</h3>
          <ul className="plug__chain" aria-label="Outputs">
            {OUTPUTS.map((n) => <Step key={n.label} node={n} />)}
          </ul>
        </div>
      </div>
      <p className="plug__foot muted">
        The layer reads from these tools and never writes to line control. A standard step is shown only when a validated card holds it; the team leader runs it on the robot panel and the app records the tap.
      </p>
    </section>
  );
}
