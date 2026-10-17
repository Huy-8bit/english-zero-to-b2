import { useEffect, useRef } from "react";
import { api } from "@/services/api";

/** Reports study time every 30 s while the tab is visible and the learner was active in the last 2 minutes. */
export function useHeartbeat(unitId: string | undefined) {
  const lastActive = useRef(Date.now());
  useEffect(() => {
    if (!unitId) return;
    const mark = () => { lastActive.current = Date.now(); };
    const events = ["keydown", "pointerdown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    api.heartbeat(unitId).catch(() => {});
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastActive.current < 120_000) api.heartbeat(unitId).catch(() => {});
    }, 30_000);
    return () => {
      clearInterval(t);
      events.forEach((e) => window.removeEventListener(e, mark));
    };
  }, [unitId]);
}
