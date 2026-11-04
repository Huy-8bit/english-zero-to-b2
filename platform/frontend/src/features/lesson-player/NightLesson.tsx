import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, BookOpenText, Check, Coffee, Moon, Timer, X } from "lucide-react";
import { NoExampleVi, ViToggle } from "@/components/ExampleVi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";
import { InlineMd, Markdown } from "@/components/Markdown";
import { SpeakButton } from "@/components/SpeakButton";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { ReaderControls } from "@/features/reader/ReaderControls";
import type { Mistake, QuizItem, Step, StepsPayload } from "@/types/content";
import { ItemCard } from "@/features/quizzes/ItemCard";
import { coreSteps, lessonOverview } from "./SprintLesson";
import { singleIntro, withoutRepeatedInstruction } from "./journey";
import { ConceptSlide, FormulaSlide } from "./slides";
import {
  BREAK_MIN, breakDue, clock, coveredNight, flashbackPick, hoursMin, loadNight, nextNight, nightPace, recallAnswer, recordNight, reviewPicks,
  tookBreak, type NightSession, type RecallPick,
} from "./nightPlan";
import { useNightSession } from "./useNightSession";
import { briefFor, NIGHT_LATER } from "./compactGrammar";
import { CompactNightLesson } from "./CompactNightLesson";

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

const typing = (e: KeyboardEvent) =>
  e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey;

type Q = { id: string; item: QuizItem; quizId: string; intro: string };
function questions(steps: Step[]) {
  const m: Record<string, Q> = {};
  steps.forEach((s) => (s.items ?? []).forEach((item) => {
    m[item.id] = { id: item.id, item: withoutRepeatedInstruction(item), quizId: s.quiz_id!, intro: singleIntro(s.intro_md ?? "", item) };
  }));
  return m;
}

export interface LearnCard { key: "what" | "form" | "tip" | "traps" | "recap"; label: string; icon: string; hint: string; steps: Step[]; traps?: Mistake[] }

/** The lesson in short cards, in the order memory takes it in: what it is → the form → a hook to remember it →
 *  the traps (fixed by the learner before seeing the right form). */
export function nightCards(steps: Step[]): LearnCard[] {
  const { form, recap, mistakes, tip } = coreSteps(steps);
  const what = steps.find((s) => s.type === "concept" && /^(WHAT|Khái niệm|Là gì)\b/i.test(s.title));
  const traps = (mistakes?.mistakes ?? []).slice(0, 3);
  const cards: LearnCard[] = [];
  if (what) cards.push({ key: "what", label: "Hiểu", icon: "💡", hint: "bài này nói về gì", steps: [what] });
  if (form.length) cards.push({ key: "form", label: "Công thức", icon: "📐", hint: "khung để lắp câu", steps: form });
  if (tip) cards.push({ key: "tip", label: "Mẹo nhớ", icon: "🧠", hint: "đọc to một lần", steps: [tip] });
  if (traps.length) cards.push({ key: "traps", label: "Bẫy", icon: "⚠️", hint: "tự sửa trong đầu rồi mới lật", steps: [], traps });
  else if (recap) cards.push({ key: "recap", label: "Điểm chốt", icon: "⚡", hint: "những gì phải nhớ", steps: [recap] });
  return cards;
}

const CARD_TONE: Record<LearnCard["key"], string> = {
  what: "border-primary/30 bg-primary-soft/25",
  form: "border-border bg-surface",
  tip: "border-success/40 bg-success-soft/30",
  traps: "border-danger/30 bg-danger-soft/15",
  recap: "border-primary/30 bg-primary-soft/25",
};
const cleanTitle = (t: string) => t.replace(/^(WHAT|FORM|HOW|WHY|COMPARISON)\b\s*:?\s*/i, "");

/** Time on this lesson against the time each remaining lesson may take to finish the night on time. */
function LessonClock({ start, budget }: { start: number; budget: number }) {
  const s = (useNow(1000) - start) / 1000;
  const tone = s < budget * 0.8 ? "text-success" : s < budget ? "text-warning" : "text-danger";
  return <span className={cn("inline-flex items-center gap-1 font-mono text-sm tabular-nums", tone)} title="Thời gian bài này / thời gian mỗi bài để kịp kế hoạch">
    <Timer size={14} />{clock(s)}<span className="text-muted">/{clock(budget)}</span></span>;
}

function PaceBadge({ session }: { session: NightSession }) {
  const p = nightPace(session, useNow(15_000));
  return (
    <>
      {p.ahead >= 1 ? <Badge tone="success">Nhanh hơn {p.ahead} bài</Badge> : p.ahead <= -1 ? <Badge tone="warning">Chậm {-p.ahead} bài</Badge> : <Badge>Đúng nhịp</Badge>}
      <span className="hidden tabular-nums text-muted sm:inline" title="Thời gian còn lại của đêm học">còn {hoursMin(p.msLeft)}</span>
    </>
  );
}

function RestOverlay({ until, onDone }: { until: number; onDone: () => void }) {
  const left = Math.max(0, (until - useNow(1000)) / 1000);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/95 p-6 backdrop-blur" role="dialog" aria-label="Nghỉ giải lao">
      <div className="max-w-md space-y-4 text-center">
        <Coffee className="mx-auto text-primary" size={56} />
        <p className="text-2xl font-bold">{left > 0 ? "Nghỉ 5 phút" : "Hết giờ nghỉ"}</p>
        <p className="font-mono text-5xl tabular-nums">{clock(left)}</p>
        <p className="text-muted">Rời màn hình, uống nước, nhìn ra xa hoặc nhắm mắt. Lúc nghỉ yên, não đang sắp xếp lại những gì vừa học — đừng lướt điện thoại.</p>
        <Button size="lg" onClick={onDone}>Học tiếp <kbd className="ml-1 text-xs opacity-70">Enter</kbd></Button>
      </div>
    </div>
  );
}

/** One question answered with one click (or keys 1–4). `hide`: a pretest — only right/wrong, the answer stays hidden. */
function OneClick({ unitId, docPath, q, hide, onResult, onNext, nextLabel }: {
  unitId: string; docPath: string; q: Q; hide?: boolean; onResult?: (correct: boolean) => void; onNext: () => void; nextLabel: string;
}) {
  const [chosen, setChosen] = useState<string>();
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.submitQuiz>>["results"][string] | null>(null);
  const [busy, setBusy] = useState(false);
  const answer = async (key?: string) => {
    if (busy || result) return;
    if (key) setChosen(key);
    setBusy(true);
    try {
      // no key = "Không biết — xem đáp án"
      const r = await api.submitQuiz(q.quizId, key ? { [q.id]: key } : {}, key ? [] : [q.id]);
      setResult(r.results[q.id]);
      onResult?.(r.results[q.id].verdict === "correct");
    } catch (e) {
      setChosen(undefined);
      toast.error(e instanceof Error ? e.message : "Không chấm được");
    } finally {
      setBusy(false);
    }
  };
  // layout effect: the keys work as soon as the screen shows (a key pressed right away is not lost)
  useLayoutEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (result) {
        if (e.key === "Enter") { e.preventDefault(); onNext(); }
        return;
      }
      const opts = q.item.options ?? [];
      const n = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : opts.findIndex((o) => o.key.toLowerCase() === e.key.toLowerCase());
      if (opts[n]) { e.preventDefault(); void answer(opts[n].key); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const right = result?.verdict === "correct";
  return (
    <div className="space-y-3">
      {q.intro && <Markdown docPath={docPath} className="text-sm text-muted">{q.intro}</Markdown>}
      <ItemCard item={q.item} unitId={unitId} docPath={docPath} draft={chosen} onDraft={(d) => void answer(String(d))}
        result={hide ? undefined : result ?? undefined} locked={busy || !!result} aiAuto={false} onSelfAssess={() => {}}
        onEnter={() => { if (result) onNext(); }} onReveal={hide ? undefined : () => void answer()} single />
      {hide && result && (
        <p className={cn("rounded-2xl p-3 font-medium", right ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
          {right ? "🎯 Đoán đúng! Đọc bài để chắc vì sao đúng." : "Chưa đúng — đáp án nằm trong bài. Vừa đọc vừa tìm nó; lát nữa câu này được hỏi lại."}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {hide && !result && <Button variant="ghost" onClick={onNext}>Chưa biết — vào học</Button>}
        {result && <Button onClick={onNext}>{nextLabel}<ArrowRight size={16} /><kbd className="ml-1 text-xs opacity-70">Enter</kbd></Button>}
      </div>
    </div>
  );
}

/** A question from an earlier lesson (the given one, or one the server picks); a miss comes back later. */
function Recall({ pick, onDone, nextLabel }: { pick: RecallPick; onDone: () => void; nextLabel: string }) {
  const steps = useQuery({ queryKey: ["steps", pick.unit], queryFn: () => api.steps(pick.unit), staleTime: Infinity });
  const one = useQuery({ queryKey: ["recall-pick", pick.unit], queryFn: () => api.quickCheck(pick.unit, 1), enabled: !pick.item, staleTime: Infinity, gcTime: 0 });
  const id = pick.item ?? one.data?.items[0];
  const q = useMemo(() => (steps.data && id ? questions(steps.data.steps)[id] : undefined), [steps.data, id]);
  if (!q || !steps.data) {
    const failed = steps.isError || one.isError || (steps.data && (pick.item || one.data));
    return failed
      ? <div className="space-y-2"><p className="text-muted">Không lấy được câu hỏi này.</p><Button onClick={onDone}>Bỏ qua<ArrowRight size={16} /></Button></div>
      : <p className="text-muted">Đang lấy câu hỏi…</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Từ bài <b className="text-fg">{steps.data.unit.id}</b> · {steps.data.unit.title_vi || steps.data.unit.title}</p>
      <OneClick key={q.id} unitId={pick.unit} docPath={steps.data.unit.path} q={q} onResult={(ok) => recallAnswer(pick.unit, q.id, ok)}
        onNext={onDone} nextLabel={nextLabel} />
    </div>
  );
}

/** A run of questions from earlier lessons, answered without looking (spaced, mixed retrieval). */
export function RecallRun({ picks, onFinish, finishLabel }: { picks: RecallPick[]; onFinish: () => void; finishLabel: string }) {
  const [i, setI] = useState(0);
  const last = i + 1 >= picks.length;
  return (
    <div className="space-y-3" data-testid="night-review">
      {picks.length > 1 && (
        <>
          <Badge tone="primary">⏪ Câu {i + 1}/{picks.length}</Badge>
          <Progress value={(100 * i) / picks.length} label={`Câu ${i + 1}/${picks.length}`} />
        </>
      )}
      <Recall key={i} pick={picks[i]} nextLabel={last ? finishLabel : "Câu tiếp"} onDone={() => (last ? onFinish() : setI(i + 1))} />
    </div>
  );
}

function Traps({ traps, revealed, onReveal }: { traps: Mistake[]; revealed: boolean[]; onReveal: (i: number) => void }) {
  return (
    <ul className="space-y-3">
      {traps.map((m, i) => (
        <li key={i} className="rounded-2xl border border-border bg-surface p-4">
          <p><span className="mr-2 rounded bg-danger-soft px-1.5 py-0.5 text-xs font-semibold text-danger">✗ Sai</span><span className="night-wrong"><InlineMd>{m.wrong}</InlineMd></span></p>
          {revealed[i] ? (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 space-y-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-success-soft px-1.5 py-0.5 text-xs font-semibold text-success">✓ Đúng</span>
                <InlineMd>{m.right}</InlineMd><SpeakButton text={m.right} label="Nghe câu đúng" />
              </p>
              {(m.tip || m.cause) && <p className="text-[15px] text-muted">💡 <InlineMd>{m.tip || m.cause}</InlineMd></p>}
            </motion.div>
          ) : (
            <button type="button" onClick={() => onReveal(i)} className="mt-2 text-sm font-medium text-primary hover:underline">Sửa trong đầu, rồi lật câu đúng</button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The lesson one short card at a time; Enter / → forward (reveals the traps one by one first), ← back. */
function LearnCards({ cards, docPath, hook, hookOk, onDone }: { cards: LearnCard[]; docPath: string; hook?: Q; hookOk?: boolean; onDone: () => void }) {
  const [at, setAt] = useState(0);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const card = cards[at];
  const hidden = card?.traps ? card.traps.findIndex((_, i) => !revealed[i]) : -1;
  const go = (i: number) => { setAt(i); window.scrollTo({ top: 0 }); };
  const forward = () => {
    if (hidden >= 0) return setRevealed((r) => { const n = [...r]; n[hidden] = true; return n; });
    if (at + 1 < cards.length) go(at + 1);
    else onDone();
  };
  // layout effect: the keys work as soon as the screen shows (a key pressed right away is not lost)
  useLayoutEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); forward(); }
      else if (e.key === "ArrowLeft" && at > 0) { e.preventDefault(); go(at - 1); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  if (!card) return <Button size="lg" onClick={onDone}>Nhớ lại — kiểm tra<ArrowRight size={18} /></Button>;
  const prompt = hook && (hook.item.prompt_md || hook.item.group_md || "").split("\n")[0];
  const options = hook?.item.options?.map((o) => `${o.key}. ${o.text}`).join(" · ");
  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="night-learn">
      {prompt && (
        <NoExampleVi>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-primary/30 bg-surface px-4 py-2.5 text-[15px]">
          <span className="font-semibold text-primary">🎯 Đi tìm đáp án:</span>
          <span className="min-w-0"><InlineMd>{prompt}</InlineMd>{options && <span className="ml-2 text-muted">({options})</span>}</span>
          {hookOk !== undefined && <Badge tone={hookOk ? "success" : "warning"} className="ml-auto">{hookOk ? "bạn đã đoán đúng" : "bạn đoán chưa đúng"}</Badge>}
        </div>
        </NoExampleVi>
      )}
      <ol className="flex flex-wrap gap-2" aria-label="Các thẻ của bài">
        {cards.map((c, i) => (
          <li key={c.key}>
            <button type="button" onClick={() => go(i)} aria-current={i === at ? "step" : undefined}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition",
                i === at ? "border-primary bg-primary text-primary-fg" : i < at ? "border-success/40 text-success" : "border-border text-muted hover:border-primary/50")}>
              {i < at ? <Check size={14} /> : <span className="tabular-nums">{i + 1}</span>}{c.icon} {c.label}
            </button>
          </li>
        ))}
      </ol>
      <motion.section key={card.key} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}
        className={cn("night-card rounded-3xl border p-5 text-[17px] sm:p-7 xl:text-[18px]", CARD_TONE[card.key])} aria-label={card.label}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{card.icon} {card.label} — {card.hint}</p>
        {card.traps ? <NoExampleVi><Traps traps={card.traps} revealed={revealed} onReveal={(i) => setRevealed((r) => { const n = [...r]; n[i] = true; return n; })} /></NoExampleVi>
          : (
            <div className="space-y-6">
              {card.steps.map((st) => (
                <div key={st.id}>
                  {cleanTitle(st.title) && card.key !== "tip" && card.key !== "recap" && <h3 className="mb-2 text-xl font-bold">{cleanTitle(st.title)}</h3>}
                  {st.type === "formula" ? <FormulaSlide step={st} docPath={docPath} /> : <ConceptSlide step={st} docPath={docPath} />}
                </div>
              ))}
            </div>
          )}
        {card.key === "tip" && <p className="mt-4 text-sm text-muted">🔊 Đọc to mẹo này một lần — nói thành tiếng giúp nhớ lâu hơn đọc thầm.</p>}
      </motion.section>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => go(at - 1)} disabled={at === 0}><ArrowLeft size={16} />Trước</Button>
        <Button size="lg" className="ml-auto" onClick={forward}>
          {hidden >= 0 ? "Lật câu đúng" : at + 1 < cards.length ? <>Tiếp: {cards[at + 1].icon} {cards[at + 1].label}</> : "Nhớ lại — kiểm tra"}<ArrowRight size={18} />
          <kbd className="ml-1 text-xs opacity-70">Enter</kbd>
        </Button>
      </div>
      <p className="text-right text-xs text-muted">Enter / → tiếp · ← quay lại</p>
    </div>
  );
}

type Phase = "flash" | "hook" | "learn" | "check" | "done" | "review";

/** 'Ngữ pháp 1 đêm', one lesson as a memory loop: ⏪ recall an earlier question → 🎯 guess one → 📖 learn in short
 *  cards → ✍️ retrieve without looking (the guessed question again + 2 new). */
export function NightLesson(props: { unitId: string; data: StepsPayload; onFull?: () => void }) {
  const brief = briefFor(props.unitId);
  const session = loadNight();
  if (session && session.plan !== "full" && NIGHT_LATER.includes(props.unitId)) return <Navigate to="/grammar-night" replace />;
  return session?.plan !== "full" && brief
    ? <CompactNightLesson brief={brief} onFull={props.onFull} />
    : <FullNightLesson {...props} />;
}

function FullNightLesson({ unitId, data, onFull }: { unitId: string; data: StepsPayload; onFull?: () => void }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { session, setSession } = useNightSession();
  const [flash] = useState(() => { const s = loadNight(); return s ? flashbackPick(s, unitId) : null; });
  const [phase, setPhase] = useState<Phase>(flash ? "flash" : "hook");
  const [start] = useState(Date.now());
  const [budget] = useState(() => (session ? nightPace(session).perLesson : 240) || 240);
  const [pre, setPre] = useState<boolean>();
  const [idx, setIdx] = useState(0);
  const [got, setGot] = useState<Record<string, boolean>>({});
  const [review, setReview] = useState<RecallPick[]>([]);
  const [resting, setResting] = useState<number | null>(null);
  const check = useQuery({ queryKey: ["quick-check", unitId], queryFn: () => api.quickCheck(unitId), staleTime: Infinity, gcTime: 0 });
  const qs = useMemo(() => questions(data.steps), [data.steps]);
  const cards = useMemo(() => nightCards(data.steps), [data.steps]);
  const overview = useMemo(() => lessonOverview(data.steps, data.unit.title_vi), [data.steps, data.unit.title_vi]);
  const items = (check.data?.items ?? []).filter((id) => qs[id]);
  const hook = items[0] ? qs[items[0]] : undefined;
  const next = session ? nextNight(session, unitId) : null;
  const nextId = next?.id;

  // the next lesson opens at once
  useEffect(() => {
    if (!nextId) return;
    void qc.prefetchQuery({ queryKey: ["steps", nextId], queryFn: () => api.steps(nextId), staleTime: Infinity });
    void qc.prefetchQuery({ queryKey: ["quick-check", nextId], queryFn: () => api.quickCheck(nextId), staleTime: Infinity });
  }, [nextId, qc]);
  // nothing to guess: straight to the cards
  const noHook = phase === "hook" && !check.isLoading && !hook;
  useEffect(() => { if (noHook) setPhase("learn"); }, [noHook]);

  const correct = items.filter((id) => got[id]).length;
  const record = (skipped = false) => setSession(recordNight(unitId, {
    correct: skipped ? 0 : correct, total: skipped ? 0 : items.length, seconds: Math.round((Date.now() - start) / 1000), pre,
    ...(skipped ? { skipped } : {}),
  }));
  const goNext = () => nav(next ? `/learn/${next.id}?mode=night` : "/grammar-night");
  const skip = () => { record(true); goNext(); };
  const toCheck = () => {
    if (check.isLoading) return;
    if (items.length) return setPhase("check");
    record();
    setPhase("done");
  };
  const advance = () => {
    if (idx + 1 < items.length) return setIdx(idx + 1);
    record();
    setPhase("done");
  };
  const rest = () => { setResting(Date.now() + BREAK_MIN * 60_000); setPhase("done"); };
  const endRest = () => { setSession(tookBreak()); setResting(null); };

  // Enter: done → next lesson, end of a break → back (the cards and questions handle their own keys)
  // layout effect: the keys work as soon as the screen shows (a key pressed right away is not lost)
  useLayoutEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (typing(e) || e.key !== "Enter") return;
      if (resting) { e.preventDefault(); endRest(); }
      else if (phase === "done") { e.preventDefault(); goNext(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (!session) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-8 text-center">
        <Moon className="mx-auto text-primary" size={44} />
        <p className="text-xl font-bold">Chưa bắt đầu đêm học ngữ pháp</p>
        <p className="text-muted">Chọn số giờ và bắt đầu ở trang “Ngữ pháp 1 đêm” — app sẽ tính nhịp đọc cho từng bài.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/grammar-night"><Button>Mở “Ngữ pháp 1 đêm”</Button></Link>
          {onFull && <Button variant="outline" onClick={onFull}>Học đầy đủ bài này</Button>}
        </div>
      </div>
    );
  }

  const pos = session.units.findIndex((u) => u.id === unitId);
  const covered = session.units.filter((u) => coveredNight(session, u.id)).length;
  const missed = items.filter((id) => got[id] === false).length;
  const flow = ([
    flash && ["flash", "⏪ Nhớ lại bài cũ"], hook && ["hook", "🎯 Đoán"], ["learn", "📖 Học"], items.length > 0 && ["check", "✍️ Nhớ lại"],
  ].filter(Boolean) as [Phase, string][]);
  const flowAt = flow.findIndex(([k]) => k === phase);
  const canBreak = breakDue(session);
  const breakPicks = () => reviewPicks(session, 5, session.lastBreak);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-8">
          <Button variant="ghost" size="icon" onClick={() => nav("/grammar-night")} aria-label="Thoát về trang đêm học"><X size={18} /></Button>
          <Badge tone="primary"><Moon size={12} />Ngữ pháp 1 đêm</Badge>
          <h1 className="min-w-0 truncate font-semibold">{data.unit.id} · {data.unit.title}</h1>
          <span className="ml-auto flex flex-wrap items-center gap-3 text-sm">
            <LessonClock start={start} budget={budget} />
            <PaceBadge session={session} />
            <span className="tabular-nums text-muted" title="Tiến độ lộ trình và bài đã đọc trong đêm">Đã học/đọc <b className="text-fg">{covered}</b>/{session.units.length}</span>
            <ViToggle />
            <ReaderControls />
            {onFull && <Button size="sm" variant="ghost" onClick={onFull} title="Thoát chế độ đêm: bài ngữ pháp mở ở chế độ học đầy đủ"><BookOpenText size={15} />Học đầy đủ</Button>}
          </span>
        </div>
        <Progress className="h-1 rounded-none" value={(100 * covered) / Math.max(1, session.units.length)} label={`Đã học/đọc ${covered}/${session.units.length} bài`} />
      </header>

      <main className="reader-page lesson-big mx-auto max-w-[90rem] px-4 pb-16 pt-6 sm:px-8">
        <div className="mx-auto mb-5 flex max-w-5xl flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">🌙 {pos >= 0 ? `Bài ${pos + 1}/${session.units.length} · ` : ""}{data.unit.level}</p>
            <h2 className="text-2xl font-bold sm:text-3xl">{overview.nameVi || data.unit.title}</h2>
            {overview.nameVi && <p className="text-muted">{data.unit.title}</p>}
          </div>
          {flowAt >= 0 && (
            <ol className="ml-auto flex flex-wrap gap-1.5 text-sm" aria-label="Vòng học của bài">
              {flow.map(([k, t], i) => (
                <li key={k} className={cn("rounded-full px-2.5 py-0.5", i === flowAt ? "bg-primary-soft font-semibold text-primary" : i < flowAt ? "text-success" : "text-muted")}>
                  {i < flowAt && "✓ "}{t}</li>
              ))}
            </ol>
          )}
        </div>

        {phase === "flash" && flash && (
          <div className="mx-auto max-w-3xl space-y-3" data-testid="night-flash">
            <h3 className="text-xl font-bold">⏪ Nhớ lại trước khi học bài mới</h3>
            <p className="text-muted">Một câu từ bài đã đọc. Cố nhớ lại (dù khó) chính là lúc trí nhớ được củng cố.</p>
            <RecallRun picks={[flash]} finishLabel={hook || check.isLoading ? "Sang bài mới" : "Vào học"} onFinish={() => { setSession(loadNight()); setPhase("hook"); }} />
            <button type="button" onClick={() => setPhase("hook")} className="text-sm text-muted underline-offset-2 hover:underline">Bỏ qua câu này</button>
          </div>
        )}

        {phase === "hook" && (
          hook ? (
            <div className="mx-auto max-w-3xl space-y-3" data-testid="night-hook">
              <h3 className="text-xl font-bold">🎯 Đoán trước khi học</h3>
              <p className="text-muted">Chưa học cũng cứ đoán: đoán (kể cả sai) khiến não chú ý đúng chỗ khi đọc. Đáp án không hiện — bạn sẽ tìm thấy nó trong bài.</p>
              <OneClick key="hook" unitId={unitId} docPath={data.unit.path} q={hook} hide onResult={setPre} onNext={() => setPhase("learn")} nextLabel="Vào học" />
            </div>
          ) : <p className="text-center text-muted">Đang chuẩn bị bài…</p>
        )}

        {phase === "learn" && (
          <>
            <LearnCards cards={cards} docPath={data.unit.path} hook={hook} hookOk={pre} onDone={toCheck} />
            {next && <p className="mx-auto mt-2 max-w-5xl"><button type="button" onClick={skip} className="text-sm text-muted underline-offset-2 hover:underline">Bỏ qua, sang {next.id}</button></p>}
          </>
        )}

        {phase === "check" && items[idx] && (
          <div className="mx-auto max-w-3xl space-y-3" data-testid="night-quiz">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary">✍️ Câu {idx + 1}/{items.length}</Badge>
              <span className="text-sm text-muted">{idx === 0 ? "Câu đoán lúc nãy — giờ bạn đã biết chưa?" : "Nhớ lại, không xem bài · bấm đáp án hoặc phím 1–4"}</span>
            </div>
            <Progress value={(100 * idx) / items.length} label={`Câu ${idx + 1}/${items.length}`} />
            <OneClick key={items[idx]} unitId={unitId} docPath={data.unit.path} q={qs[items[idx]]} nextLabel={idx + 1 < items.length ? "Câu tiếp" : "Xong bài"} onNext={advance}
              onResult={(ok) => { const id = items[idx]; setGot((g) => ({ ...g, [id]: ok })); if (!ok) setSession(recallAnswer(unitId, id, false)); }} />
          </div>
        )}

        {phase === "review" && (
          <div className="mx-auto max-w-3xl space-y-3">
            <h3 className="text-xl font-bold">⏪ Ôn nhanh trước khi nghỉ</h3>
            <p className="text-muted">Trộn câu từ các bài vừa học (câu sai được ưu tiên). Nhớ lại ngay trước khi nghỉ giúp não giữ bài tốt hơn.</p>
            <RecallRun picks={review} finishLabel={`Nghỉ ${BREAK_MIN} phút`} onFinish={() => { setSession(loadNight()); rest(); }} />
          </div>
        )}

        {phase === "done" && (
          <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto max-w-2xl space-y-4 text-center" data-testid="night-result">
            <p className="text-3xl font-bold">{items.length ? `Nhớ được ${correct}/${items.length}` : "Đã đọc xong"}</p>
            {pre === false && items[0] && got[items[0]] && <p className="font-medium text-success">🎯 Câu đoán: lúc đầu sai → giờ đã đúng. Sửa được lỗi của chính mình là cách nhớ lâu nhất.</p>}
            <p className="text-muted">{missed > 0 ? `${missed} câu sai sẽ tự quay lại sau 2 bài nữa — không cần học lại ngay, cứ đi tiếp.` : "Đã nắm — sang bài tiếp."}</p>
            {canBreak && !resting && (
              <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary-soft/40 p-4">
                <Coffee size={18} className="text-primary" /><span className="font-semibold">Đã học gần 50 phút — đến giờ nghỉ.</span>
                <div className="flex w-full flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => { const p = breakPicks(); if (p.length) { setReview(p); setPhase("review"); } else rest(); }}>Ôn 5 câu rồi nghỉ</Button>
                  <Button size="sm" variant="outline" onClick={rest}>Nghỉ luôn</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSession(tookBreak(Date.now(), 10))}>Để 10 phút nữa</Button>
                </div>
              </div>
            )}
            <Button size="lg" className="h-auto whitespace-normal py-2.5" onClick={goNext}>
              {next ? <>Bài tiếp: {next.id} · {next.title}<ArrowRight size={18} className="shrink-0" /></> : "Xem tổng kết đêm học"}
              <kbd className="ml-1 text-xs opacity-70">Enter</kbd>
            </Button>
            {missed > 1 && <p><Link to={`/learn/${unitId}?mode=journey`} className="text-sm text-primary underline-offset-2 hover:underline">Học kỹ bài này ngay</Link></p>}
          </motion.div>
        )}
      </main>
      {resting && <RestOverlay until={resting} onDone={endRest} />}
    </div>
  );
}
