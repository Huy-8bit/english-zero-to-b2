import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Progress } from "./progress";

const WIDTH = { md: "max-w-5xl", lg: "max-w-6xl", xl: "max-w-[90rem]" } as const;

/**
 * The one header of every full-screen learning screen (lesson, journey, sprint, one night, VSTEP rush):
 * ✕ exit · mode · title · level/badges … meta (time, counts) · actions — and a thin progress bar on the bottom edge.
 * The reader-* classes let the reading mode wrap the toolbar (styles/index.css).
 */
export function SessionHeader({ onExit, exitLabel = "Thoát", mode, title, level, badges, meta, actions, progress, below, notice, width = "xl" }: {
  onExit: () => void; exitLabel?: string;
  mode?: { label: string; icon?: LucideIcon };
  title: ReactNode; level?: string | null; badges?: ReactNode;
  meta?: ReactNode; actions?: ReactNode;
  progress?: { value: number; label: string };
  below?: ReactNode; notice?: ReactNode;
  width?: keyof typeof WIDTH;
}) {
  const Icon = mode?.icon;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className={cn("reader-toolbar mx-auto flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 sm:px-6", WIDTH[width])}>
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={exitLabel}><X size={18} /></Button>
        <div className="reader-title flex min-w-0 flex-1 items-center gap-2">
          {mode && <Badge tone="primary" className="shrink-0">{Icon && <Icon size={12} />}{mode.label}</Badge>}
          <h1 className="min-w-0 truncate text-sm font-semibold sm:text-base">{title}</h1>
          {level && <Badge className="shrink-0">{level}</Badge>}
          {badges}
        </div>
        {meta && <div className="flex flex-wrap items-center gap-3 text-sm tabular-nums text-muted">{meta}</div>}
        {actions && <div className="reader-actions flex items-center gap-1">{actions}</div>}
      </div>
      {below && <div className={cn("mx-auto px-3 pb-2 sm:px-6", WIDTH[width])}>{below}</div>}
      {progress && <Progress className="h-1 rounded-none" value={progress.value} label={progress.label} />}
      {notice}
    </header>
  );
}
