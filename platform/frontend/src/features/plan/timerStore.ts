import { create } from "zustand";
import { safeStorage } from "@/lib/utils";

const storage = safeStorage();
const KEY = "em-block-timer";

export interface BlockRun { blockId: string; title: string; minutes: number; endsAt: number; after: { minutes: number; long: boolean; tips: string[]; nextTitle: string | null } | null }
export interface BreakRun { minutes: number; long: boolean; endsAt: number; tips: string[]; nextTitle: string | null }

/** Focus-block and break timers (survive refresh; the journal still measures the real study time on the server). */
export const useBlockTimer = create<{
  block: BlockRun | null; brk: BreakRun | null;
  startBlock: (b: Omit<BlockRun, "endsAt">) => void; finishBlock: (brk: Omit<BreakRun, "endsAt"> | null) => void;
  extend: (minutes: number) => void; stop: () => void; endBreak: () => void;
}>((set, get) => {
  const saved = storage.get<{ block: BlockRun | null; brk: BreakRun | null }>(KEY, { block: null, brk: null });
  const persist = () => storage.set(KEY, { block: get().block, brk: get().brk });
  return {
    block: saved.block, brk: saved.brk,
    startBlock: (b) => { set({ block: { ...b, endsAt: Date.now() + b.minutes * 60_000 }, brk: null }); persist(); },
    finishBlock: (brk) => { set({ block: null, brk: brk ? { ...brk, endsAt: Date.now() + brk.minutes * 60_000 } : null }); persist(); },
    extend: (m) => { const b = get().block; if (b) { set({ block: { ...b, endsAt: b.endsAt + m * 60_000 } }); persist(); } },
    stop: () => { set({ block: null }); persist(); },
    endBreak: () => { set({ brk: null }); persist(); },
  };
});

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
