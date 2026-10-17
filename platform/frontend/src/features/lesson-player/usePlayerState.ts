import { useCallback, useEffect, useRef, useState } from "react";
import type { ItemResult, LessonState, StepsPayload } from "@/types/content";
import { api } from "@/services/api";
import { safeStorage } from "@/lib/utils";
import type { Draft } from "@/features/quizzes/draft";

const storage = safeStorage();
const key = (unitId: string) => `em-lesson-${unitId}`;

interface Local { step: number; state: LessonState }

/**
 * Lesson position, drafts, checklist and highlights. Saved to the server (debounced) and mirrored to
 * localStorage, so a refresh or a lost connection never loses answers; the newer copy wins on load.
 */
export function usePlayerState(unitId: string, data: StepsPayload | undefined) {
  const [step, setStepRaw] = useState(0);
  const [state, setState] = useState<LessonState>({});
  const [results, setResultsRaw] = useState<Record<string, ItemResult>>({});
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Local>({ step: 0, state: {} });

  useEffect(() => {
    if (!data || ready) return;
    const local = storage.get<Local | null>(key(unitId), null);
    const server: Local | null = data.progress ? { step: data.progress.current_step, state: data.progress.state ?? {} } : null;
    const pick = local && (!server || (local.state.savedAt ?? 0) > (server.state.savedAt ?? 0)) ? local : server;
    const max = Math.max(0, data.steps.length - 1);
    const s = Math.min(pick?.step ?? 0, max);
    setStepRaw(s);
    setState(pick?.state ?? {});
    setResultsRaw(data.results ?? {});
    latest.current = { step: s, state: pick?.state ?? {} };
    setReady(true);
  }, [data, ready, unitId]);

  const flush = useCallback(async () => {
    const { step: s, state: st } = latest.current;
    try {
      await api.saveProgress(unitId, s, st);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [unitId]);

  const persist = useCallback((s: number, st: LessonState, immediate = false) => {
    const stamped = { ...st, savedAt: Date.now() };
    latest.current = { step: s, state: stamped };
    storage.set(key(unitId), latest.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, immediate ? 0 : 800);
  }, [flush, unitId]);

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      void flush();
    }
  }, [flush]);

  const setStep = useCallback((s: number) => {
    setStepRaw(s);
    persist(s, latest.current.state, true);
  }, [persist]);

  const update = useCallback((fn: (st: LessonState) => LessonState) => {
    setState((prev) => {
      const next = fn(prev);
      persist(latest.current.step, next);
      return next;
    });
  }, [persist]);

  const setDraft = useCallback((itemId: string, d: Draft) => update((st) => ({ ...st, drafts: { ...(st.drafts ?? {}), [itemId]: d } })), [update]);
  const setResults = useCallback((r: Record<string, ItemResult>) => setResultsRaw((prev) => ({ ...prev, ...r })), []);
  const clearResult = useCallback((itemId: string) => {
    setResultsRaw((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    update((st) => {
      const drafts = { ...(st.drafts ?? {}) };
      delete drafts[itemId];
      return { ...st, drafts };
    });
  }, [update]);

  return { ready, step, setStep, state, update, setDraft, results, setResults, clearResult, saveError, retrySave: flush };
}
