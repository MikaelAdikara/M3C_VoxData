import type { ReactNode } from "react";

export type PlateTone = "caution" | "stop" | "safe" | "instruct" | "neutral";

const DEFAULT_ICON: Record<PlateTone, string> = {
  caution: "ph-warning",
  stop: "ph-hand-palm",
  safe: "ph-seal-check",
  instruct: "ph-note-pencil",
  neutral: "ph-info",
};

/**
 * Sign plate, the signature component: a colour band with a pictogram and a
 * plain-words state, facts below. Use only where a decision is pending or a
 * state is final.
 */
export function Plate({
  tone,
  title,
  subtitle,
  icon,
  as: Heading = "h2",
  children,
}: {
  tone: PlateTone;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: string;
  as?: "h2" | "h3" | "p";
  children?: ReactNode;
}) {
  return (
    <article className="plate" data-tone={tone}>
      <div className="plate__band">
        <span className="plate__icon">
          <i className={`ph-fill ${icon ?? DEFAULT_ICON[tone]}`} aria-hidden="true" />
        </span>
        <Heading className="plate__title">
          {title}
          {subtitle ? <small>{subtitle}</small> : null}
        </Heading>
      </div>
      {children ? <div className="plate__body">{children}</div> : null}
    </article>
  );
}
