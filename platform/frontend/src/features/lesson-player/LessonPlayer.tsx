import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FocusBadge } from "@/features/focus/FocusBadge";
import { BlockTimerChip } from "@/features/plan/BlockTimer";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft, ArrowRight, Bot, BookOpenText, Sparkles, CheckCircle2, ChevronLeft, Clock, Flag, Focus, List, NotebookPen, Trophy, X, Route,
} from "lucide-react";
import { api } from "@/services/api";
import type { ItemResult, Step } from "@/types/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { ErrorBox, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { ThemeToggle } from "@/app/Layout";
import { cn, KIND_LABELS, safeStorage } from "@/lib/utils";
import { stopSpeaking } from "@/lib/tts";
import { useUI } from "@/stores/ui";
import { QuizSlide } from "@/features/quizzes/QuizSlide";
import { isAnswered, toResponse, type Draft } from "@/features/quizzes/draft";
import { usePlayerState } from "./usePlayerState";
import { JourneySession } from "./JourneySession";
import { journeyApplies } from "./journey";
import { useHeartbeat } from "./useHeartbeat";
import { NotesPanel } from "./NotesPanel";
import { TutorPanel } from "@/features/tutor/TutorPanel";
import { GeneratorForm } from "@/features/ai-practice/GeneratorForm";
import { useAIStatus } from "@/components/ai/AIStatus";
import {
  ConceptSlide, DialogueSlide, ExamplesSlide, FlashcardsSlide, FormulaSlide, MistakesSlide, PassageSlide, RecapSlide, VocabSlide,
} from "./slides";

const TYPE_LABEL: Record<string, string> = {
  intro: "Giới thiệu", concept: "Khái niệm", formula: "Công thức", examples: "Ví dụ", comparison: "So sánh", timeline: "Minh họa",
  mistakes: "Lỗi thường gặp", dialogue: "Hội thoại", passage: "Bài đọc", quiz: "Bài tập", recap: "Tổng kết", vocab: "Từ vựng",
  flashcards: "Flashcards", submit: "Nộp bài",
};

export const ACHIEVEMENT_TITLES: Record<string, string> = {
  first_lesson: "Bài học đầu tiên", lessons_10: "Chăm chỉ — 10 bài", lessons_50: "Bền bỉ — 50 bài", perfect_quiz: "Không sai câu nào",
  streak_3: "Chuỗi 3 ngày", streak_7: "Chuỗi 7 ngày", streak_30: "Chuỗi 30 ngày", cards_100: "100 lượt ôn từ", xp_1000: "1000 XP",
  level_A0: "Hoàn thành ngữ pháp A0", level_A1: "Hoàn thành ngữ pháp A1", level_A2: "Hoàn thành ngữ pháp A2",
  level_B1: "Hoàn thành ngữ pháp B1", level_B2: "Hoàn thành ngữ pháp B2",
};

type CompleteResult = Awaited<ReturnType<typeof api.complete>>;

const MODE_KEY = "em-lesson-mode";

export default function LessonPlayer() {
  const { unitId = "" } = useParams();
  // React Router reuses this route when only the ID changes. Each lesson needs its
  // own drafts, save timer and completion state; unmount flushes the previous one.
  return <LessonModes key={unitId} unitId={unitId} />;
}

/** Journey view (one thing at a time, checks every few slides) by default; the full slide view stays available. */
function LessonModes({ unitId }: { unitId: string }) {
  const [sp, setSp] = useSearchParams();
  const storage = safeStorage();
  const forced = sp.get("mode");
  const [pref, setPref] = useState<"journey" | "classic">(() => (forced === "classic" || forced === "journey" ? forced : storage.get(MODE_KEY, "journey")));
  const steps = useQuery({ queryKey: ["steps", unitId], queryFn: () => api.steps(unitId), staleTime: Infinity, gcTime: 0 });
  const lesson = useQuery({ queryKey: ["lesson", unitId], queryFn: () => api.lesson(unitId) });
  const choose = (m: "journey" | "classic") => {
    storage.set(MODE_KEY, m);
    setPref(m);
    if (sp.get("mode")) { sp.delete("mode"); setSp(sp, { replace: true }); }
  };
  if (steps.isLoading) return <div className="mx-auto max-w-3xl space-y-4 p-6"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-72" /></div>;
  if (!steps.data) return <LessonSession unitId={unitId} />; // shows the load error with retry
  const can = journeyApplies(steps.data.unit.kind, steps.data.steps);
  if (pref === "journey" && can) {
    return <JourneySession unitId={unitId} data={steps.data} lesson={lesson.data} onClassic={() => choose("classic")} />;
  }
  return <LessonSession unitId={unitId} onJourney={can ? () => choose("journey") : undefined} />;
}

function LessonSession({ unitId, onJourney }: { unitId: string; onJourney?: () => void }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { focusMode, setFocusMode } = useUI();
  const steps = useQuery({ queryKey: ["steps", unitId], queryFn: () => api.steps(unitId), staleTime: Infinity, gcTime: 0 });
  const lesson = useQuery({ queryKey: ["lesson", unitId], queryFn: () => api.lesson(unitId) });
  useAIStatus();
  const ps = usePlayerState(unitId, steps.data);
  useHeartbeat(steps.data ? unitId : undefined);

  const [outline, setOutline] = useState(false);
  const [notes, setNotes] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const tutorTrigger = useRef<HTMLButtonElement>(null);
  const closeTutor = useCallback(() => { setTutorOpen(false); tutorTrigger.current?.focus(); }, []);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [done, setDone] = useState<CompleteResult | null>(null);
  const [submittingExam, setSubmittingExam] = useState(false);
  const primary = useRef<(() => void) | null>(null);
  const [primaryLabel, setPrimaryLabel] = useState<string | null>(null);
  const registerPrimary = useCallback((fn: (() => void) | null, label?: string) => {
    primary.current = fn;
    setPrimaryLabel(fn ? label ?? "Kiểm tra" : null);
  }, []);

  const data = steps.data;
  const unit = data?.unit;
  const isExam = unit?.kind === "exam" && (data?.steps.some((s) => s.type === "quiz" && s.defer) ?? false);
  const allSteps: (Step | { id: "submit"; type: "submit"; title: string })[] = useMemo(() => {
    if (!data) return [];
    return isExam ? [...data.steps, { id: "submit", type: "submit", title: "Nộp bài và xem kết quả" }] : data.steps;
  }, [data, isExam]);
  const total = allSteps.length;
  const step = allSteps[Math.min(ps.step, Math.max(0, total - 1))];
  const examSubmitted = !!ps.state.examSubmitted;
  const drafts = (ps.state.drafts ?? {}) as Record<string, Draft>;

  useEffect(() => {
    if (isExam && ps.ready && !ps.state.examStartedAt) ps.update((s) => ({ ...s, examStartedAt: Date.now() }));
  }, [isExam, ps]);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => { window.scrollTo({ top: 0 }); stopSpeaking(); }, [ps.step]);

  const go = useCallback((i: number) => {
    if (i < 0 || i >= total) return;
    ps.setStep(i);
  }, [ps, total]);

  const onXp = useCallback((xp: number, badges: string[]) => {
    if (xp) qc.invalidateQueries({ queryKey: ["dashboard"] });
    badges.forEach((b) => toast.success(`🏅 Huy hiệu mới: ${ACHIEVEMENT_TITLES[b] ?? b}`));
  }, [qc]);

  const finish = useCallback(async () => {
    if (!unit || completing) return;
    setCompleting(true);
    try {
      await api.saveProgress(unitId, (data?.steps.length ?? 1) - 1, ps.state);
      const r = await api.complete(unitId);
      setDone(r);
      onXp(r.xp_gained, []);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["path"] });
      qc.invalidateQueries({ queryKey: ["lessons"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không hoàn thành được bài");
    } finally {
      setCompleting(false);
    }
  }, [unit, completing, unitId, data, ps.state, onXp, qc]);

  const submitExam = useCallback(async () => {
    if (!data || submittingExam) return;
    setSubmittingExam(true);
    try {
      const all: Record<string, ItemResult> = {};
      for (const s of data.steps) {
        if (s.type !== "quiz" || !s.items) continue;
        const answers: Record<string, string> = {};
        for (const it of s.items) {
          if (ps.results[it.id]) continue;
          const d = drafts[it.id];
          if (isAnswered(it, d)) answers[it.id] = toResponse(it, d);
          else if (["mc", "tfng", "choice"].includes(it.kind)) answers[it.id] = "";
        }
        if (Object.keys(answers).length) {
          const r = await api.submitQuiz(s.quiz_id!, answers);
          Object.assign(all, r.results);
          onXp(r.xp_gained, r.new_achievements);
        }
      }
      ps.setResults(all);
      ps.update((st) => ({ ...st, examSubmitted: true }));
      toast.success("Đã nộp bài. Xem kết quả bên dưới, rồi mở lại từng phần để xem giải thích.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không nộp được bài");
    } finally {
      setSubmittingExam(false);
    }
  }, [data, submittingExam, ps, drafts, onXp]);

  // Keyboard: ← / → navigate (not while typing), Enter = primary action, Esc = leave focus mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t.isContentEditable;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "Escape" && tutorOpen) { closeTutor(); return; }
      if (t.closest("#lesson-tutor")) return;
      if (e.key === "Escape" && focusMode) setFocusMode(false);
      if (typing || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(ps.step + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(ps.step - 1); }
      if (e.key === "Enter" && !(t instanceof HTMLButtonElement) && !(t instanceof HTMLAnchorElement)) {
        e.preventDefault();
        if (primary.current) primary.current();
        else if (ps.step < total - 1) go(ps.step + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, ps.step, total, focusMode, setFocusMode, tutorOpen, closeTutor]);

  if (steps.isLoading || !ps.ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-6 w-48" /><Skeleton className="h-3 w-full" /><Skeleton className="h-72" />
      </div>
    );
  }
  if (steps.error || !data || !unit || !step) {
    return <div className="mx-auto max-w-3xl p-6"><ErrorBox error={steps.error ?? "Không tải được bài học"} onRetry={() => steps.refetch()} /><Link to="/" className="mt-4 inline-block text-primary underline">Về Dashboard</Link></div>;
  }

  const isLast = ps.step === total - 1;
  const pct = total > 1 ? (ps.step / (total - 1)) * 100 : 100;
  const lastItemId = Object.values(ps.results).sort((a, b) => b.attempt_id - a.attempt_id)[0]?.item_id;

  return (
    <div className={cn("min-h-screen bg-bg transition-[padding] duration-200 motion-reduce:transition-none", tutorOpen && "md:pr-[22rem] xl:pr-[26rem]")}>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Thoát bài học"><X size={18} /></Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold sm:text-base">{unit.id} · {unit.title}</h1>
              {unit.level && <Badge tone="primary">{unit.level}</Badge>}
              <FocusBadge />
              <BlockTimerChip />
              {!focusMode && <Badge className="hidden sm:inline-flex">{KIND_LABELS[unit.kind]}</Badge>}
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <Progress value={pct} label="Tiến độ bài học" />
              <span className="shrink-0 text-xs tabular-nums text-muted">{ps.step + 1}/{total}</span>
              {isExam && ps.state.examStartedAt && !examSubmitted && <ExamClock since={ps.state.examStartedAt} />}
            </div>
          </div>
          <div className="flex items-center">
            {!focusMode && <Button variant="ghost" size="icon" onClick={() => setOutline(true)} aria-label="Danh sách slide" className={tutorOpen ? "2xl:hidden" : "lg:hidden"}><List size={18} /></Button>}
            {onJourney && <Button variant="ghost" size="sm" onClick={onJourney} aria-label="Chế độ hành trình" title="Chế độ hành trình: từng bước, có kiểm tra xen kẽ"><Route size={18} /><span className="hidden md:inline">Hành trình</span></Button>}
            <Button variant="ghost" size="icon" onClick={() => setNotes(true)} aria-label="Ghi chú"><NotebookPen size={18} /></Button>
            <Button ref={tutorTrigger} variant={tutorOpen ? "secondary" : "ghost"} size="sm" onClick={() => setTutorOpen((open) => !open)} aria-expanded={tutorOpen} aria-controls="lesson-tutor" aria-label="Hỏi AI về bài này" title="Ask AI / Giải thích với AI"><Bot size={18} /><span className={tutorOpen ? "hidden 2xl:inline" : "hidden md:inline"}>Hỏi AI</span></Button>
            <Button variant="ghost" size="sm" onClick={() => setPracticeOpen(true)} aria-label="Tạo bài tập với AI" title="Practice with AI / Tạo bài tập"><Sparkles size={18} /><span className={tutorOpen ? "hidden 2xl:inline" : "hidden md:inline"}>Tạo bài tập</span></Button>
            <Link to={`/reference?path=${encodeURIComponent(unit.path)}`} className="hidden rounded-xl p-2 text-muted hover:bg-surface-2 sm:block" aria-label="Xem toàn bộ bài (chế độ tra cứu)" title="Xem toàn bộ bài (chế độ tra cứu)"><BookOpenText size={18} /></Link>
            <Button variant={focusMode ? "secondary" : "ghost"} size="icon" onClick={() => setFocusMode(!focusMode)} aria-pressed={focusMode} aria-label="Chế độ tập trung" title="Chế độ tập trung (Esc để thoát)"><Focus size={18} /></Button>
            {!focusMode && <ThemeToggle />}
          </div>
        </div>
        {ps.saveError && (
          <div className="bg-warning-soft px-4 py-1 text-center text-xs text-warning">
            Chưa lưu được lên máy chủ — tiến độ đang được giữ trong trình duyệt. <button className="underline" onClick={() => ps.retrySave()}>Thử lại</button>
          </div>
        )}
      </header>

      <div className={cn("mx-auto flex max-w-6xl gap-6 px-3 sm:px-6", focusMode && "max-w-4xl")}>
        {!focusMode && (
          <aside className={cn("sticky top-20 hidden h-[calc(100vh-10rem)] w-64 shrink-0 overflow-y-auto py-6", tutorOpen ? "2xl:block" : "lg:block")} aria-label="Các slide">
            <Outline steps={allSteps} current={ps.step} onPick={go} results={ps.results} />
          </aside>
        )}
        <main className={cn("min-w-0 flex-1 pt-6", tutorOpen ? "pb-[calc(46dvh+6rem)] md:pb-28" : "pb-28")}>
          <AnimatePresence mode="wait">
            <motion.section key={step.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}
              aria-labelledby="slide-title">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{TYPE_LABEL[step.type] ?? step.type}{"section" in step && step.section ? ` · Mục ${step.section}` : ""}</p>
              <h2 id="slide-title" className="mb-5 mt-1 text-xl font-bold tracking-tight sm:text-2xl">{step.title}</h2>
              {step.type === "submit" ? (
                <ExamSubmit data={data.steps} drafts={drafts} results={ps.results} submitted={examSubmitted} busy={submittingExam} onSubmit={submitExam} onJump={go} />
              ) : (
                <SlideBody step={step as Step} unitId={unitId} docPath={unit.path} cards={data.cards}
                  drafts={drafts} setDraft={ps.setDraft} results={ps.results} setResults={ps.setResults} clearResult={ps.clearResult}
                  highlights={ps.state.highlights?.[step.id] ?? []} onHighlights={(h) => ps.update((s) => ({ ...s, highlights: { ...(s.highlights ?? {}), [step.id]: h } }))}
                  checklist={ps.state.checklist ?? {}} onChecklist={(c) => ps.update((s) => ({ ...s, checklist: c }))}
                  deferred={!!(step as Step).defer && isExam} examSubmitted={examSubmitted} registerPrimary={registerPrimary} onXp={onXp} />
              )}
            </motion.section>
          </AnimatePresence>
        </main>
      </div>

      <footer className={cn("fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur transition-[right] duration-200 motion-reduce:transition-none", tutorOpen && "bottom-[46dvh] md:bottom-0 md:right-[22rem] xl:right-[26rem]")}>
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-3 sm:px-6">
          <Button variant="outline" onClick={() => go(ps.step - 1)} disabled={ps.step === 0} aria-label="Slide trước (phím ←)"><ArrowLeft size={16} /><span className="hidden sm:inline">Trước</span></Button>
          <span className={cn("mx-auto hidden text-xs text-muted", tutorOpen ? "2xl:block" : "md:block")}>← → chuyển slide · Enter để kiểm tra / tiếp tục</span>
          {primaryLabel && (
            <Button variant="secondary" className={tutorOpen ? "ml-auto" : "ml-auto md:ml-0"} onClick={() => primary.current?.()}><CheckCircle2 size={16} />{primaryLabel}</Button>
          )}
          {isLast ? (
            <Button variant="success" onClick={finish} disabled={completing || (isExam && !examSubmitted)} className={primaryLabel ? "" : tutorOpen ? "ml-auto" : "ml-auto md:ml-0"}>
              <Flag size={16} />{completing ? "Đang lưu…" : unit.status === "completed" ? "Hoàn thành lại" : "Hoàn thành bài học"}
            </Button>
          ) : (
            <Button onClick={() => go(ps.step + 1)} className={primaryLabel ? "" : tutorOpen ? "ml-auto" : "ml-auto md:ml-0"} aria-label="Slide tiếp theo (phím →)">Tiếp<ArrowRight size={16} /></Button>
          )}
        </div>
      </footer>

      <Sheet open={outline} onOpenChange={setOutline} title="Các slide trong bài">
        <Outline steps={allSteps} current={ps.step} onPick={(i) => { go(i); setOutline(false); }} results={ps.results} />
      </Sheet>
      <Sheet open={notes} onOpenChange={setNotes} title="Ghi chú của tôi"><NotesPanel unitId={unitId} /></Sheet>
      {tutorOpen && (
        <aside id="lesson-tutor" aria-labelledby="lesson-tutor-title"
          className="fixed inset-x-0 bottom-0 z-30 flex h-[46dvh] min-h-0 flex-col border-t border-border bg-surface shadow-xl md:inset-x-auto md:right-0 md:top-0 md:h-dvh md:w-[22rem] md:border-l md:border-t-0 xl:w-[26rem]">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2"><Bot size={20} className="text-primary" /><h2 id="lesson-tutor-title" className="font-semibold">Gia sư AI</h2></div>
            <Button variant="ghost" size="icon" onClick={closeTutor} aria-label="Đóng gia sư AI"><X size={18} /></Button>
          </div>
          <div className="min-h-0 flex-1 p-3 sm:p-4">
            <TutorPanel unitId={unitId} stepIndex={Math.min(ps.step, data.steps.length - 1)} lastItemId={lastItemId} />
          </div>
        </aside>
      )}
      <Sheet open={practiceOpen} onOpenChange={setPracticeOpen} title={`Tạo bài tập với AI — ${unit.id}`}><GeneratorForm lessonId={unitId} compact onDone={() => setPracticeOpen(false)} /></Sheet>
      <CompletionDialog result={done} onClose={() => setDone(null)} nextId={lesson.data?.next_id ?? null} unitKind={unit.kind} />
    </div>
  );
}

function ExamClock({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.floor((now - since) / 1000);
  return <span className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted" aria-label="Thời gian làm bài"><Clock size={12} />{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>;
}

function Outline({ steps, current, onPick, results }: { steps: { id: string; type: string; title: string; items?: Step["items"] }[]; current: number; onPick: (i: number) => void; results: Record<string, ItemResult> }) {
  return (
    <ol className="space-y-0.5">
      {steps.map((s, i) => {
        const done = s.items?.length ? s.items.every((it) => results[it.id]) : false;
        return (
          <li key={s.id}>
            <button type="button" onClick={() => onPick(i)} aria-current={i === current ? "step" : undefined}
              className={cn("flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm", i === current ? "bg-primary-soft font-medium text-primary" : "text-muted hover:bg-surface-2 hover:text-fg")}>
              <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate" title={s.title}>{s.title.includes(" — ") ? s.title.split(" — ").slice(1).join(" — ") : s.title}</span>
              {done && <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" aria-label="Đã làm" />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

interface BodyProps {
  step: Step; unitId: string; docPath: string; cards: Record<string, import("@/types/content").Card>;
  drafts: Record<string, Draft>; setDraft: (id: string, d: Draft) => void; results: Record<string, ItemResult>;
  setResults: (r: Record<string, ItemResult>) => void; clearResult: (id: string) => void;
  highlights: string[]; onHighlights: (h: string[]) => void; checklist: Record<string, boolean>; onChecklist: (c: Record<string, boolean>) => void;
  deferred: boolean; examSubmitted: boolean; registerPrimary: (fn: (() => void) | null, label?: string) => void; onXp: (xp: number, b: string[]) => void;
}

function SlideBody(p: BodyProps) {
  const { step, docPath } = p;
  switch (step.type) {
    case "formula": return <FormulaSlide step={step} docPath={docPath} />;
    case "examples": return <ExamplesSlide step={step} docPath={docPath} />;
    case "mistakes": return <MistakesSlide step={step} docPath={docPath} />;
    case "dialogue": return <DialogueSlide step={step} docPath={docPath} />;
    case "passage": return <PassageSlide step={step} docPath={docPath} />;
    case "recap": return <RecapSlide step={step} docPath={docPath} checked={p.checklist} onChecked={p.onChecklist} />;
    case "vocab": return <VocabSlide step={step} cards={p.cards} />;
    case "flashcards": return <FlashcardsSlide step={step} cards={p.cards} />;
    case "quiz":
      return <QuizSlide step={step} unitId={p.unitId} docPath={docPath} drafts={p.drafts} setDraft={p.setDraft} results={p.results}
        setResults={p.setResults} clearResult={p.clearResult} highlights={p.highlights} onHighlights={p.onHighlights}
        deferred={p.deferred} examSubmitted={p.examSubmitted} registerPrimary={p.registerPrimary} onXp={p.onXp} />;
    default:
      return <ConceptSlide step={step} docPath={docPath} />;
  }
}

function ExamSubmit({ data, drafts, results, submitted, busy, onSubmit, onJump }: {
  data: Step[]; drafts: Record<string, Draft>; results: Record<string, ItemResult>; submitted: boolean; busy: boolean; onSubmit: () => void; onJump: (i: number) => void;
}) {
  const sections = data.map((s, i) => ({ s, i })).filter(({ s }) => s.type === "quiz" && s.items?.length);
  const items = sections.flatMap(({ s }) => s.items!);
  const answered = items.filter((it) => results[it.id] || isAnswered(it, drafts[it.id])).length;
  const auto = items.filter((it) => results[it.id]?.auto);
  const correct = auto.filter((it) => results[it.id].verdict === "correct").length;
  const open = items.filter((it) => results[it.id] && !results[it.id].auto);
  return (
    <div className="space-y-4">
      {!submitted ? (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p>Bạn đã trả lời <b>{answered}/{items.length}</b> câu. Câu trắc nghiệm bỏ trống sẽ tính là sai.</p>
          <Button className="mt-4" onClick={onSubmit} disabled={busy}><Flag size={16} />{busy ? "Đang chấm…" : "Nộp toàn bài"}</Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-success/40 bg-success-soft p-5">
          <p className="text-lg font-semibold">Kết quả phần tự chấm: {correct}/{auto.length}</p>
          <p className="mt-1 text-sm">Còn {open.length} câu viết/nói/trả lời mở cần bạn so sánh với đáp án và tự đánh giá. Đây là đề tự luyện của giáo trình, không phải điểm thi chính thức.</p>
        </div>
      )}
      <ul className="space-y-2">
        {sections.map(({ s, i }) => {
          const its = s.items!;
          const a = its.filter((it) => results[it.id]?.auto);
          const c = a.filter((it) => results[it.id].verdict === "correct").length;
          const ans = its.filter((it) => results[it.id] || isAnswered(it, drafts[it.id])).length;
          return (
            <li key={s.id}>
              <button type="button" onClick={() => onJump(i)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm hover:border-primary">
                <span className="min-w-0 flex-1 truncate" title={s.title}>{s.title.includes(" — ") ? s.title.split(" — ").slice(1).join(" — ") : s.title}</span>
                <span className="text-muted">{submitted ? (a.length ? `${c}/${a.length} đúng` : "tự đánh giá") : `${ans}/${its.length} đã làm`}</span>
                <ChevronLeft size={14} className="rotate-180 text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CompletionDialog({ result, onClose, nextId, unitKind }: { result: CompleteResult | null; onClose: () => void; nextId: string | null; unitKind: string }) {
  const nav = useNavigate();
  if (!result) return null;
  const passed = result.status === "completed";
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={result.level_completed ? `🎉 Hoàn thành cấp ${result.level_completed}!` : passed ? "Hoàn thành bài học!" : "Đã lưu — nên ôn lại bài này"}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary"><Trophy size={30} /></div>
        {result.score !== null ? (
          <p className="text-3xl font-bold">{Math.round(result.score)}%</p>
        ) : <p className="text-muted">Bài này không có câu chấm điểm.</p>}
        {result.graded > 0 && <p className="text-sm text-muted">{result.correct}/{result.graded} câu đúng (tự chấm + tự đánh giá). Mốc đạt: {result.pass_score}%.</p>}
        {result.xp_gained > 0 && <p className="font-semibold text-success">+{result.xp_gained} XP</p>}
        {result.new_achievements.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">{result.new_achievements.map((a) => <Badge key={a} tone="warning">🏅 {ACHIEVEMENT_TITLES[a] ?? a}</Badge>)}</div>
        )}
        {!passed && <p className="text-sm">Ôn lại các câu sai trong trang <Link className="text-primary underline" to="/review">Ôn tập</Link> rồi học lại bài.</p>}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button variant="outline" onClick={() => nav("/")}>Về Dashboard</Button>
          {nextId && <Button onClick={() => { onClose(); nav(`/learn/${nextId}`); }}>{unitKind === "grammar" ? "Bài tiếp theo" : "Học tiếp"}<ArrowRight size={16} /></Button>}
        </div>
      </motion.div>
    </Dialog>
  );
}
