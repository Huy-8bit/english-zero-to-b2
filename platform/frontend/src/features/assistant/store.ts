import { create } from "zustand";
import type { AssistantAction } from "@/services/assistant";

/** Open the assistant from anywhere, optionally with a question to ask right away. */
export const useAssistant = create<{
  open: boolean; pending: { action?: AssistantAction; message?: string } | null;
  setOpen: (v: boolean) => void; ask: (q: { action?: AssistantAction; message?: string }) => void; take: () => void;
}>((set) => ({
  open: false,
  pending: null,
  setOpen: (open) => set({ open }),
  ask: (pending) => set({ open: true, pending }),
  take: () => set({ pending: null }),
}));
