import type { ReactNode, TextareaHTMLAttributes, InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} />;
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-muted max-w-md">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/40 bg-danger-soft p-4 text-sm">
      <p className="font-medium text-danger">Có lỗi xảy ra</p>
      <p className="mt-1 text-fg">{error instanceof Error ? error.message : String(error)}</p>
      {onRetry && <button className="mt-2 underline" onClick={onRetry}>Thử lại</button>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn("h-11 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn("w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/20", className)} {...p} />
));
Textarea.displayName = "Textarea";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
