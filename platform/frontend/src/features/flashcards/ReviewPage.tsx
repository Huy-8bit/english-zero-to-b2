import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Brain, CheckCircle2, PenLine, Sparkles, Trophy, XCircle } from "lucide-react";
import { api } from "@/services/api";
import { ai } from "@/services/ai";
import type { ItemResult } from "@/types/content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBox, PageHeader, Skeleton, Textarea } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { useAIStatus } from "@/components/ai/AIStatus";
import { useCelebrate } from "@/components/Celebrate";
import { cn } from "@/lib/utils";
import { plan, type CorrectionResult, type SmartReview } from "@/services/plan";
import { vocab } from "@/services/vocab";
import { ItemCard } from "@/features/quizzes/ItemCard";
import { isAnswered, toResponse, type Draft } from "@/features/quizzes/draft";

const STEPS = [
  { id: "curriculum", icon: BookOpen, label: "Câu sai trong bài" },
  { id: "corrections", icon: PenLine, label: "Sửa lỗi viết/nói" },
  { id: "vocab", icon: Brain, label: "Từ vựng lỗ hổng" },
  { id: "lessons", icon: Trophy, label: "Bài cần học lại" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

/** Smart review: diagnose what is missing or wrong, then review it in order (errors first, then spaced retrieval). */
export default function ReviewPage() {
  const [sp] = useSearchParams();
  const quick = sp.get("quick") === "1";
  const q = useQuery({ queryKey: ["smart-review", quick], queryFn: () => plan.smart(quick), refetchOnMount: "always" });
  const [step, setStep] = useState<StepId | null>(null);
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const count = (id: StepId) => d.sections.find((s) => s.id === id)?.count ?? 0;
  const active = step ?? STEPS.find((s) => count(s.id) > 0)?.id ?? null;
  return (
    <div>
      <PageHeader title={quick ? "Kiểm tra cuối ngày" : "Ôn tập thông minh"}
        subtitle={d.total ? `Hệ thống tìm thấy ${d.total} điểm bạn còn thiếu hoặc sai. Ôn theo thứ tự: sửa lỗi trước, rồi ôn đúng lúc sắp quên.` : "Không còn lỗ hổng nào — tuyệt vời!"} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Các phần ôn tập">
        {STEPS.map((s) => {
          const n = count(s.id);
          const Icon = s.icon;
          return (
            <button key={s.id} role="tab" aria-selected={active === s.id} onClick={() => setStep(s.id)}
              className={cn("rounded-2xl border p-3 text-left transition", active === s.id ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2")}>
              <Icon size={16} className="text-primary" />
              <p className="mt-1 text-sm font-medium">{s.label}</p>
              <p className={cn("text-xl font-bold tabular-nums", n === 0 && "text-success")}>{n === 0 ? "✓" : n}</p>
            </button>
          );
        })}
      </div>
      {d.hot_units.length > 0 && !quick && (
        <p className="mt-3 text-xs text-muted">Sai nhiều nhất ở: {d.hot_units.map((u) => `${u.unit_id} (${u.wrong})`).join(", ")}{d.weak_topics.length ? ` · Chủ điểm yếu: ${d.weak_topics.map((w) => w.title).join(", ")}` : ""}</p>
      )}
      <div className="mt-5">
        {active === null && <EmptyState icon={<Trophy size={28} />} title="Không còn gì cần ôn lúc này">Hãy học bài mới — lỗi mới (nếu có) sẽ tự xuất hiện ở đây.</EmptyState>}
        {active === "curriculum" && <CurriculumStep d={d} why={d.sections[0].why_vi} onDone={() => q.refetch()} />}
        {active === "corrections" && <CorrectionsStep d={d} why={d.sections[1].why_vi} onDone={() => q.refetch()} />}
        {active === "vocab" && <VocabStep d={d} why={d.sections[2].why_vi} />}
        {active === "lessons" && <LessonsStep d={d} why={d.sections[3].why_vi} />}
      </div>
    </div>
  );
}

function Why({ text }: { text: string }) {
  return <p className="mb-3 text-sm text-muted">{text}</p>;
}

function CurriculumStep({ d, why, onDone }: { d: SmartReview; why: string; onDone: () => void }) {
  const qc = useQueryClient();
  const fire = useCelebrate((s) => s.fire);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const list = d.curriculum_items;
  if (!list.length) return <EmptyState title="Không còn câu sai nào trong bài học" icon={<CheckCircle2 size={28} />} />;
  const fixed = list.filter((m) => results[m.item_id]?.verdict === "correct" || results[m.item_id]?.self_correct === true).length;
  const check = async (m: (typeof list)[number]) => {
    const dr = drafts[m.item_id];
    if (!isAnswered(m.item, dr)) return;
    try {
      const r = await api.submitQuiz(m.quiz_id, { [m.item_id]: toResponse(m.item, dr) });
      setResults((x) => ({ ...x, ...r.results }));
      if (r.results[m.item_id].verdict === "correct") {
        toast.success("Đúng rồi! Câu này đã được sửa.");
        if (fixed + 1 === list.length) fire("Đã sửa hết câu sai! 🎯");
      }
      qc.invalidateQueries({ queryKey: ["day-plan"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không nộp được");
    }
  };
  return (
    <div>
      <Why text={why} />
      <p className="mb-3 text-sm font-medium">Đã sửa {fixed}/{list.length}</p>
      <ul className="space-y-4">
        {list.map((m) => (
          <li key={m.item_id}>
            <p className="mb-1 text-xs text-muted"><Link className="text-primary underline" to={`/learn/${m.unit_id}`}>{m.unit_id} · {m.unit_title}</Link> · {m.step_title} · {m.response ? <>lần trước bạn trả lời “{m.response}”</> : "lần trước bạn chưa biết và đã xem đáp án"}</p>
            <ItemCard item={m.item} unitId={m.unit_id} docPath="" draft={drafts[m.item_id]} onDraft={(dr) => setDrafts((x) => ({ ...x, [m.item_id]: dr }))}
              result={results[m.item_id]} locked={false}
              onSelfAssess={async (c) => { const r = results[m.item_id]; if (r) { const s = await api.selfAssess(r.attempt_id, c); setResults((x) => ({ ...x, [m.item_id]: s.result })); } }}
              onRetry={() => setResults((x) => { const n = { ...x }; delete n[m.item_id]; return n; })} onEnter={() => check(m)}
              onReveal={async () => {
                try { const r = await api.submitQuiz(m.quiz_id, {}, [m.item_id]); setResults((x) => ({ ...x, ...r.results })); }
                catch (e) { toast.error(e instanceof Error ? e.message : "Không xem được đáp án"); }
              }} />
            {!results[m.item_id] && <Button size="sm" className="mt-2" onClick={() => check(m)} disabled={!isAnswered(m.item, drafts[m.item_id])}>Kiểm tra lại</Button>}
          </li>
        ))}
      </ul>
      <Button variant="outline" className="mt-4" onClick={onDone}>Cập nhật danh sách</Button>
    </div>
  );
}

function CorrectionsStep({ d, why, onDone }: { d: SmartReview; why: string; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [res, setRes] = useState<CorrectionResult | null>(null);
  const [score, setScore] = useState(0);
  const fire = useCelebrate((s) => s.fire);
  const list = d.corrections;
  if (!list.length) return <EmptyState title="Không còn lỗi viết/nói nào cần sửa" icon={<CheckCircle2 size={28} />} />;
  if (i >= list.length) {
    return (
      <Card className="p-6 text-center">
        <p className="text-lg font-semibold">Xong phần sửa lỗi: đúng {score}/{list.length}</p>
        <p className="text-sm text-muted">Lỗi cần đúng 2 lần ở các buổi khác nhau mới được coi là đã sửa.</p>
        <Button className="mt-3" onClick={onDone}>Tiếp tục</Button>
      </Card>
    );
  }
  const c = list[i];
  const submit = async () => {
    if (!text.trim()) return;
    try {
      const r = await plan.correct(c.id, text);
      setRes(r);
      if (r.correct) setScore((s) => s + 1);
      if (r.correct && i === list.length - 1 && score + 1 === list.length) fire("Sửa đúng tất cả! 🔥");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không kiểm tra được");
    }
  };
  return (
    <div>
      <Why text={why} />
      <Card>
        <CardHeader><CardTitle>Lỗi {i + 1}/{list.length}</CardTitle><Badge>{c.source} · {c.error_type}{c.times > 1 ? ` · lặp ${c.times} lần` : ""}</Badge></CardHeader>
        <CardContent className="space-y-3">
          {c.context && <p className="text-xs text-muted">{c.context}</p>}
          <p className="rounded-xl bg-danger-soft px-3 py-2"><span className="text-xs text-muted">Bạn đã viết/nói:</span><br /><s>{c.wrong}</s></p>
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Viết lại cho đúng (không xem đáp án)…" aria-label="Câu đã sửa" disabled={!!res}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!res) void submit(); } }} />
          {!res ? (
            <Button onClick={submit} disabled={!text.trim()}>Kiểm tra</Button>
          ) : (
            <div className={cn("space-y-1 rounded-xl p-3 text-sm", res.correct ? "bg-success-soft" : "bg-warning-soft")}>
              <p className="font-semibold">{res.correct ? <><CheckCircle2 size={16} className="mr-1 inline text-success" />Đúng</> : <><XCircle size={16} className="mr-1 inline text-danger" />Chưa đúng</>}</p>
              <p>Câu đúng: <b>{res.expected}</b></p>
              {res.explanation && <p className="text-muted">{res.explanation}</p>}
              <p className="text-xs text-muted">{res.note_vi}</p>
              <Button size="sm" className="mt-1" onClick={() => { setI(i + 1); setText(""); setRes(null); }}>Tiếp</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VocabStep({ d, why }: { d: SmartReview; why: string }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <Why text={why} />
      <Card className="p-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><p className="text-2xl font-bold">{d.vocab.due}</p><p className="text-xs text-muted">đến hạn hôm nay</p></div>
          <div><p className="text-2xl font-bold">{d.vocab.mistakes}</p><p className="text-xs text-muted">từng trả lời sai</p></div>
          <div><p className="text-2xl font-bold">{d.vocab.weak}</p><p className="text-xs text-muted">hay quên</p></div>
        </div>
        <div className="mt-4 text-center">
          <Button size="lg" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              const s = await vocab.start("gaps");
              nav(`/vocabulary/session/${s.id}?return=/review`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Không tạo được phiên ôn");
            } finally {
              setBusy(false);
            }
          }}><Brain size={18} />Ôn lỗ hổng từ vựng</Button>
          <p className="mt-2 text-xs text-muted">Từ sai/hay quên được luyện phân biệt trong ngữ cảnh rồi gõ lại; từ đến hạn ôn theo lịch FSRS.</p>
        </div>
      </Card>
    </div>
  );
}

function LessonsStep({ d, why }: { d: SmartReview; why: string }) {
  const st = useAIStatus();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <Why text={why} />
      <div className="space-y-2">
        {d.lessons.map((x) => (
          <Link key={x.lesson_id} to={x.link} className="flex items-start justify-between gap-3 rounded-2xl border border-border p-3 hover:bg-surface-2">
            <span><b>{x.lesson_id}</b> · {x.title}<span className="block text-xs text-muted">{x.reason_vi}</span></span><Badge>{x.level}</Badge>
          </Link>
        ))}
        {!d.lessons.length && <p className="text-sm text-muted">Chưa có bài nào đến hạn học lại.</p>}
      </div>
      {st.data?.enabled && d.weak_topics.length > 0 && (
        <Card className="mt-4 p-4">
          <p className="text-sm">Chủ điểm yếu: <b>{d.weak_topics.map((w) => `${w.title} (${w.mastery}%)`).join(", ")}</b></p>
          <Button className="mt-2" variant="outline" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              const es = await ai.reviewSession("weak", 10);
              nav(`/ai-practice/${es.id}`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Không tạo được bài tập AI");
            } finally {
              setBusy(false);
            }
          }}><Sparkles size={16} />{busy ? "AI đang tạo…" : "Bài tập AI cho chủ điểm yếu"}</Button>
        </Card>
      )}
    </div>
  );
}
