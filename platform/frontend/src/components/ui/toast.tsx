import { create } from "zustand";
import { AnimatePresence, motion } from "motion/react";

interface Toast { id: number; text: string; tone: "info" | "success" | "error" }
const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; drop: (id: number) => void }>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3500);
  },
  drop: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  info: (text: string) => useToasts.getState().push({ text, tone: "info" }),
  success: (text: string) => useToasts.getState().push({ text, tone: "success" }),
  error: (text: string) => useToasts.getState().push({ text, tone: "error" }),
};

export function Toaster() {
  const { toasts, drop } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-24 right-4 left-4 sm:left-auto z-[60] items-end flex flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            onClick={() => drop(t.id)}
            className={`pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-left text-sm shadow-lg ${
              t.tone === "success" ? "border-success/40 bg-success-soft" : t.tone === "error" ? "border-danger/40 bg-danger-soft" : "border-border bg-surface"}`}>
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
