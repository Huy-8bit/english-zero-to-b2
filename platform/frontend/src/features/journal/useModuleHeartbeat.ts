import { useEffect, useRef } from "react";

/** Route → study-journal module key. Pages not listed (dashboard, settings, stats…) are not counted as study time. */
export function moduleFor(path: string): string | null {
  if (path.startsWith("/vocabulary")) return "vocab";
  if (path.startsWith("/review")) return "review";
  for (const k of ["writing-studio", "speaking-studio", "reading-studio", "listening-studio", "ai-practice", "placement", "mistakes"]) {
    if (path.startsWith(`/${k}`)) return k;
  }
  if (path.startsWith("/reference") || path.startsWith("/library")) return "reference";
  return null;
}

/**
 * Study time outside lessons (lessons have their own heartbeat): every 30 s while the tab is visible and the learner
 * was active in the last 2 minutes. The server clamps gaps, so idle tabs don't inflate the journal.
 */
export function useModuleHeartbeat(path: string) {
  const lastActive = useRef(Date.now());
  const mod = moduleFor(path);
  useEffect(() => {
    if (!mod) return;
    const send = () => fetch("/api/activity/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activity: mod }), keepalive: true }).catch(() => {});
    const mark = () => { lastActive.current = Date.now(); };
    const events = ["keydown", "pointerdown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    send();
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastActive.current < 120_000) send();
    }, 30_000);
    return () => {
      clearInterval(t);
      events.forEach((e) => window.removeEventListener(e, mark));
    };
  }, [mod]);
}
