import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BedDouble, Brain, CircleCheck, Coffee, Flag, Moon, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { Ring } from "@/features/plan/TodayPlanPage";
import {
  BREAK_EVERY_MIN, BREAK_MIN, clock, coveredNight, endNight, hhmm, hoursMin, loadNight, needsReview, nextNight, nightPace, reviewPicks, startNight,
  studyMinutes, syncNight, nightUnits, replanNight, briefMisses, briefReview, startBriefQuiz, markBriefs, briefsUpTo,
  type NightPathUnit, type NightSession, type RecallPick,
} from "./nightPlan";
import { RecallRun } from "./NightLesson";
import { useNightSession } from "./useNightSession";
import { COMPACT_GRAMMAR, NIGHT_LATER } from "./compactGrammar";
import { BRIEF_QUESTIONS, questionsForBrief } from "./briefQuestions";
import { BriefQuiz } from "./BriefQuiz";

const LEVELS = ["A0", "A1", "A2", "B1", "B2"];

/** 'Ngữ pháp 1 đêm': every grammar lesson in one night — core on one screen + 3 one-click questions, at a set pace. */
export default function NightPage() {
  const { path: q, units, session, setSession } = useNightSession();
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title="Ngữ pháp 1 đêm" subtitle={`${COMPACT_GRAMMAR.length} chủ điểm ngữ pháp A0→B2 cho 3–4 giờ. Gộp bài trùng, giải thích so sánh ngay trong chủ điểm. Mỗi chủ điểm có 6 câu trắc nghiệm kèm giải thích; ôn câu sai và ôn trộn để thử nhớ lại. Sau lượt học, chuyển sang nói và viết.`} />
      {session ? <Night session={session} onChange={() => setSession(loadNight())} onEnd={() => { endNight(); setSession(null); }} />
        : <Setup units={units} onStart={setSession} />}
    </div>
  );
}

function Setup({ units: pathUnits, onStart }: { units: NightPathUnit[]; onStart: (n: NightSession) => void }) {
  const [hours, setHours] = useState(3.5);
  const [all, setAll] = useState(false);
  const [plan, setPlan] = useState<"compact" | "full">("compact");
  const [already, setAlready] = useState(0); // topics studied before (another browser, cleared data)
  const route = nightUnits(pathUnits, plan);
  const briefs = route.filter((u) => u.sources);
  const studied = new Set(plan === "compact" ? briefs.slice(0, already).map((u) => u.id) : []);
  const completed = new Set(pathUnits.filter((u) => u.status === "completed").map((u) => u.id));
  const remaining = route.filter((u) => !(u.sources ?? [u.id]).every((id) => completed.has(id)) && !studied.has(u.id));
  const units = all ? route : remaining;
  const per = units.length ? (studyMinutes(hours) * 60) / units.length : 0;
  const breaks = Math.floor((hours * 60) / (BREAK_EVERY_MIN + BREAK_MIN));
  const nav = useNavigate();
  const start = () => {
    startNight(pathUnits, hours, Date.now(), all ? "all" : "remaining", plan);
    let n = syncNight(pathUnits)!;
    if (studied.size) n = markBriefs([...studied], true)!;
    onStart(n);
    const first = nextNight(n);
    nav(first ? `/learn/${first.id}?mode=night` : "/grammar-night");
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle><Moon size={16} className="mr-1 inline" />Lên kế hoạch cho đêm nay</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 text-muted">Thời lượng:</span>
            {[3, 3.5, 4, 6, 8].map((h) => <Button key={h} size="sm" variant={hours === h ? "primary" : "outline"} onClick={() => setHours(h)}>{h === 3.5 ? "3 giờ 30" : `${h} giờ`}</Button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 text-muted">Lộ trình:</span>
            <Button size="sm" variant={plan === "compact" ? "primary" : "outline"} onClick={() => setPlan("compact")}>Bản gọn ({COMPACT_GRAMMAR.length} chủ điểm)</Button>
            <Button size="sm" variant={plan === "full" ? "primary" : "outline"} onClick={() => setPlan("full")}>Từng bài ({pathUnits.length} bài)</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 text-muted">Phạm vi:</span>
            <Button size="sm" variant={!all ? "primary" : "outline"} onClick={() => setAll(false)}>Bài chưa hoàn thành ({remaining.length})</Button>
            <Button size="sm" variant={all ? "primary" : "outline"} onClick={() => setAll(true)}>Ôn lại tất cả {route.length} {plan === "compact" ? "chủ điểm" : "bài"}</Button>
          </div>
          {plan === "compact" && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-24 text-muted">Đã học trước:</span>
              <select aria-label="Đã học trước đến chủ điểm" value={already} onChange={(e) => setAlready(Number(e.target.value))}
                className="h-9 min-w-0 max-w-full flex-1 rounded-xl border border-border bg-surface px-2">
                <option value={0}>Chưa — học từ chủ điểm đầu tiên</option>
                {briefs.map((u, i) => <option key={u.id} value={i + 1}>Đã học chủ điểm 1–{i + 1} (đến: {u.title})</option>)}
              </select>
            </label>
          )}
          <p className="text-sm text-muted">Tiếp tục theo lộ trình học, bao gồm tiến độ bạn đã đánh dấu thủ công. {plan === "compact" && "Chỉ bỏ qua một chủ điểm khi mọi bài gốc trong đó đã học; chủ điểm học dở được giữ lại."}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={plan === "compact" ? "Chủ điểm cần đọc" : "Bài cần đọc"} value={String(units.length)} />
            <Stat label="Mỗi bài" value={`≈${clock(per)}`} hint="phút:giây" />
            <Stat label="Nghỉ" value={`${breaks} × ${BREAK_MIN}′`} hint={`mỗi ${BREAK_EVERY_MIN} phút`} />
            <Stat label="Xong lúc" value={hhmm(Date.now() + hours * 3_600_000)} hint="nếu bắt đầu ngay" />
          </div>
          {per > 0 && per < 150 && <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">Dưới 2,5 phút mỗi bài là rất gấp — cân nhắc thêm giờ hoặc chỉ đọc bài chưa qua.</p>}
          <Loop compact={plan === "compact"} />
          {hours >= 8 && <p className="flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm"><BedDouble size={18} className="shrink-0 text-primary" />
            <span>Não cất bài vào trí nhớ dài hạn <b>trong lúc ngủ</b>; thức trắng làm quên nhanh hơn. Nếu được, chia 2 tối × 4 giờ, hoặc học xong thì ngủ một giấc dài — đừng học tiếp ngay việc khác.</span></p>}
          <Button size="lg" onClick={start} disabled={!units.length && !studied.size}><Play size={18} />{units.length ? "Bắt đầu đêm học" : "Lưu: đã học hết"}</Button>
        </CardContent>
      </Card>
      <HowTo />
    </div>
  );
}

/** Topics studied before (another browser, cleared browser data): mark 1…n as read in one go. */
function MarkStudied({ session, onChange }: { session: NightSession; onChange: () => void }) {
  const briefs = session.units.filter((u) => u.sources);
  const [n, setN] = useState(() => Math.max(1, briefs.filter((u) => coveredNight(session, u.id)).length));
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
      <span>Đã học ở trình duyệt khác hoặc dữ liệu trình duyệt bị xoá? Đánh dấu đã học:</span>
      <select aria-label="Đánh dấu đã học đến chủ điểm" value={n} onChange={(e) => setN(Number(e.target.value))}
        className="h-9 min-w-0 max-w-full flex-1 rounded-xl border border-border bg-surface px-2">
        {briefs.map((u, i) => <option key={u.id} value={i + 1}>Chủ điểm 1–{i + 1} (đến: {u.title})</option>)}
      </select>
      <Button size="sm" onClick={() => { markBriefs(briefsUpTo(session, n), true); onChange(); }}>Đánh dấu 1–{n}</Button>
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
  const compact = session.plan !== "full";
  const next = nextNight(session);
  const review = needsReview(session);
  const answered = Object.values(session.results).filter((r) => r.total > 0);
  const right = answered.reduce((a, r) => a + r.correct, 0);
  const asked = answered.reduce((a, r) => a + r.total, 0);
  const go = () => next && nav(`/learn/${next.id}?mode=night`);
  const [bedtime, setBedtime] = useState<RecallPick[] | null>(null);
  const [practice, setPractice] = useState(() => !!session.briefQuiz?.visible && session.briefQuiz.key.startsWith("review:"));
  const missedBriefs = briefMisses(session);
  const answeredBriefs = BRIEF_QUESTIONS.filter((q) => session.briefAnswers?.[q.id]);
  const briefRight = answeredBriefs.filter((q) => session.briefAnswers![q.id].correct).length;
  const mixed = briefReview(session);
  const startReview = (missed: boolean) => {
    const items = missed ? missedBriefs : briefReview(session);
    if (!items.length) return;
    startBriefQuiz(missed ? "review:missed" : "review:mixed", items.map((q) => q.id), true);
    onChange(); setPractice(true);
  };
  const waiting = (session.recall ?? []).length;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !next || bedtime || practice || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement
        || e.target instanceof HTMLSelectElement) return;
      e.preventDefault();
      nav(`/learn/${next.id}?mode=night`);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [next, nav, bedtime, practice]);
  const end = () => {
    if (window.confirm(next ? `Kết thúc đêm học? Còn ${p.left} bài chưa đọc; kết quả đêm nay sẽ bị xoá.` : "Kết thúc đêm học và xoá kết quả đêm nay?")) onEnd();
  };
  return (
    <>
      {compact && <Card className="mb-4"><CardContent className="space-y-3 pt-5">
        <p className="font-semibold">Bản gọn: {COMPACT_GRAMMAR.length} chủ điểm từ {COMPACT_GRAMMAR.reduce((n, b) => n + b.sources.length, 0)} bài gốc — giữ tiến độ đã học</p>
        <p className="text-sm text-muted">Gộp bài chia nhỏ và bài so sánh, chuyển {NIGHT_LATER.length} bài phát âm/luyện diễn đạt sang giai đoạn sau. Mỗi chủ điểm có 6 câu trắc nghiệm để nhớ; bạn chọn lúc luyện. Nếu đồng hồ đêm cũ đã hết, đặt lại theo thời gian bạn còn:</p>
        <div className="flex flex-wrap gap-2">{[3, 3.5, 4].map((h) => <Button key={h} size="sm" variant="outline" onClick={() => { replanNight(h); setNow(Date.now()); onChange(); }}>Còn {h === 3.5 ? "3 giờ 30" : `${h} giờ`} từ bây giờ</Button>)}</div>
      </CardContent></Card>}
      {compact && <Card className="mb-4" data-testid="brief-practice-overview"><CardHeader><CardTitle>Trắc nghiệm để nhớ — {BRIEF_QUESTIONS.length} câu</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-sm text-muted">Đã trả lời {answeredBriefs.length}/{BRIEF_QUESTIONS.length} câu · đúng gần nhất {briefRight} · cần ôn {missedBriefs.length}. Luyện lại sau vài chủ điểm; ôn trộn ưu tiên câu sai rồi xen các chủ điểm đã học.</p>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!missedBriefs.length} onClick={() => startReview(true)}>Ôn câu sai ({missedBriefs.length})</Button>
          <Button disabled={!mixed.length} onClick={() => startReview(false)}>Ôn trộn {mixed.length || 12} câu</Button></div>
        {practice && <BriefQuiz session={session} onChange={onChange} onClose={() => setPractice(false)} />}
      </CardContent></Card>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-wrap items-center gap-6 pt-5">
            <Ring percent={Math.round((100 * p.covered) / Math.max(1, p.total))} label={`Đã học hoặc đọc ${p.covered} trên ${p.total} bài`} size={132} />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-2xl font-bold">{p.covered}/{p.total} <span className="text-base font-normal text-muted">{compact ? "chủ điểm" : "bài"} · còn {p.left}</span></p>
              <p className="text-sm text-muted">{session.scope === "all" ? "Đang ôn lại tất cả bài" : `Đã hoàn thành theo lộ trình ${p.completed} ${compact ? "chủ điểm" : "bài"}`} · đã đọc đêm nay {p.read} {compact ? "chủ điểm" : "bài"}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {p.left === 0 ? <Badge tone="success">Xong toàn bộ 🎉</Badge>
                  : p.ahead >= 1 ? <Badge tone="success">Nhanh hơn kế hoạch {p.ahead} {compact ? "chủ điểm" : "bài"}</Badge>
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
              ) : <div className="space-y-3"><p className="font-semibold text-success">Đã đọc hết lộ trình ngữ pháp trong {hoursMin(p.elapsed)} 🎉 Tiếp theo, dùng các cấu trúc vừa đọc khi nói và viết.</p>
                <div className="flex flex-wrap gap-2"><Link to="/speaking"><Button>Luyện nói</Button></Link><Link to="/writing"><Button variant="outline">Luyện viết</Button></Link></div></div>}
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
              const c = us.filter((u) => coveredNight(session, u.id)).length;
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
      {compact && <Card className="mt-4"><CardHeader><CardTitle>Lộ trình gọn — chọn chủ điểm cần xem</CardTitle></CardHeader><CardContent>
        <MarkStudied session={session} onChange={onChange} />
        <ol className="grid gap-2 sm:grid-cols-2">{session.units.map((u, i) => <li key={u.id}><Link to={`/learn/${u.id}?mode=night`} className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm hover:bg-surface-2">
          <span className="text-muted">{i + 1}.</span><span className="flex-1">{u.title}<span className="mt-1 block text-xs text-muted">{u.level} · gộp {u.sources?.length ?? 1} bài</span></span>{coveredNight(session, u.id) && <CircleCheck size={16} className="shrink-0 text-success" />}
        </Link>{(session.compactRead?.includes(u.id) || !coveredNight(session, u.id)) && (
          <Button size="sm" variant="ghost" className="mt-1" onClick={() => { markBriefs([u.id], !session.compactRead?.includes(u.id)); onChange(); }}>
            {session.compactRead?.includes(u.id) ? "Bỏ dấu đã học" : "Đánh dấu đã học"}</Button>
        )}{questionsForBrief(u.id).length > 0 && <Button size="sm" variant="ghost" className="mt-1" onClick={() => { startBriefQuiz(u.id, questionsForBrief(u.id).map((q) => q.id)); nav(`/learn/${u.id}?mode=night`); }}>Luyện 6 câu · {questionsForBrief(u.id).filter((q) => session.briefAnswers?.[q.id]?.correct).length}/6 đúng</Button>}</li>)}</ol>
        <p className="mt-4 text-sm text-muted">Để sau: bảng chữ cái/âm, bày tỏ quan điểm, văn phong, kết hợp từ, dấu hiệu diễn ngôn, rào đón, biến đổi câu và lập luận. Các bài gốc vẫn mở được trong lộ trình đầy đủ.</p>
      </CardContent></Card>}
      {!compact && p.read >= 3 && (
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
      <div className={`mt-4 grid grid-cols-1 gap-4 ${compact ? "" : "lg:grid-cols-3"}`}>
        {!compact && <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Chưa nhớ ({review.length})</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {review.length ? (
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {review.map((u) => {
                  const r = session.results[u.id];
                  return (
                    <li key={u.id}><Link to={`/learn/${u.id}?mode=journey`} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-2">
                      <Badge>{u.level}</Badge><span className="min-w-0 truncate"><b>{u.id}</b> · {u.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted">{r?.skipped ? "bỏ qua" : `sai ${u.missed} câu`}</span>
                    </Link></li>
                  );
                })}
              </ul>
            ) : <p className="text-muted">Chưa có. Bài có câu sai nằm ở đây cho tới khi bạn nhớ lại đúng câu đó (app tự hỏi lại sau vài bài); bài bị bỏ qua cũng ở đây.</p>}
          </CardContent>
        </Card>}
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

function Loop({ compact = true }: { compact?: boolean }) {
  const steps = compact ? [["💡", "Hiểu cách dùng", "một chủ điểm, không chia lại thành nhiều bài trùng"], ["📐", "Khung và ví dụ", "công thức + câu tiếng Anh + nghĩa tiếng Việt"], ["⚠️", "Điểm dễ nhầm", "so sánh ngắn ngay tại chỗ, không học một bài riêng"], ["✍️", "Trắc nghiệm để nhớ", "6 câu có giải thích; ôn câu sai và ôn trộn sau vài chủ điểm"]] : LOOP;
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Vòng học mỗi bài">
      {steps.map(([icon, t, d], i) => (
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
      <CardHeader><CardTitle><Coffee size={16} className="mr-1 inline" />Cách dùng 3–4 giờ còn lại</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm text-muted">
          <li><CircleCheck size={14} className="mr-1 inline text-success" />Đọc cách dùng, nhìn khung câu, rồi hiểu từng ví dụ. Chủ điểm đã biết có thể đi nhanh.</li>
          <li><CircleCheck size={14} className="mr-1 inline text-success" />Dành thời gian cho thì, modal, điều kiện và nối câu. Không làm lại cả bộ bài chỉ để so sánh hai cấu trúc.</li>
          <li><CircleCheck size={14} className="mr-1 inline text-success" />Luyện 6 câu mỗi chủ điểm, đọc giải thích khi sai. Sau vài chủ điểm, ôn trộn để thử nhớ lại mà không nhìn bài.</li>
          <li><CircleCheck size={14} className="mr-1 inline text-success" />Nghỉ {BREAK_MIN} phút mỗi {BREAK_EVERY_MIN} phút. Đặt lại đồng hồ theo thời gian thực sự còn.</li>
          <li><CircleCheck size={14} className="mr-1 inline text-success" />Đây là lượt đọc phần cốt lõi, chưa phải thành thạo toàn bộ ngữ pháp. Đọc xong không tự tăng level hay đánh dấu hoàn thành bài gốc.</li>
          <li><CircleCheck size={14} className="mr-1 inline text-success" />Sau lượt đọc, chuyển sang nói và viết; mở lại chủ điểm liên quan khi cần sửa câu.</li>
        </ul>
      </CardContent>
    </Card>
  );
}
