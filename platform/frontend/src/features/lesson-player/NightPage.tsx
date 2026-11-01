import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, Brain, CircleCheck, Coffee, Flag, Moon, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { Ring } from "@/features/plan/TodayPlanPage";
import { api, type GrammarSprint } from "@/services/api";
import {
  BREAK_EVERY_MIN, BREAK_MIN, clock, endNight, hhmm, hoursMin, loadNight, needsReview, nextNight, nightPace, reviewPicks, startNight,
  studyMinutes, type NightSession, type RecallPick,
} from "./nightPlan";
import { RecallRun } from "./NightLesson";

const LEVELS = ["A0", "A1", "A2", "B1", "B2"];

/** 'Ngữ pháp 1 đêm': every grammar lesson in one night — core on one screen + 3 one-click questions, at a set pace. */
export default function NightPage() {
  const q = useQuery({ queryKey: ["grammar-sprint"], queryFn: api.grammarSprint, refetchOnMount: "always" });
  const [session, setSession] = useState<NightSession | null>(loadNight);
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Ngữ pháp 1 đêm" subtitle="Đọc hết ngữ pháp A0→B2 trong một đêm. Mỗi bài là một vòng nhớ ≈3–4 phút: nhớ lại bài cũ → đoán → học 4 thẻ ngắn → nhớ lại. Không bài tập dài, không chặn khi sai; câu sai tự quay lại sau vài bài." />
      {session ? <Night session={session} onChange={() => setSession(loadNight())} onEnd={() => { endNight(); setSession(null); }} />
        : <Setup s={q.data} onStart={setSession} />}
    </div>
  );
}

function Setup({ s, onStart }: { s: GrammarSprint; onStart: (n: NightSession) => void }) {
  const [hours, setHours] = useState(8);
  const [all, setAll] = useState(s.done === 0);
  const units = s.units.filter((u) => all || u.status !== "done").map(({ id, title, level }) => ({ id, title, level }));
  const per = units.length ? (studyMinutes(hours) * 60) / units.length : 0;
  const breaks = Math.floor((hours * 60) / (BREAK_EVERY_MIN + BREAK_MIN));
  const nav = useNavigate();
  const start = () => {
    const n = startNight(units, hours);
    onStart(n);
    nav(`/learn/${units[0].id}?mode=night`);
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle><Moon size={16} className="mr-1 inline" />Lên kế hoạch cho đêm nay</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 text-muted">Thời lượng:</span>
            {[4, 6, 8, 10].map((h) => <Button key={h} size="sm" variant={hours === h ? "primary" : "outline"} onClick={() => setHours(h)}>{h} giờ</Button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 text-muted">Phạm vi:</span>
            <Button size="sm" variant={!all ? "primary" : "outline"} onClick={() => setAll(false)} disabled={s.done === 0}>Bài chưa qua ({s.remaining})</Button>
            <Button size="sm" variant={all ? "primary" : "outline"} onClick={() => setAll(true)}>Tất cả {s.total} bài</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Bài cần đọc" value={String(units.length)} />
            <Stat label="Mỗi bài" value={`≈${clock(per)}`} hint="phút:giây" />
            <Stat label="Nghỉ" value={`${breaks} × ${BREAK_MIN}′`} hint={`mỗi ${BREAK_EVERY_MIN} phút`} />
            <Stat label="Xong lúc" value={hhmm(Date.now() + hours * 3_600_000)} hint="nếu bắt đầu ngay" />
          </div>
          {per > 0 && per < 150 && <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">Dưới 2,5 phút mỗi bài là rất gấp — cân nhắc thêm giờ hoặc chỉ đọc bài chưa qua.</p>}
          <Loop />
          {hours >= 8 && <p className="flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm"><BedDouble size={18} className="shrink-0 text-primary" />
            <span>Não cất bài vào trí nhớ dài hạn <b>trong lúc ngủ</b>; thức trắng làm quên nhanh hơn. Nếu được, chia 2 tối × 4 giờ, hoặc học xong thì ngủ một giấc dài — đừng học tiếp ngay việc khác.</span></p>}
          <Button size="lg" onClick={start} disabled={!units.length}><Play size={18} />Bắt đầu đêm học</Button>
        </CardContent>
      </Card>
      <HowTo />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Night({ session, onChange, onEnd }: { session: NightSession; onChange: () => void; onEnd: () => void }) {
  const nav = useNavigate();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const p = nightPace(session, now);
  const next = nextNight(session);
  const review = needsReview(session);
  const answered = Object.values(session.results).filter((r) => r.total > 0);
  const right = answered.reduce((a, r) => a + r.correct, 0);
  const asked = answered.reduce((a, r) => a + r.total, 0);
  const go = () => next && nav(`/learn/${next.id}?mode=night`);
  const [bedtime, setBedtime] = useState<RecallPick[] | null>(null);
  const waiting = (session.recall ?? []).length;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !next || bedtime || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      nav(`/learn/${next.id}?mode=night`);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [next, nav, bedtime]);
  const end = () => {
    if (window.confirm(next ? `Kết thúc đêm học? Còn ${p.left} bài chưa đọc; kết quả đêm nay sẽ bị xoá.` : "Kết thúc đêm học và xoá kết quả đêm nay?")) onEnd();
  };
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-wrap items-center gap-6 pt-5">
            <Ring percent={Math.round((100 * p.covered) / Math.max(1, p.total))} label={`Đã đọc ${p.covered} trên ${p.total} bài`} size={132} />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-2xl font-bold">{p.covered}/{p.total} <span className="text-base font-normal text-muted">bài · còn {p.left}</span></p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {p.left === 0 ? <Badge tone="success">Xong toàn bộ 🎉</Badge>
                  : p.ahead >= 1 ? <Badge tone="success">Nhanh hơn kế hoạch {p.ahead} bài</Badge>
                    : p.ahead <= -1 ? <Badge tone="warning">Chậm {-p.ahead} bài so với kế hoạch</Badge> : <Badge>Đúng nhịp</Badge>}
                <span className="text-muted">Bắt đầu {hhmm(session.start)} · đã học {hoursMin(p.elapsed)} · còn {hoursMin(p.msLeft)} / {session.hours} giờ</span>
              </div>
              {p.left > 0 && (
                <p className="text-sm">Nhịp cần để kịp: <b>≈{clock(p.perLesson)}</b>/bài · dự kiến xong lúc <b>{hhmm(p.finishAt)}</b>
                  {p.finishAt > p.end + 60_000 && <span className="text-warning"> (trễ {hoursMin(p.finishAt - p.end)})</span>}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {asked > 0 && <span>Nhớ lại đúng {right}/{asked} ({Math.round((100 * right) / asked)}%)</span>}
                {(session.recovered ?? 0) > 0 && <span className="text-success"><Brain size={14} className="mr-1 inline" />Đã cứu lại {session.recovered} câu từng sai</span>}
                {waiting > 0 && <span>{waiting} câu đang chờ hỏi lại</span>}
              </div>
              {next ? (
                <Button size="lg" className="h-auto whitespace-normal py-2.5 text-left" onClick={go}>
                  <Play size={18} className="shrink-0" />{p.covered ? "Học tiếp" : "Bắt đầu"}: {next.id} · {next.title}<kbd className="ml-1 text-xs opacity-70">Enter</kbd></Button>
              ) : <p className="font-semibold text-success">Đã đọc hết ngữ pháp trong {hoursMin(p.elapsed)} 🎉 Ngủ ngon! Mai dùng Sprint ngữ pháp để chốt các bài cần xem lại.</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={end}>{next ? <><Flag size={14} />Kết thúc đêm học</> : <><RotateCcw size={14} />Kết thúc & lập đêm mới</>}</Button>
                {!next && <Link to="/grammar-sprint"><Button size="sm" variant="outline">Sang Sprint ngữ pháp</Button></Link>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Theo cấp độ</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {LEVELS.map((lv) => {
              const us = session.units.filter((u) => u.level === lv);
              if (!us.length) return null;
              const c = us.filter((u) => session.results[u.id]).length;
              return (
                <div key={lv}>
                  <div className="flex justify-between"><b>{lv}</b><span className="tabular-nums text-muted">{c}/{us.length}</span></div>
                  <Progress value={(100 * c) / us.length} label={`${lv}: ${c}/${us.length}`} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
      {p.covered >= 3 && (
        <Card className="mt-4" data-testid="bedtime">
          <CardHeader><CardTitle><BedDouble size={16} className="mr-1 inline" />Ôn 10 câu trước khi ngủ</CardTitle></CardHeader>
          <CardContent>
            {bedtime === null ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <p className="min-w-0 flex-1 text-muted">Nhớ lại ngay trước khi ngủ: giấc ngủ củng cố mạnh nhất những gì vừa được gợi lại. Câu còn sai được ưu tiên, còn lại trộn từ cả đêm.</p>
                <Button variant={next ? "outline" : "primary"} onClick={() => setBedtime(reviewPicks(session, 10))}>Bắt đầu ôn</Button>
              </div>
            ) : bedtime.length ? (
              <div className="mx-auto max-w-3xl"><RecallRun picks={bedtime} finishLabel="Xong — đi ngủ 😴" onFinish={() => { setBedtime([]); onChange(); }} /></div>
            ) : <p className="font-semibold text-success">Xong! Tắt màn hình và ngủ ngon — não sẽ làm nốt phần việc còn lại 😴</p>}
          </CardContent>
        </Card>
      )}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Chưa nhớ ({review.length})</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {review.length ? (
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {review.map((u) => {
                  const r = session.results[u.id];
                  return (
                    <li key={u.id}><Link to={`/learn/${u.id}?mode=journey`} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-2">
                      <Badge>{u.level}</Badge><span className="min-w-0 truncate"><b>{u.id}</b> · {u.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted">{r.skipped ? "bỏ qua" : `sai ${u.missed} câu`}</span>
                    </Link></li>
                  );
                })}
              </ul>
            ) : <p className="text-muted">Chưa có. Bài có câu sai nằm ở đây cho tới khi bạn nhớ lại đúng câu đó (app tự hỏi lại sau vài bài); bài bị bỏ qua cũng ở đây.</p>}
          </CardContent>
        </Card>
        <HowTo />
      </div>
    </>
  );
}

const LOOP = [
  ["⏪", "Nhớ lại", "1 câu từ bài đã đọc — câu sai được hỏi lại sau 2 bài, rồi sau ~7 bài"],
  ["🎯", "Đoán", "1 câu trước khi học; không lộ đáp án, đọc bài để tìm"],
  ["📖", "Học 4 thẻ", "Hiểu → Công thức → Mẹo nhớ → Bẫy (tự sửa rồi mới lật)"],
  ["✍️", "Nhớ lại", "câu đoán lúc nãy + 2 câu mới, không xem bài"],
];

function Loop() {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Vòng học mỗi bài">
      {LOOP.map(([icon, t, d], i) => (
        <li key={t + i} className="rounded-2xl border border-border p-3 text-sm">
          <p className="font-semibold">{icon} {i + 1}. {t}</p>
          <p className="text-xs text-muted">{d}</p>
        </li>
      ))}
    </ol>
  );
}

function HowTo() {
  return (
    <Card>
      <CardHeader><CardTitle><Coffee size={16} className="mr-1 inline" />Vì sao học thế này dễ nhớ</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm text-muted">
          <li><CircleCheck size={14} className="mr-1 inline text-success" /><b className="text-fg">Nhớ lại &gt; đọc lại:</b> mỗi lần cố nhớ ra là một lần trí nhớ được khắc sâu. Đọc lại nhiều lần chỉ tạo cảm giác “quen”.</li>
          <li><CircleCheck size={14} className="mr-1 inline text-success" /><b className="text-fg">Đoán trước:</b> đoán sai rồi tìm ra đáp án nhớ lâu hơn là đọc thẳng.</li>
          <li><CircleCheck size={14} className="mr-1 inline text-success" /><b className="text-fg">Giãn cách + trộn bài:</b> câu cũ quay lại xen giữa bài mới, đúng lúc sắp quên.</li>
          <li><CircleCheck size={14} className="mr-1 inline text-success" /><b className="text-fg">Từng thẻ ngắn:</b> một ý mỗi lần; chữ tô màu là dạng phải nhớ, chữ gạch đỏ là dạng sai.</li>
          <li><CircleCheck size={14} className="mr-1 inline text-success" /><b className="text-fg">Nghỉ {BREAK_MIN} phút mỗi {BREAK_EVERY_MIN} phút, ngủ sau khi học:</b> não sắp xếp bài khi nghỉ và khi ngủ.</li>
          <li><CircleCheck size={14} className="mr-1 inline text-success" />Đây là lượt đọc tổng quan, bài chưa được tính “hoàn thành”. Hôm sau dùng Sprint ngữ pháp để chốt từng bài.</li>
        </ul>
      </CardContent>
    </Card>
  );
}
