import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ai } from "@/services/ai";
import { hydrate } from "@/lib/syncState";
import { safeStorage } from "@/lib/utils";
import { useUI } from "@/stores/ui";

/** Pages read learning state from storage when they mount: load the database copy first (see lib/syncState). */
export function StateSync({ children }: { children: ReactNode }) {
  const st = useQuery({ queryKey: ["auth"], queryFn: ai.authStatus, retry: false });
  const allowed = !!st.data && (!st.data.required || st.data.authenticated);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!allowed && !st.isError) return;
    let live = true;
    void hydrate().finally(() => {
      if (!live) return;
      useUI.setState({ showVi: safeStorage().get("em-example-vi", true) });
      setReady(true);
    });
    return () => { live = false; };
  }, [allowed, st.isError]);
  if (!ready) return <div className="grid min-h-screen place-items-center text-sm text-muted">Đang tải tiến độ học…</div>;
  return <>{children}</>;
}
