import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
};

export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)} {...props} />;
}
