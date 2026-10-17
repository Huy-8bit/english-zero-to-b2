import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Flame, Sparkles } from "lucide-react";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, Input, PageHeader, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/utils";
import { LearningAnalytics } from "./Analytics";

const XP_REASON: Record<string, string> = {
  auto_correct: "Câu tự chấm đúng", self_correct: "Câu tự đánh giá đúng", production: "Bài viết/nói đã nộp",
  lesson_complete: "Hoàn thành bài học", vocab_review: "Ôn flashcard", daily_goal: "Đạt mục tiêu ngày",
};

export default function ProgressPage() {
  const q = useQuery({ queryKey: ["stats"], queryFn: api.stats, refetchOnMount: "always" });
  const writing = useQuery({ queryKey: ["writing-entries"], queryFn: () => api.writing() });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  const totalAttempts = Object.values(s.attempts).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-6">
      <PageHeader title="Tiến độ & phân tích" subtitle="Mọi số liệu được tính từ hoạt động học thật đã lưu." />
      <LearningAnalytics />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><p className="flex items-center gap-2 text-xs text-muted"><Sparkles size={15} />Tổng XP</p><p className="text-2xl font-bold">{s.xp_total}</p></Card>
        <Card className="p-4"><p className="flex items-center gap-2 text-xs text-muted"><Flame size={15} />Chuỗi ngày học</p><p className="text-2xl font-bold">{s.streak}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Câu đã trả lời</p><p className="text-2xl font-bold">{totalAttempts}</p>
          <p className="text-xs text-muted">{s.attempts.correct ?? 0} đúng · {s.attempts.incorrect ?? 0} sai · {(s.attempts.mismatch ?? 0) + (s.attempts.submitted ?? 0)} tự đánh giá</p></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Theo phân hệ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {s.modules.filter((m) => m.total).map((m) => (
              <div key={m.kind}>
                <div className="flex justify-between text-sm"><span>{KIND_LABELS[m.kind] ?? m.kind}</span><span className="text-muted">{m.completed}/{m.total} · {m.minutes} phút</span></div>
                <Progress value={(m.completed / m.total) * 100} className="mt-1" label={KIND_LABELS[m.kind]} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>XP đến từ đâu</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(s.xp_by_reason).length === 0 ? <p className="text-sm text-muted">Chưa có XP. XP chỉ được cộng một lần cho mỗi hành động học thật.</p> : (
              <ul className="space-y-1 text-sm">{Object.entries(s.xp_by_reason).map(([k, v]) => <li key={k} className="flex justify-between"><span>{XP_REASON[k] ?? k}</span><b>{v}</b></li>)}</ul>
            )}
            <Goals />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Award size={16} />Huy hiệu</CardTitle></CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {s.achievements.map((a) => (
              <li key={a.key} className={`rounded-xl border p-3 ${a.earned_at ? "border-warning/50 bg-warning-soft" : "border-border opacity-60"}`}>
                <p className="font-medium">{a.earned_at ? "🏅" : "🔒"} {a.title}</p>
                <p className="text-xs text-muted">{a.description}</p>
                {a.earned_at && <p className="mt-1 text-[11px] text-muted">{new Date(a.earned_at).toLocaleDateString("vi-VN")}</p>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Lịch sử học</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {s.history.length === 0 ? <p className="text-sm text-muted">Chưa mở bài nào.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-2">Bài</th><th>Phân hệ</th><th>Trạng thái</th><th>Điểm</th><th>Thời gian</th><th>Cập nhật</th></tr></thead>
              <tbody>
                {s.history.map((h) => (
                  <tr key={h.unit_id} className="border-t border-border">
                    <td className="py-2"><Link to={`/learn/${h.unit_id}`} className="text-primary">{h.unit_id}</Link> {h.title}</td>
                    <td>{KIND_LABELS[h.kind] ?? h.kind}</td>
                    <td><Badge tone={h.status === "completed" ? "success" : h.status === "review" ? "danger" : "primary"}>{STATUS_LABELS[h.status]}</Badge></td>
                    <td>{h.best_score !== null ? `${Math.round(h.best_score)}%` : "—"}</td>
                    <td>{h.minutes} phút</td>
                    <td className="text-muted">{new Date(h.updated_at).toLocaleDateString("vi-VN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Lịch sử bài viết</CardTitle></CardHeader>
        <CardContent>
          {!writing.data?.length ? <p className="text-sm text-muted">Chưa lưu bài viết nào. Trong bài viết, bấm “Lưu phiên bản” để lưu vào đây.</p> : (
            <ul className="space-y-3">
              {writing.data.map((w) => (
                <li key={w.id} className="rounded-xl border border-border p-3 text-sm">
                  <p className="text-xs text-muted"><Link className="text-primary underline" to={`/learn/${w.unit_id}`}>{w.unit_id}</Link> · {w.item_id.split(":")[1]} · {w.word_count} từ · {new Date(w.created_at).toLocaleString("vi-VN")}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{w.text}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Goals() {
  const qc = useQueryClient();
  const p = useQuery({ queryKey: ["profile"], queryFn: api.profile });
  const [form, setForm] = useState<{ name?: string; daily?: number; weekly?: number }>({});
  if (!p.data) return null;
  const save = async () => {
    try {
      await api.saveProfile({ name: form.name ?? p.data.name, daily_goal_minutes: form.daily ?? p.data.daily_goal_minutes, weekly_goal_lessons: form.weekly ?? p.data.weekly_goal_lessons });
      toast.success("Đã lưu mục tiêu");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được");
    }
  };
  return (
    <div className="mt-5 space-y-2 border-t border-border pt-4">
      <p className="text-sm font-semibold">Hồ sơ & mục tiêu</p>
      <label className="block text-xs text-muted">Tên hiển thị<Input defaultValue={p.data.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-muted">Phút mỗi ngày<Input type="number" min={5} max={240} defaultValue={p.data.daily_goal_minutes} onChange={(e) => setForm((f) => ({ ...f, daily: Number(e.target.value) }))} /></label>
        <label className="block text-xs text-muted">Bài mỗi tuần<Input type="number" min={1} max={50} defaultValue={p.data.weekly_goal_lessons} onChange={(e) => setForm((f) => ({ ...f, weekly: Number(e.target.value) }))} /></label>
      </div>
      <Button size="sm" onClick={save}>Lưu</Button>
    </div>
  );
}
