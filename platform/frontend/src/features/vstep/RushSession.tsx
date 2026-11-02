import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check, RotateCcw, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/misc";
import { SpeakButton } from "@/components/SpeakButton";
import { cn } from "@/lib/utils";
import { lessonExitPath } from "@/lib/lessonExit";
import { formMatches, PATTERNS, type Verb } from "./verbs";
import {
  addSeconds, BATCH, DECK_ITEMS, DECK_TITLE, distractors, grade, loadRush, masteredCount, PHRASE_BY_ID, phraseMatches,
  sessionItems, VERB_BY_ID, verbLine,
} from "./store";

type Task =
  | { t: "learn"; id: string }
  | { t: "learnVerbs"; ids: string[] }
  | { t: "pick"; id: string; options: string[] }
  | { t: "recall"; id: string; retry: number }
  | { t: "verb"; id: string; retry: number };

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey;

/** Keys while a task shows; attached before paint so a key pressed right away is not lost. */
function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useLayoutEffect(() => {
    const k = (e: KeyboardEvent) => { if (!typing(e)) ref.current(e); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
}

/** A batch: new or weak items are read first (aloud), then recognised (phrases), then recalled from memory. */
function batchTasks(ids: string[], review: boolean): Task[] {
  const s = loadRush();
  const verbs = ids.filter((id) => VERB_BY_ID[id]);
  const phrases = ids.filter((id) => PHRASE_BY_ID[id]);
  const fresh = (id: string) => !review && (s.items[id]?.box ?? 0) === 0;
  const tasks: Task[] = [];
  if (verbs.some(fresh)) tasks.push({ t: "learnVerbs", ids: verbs.filter(fresh) });
  for (const id of phrases.filter(fresh)) tasks.push({ t: "learn", id });
  for (const id of shuffle(phrases.filter((id) => (s.items[id]?.box ?? 0) === 0))) tasks.push({ t: "pick", id, options: distractors(id) });
  for (const id of shuffle(ids)) tasks.push(VERB_BY_ID[id] ? { t: "verb", id, retry: 0 } : { t: "recall", id, retry: 0 });
  return tasks;
}

export default function RushSession() {
  const { deckId = "" } = useParams();
  const [round, setRound] = useState(0);
  return <Session key={`${deckId}:${round}`} deckId={deckId} onAgain={() => setRound((r) => r + 1)} />;
}

function Session({ deckId, onAgain }: { deckId: string; onAgain: () => void }) {
  const nav = useNavigate();
  const review = deckId === "review" || deckId === "mixed";
  const [ids] = useState(() => sessionItems(loadRush(), deckId));
  const batches = Array.from({ length: Math.ceil(ids.length / BATCH) }, (_, i) => ids.slice(i * BATCH, i * BATCH + BATCH));
  const [b, setB] = useState(0);
  const [tasks, setTasks] = useState<Task[]>(() => batchTasks(batches[0] ?? [], review));
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [today, setToday] = useState(() => loadRush().seconds[new Date().toLocaleDateString("sv-SE")] ?? 0);
  // study time: counted while the page is visible
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const s = addSeconds(15);
      setToday(s.seconds[new Date().toLocaleDateString("sv-SE")] ?? 0);
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  const done = pos >= tasks.length && b + 1 >= batches.length;
  const task = tasks[pos];
  const next = () => {
    if (pos + 1 < tasks.length) return setPos(pos + 1);
    if (b + 1 < batches.length) {
      setB(b + 1);
      setTasks(batchTasks(batches[b + 1], review));
      setPos(0);
    } else setPos(tasks.length);
  };
  const graded = (id: string, correct: boolean, retry?: Task) => {
    grade(id, correct);
    setScore((x) => (correct ? { ...x, right: x.right + 1 } : { ...x, wrong: x.wrong + 1 }));
    if (!correct && retry) setTasks((t) => [...t, retry]); // asked again at the end of this batch
  };
  const deckIds = DECK_ITEMS[deckId] ?? ids;
  const exit = () => nav(lessonExitPath() === "/path" ? "/vstep-rush" : lessonExitPath());

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2.5">
          <Button variant="ghost" size="icon" onClick={exit} aria-label="Thoát"><X size={18} /></Button>
          <Badge tone="primary">VSTEP B2 cấp tốc</Badge>
          <h1 className="min-w-0 truncate font-semibold">{DECK_TITLE[deckId] ?? deckId}</h1>
          <span className="ml-auto flex items-center gap-3 text-sm text-muted">
            {!done && batches.length > 0 && <span>Lô {b + 1}/{batches.length}</span>}
            <span className="tabular-nums" title="Đã học hôm nay"><Timer size={14} className="mr-1 inline" />{Math.floor(today / 3600)}h{String(Math.floor((today % 3600) / 60)).padStart(2, "0")}</span>
            <span className="tabular-nums" title="Đã thuộc trong bộ này">✓ {masteredCount(loadRush(), deckIds)}/{deckIds.length}</span>
          </span>
        </div>
        <Progress className="h-1 rounded-none" value={done ? 100 : (100 * pos) / Math.max(1, tasks.length)} label="Tiến độ lô" />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        {ids.length === 0 ? (
          <div className="space-y-3 text-center">
            <p className="text-xl font-semibold">{deckId === "review" ? "Không còn từ nào sai — tuyệt!" : "Chưa có gì để ôn ở đây."}</p>
            <Link to="/vstep-rush"><Button>Về kế hoạch</Button></Link>
          </div>
        ) : done ? (
          <div className="space-y-4 text-center" data-testid="rush-done">
            <p className="text-3xl font-bold">Xong lượt này 🎯</p>
            <p className="text-lg">Nhớ đúng <b>{score.right}</b> · cần ôn lại <b>{score.wrong}</b></p>
            <p className="text-muted">Bộ này đã thuộc {masteredCount(loadRush(), deckIds)}/{deckIds.length}. Mục sai sẽ được hỏi lại trước ở lượt sau.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="lg" onClick={onAgain}><RotateCcw size={18} />Học tiếp lượt nữa</Button>
              <Link to="/vstep-rush"><Button size="lg" variant="outline">Về kế hoạch</Button></Link>
            </div>
          </div>
        ) : task.t === "learn" ? <LearnCard key={pos} id={task.id} onNext={next} />
          : task.t === "learnVerbs" ? <VerbTable key={pos} ids={task.ids} onNext={next} />
            : task.t === "pick" ? <Pick key={pos} id={task.id} options={task.options} onNext={next}
              onResult={(ok) => { if (!ok) graded(task.id, false); }} />
              : task.t === "recall" ? <Recall key={pos} id={task.id} onNext={next}
                onResult={(ok) => graded(task.id, ok, task.retry < 2 ? { ...task, retry: task.retry + 1 } : undefined)} />
                : <VerbDrill key={pos} verb={VERB_BY_ID[task.id]} onNext={next}
                  onResult={(ok) => graded(task.id, ok, task.retry < 2 ? { ...task, retry: task.retry + 1 } : undefined)} />}
      </main>
    </div>
  );
}

function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">{label}</p>
      {children}
    </section>
  );
}

function NextButton({ onNext, label = "Tiếp" }: { onNext: () => void; label?: string }) {
  return <Button size="lg" onClick={onNext}>{label}<ArrowRight size={18} /><kbd className="ml-1 text-xs opacity-70">Enter</kbd></Button>;
}

function LearnCard({ id, onNext }: { id: string; onNext: () => void }) {
  const it = PHRASE_BY_ID[id];
  useKeys((e) => { if (e.key === "Enter") { e.preventDefault(); onNext(); } });
  return (
    <Step label="📖 Đọc to 1–2 lần, hình dung lúc dùng nó trong bài thi">
      <div className="rounded-3xl border border-primary/30 bg-primary-soft/30 p-6" data-testid="rush-learn">
        <p className="flex flex-wrap items-center gap-2 text-2xl font-bold sm:text-3xl">{it.en}<SpeakButton text={it.en.replace(/…/g, "")} /></p>
        <p className="mt-2 text-lg text-muted">{it.vi}</p>
        {it.ex && <p className="mt-4 flex items-start gap-2 text-[17px] italic">{it.ex}<SpeakButton text={it.ex} label="Nghe câu ví dụ" /></p>}
        {it.note && <p className="mt-3 text-sm text-warning">💡 {it.note}</p>}
      </div>
      <NextButton onNext={onNext} />
    </Step>
  );
}

function VerbTable({ ids, onNext }: { ids: string[]; onNext: () => void }) {
  const verbs = ids.map((id) => VERB_BY_ID[id]);
  const patterns = [...new Set(verbs.map((v) => v.pattern))];
  useKeys((e) => { if (e.key === "Enter") { e.preventDefault(); onNext(); } });
  return (
    <Step label="📖 Đọc to từng dòng: gốc – quá khứ – quá khứ phân từ">
      {patterns.map((p) => <p key={p} className="rounded-2xl bg-primary-soft/40 px-4 py-2 text-sm"><b>{PATTERNS[p].title}</b> · {PATTERNS[p].hint}</p>)}
      <div className="overflow-x-auto rounded-2xl border border-border" data-testid="rush-verbs">
        <table className="w-full text-left text-[17px]">
          <thead className="bg-surface-2 text-sm text-muted"><tr><th className="px-3 py-2">Gốc</th><th className="px-3 py-2">Quá khứ</th><th className="px-3 py-2">Quá khứ phân từ</th><th className="px-3 py-2">Nghĩa</th><th /></tr></thead>
          <tbody>
            {verbs.map((v) => (
              <tr key={v.base} className="border-t border-border">
                <td className="px-3 py-2 font-semibold">{v.base}</td><td className="px-3 py-2">{v.past}</td><td className="px-3 py-2">{v.pp}</td>
                <td className="px-3 py-2 text-muted">{v.vi}{v.note && <span className="block text-xs text-warning">{v.note}</span>}</td>
                <td className="px-2"><SpeakButton text={`${v.base}, ${v.past.replace("/", ", ")}, ${v.pp.replace("/", ", ")}`} label={`Nghe ${v.base}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NextButton onNext={onNext} label="Đã đọc — luyện gõ" />
    </Step>
  );
}

function Pick({ id, options, onResult, onNext }: { id: string; options: string[]; onResult: (ok: boolean) => void; onNext: () => void }) {
  const it = PHRASE_BY_ID[id];
  const [chosen, setChosen] = useState<string | null>(null);
  const choose = (o: string) => { if (chosen) return; setChosen(o); onResult(o === id); };
  useKeys((e) => {
    if (chosen && e.key === "Enter") { e.preventDefault(); onNext(); }
    else if (!chosen && /^[1-4]$/.test(e.key)) { e.preventDefault(); choose(options[Number(e.key) - 1]); }
  });
  return (
    <Step label="🎯 Chọn câu tiếng Anh đúng nghĩa · phím 1–4">
      <p className="text-2xl font-semibold" data-testid="rush-pick">{it.vi}</p>
      <div className="grid gap-2">
        {options.map((o, i) => {
          const right = chosen && o === id;
          const wrong = chosen === o && o !== id;
          return (
            <button key={o} type="button" onClick={() => choose(o)} disabled={!!chosen}
              className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-[17px] transition", !chosen && "hover:border-primary/60 hover:bg-surface-2",
                right ? "border-success bg-success-soft" : wrong ? "border-danger bg-danger-soft" : "border-border")}>
              <span className="grid h-6 min-w-6 place-items-center rounded-md bg-surface-2 text-xs font-bold text-muted">{i + 1}</span>{PHRASE_BY_ID[o].en}
            </button>
          );
        })}
      </div>
      {chosen && <>{it.ex && <p className="italic text-muted">{it.ex}</p>}<NextButton onNext={onNext} /></>}
    </Step>
  );
}

function Recall({ id, onResult, onNext }: { id: string; onResult: (ok: boolean) => void; onNext: () => void }) {
  const it = PHRASE_BY_ID[id];
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const settle = (ok: boolean) => { if (verdict !== null) return; setVerdict(ok); onResult(ok); };
  const reveal = () => {
    setShown(true);
    input.current?.blur();
    if (phraseMatches(text, it.en)) settle(true);
  };
  useKeys((e) => {
    if (!shown) { if (e.key === "Enter") { e.preventDefault(); reveal(); } return; }
    if (verdict === null) {
      if (e.key === "1") { e.preventDefault(); settle(true); } else if (e.key === "2") { e.preventDefault(); settle(false); }
    } else if (e.key === "Enter") { e.preventDefault(); onNext(); }
  });
  return (
    <Step label="✍️ Nhớ lại không nhìn: nói to hoặc gõ câu tiếng Anh">
      <p className="text-2xl font-semibold" data-testid="rush-recall">{it.vi}</p>
      <Input ref={input} autoFocus value={text} disabled={shown} onChange={(e) => setText(e.target.value)} placeholder="Gõ (không bắt buộc), rồi Enter để xem đáp án"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); reveal(); } }} aria-label="Câu tiếng Anh" />
      {!shown && <Button variant="outline" onClick={reveal}>Xem đáp án <kbd className="ml-1 text-xs opacity-70">Enter</kbd></Button>}
      {shown && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex flex-wrap items-center gap-2 text-xl font-bold">{it.en}<SpeakButton text={it.en.replace(/…/g, "")} /></p>
            {it.ex && <p className="mt-1 italic text-muted">{it.ex}</p>}
          </div>
          {verdict === null ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => settle(true)}><Check size={16} />Nhớ được <kbd className="ml-1 text-xs opacity-70">1</kbd></Button>
              <Button variant="outline" onClick={() => settle(false)}>Chưa nhớ <kbd className="ml-1 text-xs opacity-70">2</kbd></Button>
            </div>
          ) : (
            <>
              <p className={cn("font-medium", verdict ? "text-success" : "text-warning")}>{verdict ? "✓ Nhớ được" : "Sẽ hỏi lại ở cuối lô này"}</p>
              <NextButton onNext={onNext} />
            </>
          )}
        </div>
      )}
    </Step>
  );
}

function VerbDrill({ verb, onResult, onNext }: { verb: Verb; onResult: (ok: boolean) => void; onNext: () => void }) {
  const [past, setPast] = useState("");
  const [pp, setPp] = useState("");
  const [checked, setChecked] = useState(false);
  const ppRef = useRef<HTMLInputElement>(null);
  const okPast = formMatches(past, verb.past);
  const okPp = formMatches(pp, verb.pp);
  const check = () => {
    if (checked) return;
    setChecked(true);
    (document.activeElement as HTMLElement | null)?.blur();
    onResult(okPast && okPp);
  };
  useKeys((e) => { if (checked && e.key === "Enter") { e.preventDefault(); onNext(); } });
  const field = (ok: boolean) => checked && (ok ? "border-success bg-success-soft" : "border-danger bg-danger-soft");
  return (
    <Step label="✍️ Gõ quá khứ và quá khứ phân từ">
      <p className="text-3xl font-bold" data-testid="rush-verb">{verb.base} <span className="text-lg font-normal text-muted">· {verb.vi}</span></p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-muted">Quá khứ (V2)
          <Input autoFocus value={past} disabled={checked} onChange={(e) => setPast(e.target.value)} className={cn(field(okPast))} aria-label="Quá khứ"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ppRef.current?.focus(); } }} />
        </label>
        <label className="space-y-1 text-sm text-muted">Quá khứ phân từ (V3)
          <Input ref={ppRef} value={pp} disabled={checked} onChange={(e) => setPp(e.target.value)} className={cn(field(okPp))} aria-label="Quá khứ phân từ"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); check(); } }} />
        </label>
      </div>
      {!checked ? <Button onClick={check}>Kiểm tra <kbd className="ml-1 text-xs opacity-70">Enter</kbd></Button> : (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-xl">
            <span className={okPast && okPp ? "font-semibold text-success" : "font-semibold text-warning"}>{okPast && okPp ? "✓" : "✗"} {verbLine(verb)}</span>
            <SpeakButton text={`${verb.base}, ${verb.past.replace("/", ", ")}, ${verb.pp.replace("/", ", ")}`} />
          </p>
          <p className="text-sm text-muted">{PATTERNS[verb.pattern].title} · {PATTERNS[verb.pattern].hint}{verb.note ? ` · ${verb.note}` : ""}</p>
          {!(okPast && okPp) && <p className="text-sm text-warning">Sẽ hỏi lại ở cuối lô này.</p>}
          <NextButton onNext={onNext} />
        </div>
      )}
    </Step>
  );
}

