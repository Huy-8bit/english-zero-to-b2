import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Check, ChevronLeft, ChevronRight, Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorBox, Input, PageHeader, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { LEVEL_OPTIONS, STATE_LABELS, vocab, type WordCard } from "@/services/vocab";
import { WordRow } from "./components";
import { SubNav, useStart } from "./VocabHome";

const KINDS: Record<string, string> = { word: "Từ", phrasal_verb: "Cụm động từ", phrase: "Cụm từ", collocation: "Collocation", pattern: "Mẫu câu" };
const MASTERY: Record<string, string> = { new: "Chưa học", learning: STATE_LABELS.learning, review: STATE_LABELS.review, relearning: STATE_LABELS.relearning, mastered: STATE_LABELS.mastered, due: "Đến hạn ôn" };

export default function ExplorerPage() {
  const [sp, setSp] = useSearchParams();
  const f = { q: sp.get("q") ?? "", level: sp.get("level") ?? "", topic: sp.get("topic") ?? "", kind: sp.get("kind") ?? "", mastery: sp.get("mastery") ?? "", page: Number(sp.get("page") ?? 1) };
  const [text, setText] = useState(f.q);
  useEffect(() => setText(f.q), [f.q]);
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== "page") n.delete("page");
    setSp(n, { replace: true });
  };
  const topics = useQuery({ queryKey: ["vocab-topics"], queryFn: vocab.topics });
  const q = useQuery({ queryKey: ["vocab-entries", f], queryFn: () => vocab.entries({ ...f, size: 25 }), placeholderData: keepPreviousData });
  const { start, busy } = useStart();
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.size)) : 1;
  const sel = "h-10 rounded-xl border border-border bg-surface px-3 text-sm";
  return (
    <div>
      <PageHeader title="Khám phá từ vựng" subtitle="Tìm theo tiếng Anh hoặc tiếng Việt, lọc theo trình độ, chủ đề, loại và mức độ ghi nhớ." />
      <SubNav />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-2 pt-5">
          <form className="flex min-w-60 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); set("q", text.trim()); }}>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="achieve, đạt được, went…" aria-label="Tìm từ" />
            <Button type="submit" aria-label="Tìm"><Search size={16} /></Button>
          </form>
          <select aria-label="Trình độ" className={sel} value={f.level} onChange={(e) => set("level", e.target.value)}>
            <option value="">Trình độ</option>{LEVEL_OPTIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <select aria-label="Chủ đề" className={sel} value={f.topic} onChange={(e) => set("topic", e.target.value)}>
            <option value="">Chủ đề</option>{topics.data?.filter((t) => t.total).map((t) => <option key={t.id} value={t.id}>{t.name_vi}</option>)}
          </select>
          <select aria-label="Loại" className={sel} value={f.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="">Loại</option>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select aria-label="Mức độ ghi nhớ" className={sel} value={f.mastery} onChange={(e) => set("mastery", e.target.value)}>
            <option value="">Mức độ</option>{Object.entries(MASTERY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </CardContent>
      </Card>
      {q.isLoading ? <Skeleton className="h-96" /> : q.error || !q.data ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>{q.data.total.toLocaleString("vi-VN")} kết quả</span>
            {q.data.total > 0 && (f.topic || f.level) && (
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => start("learn", { topic: f.topic || undefined, level: f.level || undefined })}><Play size={14} />Học từ mới trong bộ lọc này</Button>
            )}
          </div>
          {q.data.items.length ? (
            <div className="space-y-2">{q.data.items.map((w) => <WordRow key={w.id} w={w} right={<SaveButton w={w} />} />)}</div>
          ) : <EmptyState title="Không tìm thấy từ phù hợp">Thử từ khác, hoặc bỏ bớt bộ lọc.</EmptyState>}
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={f.page <= 1} onClick={() => set("page", String(f.page - 1))}><ChevronLeft size={16} />Trước</Button>
              <span className="text-sm tabular-nums">Trang {f.page}/{pages}</span>
              <Button variant="outline" size="sm" disabled={f.page >= pages} onClick={() => set("page", String(f.page + 1))}>Sau<ChevronRight size={16} /></Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function SaveButton({ w }: { w: WordCard }) {
  const qc = useQueryClient();
  const saved = !!w.progress?.saved;
  return (
    <Button size="sm" variant={saved ? "secondary" : "ghost"} aria-pressed={saved} onClick={async () => {
      try {
        await vocab.progress(w.id, saved ? "unsave" : "learn");
        if (!saved) toast.success(`Đã thêm “${w.lemma}” vào danh sách học`);
        qc.invalidateQueries({ queryKey: ["vocab-entries"] });
        qc.invalidateQueries({ queryKey: ["vocab-overview"] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không lưu được");
      }
    }}>{saved ? <><Check size={14} />Đã lưu</> : <><BookmarkPlus size={14} />Học từ này</>}</Button>
  );
}
