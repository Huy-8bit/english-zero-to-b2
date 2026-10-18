import { Link } from "react-router-dom";
import { TodayPlanCard } from "@/features/plan/TodayPlanCard";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Brain, CalendarDays, Clock, Flame, GraduationCap, PlayCircle, Sparkles, Target, Trophy, TriangleAlert } from "lucide-react";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, Skeleton } from "@/components/ui/misc";
import { formatMinutes, KIND_LABELS } from "@/lib/utils";
import { DailyPlan, WeakTopics } from "./AIPlan";

const DAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function DashboardPage() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard, refetchOnMount: "always" });
  if (q.isLoading) return <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const r = d.recommendations;
  const cont = r.continue[0];
  const maxMin = Math.max(5, ...d.weekly_activity.map((x) => x.minutes));
  const goalPct = (d.today.minutes / d.user.daily_goal_minutes) * 100;
  const earned = d.achievements.filter((a) => a.earned_at);
  return (
    <div className="space-y-6">
      <TodayPlanCard />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Xin chào, {d.user.name} 👋</p>
          <h1 className="text-2xl font-bold tracking-tight">Hôm nay học gì?</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="warning" className="px-3 py-1 text-sm"><Flame size={14} />{d.streak} ngày liên tiếp</Badge>
          <Badge tone="primary" className="px-3 py-1 text-sm"><Sparkles size={14} />{d.xp.total} XP</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="bg-gradient-to-br from-primary-soft to-transparent p-6">
            {cont ? (
              <>
                <p className="text-sm font-medium text-primary">Tiếp tục học</p>
                <h2 className="mt-1 text-xl font-bold">{cont.id} · {cont.title}</h2>
                <p className="text-sm text-muted">{cont.title_vi} · slide {cont.current_step + 1}/{cont.total_steps}</p>
                <Progress className="mt-3 max-w-md" value={cont.total_steps ? ((cont.current_step + 1) / cont.total_steps) * 100 : 0} />
                <Link to={`/learn/${cont.id}`} className="mt-4 inline-block"><Button><PlayCircle size={18} />Continue Learning</Button></Link>
              </>
            ) : r.next_lesson ? (
              <>
                <p className="text-sm font-medium text-primary">{d.lessons.completed ? "Bài tiếp theo được đề xuất" : "Bắt đầu hành trình"}</p>
                <h2 className="mt-1 text-xl font-bold">{r.next_lesson.id} · {r.next_lesson.title}</h2>
                <p className="text-sm text-muted">{r.next_lesson.title_vi}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/learn/${r.next_lesson.id}`}><Button><PlayCircle size={18} />Bắt đầu học</Button></Link>
                  {!r.placement_taken && <Link to="/placement"><Button variant="outline"><Target size={18} />Làm bài kiểm tra xếp lớp</Button></Link>}
                </div>
              </>
            ) : <p>Bạn đã hoàn thành toàn bộ ngữ pháp. Hãy làm bài kiểm tra B2 trong mục Kiểm tra.</p>}
          </div>
          {r.continue.length > 1 && (
            <CardContent className="pt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-muted">Đang học dở</p>
              <ul className="flex flex-wrap gap-2">
                {r.continue.slice(1).map((c) => <li key={c.id}><Link to={`/learn/${c.id}`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary">{c.id} · {c.title}</Link></li>)}
              </ul>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target size={16} />Mục tiêu hôm nay</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-sm"><span>{Math.round(d.today.minutes)} / {d.user.daily_goal_minutes} phút</span><span className="text-muted">{Math.min(100, Math.round(goalPct))}%</span></div>
              <Progress value={goalPct} className="mt-1" label="Mục tiêu phút hôm nay" />
            </div>
            <div>
              <div className="flex justify-between text-sm"><span>{d.lessons.week_completed} / {d.user.weekly_goal_lessons} bài tuần này</span></div>
              <Progress value={(d.lessons.week_completed / d.user.weekly_goal_lessons) * 100} className="mt-1" label="Mục tiêu bài học tuần" />
            </div>
            <p className="text-xs text-muted">+{d.xp.today} XP hôm nay · {d.today.items} câu đã trả lời</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DailyPlan />
        <WeakTopics />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<GraduationCap size={18} />} label="Trình độ hiện tại" value={r.current_level} sub={r.current_level_name + (r.placement ? (r.placement.score != null ? ` · xếp lớp ${r.placement.score}/80` : " · theo bài xếp lớp") : "")} />
        <Stat icon={<Trophy size={18} />} label="Bài đã hoàn thành" value={`${d.lessons.completed}/${d.lessons.total}`} sub={`Ngữ pháp ${d.lessons.grammar_completed}/${d.lessons.grammar_total}`} />
        <Stat icon={<Clock size={18} />} label="Thời gian học" value={formatMinutes(d.time.total_minutes)} sub={`Tuần này ${formatMinutes(d.time.week_minutes)}`} />
        <Stat icon={<Brain size={18} />} label="Cần ôn hôm nay" value={String(d.vocabulary.due + d.lessons.review)} sub={`${d.vocabulary.due} thẻ từ · ${d.lessons.review} bài`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays size={16} />Hoạt động 7 ngày</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-36 items-end gap-2" role="img" aria-label="Biểu đồ số phút học 7 ngày gần nhất">
              {d.weekly_activity.map((w) => (
                <div key={w.day} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-muted tabular-nums">{w.minutes ? Math.round(w.minutes) : ""}</span>
                  <div className="w-full rounded-t-md bg-primary/80" style={{ height: `${(w.minutes / maxMin) * 100}%`, minHeight: w.minutes ? 4 : 1 }} title={`${w.minutes} phút, ${w.items} câu`} />
                  <span className="text-[11px] text-muted">{DAY[new Date(w.day + "T00:00").getDay()]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ngữ pháp theo cấp độ</CardTitle><Link to="/path" className="text-xs text-primary">Lộ trình →</Link></CardHeader>
          <CardContent className="space-y-3">
            {d.grammar_mastery.map((m) => (
              <div key={m.level}>
                <div className="flex justify-between text-sm"><span><b>{m.level}</b> {m.name}</span><span className="text-muted">{m.completed}/{m.total}{m.avg_score !== null ? ` · ${Math.round(m.avg_score)}%` : ""}</span></div>
                <Progress value={(m.completed / m.total) * 100} className="mt-1" label={`Tiến độ ${m.level}`} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Từ vựng</CardTitle><Link to="/review" className="text-xs text-primary">Ôn tập →</Link></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold">{d.vocabulary.seen}<span className="text-base font-normal text-muted"> / {d.vocabulary.total_cards} từ đã học</span></p>
            <Progress value={(d.vocabulary.seen / Math.max(1, d.vocabulary.total_cards)) * 100} label="Từ vựng đã học" />
            <p className="text-sm text-muted">{d.vocabulary.mature} từ nhớ lâu (khoảng ôn ≥ 21 ngày) · {d.vocabulary.due} thẻ đến hạn</p>
            <Link to="/review"><Button variant="outline" size="sm"><Brain size={15} />Ôn {d.vocabulary.due ? `${d.vocabulary.due} thẻ đến hạn` : "từ mới"}</Button></Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TriangleAlert size={16} />Lỗi gần đây</CardTitle><Link to="/review" className="text-xs text-primary">Làm lại →</Link></CardHeader>
          <CardContent>
            {d.recent_mistakes.length === 0 ? <p className="text-sm text-muted">Chưa có câu sai nào. Các câu làm sai sẽ hiện ở đây để bạn ôn lại.</p> : (
              <ul className="divide-y divide-border">
                {d.recent_mistakes.map((m) => (
                  <li key={m.item_id + m.created_at} className="flex items-center gap-3 py-2 text-sm">
                    <Badge tone="danger">{m.item_id.split(":")[1]}</Badge>
                    <span className="min-w-0 flex-1 truncate">{m.unit_title}</span>
                    <span className="max-w-[40%] truncate text-muted">“{m.response}”</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Đề xuất cho bạn</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {r.next_lesson && <Rec to={`/learn/${r.next_lesson.id}`} tag="Bài mới" title={`${r.next_lesson.id} · ${r.next_lesson.title}`} />}
            {r.review_lessons.map((x) => <Rec key={x.id} to={`/learn/${x.id}`} tag="Cần ôn" tone="danger" title={`${x.id} · ${x.title}${x.score !== null ? ` (${Math.round(x.score)}%)` : ""}`} />)}
            {r.skills_or_test && <Rec to={`/learn/${r.skills_or_test.id}`} tag={KIND_LABELS[r.skills_or_test.kind]} tone="success" title={r.skills_or_test.title} />}
            {r.due_cards > 0 && <Rec to="/review" tag="Flashcards" title={`${r.due_cards} thẻ từ vựng đến hạn ôn`} />}
            {!r.placement_taken && <Rec to="/placement" tag="Xếp lớp" title="Kiểm tra xếp lớp thích ứng — tìm điểm xuất phát phù hợp" />}
            <p className="pt-2 text-xs text-muted">Huy hiệu: {earned.length}/{d.achievements.length} · <Link className="text-primary underline" to="/progress">xem tất cả</Link></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-xs text-muted">{icon}{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function Rec({ to, tag, title, tone = "primary" }: { to: string; tag: string; title: string; tone?: "primary" | "danger" | "success" }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm hover:border-primary">
      <Badge tone={tone}>{tag}</Badge>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <ArrowRight size={14} className="text-muted" />
    </Link>
  );
}
