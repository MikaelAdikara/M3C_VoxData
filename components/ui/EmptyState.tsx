import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

/** Empty state that says what is normal and what to do next. */
export function EmptyState({
  icon = "check-circle",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <p className="empty__title">{title}</p>
      {children ? <p className="empty__text">{children}</p> : null}
      {action}
    </div>
  );
}
