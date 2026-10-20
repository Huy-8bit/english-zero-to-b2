import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { lessonExitPath } from "@/lib/lessonExit";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight, BookOpenText, Bot, CalendarClock, CheckCircle2, Flag, Flame, ListChecks, Rocket, RotateCcw, Sparkles, Star, Target, X } from "lucide-react";
import { api } from "@/services/api";
import { ai } from "@/services/ai";
import type { ItemResult, JourneyState, LessonDetail, QuizItem, Step, StepsPayload } from "@/types/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { useCelebrate } from "@/components/Celebrate";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/Markdown";
import { ItemCard } from "@/features/quizzes/ItemCard";
import { TestOut } from "./TestOut";
import { isAnswered, toResponse, type Draft } from "@/features/quizzes/draft";
import { TutorPanel } from "@/features/tutor/TutorPanel";
import { FocusBadge } from "@/features/focus/FocusBadge";
import { BlockTimerChip } from "@/features/plan/BlockTimer";
import { ConceptSlide, DialogueSlide, ExamplesSlide, FlashcardsSlide, FormulaSlide, MistakesSlide, PassageSlide, RecapSlide, VocabSlide } from "./slides";
import { usePlayerState } from "./usePlayerState";
import { useHeartbeat } from "./useHeartbeat";
import { buildJourney, isAuto, stars, type Card } from "./journey";

type QCard = Extract<Card, { item: QuizItem }> | { kind: "retry"; key: string; item: QuizItem; quizId: string; stepIndex: number; intro: string };
const EMPTY: JourneyState = { pos: 0, done: [], wrong: [], retry: [], retryPass: 0, first: {}, xp: 0, startedAt: 0 };
const isQ = (c: Card | QCard): c is QCard => "item" in c;
const good = (r?: ItemResult) => !!r && (r.verdict === "correct" || r.self_correct === true || r.ai_correct === true);

/** Journey view of a lesson: one thing at a time, retrieval every few minutes, wrong answers come back, stars at the end. */
export function JourneySession({ unitId, data, lesson, onClassic }: { unitId: string; data: StepsPayload; lesson?: LessonDetail & { next_id?: string | null }; onClassic: () => void }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const fire = useCelebrate((s) => s.fire);
  const ps = usePlayerState(unitId, data);
  useHeartbeat(unitId);
  const js: JourneyState = { ...EMPTY, ...(ps.state.journey ?? {}) };
  // questions answered in earlier sessions are asked after new ones; the pick is saved so a reload keeps the same screens
  const attempted = useMemo(() => new Set(Object.keys(data.results ?? {})), [data.results]);
  const savedChallenge = ps.ready ? js.challenge : undefined;
  const j = useMemo(() => buildJourney(data.steps, { challenge: savedChallenge, attempted }), [data.steps, savedChallenge, attempted]);
  const byId = useMemo(() => {
    const m: Record<string, QCard> = {};
    j.cards.forEach((c) => { if (isQ(c)) m[c.item.id] = c; });
    return m;
  }, [j]);
  const cards: (Card | QCard)[] = useMemo(() => {
    const recap = j.cards.findIndex((c) => c.kind === "recap");
    const retry: QCard[] = js.retry.filter((id) => byId[id]).map((id, n) => ({ ...byId[id], kind: "retry", key: `retry:${n}:${id}` }));
    return [...j.cards.slice(0, recap), ...retry, ...j.cards.slice(recap)];
  }, [j, js.retry, byId]);
  const pos = Math.min(js.pos, cards.length - 1);
  const card = cards[pos];
  const drafts = (ps.state.drafts ?? {}) as Record<string, Draft>;
  const [combo, setCombo] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [finish, setFinish] = useState<{ score: number | null; xp: number; status: string } | null>(null);
  const finishing = useRef(false);
  const [testOut, setTestOut] = useState(false);
  useEffect(() => {
    if (ps.ready && !js.challenge) setJ((s) => ({ ...s, challenge: j.picked }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ps.ready, js.challenge]);

  const setJ = useCallback((fn: (s: JourneyState) => JourneyState) => {
    ps.update((st) => ({ ...st, journey: fn({ ...EMPTY, ...(st.journey ?? {}) }) }));
  }, [ps]);
  useEffect(() => {
    if (ps.ready && !ps.state.journey?.startedAt) setJ((s) => ({ ...s, startedAt: Date.now() }));
  }, [ps.ready, ps.state.journey?.startedAt, setJ]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pos]);
  // a retry card asks the question again from scratch
  const retryKey = card?.kind === "retry" ? card.key : null;
  useEffect(() => {
    if (card && card.kind === "retry") {
      const id = card.item.id;
      setJ((s) => ({ ...s, done: s.done.filter((x) => x !== id) }));
      if (ps.results[id]) ps.clearResult(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  const next = useCallback(() => {
    setJ((s) => {
      const recapAt = cards.findIndex((c) => c.kind === "recap");
      let p = Math.min(s.pos, cards.length - 1) + 1;
      if (p === recapAt && s.wrong.length && s.retryPass < 2) {
        return { ...s, retry: [...s.retry, ...s.wrong], wrong: [], retryPass: s.retryPass + 1, pos: p };
      }
      p = Math.min(p, cards.length - 1);
      return { ...s, pos: p };
    });
  }, [setJ, cards]);

  /** `override`: the learner's self-assessment replaces a provisional "not matching the model answer". */
  const record = useCallback((c: QCard, ok: boolean, override = false) => {
    setJ((s) => {
      const counts = c.kind !== "pretest" && c.kind !== "retry";
      const first = counts && (s.first[c.item.id] === undefined || override) ? { ...s.first, [c.item.id]: ok } : s.first;
      const wrong = ok ? s.wrong.filter((x) => x !== c.item.id) : s.wrong.includes(c.item.id) ? s.wrong : [...s.wrong, c.item.id];
      const done = s.done.includes(c.item.id) ? s.done : [...s.done, c.item.id];
      return { ...s, first, wrong, done };
    });
    setCombo((x) => {
      const n = ok ? x + 1 : 0;
      if (ok && n > 0 && n % 5 === 0) fire(`${n} câu đúng liên tiếp! 🔥`);
      return n;
    });
  }, [setJ, fire]);

  const check = useCallback(async (c: QCard) => {
    const d = drafts[c.item.id];
    if (busy || !isAnswered(c.item, d)) return;
    setBusy(true);
    try {
      const r = await api.submitQuiz(c.quizId, { [c.item.id]: toResponse(c.item, d) });
      let res = r.results[c.item.id];
      if (res.verdict === "mismatch" && res.has_key) {
        // differs from the model answer: let the AI decide now instead of asking the learner to self-assess
        try {
          const g = await ai.gradeAttempt(res.attempt_id);
          res = { ...res, ai_correct: g.score >= 0.75 };
        } catch {
          /* AI unavailable: self-assessment stays available */
        }
      }
      ps.setResults({ ...r.results, [c.item.id]: res });
      if (r.xp_gained) setJ((s) => ({ ...s, xp: s.xp + r.xp_gained }));
      // "mismatch" (open answer not equal to the model): provisionally wrong until the learner self-assesses
      if (res.verdict !== "submitted") record(c, res.verdict === "correct" || res.ai_correct === true);
      else setJ((s) => ({ ...s, done: s.done.includes(c.item.id) ? s.done : [...s.done, c.item.id] }));
      qc.invalidateQueries({ queryKey: ["day-plan"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không chấm được");
    } finally {
      setBusy(false);
    }
  }, [busy, drafts, ps, setJ, record, qc]);

  const reveal = useCallback(async (c: QCard) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.submitQuiz(c.quizId, {}, [c.item.id]);
      ps.setResults(r.results);
      record(c, false); // not known: counts as wrong and comes back in the retry round
      qc.invalidateQueries({ queryKey: ["day-plan"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xem được đáp án");
    } finally {
      setBusy(false);
    }
  }, [busy, ps, record, qc]);

  const selfAssess = useCallback(async (c: QCard, ok: boolean) => {
    const r = ps.results[c.item.id];
    if (!r) return;
    const s = await api.selfAssess(r.attempt_id, ok);
    ps.setResults({ [c.item.id]: s.result });
    if (s.xp_gained) setJ((x) => ({ ...x, xp: x.xp + s.xp_gained }));
    record(c, ok, true);
  }, [ps, setJ, record]);

  const complete = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      await api.saveProgress(unitId, data.steps.length - 1, ps.state);
      const r = await api.complete(unitId);
      setFinish({ score: r.score, xp: r.xp_gained, status: r.status });
      setJ((s) => ({ ...s, completed: true }));
      ["dashboard", "path", "lessons", "day-plan", "smart-review"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) {
      finishing.current = false;
      toast.error(e instanceof Error ? e.message : "Không hoàn thành được bài");
    }
  }, [unitId, data.steps.length, ps.state, qc, setJ]);
  useEffect(() => {
    if (card?.kind === "finish" && ps.ready) void complete();
  }, [card?.kind, ps.ready, complete]);

  const result = card && isQ(card) && js.done.includes(card.item.id) ? ps.results[card.item.id] : undefined;
  const canNext = !card || !isQ(card) || !!result;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "Enter" || e.key === "ArrowRight") {
        if (!card || card.kind === "finish" || testOut) return;  // the test-out screen has its own buttons
        e.preventDefault();
        if (isQ(card) && !result) void check(card);
        else if (canNext) next();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [card, result, canNext, check, next, testOut]);

  if (!ps.ready || !card) return null;
  const stage = j.stageOf[Math.min(pos, j.stageOf.length - 1)] ?? 2;
  const stageCards = (st: number) => cards.filter((_, i) => (j.stageOf[i] ?? 2) === st && cards[i].kind !== "mission").length;
  const stageDone = (st: number) => cards.slice(0, pos).filter((_, i) => (j.stageOf[i] ?? 2) === st && cards[i].kind !== "mission").length;
  const firsts = Object.values(js.first);
  const firstOk = firsts.filter(Boolean).length;
  const stepIndex = "stepIndex" in card ? card.stepIndex : 0;

  return (
    <div className={cn("min-h-screen bg-bg", tutorOpen && "md:pr-[22rem] xl:pr-[26rem]")}>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-2 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => nav(lessonExitPath())} aria-label="Thoát bài học"><X size={18} /></Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold sm:text-base">{data.unit.id} · {data.unit.title}</h1>
              <FocusBadge /><BlockTimerChip />
            </div>
            <div className="mt-1 flex gap-1" aria-label={`Chặng ${stage + 1}/3: ${j.stages[stage]}`}>
              {j.stages.map((name, i) => (
                <div key={name} className="flex-1" title={`Chặng ${i + 1}: ${name}`}>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (stageDone(i) / Math.max(1, stageCards(i))) * 100)}%` }} />
                  </div>
                  <p className={cn("mt-0.5 hidden text-[10px] sm:block", i === stage ? "font-semibold text-primary" : "text-muted")}>{i + 1}. {name}</p>
                </div>
              ))}
            </div>
          </div>
          {combo >= 3 && <Badge tone="warning"><Flame size={12} />{combo}</Badge>}
          <Badge tone="primary" title="XP trong bài này">+{js.xp} XP</Badge>
          <Button variant={tutorOpen ? "secondary" : "ghost"} size="sm" onClick={() => setTutorOpen((o) => !o)} aria-label="Hỏi AI về bài này" aria-expanded={tutorOpen}><Bot size={18} /><span className="hidden md:inline">Hỏi AI</span></Button>
          <Button variant="ghost" size="icon" onClick={onClassic} aria-label="Xem đầy đủ (cách học cũ)" title="Xem đầy đủ (cách học cũ)"><BookOpenText size={18} /></Button>
        </div>
      </header>

      <main className="lesson-big mx-auto max-w-4xl px-3 pb-28 pt-6 sm:px-6 xl:max-w-5xl">
        {/* enter animation only: an exit animation (AnimatePresence mode="wait") could freeze the old screen when
            the learner moved on quickly, leaving an input that ignored typing */}
          <motion.section key={card.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} aria-live="polite">
            {card.kind === "mission" && (testOut
              ? <TestOut unitId={unitId} data={data} nextId={lesson?.next_id ?? null} onStudy={() => setTestOut(false)} />
              : <Mission data={data} j={j} onTestOut={() => setTestOut(true)} />)}
            {card.kind === "content" && <ContentCard step={card.step} data={data} checklist={ps.state.checklist ?? {}} onChecklist={(c) => ps.update((s) => ({ ...s, checklist: c }))} />}
            {isQ(card) && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  {card.kind === "pretest" ? `Đoán trước ${card.n}/${card.of} — sai cũng không sao` : card.kind === "check" ? "Kiểm tra nhanh" : card.kind === "retry" ? "Làm lại câu sai" : `Thử thách · ${card.level}`}
                </p>
                {card.kind === "pretest" && !result && <p className="mb-3 text-sm text-muted">Trả lời theo phỏng đoán. Bài học sẽ cho bạn biết vì sao — đoán trước giúp não chú ý hơn.</p>}
                {card.intro && <ExerciseIntro md={card.intro} docPath={data.unit.path} />}
                <ItemCard item={card.item} unitId={unitId} docPath={data.unit.path} draft={drafts[card.item.id]} onDraft={(d) => ps.setDraft(card.item.id, d)}
                  result={result} locked={false} aiAuto={false} onSelfAssess={(ok) => void selfAssess(card, ok)} onRetry={() => ps.clearResult(card.item.id)} onEnter={() => void check(card)}
                  onReveal={() => void reveal(card)} />
                {result && !(good(result) && card.kind !== "pretest") && <p className="mt-2 text-sm text-muted">{good(result) ? "Đoán đúng! Xem bài để chắc chắn vì sao."
                  : result.verdict === "mismatch" && result.ai_correct === false ? "AI chấm chưa đúng — đọc chỗ sai bên dưới; câu này sẽ được hỏi lại ở cuối bài."
                  : result.verdict === "mismatch" && result.self_correct === null ? "AI chưa chấm được — so sánh với đáp án: nếu đúng ý, bấm “Tôi làm đúng”; nếu không, câu này sẽ được hỏi lại ở cuối bài."
                  : result.verdict === "submitted" ? "Tự đánh giá câu trả lời của bạn rồi bấm Tiếp."
                  : result.verdict === "revealed" ? "Đọc kỹ đáp án và giải thích — câu này sẽ được hỏi lại ở cuối bài." : "Chưa đúng — câu này sẽ được hỏi lại ở cuối bài."}</p>}
              </div>
            )}
            {card.kind === "checkpoint" && <Checkpoint stage={card.stage} title={card.title} firstOk={firstOk} firstTotal={firsts.length} fire={fire} />}
            {card.kind === "recap" && (card.step ? <ContentCard step={card.step} data={data} checklist={ps.state.checklist ?? {}} onChecklist={(c) => ps.update((s) => ({ ...s, checklist: c }))} />
              : <p className="text-muted">Bạn đã đi hết các phần của bài.</p>)}
            {card.kind === "finish" && (
              <Finish unitId={unitId} nextId={lesson?.next_id ?? null} result={finish} xp={js.xp} firstOk={firstOk} firstTotal={firsts.length}
                stillWrong={js.done.filter((id) => byId[id] && isAuto(byId[id].item) && !good(ps.results[id])).map((id) => byId[id].item.label)}
                minutes={js.startedAt ? Math.round((Date.now() - js.startedAt) / 60000) : null} />
            )}
          </motion.section>
      </main>

      {card.kind !== "finish" && !testOut && (
        <footer className={cn("fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur", tutorOpen && "bottom-[46dvh] md:bottom-0 md:right-[22rem] xl:right-[26rem]")}>
          <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-3 sm:px-6 xl:max-w-5xl">
            <span className="text-xs text-muted">{pos + 1}/{cards.length} · Enter để tiếp tục</span>
            {isQ(card) && !result ? (
              <>
                {!isAuto(card.item) && <Button variant="ghost" className="ml-auto" onClick={next}>Bỏ qua</Button>}
                <Button className={isAuto(card.item) ? "ml-auto" : ""} onClick={() => void check(card)} disabled={busy || !isAnswered(card.item, drafts[card.item.id])}><CheckCircle2 size={16} />Kiểm tra</Button>
              </>
            ) : (
              <Button className="ml-auto" onClick={next} disabled={!canNext}>
                {card.kind === "mission" ? <><Target size={16} />Bắt đầu</> : cards[pos + 1]?.kind === "finish" ? <><Flag size={16} />Hoàn thành bài</> : <>Tiếp<ArrowRight size={16} /></>}
              </Button>
            )}
          </div>
        </footer>
      )}
      {tutorOpen && (
        <aside className="fixed inset-x-0 bottom-0 z-30 flex h-[46dvh] min-h-0 flex-col border-t border-border bg-surface shadow-xl md:inset-x-auto md:right-0 md:top-0 md:h-dvh md:w-[22rem] md:border-l md:border-t-0 xl:w-[26rem]" aria-label="Gia sư AI">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2"><Bot size={20} className="text-primary" /><h2 className="font-semibold">Gia sư AI</h2></div>
            <Button variant="ghost" size="icon" onClick={() => setTutorOpen(false)} aria-label="Đóng gia sư AI"><X size={18} /></Button>
          </div>
          <div className="min-h-0 flex-1 p-3 sm:p-4"><TutorPanel unitId={unitId} stepIndex={stepIndex} lastItemId={isQ(card) ? card.item.id : undefined} /></div>
        </aside>
      )}
    </div>
  );
}

/** Shared instructions/context of the exercise the question belongs to (items often refer to it). */
function ExerciseIntro({ md, docPath }: { md: string; docPath: string }) {
  const long = md.length > 700;
  return (
    <details open={!long} className="mb-3 rounded-2xl border border-border bg-surface-2/60 px-4 py-3 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-muted">Hướng dẫn của bài tập</summary>
      <div className="mt-2"><Markdown docPath={docPath}>{md}</Markdown></div>
    </details>
  );
}

function ContentCard({ step, data, checklist, onChecklist }: { step: Step; data: StepsPayload; checklist: Record<string, boolean>; onChecklist: (c: Record<string, boolean>) => void }) {
  const docPath = data.unit.path;
  const body = (() => {
    switch (step.type) {
      case "formula": return <FormulaSlide step={step} docPath={docPath} />;
      case "examples": return <ExamplesSlide step={step} docPath={docPath} />;
      case "mistakes": return <MistakesSlide step={step} docPath={docPath} />;
      case "dialogue": return <DialogueSlide step={step} docPath={docPath} />;
      case "passage": return <PassageSlide step={step} docPath={docPath} />;
      case "recap": return <RecapSlide step={step} docPath={docPath} checked={checklist} onChecked={onChecklist} />;
      case "vocab": return <VocabSlide step={step} cards={data.cards} />;
      case "flashcards": return <FlashcardsSlide step={step} cards={data.cards} />;
      default: return <ConceptSlide step={step} docPath={docPath} />;
    }
  })();
  return (
    <div>
      <h2 id="slide-title" className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">{step.title}</h2>
      {body}
    </div>
  );
}

function Mission({ data, j, onTestOut }: { data: StepsPayload; j: ReturnType<typeof buildJourney>; onTestOut: () => void }) {
  const intro = j.cards[0].kind === "mission" ? j.cards[0].intro : null;
  const content = j.cards.filter((c) => c.kind === "content").length;
  const pre = j.cards.filter((c) => c.kind === "pretest").length;
  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-primary-soft to-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Nhiệm vụ hôm nay</p>
        <h2 className="mt-1 text-2xl font-bold">{data.unit.title}</h2>
        {data.unit.title_vi && <p className="text-muted">{data.unit.title_vi}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {data.unit.minutes ? <Badge><CalendarClock size={12} />~{data.unit.minutes} phút</Badge> : null}
          <Badge><ListChecks size={12} />{content} phần giải thích · {j.questionCount} câu hỏi</Badge>
          {j.skipped > 0 && <Badge tone="primary">Bài rút gọn: làm {j.questionCount - j.skipped} câu · {j.skipped} câu còn lại để lần ôn sau</Badge>}
        </div>
      </div>
      <ol className="grid gap-2 sm:grid-cols-3">
        {[["1 · Hiểu", "Giải thích ngắn, mỗi 2 phần có 1 câu kiểm tra"], ["2 · Vận dụng", "Cách dùng, lỗi hay gặp, ví dụ thật"], ["3 · Thử thách", "Câu hỏi từng câu một, câu sai được làm lại"]].map(([t, d]) => (
          <li key={t} className="rounded-2xl border border-border p-3"><p className="font-semibold">{t}</p><p className="text-xs text-muted">{d}</p></li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 p-4">
        <Rocket size={18} className="text-primary" />
        <p className="min-w-0 flex-1 text-sm"><b>Đã biết bài này?</b> Làm 8 câu kiểm tra nhanh — đúng 7/8 ngay lần đầu là vượt bài, sang bài tiếp theo.</p>
        <Button variant="outline" onClick={onTestOut}>Kiểm tra vượt bài</Button>
      </div>
      {pre > 0 && <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning"><Sparkles size={14} className="mr-1 inline" />Bắt đầu bằng {pre} câu đoán trước — trả lời theo cảm nhận, sai cũng không sao.</p>}
      {intro && <details className="rounded-2xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Mục tiêu & giới thiệu bài</summary><div className="mt-3"><ConceptSlide step={intro} docPath={data.unit.path} /></div></details>}
    </div>
  );
}

function Checkpoint({ stage, title, firstOk, firstTotal, fire }: { stage: number; title: string; firstOk: number; firstTotal: number; fire: (t: string) => void }) {
  useEffect(() => { fire(`Xong chặng ${stage + 1}: ${title}!`); }, [stage, title, fire]);
  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 size={32} /></div>
      <h2 className="text-2xl font-bold">Hoàn thành chặng {stage + 1}: {title}</h2>
      {firstTotal > 0 && <p className="text-muted">Đúng ngay lần đầu: <b>{firstOk}/{firstTotal}</b> câu kiểm tra</p>}
      <p className="text-sm text-muted">Nếu thấy mỏi, đứng dậy vươn vai 1 phút trước khi sang chặng tiếp theo.</p>
    </div>
  );
}

function Finish({ unitId, nextId, result, xp, firstOk, firstTotal, stillWrong, minutes }: {
  unitId: string; nextId: string | null; result: { score: number | null; xp: number; status: string } | null; xp: number; firstOk: number; firstTotal: number;
  stillWrong: string[]; minutes: number | null;
}) {
  const nav = useNavigate();
  const n = stars(firstOk, firstTotal);
  return (
    <div className="space-y-5 text-center">
      <div className="flex justify-center gap-2" aria-label={`${n} trên 3 sao`}>
        {[1, 2, 3].map((i) => (
          <motion.span key={i} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.2 * i, type: "spring" }}>
            <Star size={48} className={i <= n ? "fill-warning text-warning" : "text-border"} />
          </motion.span>
        ))}
      </div>
      <h2 className="text-2xl font-bold">{n === 3 ? "Xuất sắc!" : n === 2 ? "Làm tốt lắm!" : "Đã hoàn thành — ôn thêm sẽ chắc hơn"}</h2>
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
        <div className="rounded-2xl bg-surface-2 p-3"><p className="text-xl font-bold">{firstTotal ? Math.round((firstOk / firstTotal) * 100) : 100}%</p><p className="text-xs text-muted">đúng lần đầu</p></div>
        <div className="rounded-2xl bg-surface-2 p-3"><p className="text-xl font-bold">+{xp + (result?.xp ?? 0)}</p><p className="text-xs text-muted">XP</p></div>
        <div className="rounded-2xl bg-surface-2 p-3"><p className="text-xl font-bold">{minutes ?? "—"}</p><p className="text-xs text-muted">phút</p></div>
      </div>
      {result?.score !== null && result?.score !== undefined && <p className="text-sm text-muted">Điểm bài: {Math.round(result.score)}% {result.status === "review" ? "— dưới 60%, bài được đánh dấu cần ôn lại" : ""}</p>}
      {!result && <p className="text-sm text-muted">Đang lưu kết quả…</p>}
      {stillWrong.length > 0 && <p className="rounded-2xl bg-warning-soft px-4 py-2 text-sm text-warning"><RotateCcw size={14} className="mr-1 inline" />Còn {stillWrong.length} câu chưa đúng ({stillWrong.slice(0, 6).join(", ")}) — đã đưa vào Ôn tập thông minh.</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {nextId && <Button onClick={() => nav(`/learn/${nextId}`)}>Bài tiếp theo<ArrowRight size={16} /></Button>}
        <Link to="/today"><Button variant="outline"><CalendarClock size={16} />Về lịch học hôm nay</Button></Link>
        {stillWrong.length > 0 && <Link to="/review"><Button variant="outline">Ôn ngay</Button></Link>}
        <Link to={`/learn/${unitId}?mode=classic`}><Button variant="ghost">Xem lại toàn bài</Button></Link>
      </div>
    </div>
  );
}
