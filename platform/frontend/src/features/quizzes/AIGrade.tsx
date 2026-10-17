import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ai, type GradeFeedback } from "@/services/ai";
import { Button } from "@/components/ui/button";
import { GradeView, FollowUps } from "@/components/ai/FeedbackCard";
import { AIErrorBox, AILoading, useAIStatus } from "@/components/ai/AIStatus";

/** For open answers in curriculum lessons: ask the AI to grade against the curriculum's answer key. */
export function AIGradeButton({ attemptId }: { attemptId: number }) {
  const st = useAIStatus();
  const qc = useQueryClient();
  const [res, setRes] = useState<GradeFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    ai.attemptGrade(attemptId).then((r) => { if (active) setRes(r.result); }).catch(() => {});
    return () => { active = false; };
  }, [attemptId]);
  if (!st.data?.enabled && !res) return null;
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setRes(await ai.gradeAttempt(attemptId));
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["weaknesses"] });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
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
