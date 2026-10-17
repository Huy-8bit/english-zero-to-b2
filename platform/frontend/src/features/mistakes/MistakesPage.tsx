import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { ai, ERROR_LABELS } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { AIErrorBox, AILoading, AIUnavailable, useAIStatus } from "@/components/ai/AIStatus";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; tone: "danger" | "warning" | "success" }> = {
  new: { label: "Mới", tone: "danger" }, reviewing: { label: "Đang ôn", tone: "warning" }, mastered: { label: "Đã vững", tone: "success" },
};
const SOURCE: Record<string, string> = { curriculum: "Bài học", ai_exercise: "Bài tập AI", writing: "Viết", speaking: "Nói" };

export default function MistakesPage() {
  const st = useAIStatus();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["mistakes-notebook"], queryFn: ai.mistakes, refetchOnMount: "always" });
  const weak = useQuery({ queryKey: ["weaknesses"], queryFn: ai.weaknesses });
  const [cat, setCat] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("open");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const recs = d.records.filter((r) => (!cat || r.error_type === cat) && (status === "all" || (status === "open" ? r.review_status !== "mastered" : r.review_status === status)));
  const maxCat = Math.max(1, ...Object.values(d.by_category));
  const practise = async (scope: "mistakes" | "weak") => {
    setBusy(true);
    setErr(null);
    try {
      const es = await ai.reviewSession(scope, 10);
      nav(`/ai-practice/${es.id}`);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHeader title="Sổ lỗi sai" subtitle="Mọi câu sai có giá trị học tập được tự động lưu lại. Luyện lại bằng câu hỏi MỚI cùng quy tắc — không lặp lại nguyên câu cũ."
        actions={<div className="flex gap-2">
          <Button onClick={() => practise("mistakes")} disabled={busy || !d.open_count || !st.data?.enabled}><Sparkles size={15} />Luyện lỗi của tôi</Button>
          <Button variant="outline" onClick={() => practise("weak")} disabled={busy || !weak.data?.weak_topics.length || !st.data?.enabled}>Luyện chủ điểm yếu</Button></div>} />
      <AIUnavailable compact />
      {busy && <AILoading label="AI đang tạo bài tập mới từ các lỗi đã ghi nhận…" />}
      {err != null && <AIErrorBox error={err} onRetry={() => practise("mistakes")} />}
      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[["open", "Chưa vững"], ["new", "Mới"], ["reviewing", "Đang ôn"], ["mastered", "Đã vững"], ["all", "Tất cả"]].map(([v, l]) => (
              <button key={v} onClick={() => setStatus(v)} aria-pressed={status === v} className={cn("rounded-full border px-3 py-1 text-sm", status === v ? "border-primary bg-primary-soft text-primary" : "border-border")}>{l}</button>))}
            {cat && <button onClick={() => setCat(null)} className="rounded-full bg-danger-soft px-3 py-1 text-sm text-danger">{ERROR_LABELS[cat] ?? cat} ✕</button>}
          </div>
          {recs.length === 0 ? <EmptyState title="Không có lỗi nào trong bộ lọc này" /> : (
            <ul className="space-y-2">{recs.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS[r.review_status].tone}>{STATUS[r.review_status].label}</Badge>
                  <Badge>{ERROR_LABELS[r.error_type] ?? r.error_type}</Badge><Badge>{SOURCE[r.source_type] ?? r.source_type}</Badge>
                  {r.frequency > 1 && <Badge tone="danger">sai {r.frequency} lần</Badge>}
                  <span className="ml-auto text-xs text-muted">lần cuối {new Date(r.last_seen).toLocaleDateString("vi-VN")}</span>
                </div>
                {r.question_text && <p className="mt-2 text-muted">{r.question_text}</p>}
                <p className="mt-1"><span className="line-through decoration-danger">{r.student_answer || "(bỏ trống)"}</span> → <b className="text-success">{r.corrected_answer}</b></p>
                {r.explanation && <p className="mt-1 text-muted">{r.explanation}</p>}
                {r.topic_id && <Link to={`/learn/${r.topic_id}`} className="mt-1 inline-block text-primary underline">Ôn bài {r.topic_id} · {r.topic_title}</Link>}
              </li>))}</ul>
          )}
        </div>
        <div className="space-y-4">
          <Card><CardHeader><CardTitle>Loại lỗi ({d.open_count} chưa vững)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">{Object.entries(d.by_category).map(([c, n]) => (
              <button key={c} className="block w-full text-left" onClick={() => setCat(c)}><div className="flex justify-between"><span>{ERROR_LABELS[c] ?? c}</span><b>{n}</b></div><Progress value={(n / maxCat) * 100} label={c} /></button>))}
              {!Object.keys(d.by_category).length && <p className="text-muted">Chưa có.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Chủ điểm ngữ pháp yếu</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">{weak.data?.weak_topics.map((t) => (
              <div key={t.topic_id}><div className="flex justify-between"><Link className="text-primary underline" to={`/learn/${t.topic_id}`}>{t.topic_id} {t.title}</Link><span>{Math.round(t.mastery * 100)}%</span></div><Progress value={t.mastery * 100} label={t.title} /></div>))}
              {!weak.data?.weak_topics.length && <p className="text-muted">Cần ít nhất 3 câu trả lời mỗi chủ điểm để xác định điểm yếu.</p>}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}
