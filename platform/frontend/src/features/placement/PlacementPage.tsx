import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { ai, type PlacementState } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Textarea } from "@/components/ui/misc";
import { Markdown } from "@/components/Markdown";
import { AIErrorBox, SimulatedBanner } from "@/components/ai/AIStatus";
import { cn, safeStorage } from "@/lib/utils";

const store = safeStorage();
const SKILLS: Record<string, string> = { grammar: "Ngữ pháp", vocabulary: "Từ vựng", reading: "Đọc hiểu", writing: "Viết", speaking: "Nói" };
const SECTIONS: Record<string, string> = { grammar: "Ngữ pháp", vocabulary: "Từ vựng", reading: "Đọc hiểu", writing: "Viết" };

export default function PlacementPage() {
  const qc = useQueryClient();
  const [state, setState] = useState<PlacementState | null>(null);
  const [writing, setWriting] = useState(true);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const resumeId = store.get<string | null>("em-placement", null);

  const run = async (fn: () => Promise<PlacementState>) => {
    setBusy(true);
    setErr(null);
    try {
      const s = await fn();
      setState(s);
      setAnswer("");
      store.set("em-placement", s.done ? null : s.session_id);
      if (s.done) qc.invalidateQueries();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const q = state?.question;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Kiểm tra xếp lớp (thích ứng)" subtitle="Độ khó tự điều chỉnh theo câu trả lời. Câu hỏi lấy từ giáo trình và được chấm tự động; phần viết (tuỳ chọn) do AI đánh giá." />
      <SimulatedBanner />
      {!state && (
        <Card><CardContent className="space-y-3 pt-5 text-sm">
          <p>Gồm: ngữ pháp (thích ứng, tối đa 18 câu) → từ vựng → đọc hiểu → viết ngắn (tuỳ chọn). Kỹ năng Nói không được đánh giá ở đây.</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={writing} onChange={(e) => setWriting(e.target.checked)} />Có phần viết (cần AI)</label>
          <div className="flex gap-2">
            <Button onClick={() => run(() => ai.placementStart(writing))} disabled={busy}><ClipboardCheck size={16} />Bắt đầu</Button>
            {resumeId && <Button variant="outline" onClick={() => run(() => ai.placement(resumeId))} disabled={busy}>Tiếp tục bài đang làm</Button>}
          </div>
        </CardContent></Card>
      )}
      {state && !state.done && q && (
        <Card>
          <CardHeader><CardTitle>{SECTIONS[state.section ?? ""] ?? state.section}</CardTitle><Badge>{state.progress?.answered ?? 0} câu đã làm</Badge></CardHeader>
          <CardContent className="space-y-3">
            {q.passage_md && <div className="max-h-72 overflow-y-auto rounded-xl bg-surface-2 p-3 text-sm"><Markdown>{q.passage_md}</Markdown></div>}
            {q.instruction_md && <Markdown className="text-sm text-muted">{q.instruction_md}</Markdown>}
            <Markdown>{q.prompt_md}</Markdown>
            {q.kind === "long" ? (
              <>
                <Textarea rows={6} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Bài viết" />
                <div className="flex gap-2"><Button onClick={() => run(() => ai.placementAnswer(state.session_id, "writing", answer))} disabled={busy || answer.trim().split(/\s+/).length < 20}>Nộp & xem kết quả</Button>
                  <Button variant="ghost" onClick={() => run(() => ai.placementAnswer(state.session_id, "writing", ""))} disabled={busy}>Bỏ qua phần viết</Button></div>
              </>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">{(q.options ?? []).map((o) => (
                <button key={o.key} disabled={busy} onClick={() => run(() => ai.placementAnswer(state.session_id, q.id, o.key))}
                  className={cn("flex gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:border-primary")}><b>{o.key}</b><Markdown inline>{o.text}</Markdown></button>))}</div>
            )}
          </CardContent>
        </Card>
      )}
      {err != null && <AIErrorBox error={err} />}
      {state?.done && state.result && (
        <div className="space-y-4">
          <Card><CardHeader><CardTitle>Trình độ ước lượng: {state.result.overall}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{Object.entries(state.result.skills).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border p-3 text-center"><p className="text-xs text-muted">{SKILLS[k]}</p><p className="text-lg font-bold">{v ?? "—"}</p>{!v && <p className="text-[11px] text-muted">chưa đánh giá</p>}</div>))}</div>
              <p className="text-xs text-muted">{state.result.disclaimer_vi}</p>
              {state.result.notes.map((n) => <p key={n} className="text-xs text-warning">{n}</p>)}
            </CardContent></Card>
          <Card><CardHeader><CardTitle>Kế hoạch học</CardTitle></CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div><p className="font-semibold">Điểm mạnh</p><ul className="list-disc pl-5">{state.result.report.strengths_vi.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><p className="font-semibold">Cần cải thiện</p><ul className="list-disc pl-5">{state.result.report.weaknesses_vi.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><p className="font-semibold">Ưu tiên</p><ul className="list-disc pl-5">{state.result.report.study_priorities_vi.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><p className="font-semibold">Lộ trình</p><ul className="list-disc pl-5">{state.result.report.plan_vi.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div className="sm:col-span-2"><p className="font-semibold">Bắt đầu với</p><div className="mt-1 flex flex-wrap gap-2">{state.result.report.recommended_lesson_ids.map((id) => <Link key={id} to={`/learn/${id}`}><Badge tone="primary">{id}</Badge></Link>)}</div></div>
            </CardContent></Card>
          <Link to="/"><Button>Về Dashboard với lộ trình mới</Button></Link>
        </div>
      )}
    </div>
  );
}
