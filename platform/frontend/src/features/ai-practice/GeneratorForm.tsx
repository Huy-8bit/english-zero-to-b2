import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { api } from "@/services/api";
import { ai, QTYPE_LABELS } from "@/services/ai";
import { Button } from "@/components/ui/button";
import { AIErrorBox, AILoading, AIUnavailable, useAIStatus } from "@/components/ai/AIStatus";
import { cn } from "@/lib/utils";

const COUNTS = [5, 10, 15, 20];
const DIFFS = [["easy", "Dễ"], ["normal", "Vừa"], ["hard", "Khó"], ["adaptive", "Theo năng lực"]] as const;
const SCOPES = [["lesson", "Bài hiện tại"], ["previous", "Các bài trước"], ["weak", "Chủ điểm yếu"], ["mistakes", "Lỗi đã gặp"]] as const;
const TYPES = ["multiple_choice", "fill_blank", "verb_conjugation", "error_correction", "sentence_transformation", "sentence_ordering",
  "matching", "translation_vi_en", "translation_en_vi", "short_answer", "sentence_writing", "contextual_grammar", "true_false"];

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, l]) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
            className={cn("rounded-xl border px-3 py-1.5 text-sm", value === v ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface")}>{l}</button>
        ))}
      </div>
    </fieldset>
  );
}

/** "Practice with AI": generates a NEW exercise set grounded in the curriculum and opens it. */
export function GeneratorForm({ lessonId, compact, onDone }: { lessonId?: string; compact?: boolean; onDone?: () => void }) {
  const nav = useNavigate();
  const st = useAIStatus();
  const lessons = useQuery({ queryKey: ["lessons", "grammar"], queryFn: () => api.lessons({ kind: "grammar" }), enabled: !lessonId });
  const [lesson, setLesson] = useState(lessonId ?? "");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<string>("adaptive");
  const [scope, setScope] = useState<string>("lesson");
  const [types, setTypes] = useState<string[]>(["mixed"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const max = st.data?.limits.max_exercise_count ?? 20;
  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const es = await ai.generate({ lesson_id: lesson || null, scope, count: Math.min(count, max), difficulty, question_types: types });
      onDone?.();
      nav(`/ai-practice/${es.id}`);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  if (st.data && !st.data.enabled) return <AIUnavailable />;
  const toggleType = (t: string) => setTypes((cur) => (t === "mixed" ? ["mixed"] : (() => {
    const next = cur.filter((x) => x !== "mixed");
    const n = next.includes(t) ? next.filter((x) => x !== t) : [...next, t];
    return n.length ? n : ["mixed"];
  })()));
  return (
    <div className="space-y-4">
      {!lessonId && (
        <label className="block text-sm font-medium">Bài học
          <select className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3" value={lesson} onChange={(e) => setLesson(e.target.value)}>
            <option value="">— chọn bài (không bắt buộc với Chủ điểm yếu / Lỗi đã gặp) —</option>
            {lessons.data?.map((u) => <option key={u.id} value={u.id}>{u.id} · {u.title}</option>)}
          </select>
        </label>
      )}
      <Seg label="Nội dung" value={scope} options={SCOPES} onChange={setScope} />
      <Seg label="Số câu" value={count} options={COUNTS.filter((c) => c <= max).map((c) => [c, String(c)] as const)} onChange={setCount} />
      <Seg label="Độ khó" value={difficulty} options={DIFFS} onChange={setDifficulty} />
      {!compact && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Dạng bài</legend>
          <div className="flex flex-wrap gap-2">
            {["mixed", ...TYPES].map((t) => (
              <button key={t} type="button" aria-pressed={types.includes(t)} onClick={() => toggleType(t)}
                className={cn("rounded-xl border px-3 py-1.5 text-sm", types.includes(t) ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface")}>{t === "mixed" ? "Trộn" : QTYPE_LABELS[t]}</button>
            ))}
          </div>
        </fieldset>
      )}
      <Button onClick={generate} disabled={busy || (!lesson && (scope === "lesson" || scope === "previous"))}><Sparkles size={16} />{busy ? "Đang tạo…" : "Tạo bài tập"}</Button>
      <p className="text-xs text-muted">AI soạn câu hỏi mới từ nội dung giáo trình; câu hỏi lỗi, mơ hồ hoặc trùng lặp bị loại tự động. Đáp án chỉ hiện sau khi nộp.</p>
      {busy && <AILoading label="AI đang soạn và kiểm tra câu hỏi (có thể mất 20–40 giây)…" />}
      {err != null && <AIErrorBox error={err} onRetry={generate} />}
    </div>
  );
}
