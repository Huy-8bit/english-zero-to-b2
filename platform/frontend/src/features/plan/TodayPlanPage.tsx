import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Coffee, Lock, Play, Square, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { useCelebrate } from "@/components/Celebrate";
import { cn } from "@/lib/utils";
import { focus } from "@/services/focus";
import { plan, type DayPlan, type PlanBlock } from "@/services/plan";
import { vocab, type SessionKind } from "@/services/vocab";
import { mmss, useBlockTimer } from "./timerStore";

const GOALS = [60, 120, 180, 240];

export function Ring({ percent, label, size = 120 }: { percent: number; label: string; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={12} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--primary)" strokeWidth={12} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, percent / 100))} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-current text-xl font-bold">{percent}%</text>
    </svg>
  );
}

export function useStartBlock() {
  const nav = useNavigate();
  const startBlock = useBlockTimer((s) => s.startBlock);
  return async (p: DayPlan, b: PlanBlock, opts: { lock?: boolean } = {}) => {
    const i = p.timeline.findIndex((t) => t.type === "block" && t.id === b.id);
    const brk = p.timeline[i + 1]?.type === "break" ? p.timeline[i + 1] : null;
    const next = p.timeline.slice(i + 1).find((t) => t.type === "block");
    const remaining = Math.max(5, b.minutes - b.done_minutes);
    startBlock({ blockId: b.id, title: b.title, minutes: remaining,
      after: brk && brk.type === "break" ? { minutes: brk.minutes, long: brk.long, tips: brk.tips, nextTitle: next && next.type === "block" ? next.title : null } : null });
    if (opts.lock) {
      try {
        await focus.start({ lessons: 0, minutes: remaining });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không khóa máy được");
      }
    }
    if (b.action.type === "vocab_session") {
      const s = await vocab.start((b.action.kind ?? "review") as SessionKind);
      nav(`/vocabulary/session/${s.id}?return=/today`);
    } else if (b.action.link) {
      nav(b.action.link);
    }
  };
}

export default function TodayPlanPage() {
  const q = useQuery({ queryKey: ["day-plan"], queryFn: plan.today, refetchInterval: 60_000 });
  const qc = useQueryClient();
  const fire = useCelebrate((s) => s.fire);
  const { block, stop } = useBlockTimer();
  const startBlock = useStartBlock();
  const [lock, setLock] = useState(false);
  const goalShown = useRef(false);
  useEffect(() => {
    if (q.data && q.data.percent >= 100 && !goalShown.current) {
      goalShown.current = true;
      fire(`Hoàn thành mục tiêu ${Math.round(q.data.target_minutes / 60 * 10) / 10} giờ hôm nay! 🏆`);
    }
  }, [q.data, fire]);
  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-96" /></div>;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data;
  const setGoal = async (m: number) => {
    await plan.setGoal(m);
    qc.invalidateQueries({ queryKey: ["day-plan"] });
    toast.success(`Mục tiêu mới: ${m / 60} giờ mỗi ngày`);
  };
  const current = p.blocks.find((b) => b.id === p.current_block);
  return (
    <div>
      <PageHeader title="Lịch học hôm nay" subtitle="Các khối học ngắn, xen kẽ kỹ năng và nghỉ chủ động để tập trung và tỉnh táo suốt buổi." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-wrap items-center gap-6 pt-5">
            <Ring percent={p.percent} label={`Đã học ${p.minutes_today} trên ${p.target_minutes} phút`} />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-2xl font-bold">{Math.floor(p.minutes_today / 60)}h{String(p.minutes_today % 60).padStart(2, "0")} <span className="text-base font-normal text-muted">/ {p.target_minutes / 60} giờ</span></p>
              <p className="text-sm text-muted">{p.blocks_done}/{p.blocks_total} khối xong · streak {p.streak} ngày</p>
              {block ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary">
                  Đang học: <b>{block.title}</b> · còn {mmss(block.endsAt - Date.now())}
                  <Button size="sm" variant="ghost" onClick={stop}><Square size={14} />Dừng khối</Button>
                </div>
              ) : current ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="lg" onClick={() => startBlock(p, current, { lock })}><Play size={18} />Bắt đầu: {current.title}</Button>
                  <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} /><Lock size={14} />Khóa máy trong khối này</label>
                </div>
              ) : <p className="font-medium text-success"><Trophy size={16} className="mr-1 inline" />Đã xong tất cả các khối hôm nay!</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><Target size={16} className="mr-1 inline" />Nhiệm vụ hôm nay</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {p.quests.map((x) => (
              <div key={x.id}>
                <div className="flex justify-between gap-2">
                  <span className={cn(x.done && "text-success")}>{x.done ? <CheckCircle2 size={14} className="mr-1 inline" /> : <Circle size={14} className="mr-1 inline text-muted" />}{x.title}</span>
                  <Badge tone={x.done ? "success" : "neutral"}>+{x.xp} XP</Badge>
                </div>
                <Progress value={Math.min(100, (x.progress / x.goal) * 100)} label={`${x.title}: ${x.progress}/${x.goal}`} />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
              <span className="text-xs text-muted">Mục tiêu mỗi ngày:</span>
              {GOALS.map((m) => <Button key={m} size="sm" variant={p.target_minutes === m ? "primary" : "outline"} onClick={() => setGoal(m)}>{m / 60}h</Button>)}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Các khối học</CardTitle><span className="text-xs text-muted">Bắt đầu theo thứ tự; có thể đổi nếu cần</span></CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {p.timeline.map((t, i) => t.type === "break" ? (
              <li key={`b${i}`} className="flex items-center gap-2 pl-3 text-xs text-muted"><Coffee size={14} />{t.long ? "Nghỉ dài" : "Nghỉ"} {t.minutes} phút — {t.tips[0].toLowerCase()}</li>
            ) : (
              <li key={t.id} className={cn("rounded-2xl border p-3", t.id === p.current_block ? "border-primary/50 bg-primary-soft/40" : "border-border", t.status === "done" && "opacity-70")}>
                <div className="flex flex-wrap items-center gap-2">
                  {t.status === "done" ? <CheckCircle2 size={18} className="text-success" /> : <Circle size={18} className="text-muted" />}
                  <span className="font-semibold">{t.title}</span>
                  <Badge>{t.done_minutes}/{t.minutes} phút</Badge>
                  <Button size="sm" variant={t.id === p.current_block ? "primary" : "outline"} className="ml-auto" disabled={!!block}
                    onClick={() => startBlock(p, t, { lock: t.id === p.current_block && lock })}><Play size={14} />{t.status === "done" ? "Làm thêm" : "Bắt đầu"}</Button>
                </div>
                <p className="mt-1 text-sm">{t.action.label}</p>
                <p className="text-xs text-muted">{t.why_vi}</p>
                <Progress className="mt-2" value={Math.min(100, (t.done_minutes / t.minutes) * 100)} label={`${t.title}: ${t.done_minutes}/${t.minutes} phút`} />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader><CardTitle>Bí quyết tập trung</CardTitle></CardHeader>
        <CardContent><ul className="grid gap-1 text-sm text-muted sm:grid-cols-2">{p.principles_vi.map((x) => <li key={x}>• {x}</li>)}</ul></CardContent>
      </Card>
    </div>
  );
}
