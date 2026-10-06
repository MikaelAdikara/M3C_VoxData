import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export type PlateTone = "caution" | "stop" | "safe" | "instruct" | "neutral";

const DEFAULT_ICON: Record<PlateTone, IconName> = {
  caution: "warning",
  stop: "hand-palm",
  safe: "seal-check",
  instruct: "note-pencil",
  neutral: "info",
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
  icon?: IconName;
  as?: "h2" | "h3" | "p";
  children?: ReactNode;
}) {
  return (
    <article className="plate" data-tone={tone}>
      <div className="plate__band">
        <span className="plate__icon">
          <Icon name={icon ?? DEFAULT_ICON[tone]} weight="fill" />
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
