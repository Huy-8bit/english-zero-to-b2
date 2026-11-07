import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A keyboard shortcut hint inside a button or a sentence ("Enter", "1–4"). Inherits the text colour (readable on any
 *  button tone). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn("ml-1 rounded border border-current/30 px-1 font-mono text-[11px] leading-4", className)}>{children}</kbd>;
}
