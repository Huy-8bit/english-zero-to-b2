import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Save, Sparkles, Timer, Trash2 } from "lucide-react";
import { ai, ERROR_LABELS, newId, type WritingFeedback, type WritingSubmission } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input, PageHeader, Textarea } from "@/components/ui/misc";
import { Markdown } from "@/components/Markdown";
import { toast } from "@/components/ui/toast";
import { SaveWordButton } from "@/features/vocab/Lookup";
import { AIErrorBox, AILoading, AIUnavailable, SimulatedBanner, useAIStatus } from "@/components/ai/AIStatus";
import { cn, safeStorage, wordCount } from "@/lib/utils";
import { diffWords } from "./diff";

const store = safeStorage();
const LEVELS = ["A1", "A2", "B1", "B2"];
const CRITERIA: Record<string, string> = {
  task_fulfilment: "Hoàn thành yêu cầu", organization_coherence: "Bố cục & mạch lạc", vocabulary: "Từ vựng", grammar: "Ngữ pháp", clarity_naturalness: "Rõ ràng & tự nhiên",
};

interface Prompt { title?: string; prompt_md?: string; prompt_en?: string; instructions_vi?: string; requirements?: string[]; word_min?: number | null; word_max?: number | null; suggested_minutes?: number; source?: string }
interface Draft { prompt: Prompt | null; text: string; taskType: string; level: string; mode: string; clientId: string; parentId: number | null }

export default function WritingStudioPage() {
  const st = useAIStatus();
  const qc = useQueryClient();
  const nav = useNavigate();
  const opts = useQuery({ queryKey: ["writing-options"], queryFn: ai.writingOptions });
  const hist = useQuery({ queryKey: ["writing-history"], queryFn: ai.writingHistory });
  const [d, setD] = useState<Draft>(() => store.get<Draft>("em-writing-draft", { prompt: null, text: "", taskType: "paragraph", level: "B1", mode: "minimal", clientId: newId(), parentId: null }));
  const [result, setResult] = useState<WritingSubmission | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ e: unknown; retry: () => void } | null>(null);
  const [topic, setTopic] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [tab, setTab] = useState<"write" | "history">("write");
  useEffect(() => { store.set("em-writing-draft", d); }, [d]);
  useEffect(() => {
    if (!d.text) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [d.text]);
  const words = wordCount(d.text);
  const target = d.prompt?.word_min && d.prompt.word_max ? [d.prompt.word_min, d.prompt.word_max] : null;

  const editDraft = (patch: Partial<Draft>) => {
    setD((previous) => ({ ...previous, ...patch, clientId: newId() }));
    setResult(null);
    setErr(null);
  };

  const genPrompt = async () => {
    setBusy("prompt");
    setErr(null);
    try {
      const p = await ai.writingPrompt({ level: d.level, task_type: d.taskType, topic });
      editDraft({ prompt: p as Prompt });
    } catch (e) {
      setErr({ e, retry: genPrompt });
    } finally {
      setBusy(null);
    }
  };
  const submit = async () => {
    if (!d.prompt) return toast.error("Hãy chọn hoặc tạo đề bài trước.");
    setBusy("eval");
    setErr(null);
    try {
      const r = await ai.evaluateWriting({ text: d.text, prompt: d.prompt as Record<string, unknown>, mode: d.mode, task_type: d.taskType, level: d.level, client_submission_id: d.clientId, parent_id: d.parentId });
      setResult(r);
      setD((x) => ({ ...x, clientId: newId() }));
      qc.invalidateQueries({ queryKey: ["writing-history"] });
    } catch (e) {
      setErr({ e, retry: submit });  // draft is kept, same client id → no double charge
    } finally {
      setBusy(null);
    }
  };
  const retryWriting = () => {
    if (!result) return;
    setD((x) => ({ ...x, parentId: result.id, clientId: newId() }));
    setResult(null);
    toast.info("Sửa bài theo góp ý rồi nộp lại để so sánh tiến bộ.");
  };
  const practice = async (topics: { lesson_id: string }[], focus: string[]) => {
    setBusy("practice");
    try {
      const es = await ai.generate({ lesson_id: topics[0]?.lesson_id ?? null, scope: topics.length ? "lesson" : "weak", count: 8, difficulty: "adaptive", question_types: ["mixed"], focus });
      nav(`/ai-practice/${es.id}`);
    } catch (e) {
      setErr({ e, retry: () => practice(topics, focus) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Writing Studio" subtitle="Viết bài, nhận góp ý chi tiết từ AI: lỗi được đánh dấu ngay trong bài, bản sửa, bản viết lại và kế hoạch cải thiện."
        actions={<div className="flex gap-2"><Button variant={tab === "write" ? "primary" : "outline"} onClick={() => setTab("write")}>Viết bài</Button><Button variant={tab === "history" ? "primary" : "outline"} onClick={() => setTab("history")}><History size={15} />Lịch sử</Button></div>} />
      <SimulatedBanner />
      {st.data && !st.data.enabled && <div className="mb-4"><AIUnavailable /></div>}
      {tab === "history" ? <WritingHistory data={hist.data} onOpen={(s) => { setResult(s); setD((x) => ({ ...x, text: s.text, prompt: s.prompt as Prompt, mode: s.mode, taskType: s.task_type, level: s.level, parentId: s.id, clientId: newId() })); setTab("write"); }} /> : (
        <div className="grid gap-5 xl:grid-cols-[19rem_1fr]">
          <Card>
            <CardHeader><CardTitle>Đề bài</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <label>Dạng bài<select className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2" disabled={busy !== null} value={d.taskType} onChange={(e) => editDraft({ taskType: e.target.value })}>
                  {Object.entries(opts.data?.task_types ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>Trình độ<select className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2" disabled={busy !== null} value={d.level} onChange={(e) => editDraft({ level: e.target.value })}>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
              </div>
              <label className="block">Chế độ góp ý<select className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2" disabled={busy !== null} value={d.mode} onChange={(e) => editDraft({ mode: e.target.value })}>
                <option value="minimal">Sửa tối thiểu — giữ cách viết của bạn</option><option value="natural">Viết lại tự nhiên</option><option value="b2">Nâng cấp hướng B2</option></select></label>
              <details className="rounded-xl border border-border p-2">
                <summary className="cursor-pointer font-medium">Chọn đề từ giáo trình</summary>
                <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {opts.data?.curriculum_prompts.map((p) => (
                    <li key={p.id}><button className="w-full rounded-lg px-2 py-1 text-left hover:bg-surface-2" disabled={busy !== null} onClick={() => editDraft({ prompt: { title: `${p.unit_id} · ${p.title}`, prompt_md: p.prompt_md, word_min: p.word_min, word_max: p.word_max, source: p.unit_id }, level: p.level && LEVELS.includes(p.level) ? p.level : d.level })}>
                      <span className="block text-xs text-muted">{p.unit_id} · {p.unit_title}</span><span className="line-clamp-2">{p.prompt_md.replace(/[*_]/g, "")}</span></button></li>
                  ))}
                </ul>
              </details>
              <div className="flex gap-2"><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Chủ đề (tuỳ chọn)" aria-label="Chủ đề cho đề AI" />
                <Button variant="secondary" className="whitespace-nowrap" onClick={genPrompt} disabled={busy !== null || !st.data?.enabled}><Sparkles size={14} />Đề AI</Button></div>
              {d.prompt && (
                <div className="rounded-xl bg-surface-2 p-3">
                  <p className="font-semibold">{d.prompt.title}</p>
                  <Markdown className="text-sm">{d.prompt.prompt_md ?? d.prompt.prompt_en ?? ""}</Markdown>
                  {d.prompt.instructions_vi && <p className="mt-1 text-muted">{d.prompt.instructions_vi}</p>}
                  {!!d.prompt.requirements?.length && <ul className="mt-1 list-disc pl-5">{d.prompt.requirements.map((r) => <li key={r}>{r}</li>)}</ul>}
                  <p className="mt-1 text-xs text-muted">{target ? `${target[0]}–${target[1]} từ` : ""}{d.prompt.suggested_minutes ? ` · gợi ý ${d.prompt.suggested_minutes} phút` : ""}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card className="p-4">
              {result ? <Highlighted text={result.text} fb={result.feedback} /> : (
                <Textarea disabled={busy !== null} rows={12} value={d.text} onChange={(e) => editDraft({ text: e.target.value })} placeholder="Viết bài của bạn ở đây… (tự động lưu nháp)" aria-label="Bài viết" />
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className={target && (words < target[0] || words > target[1]) ? "font-medium text-warning" : ""}>{words} từ{target ? ` / ${target[0]}–${target[1]}` : ""}</span>
                <span className="inline-flex items-center gap-1"><Timer size={13} />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
                <span className="inline-flex items-center gap-1"><Save size={13} />Nháp được lưu trong trình duyệt</span>
                <span className="ml-auto flex gap-2">
                  {result ? <Button size="sm" onClick={retryWriting}>Sửa & nộp lại</Button> :
                    <Button size="sm" onClick={submit} disabled={busy !== null || words < 3 || !st.data?.enabled}><Sparkles size={14} />{busy === "eval" ? "AI đang chấm…" : "Nhận góp ý AI"}</Button>}
                </span>
              </div>
            </Card>
            {busy === "eval" && <AILoading label="AI đang đọc bài, tìm lỗi và viết góp ý (có thể mất 30–60 giây)…" />}
            {busy === "prompt" && <AILoading label="Đang tạo đề…" />}
            {busy === "practice" && <AILoading label="Đang tạo bài luyện tập theo lỗi của bạn…" />}
            {err && <AIErrorBox error={err.e} onRetry={err.retry} />}
            {result && <FeedbackView sub={result} onPractice={practice} />}
          </div>
        </div>
      )}
    </div>
  );
}

/** Learner's text with each detected error highlighted in place (hover/focus for the correction). */
function Highlighted({ text, fb }: { text: string; fb: WritingFeedback }) {
  const spans = fb.detected_errors.map((e, i) => ({ ...e, i })).filter((e) => e.span).sort((a, b) => a.span![0] - b.span![0]);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const e of spans) {
    const [s, t] = e.span!;
    if (s < pos) continue;
    parts.push(text.slice(pos, s));
    parts.push(
      <mark key={e.i} tabIndex={0} title={`${e.correction} — ${e.explanation_vi}`} className={cn("rounded px-0.5", e.severity === "major" ? "bg-danger-soft underline decoration-danger decoration-wavy" : "bg-warning-soft")}>
        {text.slice(s, t)}<sup className="ml-0.5 text-[10px] font-bold text-danger">{e.i + 1}</sup>
      </mark>,
    );
    pos = t;
  }
  parts.push(text.slice(pos));
  return <div className="whitespace-pre-wrap text-[15px] leading-relaxed" aria-label="Bài viết có đánh dấu lỗi">{parts}</div>;
}

function FeedbackView({ sub, onPractice }: { sub: WritingSubmission; onPractice: (topics: { lesson_id: string }[], focus: string[]) => void }) {
  const fb = sub.feedback;
  const diff = useMemo(() => diffWords(sub.text, fb.minimal_corrections), [sub.text, fb.minimal_corrections]);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Nhận xét chung</CardTitle><div className="flex gap-2"><Badge tone="primary">Ước lượng {fb.estimated_level}</Badge>{fb.estimated_score_10 != null && <Badge>{fb.estimated_score_10}/10</Badge>}</div></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{fb.overall_assessment_vi}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {fb.criteria.map((c) => (
              <div key={c.criterion}><div className="flex justify-between"><span>{CRITERIA[c.criterion] ?? c.criterion}</span><b>{c.score}/10</b></div>
                <Progress value={c.score * 10} className="mt-1" label={CRITERIA[c.criterion]} /><p className="mt-1 text-xs text-muted">{c.comment_vi}</p></div>
            ))}
          </div>
          <p className="text-xs text-muted">{fb.disclaimer_vi}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Lỗi ngữ pháp & từ ({fb.detected_errors.length})</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {fb.detected_errors.map((e, i) => (
              <li key={i} className="rounded-xl border border-border p-3">
                <span className="mr-2 font-bold text-danger">{i + 1}</span><Badge tone="danger">{ERROR_LABELS[e.category] ?? e.category}</Badge>{e.severity === "major" && <Badge tone="warning" className="ml-1">quan trọng</Badge>}
                <p className="mt-1"><span className="line-through decoration-danger">{e.original}</span> → <b className="text-success">{e.correction}</b></p>
                <p className="text-muted">{e.explanation_vi}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Trước / Sau (sửa tối thiểu)</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-[15px] leading-relaxed">{diff.map((p, i) => p.type === "same" ? <span key={i}>{p.text}</span> :
          p.type === "del" ? <del key={i} className="bg-danger-soft decoration-danger">{p.text}</del> : <ins key={i} className="bg-success-soft no-underline font-medium">{p.text}</ins>)}</p></CardContent>
      </Card>
      {sub.mode !== "minimal" && (
        <Card><CardHeader><CardTitle>{sub.mode === "b2" ? "Bản nâng cấp hướng B2" : "Bản viết lại tự nhiên"}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm"><p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-[15px]">{fb.rewritten_version}</p>
            <ul className="list-disc pl-5">{fb.rewrite_changes_vi.map((c, i) => <li key={i}>{c}</li>)}</ul></CardContent></Card>
      )}
      {(fb.b2_upgrade_suggestions.length > 0 || fb.vocabulary_suggestions.length > 0) && (
        <Card><CardHeader><CardTitle>Gợi ý nâng cấp</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {fb.b2_upgrade_suggestions.map((u, i) => <p key={i}><span className="text-muted">{u.original}</span> → <b>{u.suggestion}</b><span className="block text-xs text-muted">{u.why_vi}</span></p>)}
            {fb.vocabulary_suggestions.map((v, i) => <p key={`v${i}`}><b>{v.word_used}</b> → <b className="text-primary">{v.better_choice}</b><SaveWordButton text={v.better_choice} module="writing" meaning_vi={v.why_vi} example={v.example} context={v.word_used} /> <i>{v.example}</i><span className="block text-xs text-muted">{v.why_vi}</span></p>)}
            {!!fb.vocab_used?.length && <p className="text-xs text-muted">Từ đã học bạn dùng trong bài: {fb.vocab_used.map((u) => `${u.lemma}${u.correct ? " ✓" : " (có lỗi)"}`).join(", ")}</p>}
          </CardContent></Card>
      )}
      <Card><CardHeader><CardTitle>Bố cục & kế hoạch cải thiện</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm"><p>{fb.organization_feedback_vi}</p><ul className="list-disc pl-5">{fb.improvement_plan_vi.map((p, i) => <li key={i}>{p}</li>)}</ul>
          {fb.practice_lessons.length > 0 && <p>Bài nên ôn: {fb.practice_lessons.map((l) => `${l.lesson_id} ${l.title}`).join(" · ")}</p>}
          <Button size="sm" variant="secondary" onClick={() => onPractice(fb.practice_lessons, fb.detected_errors.map((e) => e.category).slice(0, 5))}><Sparkles size={14} />Tạo bài tập theo lỗi của tôi</Button>
        </CardContent></Card>
    </div>
  );
}

function WritingHistory({ data, onOpen }: { data?: Awaited<ReturnType<typeof ai.writingHistory>>; onOpen: (s: WritingSubmission) => void }) {
  const qc = useQueryClient();
  if (!data) return null;
  const cats = Object.entries(data.stats.error_categories);
  const max = Math.max(1, ...cats.map(([, n]) => n));
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <ul className="space-y-2">
        {data.submissions.length === 0 && <p className="text-sm text-muted">Chưa có bài nào.</p>}
        {data.submissions.map((s) => (
          <li key={s.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
            <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(s)}>
              <span className="block font-medium">{String(s.prompt.title ?? "Bài viết")}</span>
              <span className="block text-xs text-muted">{new Date(s.created_at).toLocaleString("vi-VN")} · {s.word_count} từ · {s.feedback.detected_errors.length} lỗi · {s.feedback.estimated_level}{s.parent_id ? " · bản sửa lại" : ""}</span>
              <span className="mt-1 line-clamp-2 block">{s.text}</span>
            </button>
            <Button size="icon" variant="ghost" aria-label="Xóa bài" onClick={async () => { if (window.confirm("Xóa bài viết này?")) { await ai.deleteWriting(s.id); qc.invalidateQueries({ queryKey: ["writing-history"] }); } }}><Trash2 size={15} /></Button>
          </li>
        ))}
      </ul>
      <Card><CardHeader><CardTitle>Thống kê lỗi</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {cats.map(([c, n]) => <div key={c}><div className="flex justify-between"><span>{ERROR_LABELS[c] ?? c}</span><b>{n}</b></div><Progress value={(n / max) * 100} label={c} /></div>)}
          {data.stats.timeline.length > 1 && <p className="text-xs text-muted">Lỗi/100 từ: {data.stats.timeline.map((t) => t.errors_per_100).join(" → ")}</p>}
        </CardContent></Card>
    </div>
  );
}
