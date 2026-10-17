import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { ai, type Recommendation } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AIErrorBox, AILoading } from "@/components/ai/AIStatus";

const TYPE: Record<string, string> = {
  continue_lesson: "Học tiếp", practice_weak_topic: "Chủ điểm yếu", spaced_review: "Đến lịch ôn", vocabulary_review: "Từ vựng",
  retry_mistakes: "Lỗi gần đây", listening_practice: "Nghe",
};

/** "Recommended for today" — every item is justified by stored learning data (shown as the reason). */
export function DailyPlan() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["ai-plan"], queryFn: ai.plan, refetchOnMount: "always" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const go = async (r: Recommendation) => {
    const p = r.suggested_exercise_parameters as { lesson_id?: string; count?: number; difficulty?: string; scope?: string } | null;
    if (r.recommendation_type === "continue_lesson" && r.recommended_lesson_id) return nav(`/learn/${r.recommended_lesson_id}`);
    if (r.recommendation_type === "vocabulary_review") return nav("/review");
    if (r.recommendation_type === "listening_practice") return nav("/listening-studio");
    if (!p) return r.recommended_lesson_id ? nav(`/learn/${r.recommended_lesson_id}`) : nav("/mistakes");
    setBusy(r.title);
    setErr(null);
    try {
      const es = p.scope === "mistakes" ? await ai.reviewSession("mistakes", p.count ?? 10)
        : await ai.generate({ lesson_id: p.lesson_id ?? null, scope: p.scope ?? "lesson", count: p.count ?? 10, difficulty: p.difficulty ?? "adaptive", question_types: ["mixed"] });
      nav(`/ai-practice/${es.id}`);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles size={16} />Kế hoạch học hôm nay</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {q.data?.plan.map((r) => (
          <button key={r.title} onClick={() => go(r)} disabled={!!busy} className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left text-sm hover:border-primary">
            <Badge tone={r.priority <= 2 ? "primary" : "neutral"}>{TYPE[r.recommendation_type] ?? r.recommendation_type}</Badge>
            <span className="min-w-0 flex-1"><span className="block font-medium">{r.title}</span><span className="block text-xs text-muted">{r.weakness_reason}</span></span>
            <ArrowRight size={14} className="text-muted" />
          </button>
        ))}
        {busy && <AILoading label={`Đang chuẩn bị: ${busy}…`} />}
        {err != null && <AIErrorBox error={err} />}
      </CardContent>
    </Card>
  );
}

export function WeakTopics() {
  const q = useQuery({ queryKey: ["weaknesses"], queryFn: ai.weaknesses, refetchOnMount: "always" });
  const weak = q.data?.weak_topics ?? [];
  return (
    <Card>
      <CardHeader><CardTitle>Chủ điểm ngữ pháp yếu</CardTitle><Link to="/mistakes" className="text-xs text-primary underline">Sổ lỗi →</Link></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {weak.length === 0 ? <p className="text-muted">Chưa đủ dữ liệu — cần ít nhất 3 câu trả lời cho mỗi chủ điểm. Độ thành thạo xét cả độ khó, câu gần đây và thời gian chưa ôn.</p> :
          weak.slice(0, 5).map((t) => (
            <div key={t.topic_id}><div className="flex justify-between"><Link className="text-primary underline" to={`/learn/${t.topic_id}`}>{t.topic_id} {t.title}</Link><span>{Math.round(t.mastery * 100)}% · {t.attempts} câu</span></div>
              <Progress value={t.mastery * 100} label={t.title} /></div>))}
      </CardContent>
    </Card>
  );
}
