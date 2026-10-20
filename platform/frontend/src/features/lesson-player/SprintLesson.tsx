import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight, BookOpenText, Flame, Rocket, Timer, Trophy, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCelebrate } from "@/components/Celebrate";
import { cn } from "@/lib/utils";
import { lessonExitPath } from "@/lib/lessonExit";
import { api, type GrammarSprint, type SprintUnit } from "@/services/api";
import type { LessonDetail, Step, StepsPayload } from "@/types/content";
import { ConceptSlide, FormulaSlide, MistakesSlide } from "./slides";
import { TestOut, type TestOutResult } from "./TestOut";
import { dailyTarget, getCombo, loadPlan, setCombo } from "./sprintPlan";

const TARGET_SECONDS = 8 * 60;

/** The next lesson to sprint: the first one still to do after this lesson in route order (then any earlier one). */
export function nextAfter(units: SprintUnit[], id: string): SprintUnit | null {
  const i = units.findIndex((u) => u.id === id);
  return units.slice(i + 1).find((u) => u.status === "todo") ?? units.slice(0, Math.max(0, i)).find((u) => u.status === "todo") ?? null;
}

/** The core of a grammar lesson on one wide screen: form, short summary, common mistakes, memory tip. */
export function coreSteps(steps: Step[]) {
  const form = steps.filter((s) => s.type === "formula" || s.type === "comparison");
  const full = steps.find((s) => s.type === "recap") ?? null;
  // only the key points: the review schedule and links at the end of a recap are not for a sprint
  const recap = full ? { ...full, md: (full.md ?? "").split(/\n#{1,4}\s*(?:Lịch ôn|Liên kết|Links?\b|Review schedule)/i)[0].trim() } : null;
  const mistakes = steps.find((s) => s.type === "mistakes") ?? null;
  const tip = steps.find((s) => s.type === "concept" && /mẹo|tip/i.test(s.title)) ?? null;
  const fallback = form.length ? [] : steps.filter((s) => s.type === "concept").slice(1, 3);
  return { form: form.length ? form : fallback, recap, mistakes, tip };
}

function Clock({ start }: { start: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.floor((now - start) / 1000);
  const tone = s < TARGET_SECONDS * 0.75 ? "text-success" : s < TARGET_SECONDS ? "text-warning" : "text-danger";
  return <span className={cn("inline-flex items-center gap-1 font-mono text-sm tabular-nums", tone)} title="Mục tiêu khoảng 8 phút mỗi bài">
    <Timer size={14} />{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</span>;
}

export function SprintLesson({ unitId, data, lesson }: { unitId: string; data: StepsPayload; lesson?: LessonDetail & { next_id?: string | null } }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const fire = useCelebrate((s) => s.fire);
  const sprint = useQuery({ queryKey: ["grammar-sprint"], queryFn: api.grammarSprint, refetchOnMount: "always" });
  const [phase, setPhase] = useState<"core" | "check" | "result">("core");
  const [result, setResult] = useState<TestOutResult | null>(null);
  const [start] = useState(Date.now());
  const [combo, setComboState] = useState(getCombo());
  const core = useMemo(() => coreSteps(data.steps), [data.steps]);
  const s = sprint.data;
  const next = s ? nextAfter(s.units, unitId) : null;
  const day = s ? dailyTarget(loadPlan(), s.remaining, s.today) : null;
  const goNext = () => nav(next ? `/learn/${next.id}?mode=sprint` : "/grammar-sprint");

  const finished = (r: TestOutResult) => {
    setResult(r);
    setPhase("result");
    const c = r.passed ? combo + 1 : 0;
    setCombo(c);
    setComboState(c);
    qc.invalidateQueries({ queryKey: ["grammar-sprint"] });
    qc.invalidateQueries({ queryKey: ["day-plan"] });
    if (r.passed) fire(c >= 3 ? `🔥 ${c} bài liên tiếp!` : `Qua bài ${unitId}! ⚡`);
  };
  // Enter: core → check, result → next lesson (the check screen handles its own keys)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (phase === "core") { e.preventDefault(); setPhase("check"); }
      else if (phase === "result") { e.preventDefault(); goNext(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-8">
          <Button variant="ghost" size="icon" onClick={() => nav(lessonExitPath())} aria-label="Thoát bài học"><X size={18} /></Button>
          <Badge tone="primary"><Zap size={12} />Sprint ngữ pháp</Badge>
          <h1 className="min-w-0 truncate font-semibold">{data.unit.id} · {data.unit.title}</h1>
          <Badge>{data.unit.level}</Badge>
          <span className="ml-auto flex flex-wrap items-center gap-3 text-sm">
            <Clock start={start} />
            {combo > 0 && <span className="inline-flex items-center gap-1 font-semibold text-warning" title="Số bài qua liên tiếp"><Flame size={15} />{combo}</span>}
            {s && day && <span className="tabular-nums text-muted" title="Bài ngữ pháp đã qua hôm nay / mục tiêu hôm nay">Hôm nay <b className="text-fg">{s.today}</b>/{day.target}</span>}
            {s && <span className="hidden tabular-nums text-muted md:inline">Tổng {s.done}/{s.total}</span>}
          </span>
        </div>
        {s && <Progress className="h-1 rounded-none" value={(100 * s.done) / s.total} label={`Đã qua ${s.done}/${s.total} bài ngữ pháp`} />}
      </header>

      <main className="lesson-big mx-auto max-w-[90rem] px-4 pb-16 pt-6 sm:px-8">
        <ol className="mb-5 flex flex-wrap gap-2 text-sm" aria-label="Các bước">
          {[["core", "1 · Nắm cốt lõi (≈3 phút)"], ["check", "2 · Kiểm tra 6 câu"], ["result", "3 · Qua bài"]].map(([k, t]) => (
            <li key={k} className={cn("rounded-full border px-3 py-1", phase === k ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border text-muted")}>{t}</li>
          ))}
        </ol>

        {phase === "core" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <section className="rounded-3xl border border-border bg-surface p-5 text-[16px] sm:p-6 xl:text-[17px]" aria-label="Công thức">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">📐 Công thức</p>
                <div className="space-y-6">
                  {core.form.map((st) => (
                    <div key={st.id}>
                      <h2 className="mb-2 text-lg font-bold">{st.title}</h2>
                      {st.type === "formula" ? <FormulaSlide step={st} docPath={data.unit.path} /> : <ConceptSlide step={st} docPath={data.unit.path} />}
                    </div>
                  ))}
                </div>
              </section>
              <div className="space-y-5">
                {core.recap && (
                  <section className="rounded-3xl border border-primary/30 bg-primary-soft/30 p-5 text-[16px] sm:p-6 xl:text-[17px]" aria-label="Tóm tắt">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">⚡ Tóm tắt</p>
                    <ConceptSlide step={core.recap} docPath={data.unit.path} />
                  </section>
                )}
                {core.mistakes && (
                  <section className="rounded-3xl border border-warning/40 bg-warning-soft/30 p-5 text-[16px] sm:p-6" aria-label="Lỗi hay gặp">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warning">⚠️ Lỗi hay gặp</p>
                    <MistakesSlide step={core.mistakes} docPath={data.unit.path} />
                  </section>
                )}
                {core.tip && (
                  <section className="rounded-3xl border border-border bg-surface p-5 text-[16px] sm:p-6" aria-label="Mẹo ghi nhớ">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">💡 {core.tip.title}</p>
                    <ConceptSlide step={core.tip} docPath={data.unit.path} />
                  </section>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => setPhase("check")}><Rocket size={18} />Đã nắm — kiểm tra 6 câu <kbd className="ml-1 text-xs opacity-70">Enter</kbd></Button>
              <Link to={`/learn/${unitId}?mode=journey`}><Button size="lg" variant="outline"><BookOpenText size={18} />Học đầy đủ bài này</Button></Link>
              {next && <button type="button" onClick={goNext} className="text-sm text-muted underline-offset-2 hover:underline">Bỏ qua, sang {next.id}</button>}
            </div>
          </motion.div>
        )}

        {phase === "check" && (
          <div className="mx-auto max-w-3xl">
            <TestOut unitId={unitId} data={data} nextId={lesson?.next_id ?? null} size={6} onFinished={finished}
              onStudy={() => nav(`/learn/${unitId}?mode=journey`)} />
          </div>
        )}

        {phase === "result" && result && (
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto max-w-2xl space-y-5 text-center" data-testid="sprint-result">
            {result.passed ? <Trophy className="mx-auto text-warning" size={52} /> : <BookOpenText className="mx-auto text-primary" size={52} />}
            <p className="text-3xl font-bold">{result.passed ? "Qua bài!" : "Chưa qua — đánh dấu “cần học kỹ”"}</p>
            <p className="text-lg">Đúng <b>{result.correct}/{result.total}</b> câu ngay lần đầu (cần {result.pass_mark}).
              {result.passed && result.xp_gained ? <span className="ml-2 font-semibold text-success">+{result.xp_gained} XP</span> : null}</p>
            {combo >= 2 && <p className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-3 py-1 text-warning"><Flame size={16} />{combo} bài qua liên tiếp</p>}
            {s && day && <DayProgress s={s} target={day.target} dayN={day.dayN} />}
            {!result.passed && <p className="text-sm text-muted">Không sao — bài này nằm trong danh sách “cần học kỹ” ở trang Sprint. Đi tiếp để giữ nhịp, quay lại học đầy đủ sau.</p>}
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="lg" onClick={goNext}>{next ? <>Bài tiếp: {next.id}<ArrowRight size={18} /></> : "Về trang Sprint"} <kbd className="ml-1 text-xs opacity-70">Enter</kbd></Button>
              {!result.passed && <Link to={`/learn/${unitId}?mode=journey`}><Button size="lg" variant="outline">Học kỹ bài này ngay</Button></Link>}
            </div>
            {next && <p className="text-sm text-muted">Tiếp theo: {next.title} ({next.level})</p>}
          </motion.div>
        )}
      </main>
    </div>
  );
}

function DayProgress({ s, target, dayN }: { s: GrammarSprint; target: number; dayN: number }) {
  const pct = Math.min(100, (100 * s.today) / Math.max(1, target));
  return (
    <div className="mx-auto max-w-md space-y-1 text-left text-sm">
      <div className="flex justify-between"><span>Ngày {dayN} · hôm nay {s.today}/{target} bài</span><span className="text-muted">còn {s.remaining} bài</span></div>
      <Progress value={pct} label={`Hôm nay ${s.today}/${target} bài`} />
      {s.today >= target && <p className="font-semibold text-success">Đạt mục tiêu hôm nay 🎯 — làm thêm là vượt kế hoạch.</p>}
    </div>
  );
}
