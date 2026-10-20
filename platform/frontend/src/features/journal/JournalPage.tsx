import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, CalendarCheck, CheckCircle2, Clock, Lightbulb, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { insights, type JournalDay } from "@/services/assistant";
import { useAssistant } from "@/features/assistant/store";

const vnDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default function JournalPage() {
  const q = useQuery({ queryKey: ["journal"], queryFn: insights });
  const ask = useAssistant((s) => s.ask);
  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-48" /><Skeleton className="h-96" /></div>;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const { journal, pace, eta, review } = q.data;
  const active = journal.filter((d) => d.minutes || d.items);
  // calendar days from the pace analysis (days without study included, so gaps are visible)
  const chart = pace.days.slice(-14).map((d) => ({ day: d.date.slice(8, 10) + "/" + d.date.slice(5, 7), minutes: d.minutes }));
  return (
    <div>
      <PageHeader title="Nhật ký học tập" subtitle="Mỗi ngày bạn học bài nào, bao lâu, đúng bao nhiêu. Dữ liệu này dùng để đo nhịp học thực tế, ước lượng ngày hoàn thành và gợi ý ôn tập."
        actions={<Button variant="outline" onClick={() => ask({ action: "eta" })}><Bot size={16} />Hỏi trợ lý: bao lâu nữa tôi xong?</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pace.has_data
          ? <Kpi label="Nhịp thực tế" v={`${pace.minutes_per_study_day} phút/ngày học`} sub={`Học ${pace.study_days}/${pace.calendar_days} ngày · ${pace.lessons_per_study_day} bài/ngày học`} />
          : <Kpi label="Nhịp thực tế" v="Chưa có dữ liệu" sub="Học một bài để bắt đầu đo" />}
        <Kpi label="Tốc độ mỗi bài" v={pace.speed.minutes_per_lesson ? `≈${pace.speed.minutes_per_lesson} phút` : "Chưa đo được"}
          sub={pace.speed.overall_ratio ? `×${pace.speed.overall_ratio} thời lượng gợi ý · ${pace.speed.samples} bài` : "Cần ≥ 2 bài có đo thời gian"} />
        <Kpi label={`Còn lại tới ${eta.target_level}`} v={`${eta.remaining_lessons} bài`} sub={`≈${eta.remaining_hours} giờ học bài`} />
        <Kpi label="Dự kiến hoàn thành" v={vnDate(eta.finish_date)} sub={`${eta.duration_vi} · khoảng ${vnDate(eta.range.fast.finish_date)} – ${vnDate(eta.range.slow.finish_date)}`} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Thời gian học từng ngày</CardTitle><span className="text-xs text-muted">Đường kẻ: mục tiêu {pace.goal_minutes} phút</span></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} phút`, "Thời gian"]} /><Bar dataKey="minutes" fill="var(--primary)" radius={4} />
                {pace.goal_minutes > 0 && <ReferenceLine y={pace.goal_minutes} stroke="var(--success)" strokeDasharray="4 4" />}</BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Mốc từng cấp</CardTitle><Badge tone={eta.confidence === "khá" ? "success" : "warning"}>Độ tin cậy: {eta.confidence}</Badge></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {eta.milestones.map((m) => (
              <div key={m.level} className="flex justify-between gap-2">
                <span className="text-muted">{m.level} · {m.lessons} bài · ≈{m.hours} giờ{m.speed_basis !== "measured" && <span title="Tốc độ ở cấp này được suy ra từ các bài bạn đã học"> *</span>}</span>
                <b>{vnDate(m.finish_date)}</b>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted">Tính theo {eta.basis_vi}.</p>
            <p className="text-xs text-warning">{eta.confidence_reason_vi}</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle><Lightbulb size={16} className="mr-1 inline" />Nhận xét từ dữ liệu của bạn</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => ask({ action: "progress" })}><Bot size={14} />Hỏi trợ lý</Button></CardHeader>
          <CardContent><ul className="space-y-1.5 text-sm">{pace.observations_vi.map((o) => <li key={o}>• {o}</li>)}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Nếu thay đổi thời gian học</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {eta.scenarios.map((x) => (
              <div key={x.label} className="flex justify-between gap-2"><span className="text-muted">{x.label}</span><b className="text-right">{x.duration_vi} · {vnDate(x.finish_date)}</b></div>
            ))}
            {!eta.scenarios.length && <p className="text-muted">Chưa đủ dữ liệu để so sánh.</p>}
            <p className="pt-1 text-xs text-muted">{eta.disclaimer_vi}</p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle><RotateCcw size={16} className="mr-1 inline" />Cần ôn lại</CardTitle><Button size="sm" variant="ghost" onClick={() => ask({ action: "review" })}><Bot size={14} />Hỏi trợ lý</Button></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {review.lessons.map((x) => (
            <Link key={x.lesson_id} to={x.link} className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2 hover:bg-surface-2">
              <span><b>{x.lesson_id}</b> · {x.title}<span className="block text-xs text-muted">{x.reason_vi}</span></span><Badge>{x.level}</Badge>
            </Link>
          ))}
          {review.vocab_due > 0 && <Link to="/vocabulary" className="block rounded-xl border border-border px-3 py-2 hover:bg-surface-2"><b>{review.vocab_due} từ vựng</b> đến hạn ôn (FSRS)</Link>}
          {!review.lessons.length && !review.vocab_due && <p className="text-muted">Chưa có bài nào đến hạn ôn.</p>}
        </CardContent>
      </Card>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Từng ngày (30 ngày)</h2>
      {active.length ? <div className="space-y-3">{active.map((d) => <DayCard key={d.date} d={d} />)}</div>
        : <EmptyState icon={<CalendarCheck size={28} />} title="Chưa có bản ghi học tập">Nhật ký tự ghi lại khi bạn học bài, ôn từ vựng hoặc dùng các studio.</EmptyState>}
    </div>
  );
}

function Kpi({ label, v, sub }: { label: string; v: string; sub?: string }) {
  return <Card><CardContent className="pt-5"><p className="text-xs text-muted">{label}</p><p className="text-2xl font-bold tabular-nums">{v}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</CardContent></Card>;
}

function DayCard({ d }: { d: JournalDay }) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{d.weekday}, {vnDate(d.date)}</p>
          <Badge><Clock size={12} />{d.minutes} phút</Badge>
          {d.items > 0 && <Badge tone={d.accuracy !== null && d.accuracy >= 70 ? "success" : "warning"}>{d.items} câu · đúng {d.accuracy}%</Badge>}
          {d.words_learned > 0 && <Badge tone="primary">+{d.words_learned} từ mới</Badge>}
          {d.vocab_reviews > 0 && <Badge>{d.vocab_reviews} lượt ôn từ</Badge>}
        </div>
        <ul className="space-y-1 text-sm">
          {d.lessons.map((l) => (
            <li key={l.key} className="flex flex-wrap items-center gap-2">
              {l.completed ? <CheckCircle2 size={14} className="text-success" /> : <span className="h-3.5 w-3.5 rounded-full border border-border" />}
              <Link to={`/learn/${l.key}`} className="font-medium hover:text-primary">{l.key} · {l.title}</Link>
              <span className="text-xs text-muted">{l.minutes ? `${l.minutes} phút` : ""}{l.items ? ` · ${l.correct}/${l.items} đúng` : ""}{l.completed && l.score !== null ? ` · hoàn thành ${l.score}%` : ""}</span>
            </li>
          ))}
          {d.modules.map((m) => (
            <li key={m.key} className="flex flex-wrap items-center gap-2 text-muted">
              <span className="h-3.5 w-3.5" />{m.title}<span className="text-xs">{m.minutes ? `${m.minutes} phút` : ""}{m.items ? ` · ${m.correct}/${m.items} đúng` : ""}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
