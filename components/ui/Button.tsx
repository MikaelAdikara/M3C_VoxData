import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "stop" | "quiet";
type Size = "md" | "xl";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

function classes({ variant = "primary", size = "md", block }: CommonProps) {
  return [
    "btn",
    variant !== "primary" && `btn--${variant}`,
    size === "xl" && "btn--xl",
    block && "btn--block",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Pill button. Floor screens use size "xl" (72 px). "stop" is only for "Stop and fix". */
export function Button({
  variant,
  size,
  block,
  icon,
  children,
  type = "button",
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes({ variant, size, block, children })} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  block,
  icon,
  children,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={classes({ variant, size, block, children })}>
      {icon}
      {children}
    </Link>
  );
}
