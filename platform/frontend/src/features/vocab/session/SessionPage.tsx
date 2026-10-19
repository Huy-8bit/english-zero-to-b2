import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock, Coffee, Flame, RotateCcw, Sparkles, Trophy, XCircle } from "lucide-react";
import { useCelebrate } from "@/components/Celebrate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { AIRequestError } from "@/services/ai";
import { VERDICT_LABELS, vocab, type AnswerResult, type Session, type SessionKind, type Summary } from "@/services/vocab";
import { Ipa, relDue } from "../components";
import { ItemView, typeLabel } from "./items";

const AI_DOWN = new Set(["ai_disabled", "ai_unavailable", "quota_exceeded", "budget_exceeded", "daily_limit", "rate_limited", "timeout", "network"]);

export default function SessionPage() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["vocab-session", id], queryFn: () => vocab.session(id), staleTime: Infinity });
  if (q.isLoading) return <Skeleton className="mx-auto h-96 max-w-3xl" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  return <Player key={q.data.id} initial={q.data} />;
}

function Player({ initial }: { initial: Session }) {
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const backTo = safeReturn(sp.get("return"));
  const [s, setS] = useState(initial);
  const [idx, setIdx] = useState(initial.cursor);
  const [busy, setBusy] = useState(false);
  const [aiDown, setAiDown] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(initial.summary);
  const started = useRef(Date.now());
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const [fatigue, setFatigue] = useState<string | null>(null);
  const history = useRef<{ ok: boolean; ms: number }[]>([]);
  const fire = useCelebrate((x) => x.fire);
  const it = s.items[idx];
  const result = it ? s.results[it.id] : undefined;
  const done = idx >= s.items.length;

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      setSummary(await vocab.finish(s.id));
      qc.invalidateQueries({ queryKey: ["vocab-overview"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không kết thúc được phiên học");
    } finally {
      setBusy(false);
    }
  }, [s.id, qc]);

  useEffect(() => {
    if (done && !summary && s.items.length) void finish();
  }, [done, summary, finish, s.items.length]);
  useEffect(() => { started.current = Date.now(); }, [idx]);

  const submit = useCallback(async (body: Record<string, unknown>) => {
    if (!it || busy || s.results[it.id]) return;
    setBusy(true);
    try {
      const r = await vocab.answer(s.id, { item_id: it.id, duration_ms: Date.now() - started.current, client_review_id: `${s.id}:${it.id}`, ...body });
      if (it.type !== "learn") {
        const ok = !!r.correct;
        comboRef.current = ok ? comboRef.current + 1 : 0;
        setCombo(comboRef.current);
        if (ok && comboRef.current % 5 === 0) fire(`${comboRef.current} câu đúng liên tiếp! 🔥`);
        history.current.push({ ok, ms: Date.now() - started.current });
        setFatigue(fatigueSignal(history.current));
      }
      let next = { ...s, results: { ...s.results, [it.id]: r } };
      if (r.retry_added) next = { ...(await vocab.session(s.id)), results: next.results };
      setS(next);
      qc.setQueryData(["vocab-session", s.id], next);
      if (it.type === "learn") setIdx((i) => i + 1);
    } catch (e) {
      if (e instanceof AIRequestError && AI_DOWN.has(e.code) && it.type === "use_it") {
        setAiDown(true);
        toast.info("AI chưa sẵn sàng — bạn có thể tự đánh giá câu của mình.");
      } else {
        toast.error(e instanceof Error ? e.message : "Không lưu được câu trả lời");
      }
    } finally {
      setBusy(false);
    }
  }, [it, busy, s, qc, fire]);

  const selfAssess = useCallback(async (ok: boolean) => {
    if (!it || busy) return;
    setBusy(true);
    try {
      const r = await vocab.answer(s.id, { item_id: it.id, self: ok ? "correct" : "wrong" });
      const next = { ...s, results: { ...s.results, [it.id]: r } };
      setS(next);
      qc.setQueryData(["vocab-session", s.id], next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }, [it, busy, s, qc]);

  useEffect(() => {
    if (!result || result.verdict === "mismatch") return; // a translation waiting for self-assessment
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setIdx((i) => i + 1); } };
    const t = setTimeout(() => window.addEventListener("keydown", k), 150);
    return () => { clearTimeout(t); window.removeEventListener("keydown", k); };
  }, [result]);

  if (!s.items.length) return <EmptySession kind={s.kind} />;
  if (summary) return <SummaryView s={s} summary={summary} backTo={backTo} />;
  if (done) return <Skeleton className="mx-auto h-96 max-w-3xl" />;
  const pct = Math.round((Object.keys(s.results).length / s.items.length) * 100);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {fatigue && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-2xl bg-warning-soft px-4 py-2 text-sm text-warning">
          <Coffee size={16} />{fatigue}
          <button className="ml-auto text-xs underline" onClick={() => setFatigue(null)}>Tiếp tục học</button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Link to={backTo} className="text-sm text-muted hover:text-fg">← Quay lại</Link>
        {combo >= 3 && <Badge tone="warning" aria-label={`${combo} câu đúng liên tiếp`}><Flame size={12} />{combo}</Badge>}
        <div className="flex-1"><Progress value={pct} label={`Tiến độ phiên học ${pct}%`} /></div>
        <span data-testid="session-pos" className="text-sm tabular-nums text-muted">{Math.min(idx + 1, s.items.length)}/{s.items.length}</span>
        {s.params.timed ? <Timer key={it.id} /> : null}
      </div>
      <Card>
        <CardContent className="space-y-6 pt-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge>{s.title_vi}</Badge><Badge tone="primary">{typeLabel[it.type]}</Badge>
            {it.round > 1 && <Badge tone="warning"><RotateCcw size={12} />Ôn lại từ vừa sai</Badge>}
            {!it.scheduled && it.type !== "learn" && <Badge>Luyện thêm — không đổi lịch ôn</Badge>}
          </div>
          <div data-testid={`item-${it.type}`}><ItemView key={it.id} it={it} sid={s.id} submit={submit} busy={busy || !!result} aiDown={aiDown} /></div>
          {result && <Feedback r={result} onNext={() => setIdx((i) => i + 1)} last={idx + 1 >= s.items.length} onSelf={selfAssess} busy={busy} />}
        </CardContent>
      </Card>
    </div>
  );
}

function Timer() {
  const [t, setT] = useState(10);
  useEffect(() => {
    const h = setInterval(() => setT((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(h);
  }, []);
  return <span className="inline-flex items-center gap-1 text-sm text-muted" title="Chỉ là nhịp gợi ý, không bị tính sai khi hết giờ"><Clock size={14} />{t}s</span>;
}

export function Feedback({ r, onNext, last, onSelf, busy }: { r: AnswerResult; onNext: () => void; last: boolean; onSelf?: (ok: boolean) => void; busy?: boolean }) {
  const ok = !!r.correct;
  const pending = r.verdict === "mismatch";
  const near = ["spelling", "wrong_form", "minor_issues", "hard", "self_partly"].includes(r.verdict);
  return (
    <div role="status" aria-live="polite" data-testid="feedback" className={`space-y-3 rounded-2xl border p-4 ${ok ? (near ? "border-warning/40 bg-warning-soft" : "border-success/40 bg-success-soft") : pending ? "border-warning/40 bg-warning-soft" : "border-danger/40 bg-danger-soft"}`}>
      <div className="flex flex-wrap items-center gap-2">
        {ok ? <CheckCircle2 className="text-success" size={20} /> : <XCircle className="text-danger" size={20} />}
        <span className="font-semibold">{VERDICT_LABELS[r.verdict] ?? r.verdict}</span>
        <Link to={`/vocabulary/word/${encodeURIComponent(r.entry_id)}`} className="font-semibold text-primary underline-offset-2 hover:underline">{r.entry.headword}</Link>
        <Ipa uk={r.entry.ipa_uk} us={r.entry.ipa_us} />
      </div>
      {r.type === "translate" && (
        <div className="space-y-1 text-sm">
          <p>Câu mẫu: <b>{r.expected}</b></p>
          {r.answer && r.verdict !== "correct" && <p className="text-muted">Bạn viết: {r.answer}</p>}
          {r.verdict === "wrong_order" && <p>Bạn dùng đúng các từ nhưng <b>sai trật tự</b> — tiếng Anh thường theo thứ tự Chủ ngữ → Động từ → Tân ngữ → Nơi chốn → Thời gian.</p>}
          {r.used_word === false && <p>Câu của bạn chưa dùng từ <b>{r.entry.headword}</b>.</p>}
          {pending && onSelf && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span>{r.ai_unavailable ? "AI chưa kiểm tra được. " : ""}So sánh với câu mẫu: câu của bạn có cùng ý và đúng ngữ pháp không?</span>
              <Button size="sm" variant="success" disabled={busy} onClick={() => onSelf(true)}>Câu của tôi cũng đúng</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onSelf(false)}>Tôi dịch chưa đúng</Button>
            </div>
          )}
        </div>
      )}
      {r.expected && !ok && r.type !== "flashcard" && r.type !== "translate" && <p className="text-sm">Đáp án: <b>{r.expected}</b>{typeof r.answer === "string" && r.answer && <> · bạn viết: <s>{r.answer}</s></>}</p>}
      {r.verdict === "spelling" && <p className="text-sm">Gần đúng — chú ý chính tả: <b>{r.expected}</b></p>}
      {r.verdict === "wrong_form" && <p className="text-sm">Đúng từ nhưng sai dạng. Dạng cần dùng: <b>{r.expected}</b>.</p>}
      {r.verdict === "wrong_meaning" && r.confused_meaning && <p className="text-sm">Từ bạn viết có nghĩa “{r.confused_meaning}”, khác với từ cần tìm.</p>}
      {r.full && <p className="text-sm"><i>{r.full}</i>{r.vi && <span className="block text-muted">{r.vi}</span>}</p>}
      {r.explain && (
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {r.explain.map((x) => <li key={x.word} className={x.correct ? "font-semibold" : "text-muted"}>{x.correct ? "✓" : "✗"} <b>{x.word}</b>{x.meaning_vi && <> = {x.meaning_vi}</>}</li>)}
        </ul>
      )}
      {r.note_vi && <p className="text-sm">{r.note_vi}</p>}
      {r.ai_explanation_vi && <p className="text-sm"><Sparkles size={14} className="mr-1 inline" />{r.ai_explanation_vi}</p>}
      {r.type === "use_it" && r.ai && (
        <div className="space-y-1 text-sm">
          <p>{r.explanation_vi}</p>
          {r.issues?.map((x, i) => <p key={i}>❌ {x.original} → ✅ <b>{x.correction}</b> — {x.explanation_vi}</p>)}
          {r.corrected_sentence && r.verdict !== "correct" && <p>Câu đã sửa: <i>{r.corrected_sentence}</i></p>}
          {r.better_example && <p className="text-muted">Thêm ví dụ: <i>{r.better_example}</i></p>}
        </div>
      )}
      {r.type === "use_it" && r.verdict === "missing_word" && <p className="text-sm">{r.explanation_vi}</p>}
      {r.schedule && <p className="text-xs text-muted">Lịch ôn tiếp: {relDue(r.schedule.due)} (FSRS · {VERDICT_LABELS[r.schedule.rating_name]})</p>}
      {r.retry_added && <p className="text-xs text-muted">Từ này sẽ được hỏi lại ở cuối phiên.</p>}
      <div className="text-right"><Button onClick={onNext} disabled={pending && !!onSelf}>{last ? "Xem tổng kết" : "Tiếp tục"} <ArrowRight size={16} /> <kbd className="text-xs opacity-70">Enter</kbd></Button></div>
    </div>
  );
}

function EmptySession({ kind }: { kind: string }) {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <Trophy className="mx-auto text-success" size={36} />
      <p className="mt-3 text-lg font-semibold">{kind === "review" ? "Không còn từ nào đến hạn ôn 🎉" : "Chưa có từ phù hợp cho chế độ này"}</p>
      <p className="mt-1 text-sm text-muted">Hãy học thêm từ mới hoặc chọn chủ đề khác.</p>
      <Link to="/vocabulary" className="mt-4 inline-block"><Button>Về trang Từ vựng</Button></Link>
    </Card>
  );
}

function SummaryView({ s, summary, backTo }: { s: Session; summary: Summary; backTo: string }) {
  const nav = useNavigate();
  const fire = useCelebrate((x) => x.fire);
  useEffect(() => {
    if (summary.answered >= 8 && summary.correct / summary.answered >= 0.85) fire(`Xuất sắc: ${summary.correct}/${summary.answered} câu đúng!`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const name = (eid: string) => summary.words.find((w) => w.entry_id === eid)?.lemma ?? eid;
  const start = async (kind: SessionKind) => {
    try {
      const ns = await vocab.start(kind);
      nav(`/vocabulary/session/${ns.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tạo được phiên học");
    }
  };
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader><CardTitle data-testid="summary-title">Tổng kết: {s.title_vi}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat n={summary.correct} of={summary.answered} label="Câu đúng" />
            <Stat n={summary.learned.length} label="Từ đã học (nhớ lại được)" />
            <Stat n={summary.recalled.length} label="Nhớ lại đúng" />
            <Stat n={summary.difficult.length} label="Còn khó" />
          </div>
          {summary.next_review && <p className="text-sm">Lần ôn tiếp theo gần nhất: <b>{relDue(summary.next_review)}</b> · {summary.scheduled} từ đã được xếp lịch (FSRS).</p>}
          {summary.difficult.length > 0 && (
            <div><p className="text-sm font-medium">Từ còn khó</p>
              <div className="mt-1 flex flex-wrap gap-1.5">{summary.difficult.map((e) => <Link key={e} to={`/vocabulary/word/${encodeURIComponent(e)}`}><Badge tone="warning">{name(e)}</Badge></Link>)}</div>
            </div>
          )}
          {summary.mistakes.length > 0 && (
            <div><p className="text-sm font-medium">Lỗi trong phiên</p>
              <ul className="mt-1 space-y-1 text-sm">{summary.mistakes.map((m, i) => (
                <li key={i}><b>{m.lemma}</b> · {typeLabel[m.type]} · {VERDICT_LABELS[m.verdict] ?? m.verdict}{m.expected ? <> — đáp án: <b>{String(m.expected)}</b></> : null}{m.answer !== undefined && m.answer !== "" && m.answer !== null ? <> (bạn: {String(m.answer)})</> : null}</li>
              ))}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {summary.suggestions.map((x) => <Button key={x.mode} variant="outline" onClick={() => start(x.mode as SessionKind)}>{x.label_vi}</Button>)}
            <Link to={backTo}><Button>{backTo === "/vocabulary" ? "Tiếp tục" : "Quay lại kế hoạch"} <ArrowRight size={16} /></Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ n, of, label }: { n: number; of?: number; label: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3 text-center">
      <p className="text-2xl font-bold tabular-nums">{n}{of !== undefined && <span className="text-base text-muted">/{of}</span>}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

/** Only same-app paths are allowed as a return target. */
function safeReturn(v: string | null): string {
  return v && /^\/(today|review|vocabulary|writing-daily)(\/|$|\?)/.test(v) ? v : "/vocabulary";
}

/**
 * Fatigue cue from the learner's own answers (no AI): after ≥ 12 answers, accuracy of the last 8 below 50 %, or answers
 * getting much slower than at the start of the session. Suggests a short break or a change of activity.
 */
export function fatigueSignal(h: { ok: boolean; ms: number }[]): string | null {
  if (h.length < 12) return null;
  const last = h.slice(-8);
  const acc = last.filter((x) => x.ok).length / last.length;
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const early = median(h.slice(0, 6).map((x) => x.ms));
  const late = median(h.slice(-6).map((x) => x.ms));
  if (acc < 0.5) return "Độ chính xác đang giảm — có thể bạn đã mệt. Nghỉ 5 phút (đứng dậy, uống nước) hoặc đổi sang dạng bài khác.";
  if (early > 0 && late > early * 2 && late > 8000) return "Bạn trả lời chậm dần — dấu hiệu mất tập trung. Nghỉ ngắn 3–5 phút sẽ giúp tỉnh táo lại.";
  return null;
}
