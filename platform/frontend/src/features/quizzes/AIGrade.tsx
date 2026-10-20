import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ai, type GradeFeedback } from "@/services/ai";
import { Button } from "@/components/ui/button";
import { GradeView, FollowUps } from "@/components/ai/FeedbackCard";
import { AIErrorBox, AILoading, useAIStatus } from "@/components/ai/AIStatus";

export type AIGradeState = "pending" | "done" | "failed";

/** For open answers in curriculum lessons: the AI grades against the curriculum's answer key.
 *  `auto`: grade immediately (no button); `onState` reports the outcome so the caller can hide self-assessment. */
export function AIGradeButton({ attemptId, auto = false, onState }: { attemptId: number; auto?: boolean; onState?: (s: AIGradeState, res?: GradeFeedback) => void }) {
  const st = useAIStatus();
  const qc = useQueryClient();
  const [res, setRes] = useState<GradeFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const report = useRef(onState);
  report.current = onState;
  const run = async () => {
    setBusy(true);
    setErr(null);
    report.current?.("pending");
    try {
      const r = await ai.gradeAttempt(attemptId);
      setRes(r);
      report.current?.("done", r);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["weaknesses"] });
    } catch (e) {
      setErr(e);
      report.current?.("failed");
    } finally {
      setBusy(false);
    }
  };
  const enabled = st.data?.enabled;
  useEffect(() => {
    let active = true;
    ai.attemptGrade(attemptId).then((r) => {
      if (!active) return;
      if (r.result) {
        setRes(r.result);
        report.current?.("done", r.result);
      } else if (auto && enabled) {
        void run();
      } else if (auto && enabled === false) {
        report.current?.("failed");
      }
    }).catch(() => { if (active && auto) report.current?.("failed"); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, auto, enabled]);
  if (!enabled && !res) return null;
  return (
    <div className="mt-3 text-fg">
      {res ? (
        <>
          <GradeView fb={{ ...res, grader: "ai" }} />
          <FollowUps targetType="attempt" targetId={String(attemptId)} />
        </>
      ) : (
        <Button size="sm" variant="secondary" onClick={run} disabled={busy}><Sparkles size={14} />Chấm & giải thích bằng AI</Button>
      )}
      {busy && <AILoading label="AI đang chấm câu trả lời của bạn…" />}
      {err != null && <AIErrorBox error={err} onRetry={run} />}
    </div>
  );
}
