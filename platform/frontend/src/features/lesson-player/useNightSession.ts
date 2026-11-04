import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { loadNight, syncNight, withPathProgress } from "./nightPlan";

/** The overview and lesson navigation share the server-backed learning path. */
export function useNightSession() {
  const path = useQuery({ queryKey: ["path"], queryFn: api.path, refetchOnMount: "always" });
  const units = useMemo(() => path.data?.levels.flatMap((lv) => lv.blocks.flatMap((b) => b.lessons))
    .map((u) => ({ id: u.id, title: u.title, level: u.level!, status: u.status })) ?? [], [path.data]);
  const [stored, setSession] = useState(loadNight);
  useEffect(() => {
    if (path.data) setSession(syncNight(units));
  }, [path.data, units]);
  const session = stored && path.data ? withPathProgress(stored, units) : stored;
  return { path, units, session, setSession };
}
