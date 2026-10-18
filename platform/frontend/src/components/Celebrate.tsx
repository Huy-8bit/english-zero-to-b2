import { AnimatePresence, motion } from "motion/react";
import { create } from "zustand";

/** Short, quiet celebration (≈1.5 s) for real milestones: a finished focus block, the daily goal, a strong session. */
export const useCelebrate = create<{ key: number; text: string | null; fire: (text: string) => void; clear: () => void }>((set) => ({
  key: 0, text: null,
  fire: (text) => {
    set((s) => ({ key: s.key + 1, text }));
    setTimeout(() => set({ text: null }), 1800);
  },
  clear: () => set({ text: null }),
}));

const EMOJI = ["🎉", "⭐", "✨", "💪", "🔥", "🌟"];

export function CelebrateHost() {
  const { key, text } = useCelebrate();
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <AnimatePresence>
      {text && (
        <motion.div key={key} className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {!reduce && Array.from({ length: 14 }).map((_, i) => (
            <motion.span key={i} className="absolute text-3xl" initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
              animate={{ x: Math.cos((i / 14) * 2 * Math.PI) * 220, y: Math.sin((i / 14) * 2 * Math.PI) * 160, scale: 1.1, opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}>{EMOJI[i % EMOJI.length]}</motion.span>
          ))}
          <motion.p role="status" className="rounded-2xl bg-surface px-6 py-3 text-lg font-semibold shadow-xl" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>{text}</motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
