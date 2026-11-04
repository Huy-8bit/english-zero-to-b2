import { create } from "zustand";
import { safeStorage } from "@/lib/utils";
import { readerSettings, READER_KEY, READER_DARK_DEFAULT_KEY, type ReaderSettings } from "@/features/reader/readerSettings";

const storage = safeStorage();

function initialReader(): ReaderSettings {
  const saved = storage.get<Partial<ReaderSettings> | null>(READER_KEY, null);
  if (!storage.get(READER_DARK_DEFAULT_KEY, false)) {
    // Apply the requested dark default once, including browsers that saved the previous paper default.
    const reader = readerSettings({ ...saved, enabled: true, tone: "black" });
    storage.set(READER_KEY, reader);
    storage.set(READER_DARK_DEFAULT_KEY, true);
    return reader;
  }
  return readerSettings(saved);
}

interface UIState {
  reader: ReaderSettings;
  setReader: (patch: Partial<ReaderSettings>) => void;
  theme: "light" | "dark";
  focusMode: boolean;
  sidebarOpen: boolean;
  ttsRate: number;
  /** Vietnamese under the English examples of a lesson. */
  showVi: boolean;
  toggleVi: () => void;
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;
  setFocusMode: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  setTtsRate: (r: number) => void;
}

const initialTheme = (): "light" | "dark" =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";

export const useUI = create<UIState>((set, get) => ({
  reader: initialReader(),
  setReader: (patch) => {
    const reader = readerSettings({ ...get().reader, ...patch });
    storage.set(READER_KEY, reader);
    set({ reader });
  },
  theme: initialTheme(),
  focusMode: storage.get("em-focus", false),
  sidebarOpen: false,
  ttsRate: storage.get("em-tts-rate", 1),
  showVi: storage.get("em-example-vi", true),
  toggleVi: () => {
    storage.set("em-example-vi", !get().showVi);
    set({ showVi: !get().showVi });
  },
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
