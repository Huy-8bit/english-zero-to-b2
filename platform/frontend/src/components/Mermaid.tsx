import { useEffect, useId, useState } from "react";
import { useUI } from "@/stores/ui";

/** Renders a Mermaid diagram; the library is loaded only when a diagram is on screen. */
export function Mermaid({ code }: { code: string }) {
  const theme = useUI((s) => s.theme);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: theme === "dark" ? "dark" : "neutral", fontFamily: "inherit" });
      try {
        const { svg } = await mermaid.render(`m${id}${theme}`, code);
        if (!cancelled) setSvg(svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code, id, theme]);
  if (failed) return <pre className="text-xs"><code>{code}</code></pre>;
  if (!svg) return <div className="h-32 animate-pulse rounded-xl bg-surface-2" aria-label="Đang vẽ sơ đồ" />;
  // Mermaid output is produced with securityLevel "strict" from curriculum source, not user input.
  return <div className="my-2 flex justify-center overflow-x-auto rounded-xl border border-border bg-surface p-3 [&_svg]:max-w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}
