import type { ReactNode } from "react";

/** Empty state that says what is normal and what to do next. */
export function EmptyState({
  icon = "ph-check-circle",
  title,
  children,
  action,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <i className={`ph ${icon}`} aria-hidden="true" />
      <p className="empty__title">{title}</p>
      {children ? <p className="empty__text">{children}</p> : null}
      {action}
    </div>
  );
}
