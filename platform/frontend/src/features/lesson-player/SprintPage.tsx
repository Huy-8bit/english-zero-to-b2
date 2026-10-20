import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, CircleCheck, Flame, Play, Rocket, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { Ring } from "@/features/plan/TodayPlanPage";
import { api } from "@/services/api";
import { dailyTarget, getCombo, loadPlan, savePlan } from "./sprintPlan";

/** Grammar sprint: get through every grammar lesson A0→B2 in a few days — core on one screen, 6-question check, next. */
export default function SprintPage() {
  const q = useQuery({ queryKey: ["grammar-sprint"], queryFn: api.grammarSprint, refetchOnMount: "always" });
  const nav = useNavigate();
  const [plan, setPlan] = useState(loadPlan());
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  const day = dailyTarget(plan, s.remaining, s.today);
  const choose = (days: number) => {
    const p = { days, start: new Date().toISOString().slice(0, 10), startRemaining: s.remaining + s.today };
    savePlan(p);
    setPlan(p);
  };
  const queue = s.units.filter((u) => u.status === "todo").slice(0, 8);
  const combo = getCombo();
  return (
    <div>
      <PageHeader title="Sprint ngữ pháp" subtitle="Đi qua toàn bộ ngữ pháp A0→B2 thật nhanh: mỗi bài ≈8 phút — nắm cốt lõi trên một màn hình, kiểm tra 6 câu, qua là sang bài tiếp." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-wrap items-center gap-6 pt-5">
            <Ring percent={Math.round((100 * s.done) / s.total)} label={`Đã qua ${s.done} trên ${s.total} bài ngữ pháp`} size={132} />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-2xl font-bold">{s.done}/{s.total} <span className="text-base font-normal text-muted">bài ngữ pháp · còn {s.remaining}</span></p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Hoàn thành trong:</span>
                {[3, 4, 7].map((d) => <Button key={d} size="sm" variant={plan?.days === d ? "primary" : "outline"} onClick={() => choose(d)}>{d} ngày</Button>)}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Ngày {day.dayN}{plan ? `/${plan.days}` : ""} · hôm nay <b>{s.today}</b>/{day.target} bài</span>{combo > 0 && <span className="inline-flex items-center gap-1 text-warning"><Flame size={14} />{combo} liên tiếp</span>}</div>
                <Progress value={Math.min(100, (100 * s.today) / Math.max(1, day.target))} label={`Hôm nay ${s.today}/${day.target} bài`} />
                <p className="text-xs text-muted">≈ {Math.round((day.target * 8) / 60 * 10) / 10} giờ hôm nay với nhịp 8 phút/bài.</p>
              </div>
              {s.next ? (
                <Button size="lg" onClick={() => nav(`/learn/${s.next!.id}?mode=sprint`)}><Play size={18} />Bắt đầu: {s.next.id} · {s.next.title}</Button>
              ) : <p className="font-semibold text-success">Đã đi hết toàn bộ ngữ pháp 🎉</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Theo cấp độ</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {s.levels.map((l) => (
              <div key={l.level}>
                <div className="flex justify-between"><b>{l.level}</b><span className="tabular-nums text-muted">{l.done}/{l.total}</span></div>
                <Progress value={(100 * l.done) / l.total} label={`${l.level}: ${l.done}/${l.total}`} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle><Zap size={16} className="mr-1 inline" />Tiếp theo</CardTitle></CardHeader>
          <CardContent>
            <ol className="grid gap-2 sm:grid-cols-2">
              {queue.map((u, i) => (
                <li key={u.id}><Link to={`/learn/${u.id}?mode=sprint`} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2">
                  <span className="w-5 text-muted">{i + 1}.</span><Badge>{u.level}</Badge><span className="min-w-0 truncate"><b>{u.id}</b> · {u.title}</span>
                </Link></li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><BookOpenText size={16} className="mr-1 inline" />Cần học kỹ ({s.study.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {s.study.length ? s.study.map((u) => (
              <Link key={u.id} to={`/learn/${u.id}?mode=journey`} className="block rounded-lg px-2 py-1 hover:bg-surface-2"><b>{u.id}</b> · {u.title}</Link>
            )) : <p className="text-muted">Chưa có — bài nào chưa qua kiểm tra 6 câu sẽ nằm ở đây để học đầy đủ sau.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle><Rocket size={16} className="mr-1 inline" />Cách sprint hiệu quả</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-muted">
            <li><CircleCheck size={14} className="mr-1 inline text-success" />Mỗi bài: đọc cốt lõi 2–3 phút (công thức, tóm tắt, lỗi hay gặp) → 6 câu → đúng 5/6 là qua. Bấm Enter để đi tiếp.</li>
            <li><CircleCheck size={14} className="mr-1 inline text-success" />Học theo khối 25–30 phút (3–4 bài) rồi nghỉ 5 phút; giữ chuỗi 🔥 nhưng đừng bỏ giờ nghỉ.</li>
            <li><CircleCheck size={14} className="mr-1 inline text-success" />Sprint giúp đi qua toàn bộ ngữ pháp và tìm ra chỗ còn hổng; nhớ lâu cần ôn lại: các bài đã qua được hẹn ôn theo lịch, bài “cần học kỹ” học đầy đủ ở chế độ Hành trình.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
