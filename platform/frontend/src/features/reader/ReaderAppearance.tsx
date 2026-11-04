import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { useUI } from "@/stores/ui";
import { isReadingRoute } from "./readerSettings";

/** Reading preferences change appearance only; route changes restore the app's normal theme. */
export function ReaderAppearance() {
  const { pathname } = useLocation();
  const { reader, theme } = useUI();
  const active = reader.enabled && isReadingRoute(pathname);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", active ? reader.tone === "night" || reader.tone === "black" : theme === "dark");
    if (active) {
      root.dataset.reader = reader.tone;
      root.dataset.readerFocus = String(reader.focus);
      root.style.setProperty("--reader-size", `${reader.size}px`);
      root.style.setProperty("--reader-leading", reader.spacing === "wide" ? "2.1" : "1.85");
      root.style.setProperty("--reader-font", reader.font === "book" ? 'Georgia, "Times New Roman", serif' : "var(--font-sans)");
    } else {
      delete root.dataset.reader;
      delete root.dataset.readerFocus;
    }
    return () => {
      delete root.dataset.reader;
      delete root.dataset.readerFocus;
      root.classList.toggle("dark", theme === "dark");
    };
  }, [active, reader, theme]);
  return null;
}
