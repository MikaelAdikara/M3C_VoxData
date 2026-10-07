import {
  ArrowBendUpRight,
  ArrowCounterClockwise,
  ArrowRight,
  BellRinging,
  Books,
  Camera,
  ChartLine,
  Check,
  CheckCircle,
  ClipboardText,
  Cpu,
  Drop,
  Funnel,
  HandPalm,
  HandPointing,
  Info,
  Lightbulb,
  Monitor,
  Moon,
  NotePencil,
  PaperPlaneTilt,
  Pause,
  Play,
  SealCheck,
  Sparkle,
  SquaresFour,
  Sun,
  UserCircle,
  UsersThree,
  VideoCamera,
  Warning,
  WarningCircle,
  Wrench,
  X,
  XCircle,
} from "@phosphor-icons/react/ssr";
import type { IconWeight } from "@phosphor-icons/react";

const ICONS = {
  "arrow-bend-up-right": ArrowBendUpRight,
  "arrow-counter-clockwise": ArrowCounterClockwise,
  "arrow-right": ArrowRight,
  "bell-ringing": BellRinging,
  books: Books,
  camera: Camera,
  "chart-line": ChartLine,
  check: Check,
  "check-circle": CheckCircle,
  "clipboard-text": ClipboardText,
  cpu: Cpu,
  drop: Drop,
  funnel: Funnel,
  "hand-palm": HandPalm,
  "hand-pointing": HandPointing,
  info: Info,
  lightbulb: Lightbulb,
  monitor: Monitor,
  moon: Moon,
  "note-pencil": NotePencil,
  "paper-plane-tilt": PaperPlaneTilt,
  pause: Pause,
  play: Play,
  "seal-check": SealCheck,
  sparkle: Sparkle,
  "squares-four": SquaresFour,
  sun: Sun,
  "user-circle": UserCircle,
  "users-three": UsersThree,
  "video-camera": VideoCamera,
  warning: Warning,
  "warning-circle": WarningCircle,
  wrench: Wrench,
  x: X,
  "x-circle": XCircle,
} as const;

export type IconName = keyof typeof ICONS;

/**
 * Phosphor icon, decorative by default. Wrapped in <i> so the existing
 * size rules in globals.css (font-size on the wrapper) keep working.
 */
export function Icon({ name, weight = "regular" }: { name: IconName; weight?: IconWeight }) {
  const Glyph = ICONS[name];
  return (
    <i className="icon" aria-hidden="true">
      <Glyph weight={weight} />
    </i>
  );
}
