import { create } from "zustand";
import { safeStorage } from "@/lib/utils";

const storage = safeStorage();

interface UIState {
  theme: "light" | "dark";
  focusMode: boolean;
  sidebarOpen: boolean;
  ttsRate: number;
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;
  setFocusMode: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  setTtsRate: (r: number) => void;
}

const initialTheme = (): "light" | "dark" =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";

export const useUI = create<UIState>((set, get) => ({
  theme: initialTheme(),
  focusMode: storage.get("em-focus", false),
  sidebarOpen: false,
  ttsRate: storage.get("em-tts-rate", 1),
  setTheme: (t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    try {
      localStorage.setItem("em-theme", t);
    } catch {
      /* ignore */
    }
    set({ theme: t });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
  setFocusMode: (v) => {
    storage.set("em-focus", v);
    set({ focusMode: v });
  },
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setTtsRate: (r) => {
    storage.set("em-tts-rate", r);
    set({ ttsRate: r });
  },
}));
