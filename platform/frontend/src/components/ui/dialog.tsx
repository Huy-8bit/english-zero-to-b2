import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onOpenChange, title, description, children, className }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string; children: ReactNode; className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <D.Content className={cn("fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[85vh] overflow-y-auto", className)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-lg font-semibold">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Đóng"><X size={18} /></D.Close>
          </div>
          <div className="mt-4">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <D.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <D.Title className="text-base font-semibold">{title}</D.Title>
            <D.Description className="sr-only">{title}</D.Description>
            <D.Close className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Đóng"><X size={18} /></D.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
