import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ai, QTYPE_LABELS } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const LABEL: Record<string, { t: string; tone: "danger" | "warning" | "success" | "primary" | "neutral" }> = {
  chua_du_du_lieu: { t: "Chưa đủ dữ liệu", tone: "neutral" }, yeu: { t: "Yếu", tone: "danger" }, dang_tien_bo: { t: "Đang tiến bộ", tone: "warning" },
  kha: { t: "Khá", tone: "primary" }, thanh_thao: { t: "Thành thạo", tone: "success" },
};

/** Learning analytics from real learner data: topic mastery, writing, reading, speaking. */
export function LearningAnalytics() {
  const topics = useQuery({ queryKey: ["weaknesses"], queryFn: ai.weaknesses });
  const writing = useQuery({ queryKey: ["writing-history"], queryFn: ai.writingHistory });
  const reading = useQuery({ queryKey: ["reading-analytics"], queryFn: ai.readingAnalytics });
  const speaking = useQuery({ queryKey: ["speaking-history"], queryFn: ai.speakingSessions });
  const rows = topics.data?.topics ?? [];
  const tl = writing.data?.stats.timeline ?? [];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Độ thành thạo theo chủ điểm</CardTitle><span className="text-xs text-muted">xét độ khó, câu gần đây, số lần làm và thời gian chưa ôn</span></CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? <p className="text-sm text-muted">Làm bài tập trong bài học hoặc bài tập AI để bắt đầu theo dõi.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-1">Chủ điểm</th><th>Mức</th><th className="w-40">Thành thạo</th><th>Số câu</th><th>Đúng gần đây</th><th>Ôn lại</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.topic_id} className="border-t border-border">
                  <td className="py-1.5"><Link className="text-primary underline" to={`/learn/${r.topic_id}`}>{r.topic_id}</Link> {r.title}</td>
                  <td><Badge tone={LABEL[r.label]?.tone ?? "neutral"}>{LABEL[r.label]?.t ?? r.label}</Badge></td>
                  <td><Progress value={r.mastery * 100} label={r.title} /></td>
                  <td>{r.attempts}</td><td>{Math.round(r.recent_accuracy * 100)}%</td>
                  <td className={r.review_due ? "font-medium text-warning" : "text-muted"}>{r.next_review ?? "—"}</td>
                </tr>))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Tiến bộ viết</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {tl.length < 2 ? <p className="text-muted">{tl.length ? "Cần ít nhất 2 bài để vẽ xu hướng." : "Chưa có bài viết nào được chấm."}</p> : (
              <div className="h-40" role="img" aria-label="Số lỗi trên 100 từ theo thời gian">
                <ResponsiveContainer><LineChart data={tl.map((t, i) => ({ n: i + 1, errors: t.errors_per_100 }))}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="n" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Line dataKey="errors" name="Lỗi/100 từ" stroke="var(--primary)" strokeWidth={2} /></LineChart></ResponsiveContainer>
              </div>
            )}
            <p className="mt-1 text-xs text-muted">{writing.data?.stats.submissions ?? 0} bài đã chấm</p>
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Đọc hiểu</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">{reading.data?.by_type.map((b) => (
            <div key={b.type}><div className="flex justify-between"><span>{QTYPE_LABELS[b.type] ?? b.type}</span><span>{Math.round(b.accuracy * 100)}%</span></div><Progress value={b.accuracy * 100} label={b.type} /></div>))}
            {!reading.data?.by_type.length && <p className="text-muted">Chưa có bài đọc AI nào.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Luyện nói</CardTitle></CardHeader>
          <CardContent className="text-sm"><p className="text-2xl font-bold">{speaking.data?.sessions.length ?? 0}</p><p className="text-muted">phiên · {speaking.data?.sessions.reduce((a, s) => a + s.answers, 0) ?? 0} câu trả lời</p>
            <Link to="/speaking-studio" className="text-primary underline">Mở Speaking Studio</Link></CardContent></Card>
      </div>
    </div>
  );
}
