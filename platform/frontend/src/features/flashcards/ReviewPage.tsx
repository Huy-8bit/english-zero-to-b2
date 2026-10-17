import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, CheckCheck, TriangleAlert } from "lucide-react";
import { api } from "@/services/api";
import type { ItemResult } from "@/types/content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { FlashcardDeck } from "./FlashcardDeck";
import { ItemCard } from "@/features/quizzes/ItemCard";
import { isAnswered, toResponse, type Draft } from "@/features/quizzes/draft";

export default function ReviewPage() {
  const [tab, setTab] = useState<"cards" | "mistakes">("cards");
  return (
    <div>
      <PageHeader title="Ôn tập & Flashcards" subtitle="Ôn từ vựng theo lịch lặp lại ngắt quãng và làm lại các câu đã sai." />
      <div role="tablist" className="mb-6 flex gap-2">
        <Button role="tab" aria-selected={tab === "cards"} variant={tab === "cards" ? "primary" : "outline"} onClick={() => setTab("cards")}><Brain size={16} />Flashcards đến hạn</Button>
        <Button role="tab" aria-selected={tab === "mistakes"} variant={tab === "mistakes" ? "primary" : "outline"} onClick={() => setTab("mistakes")}><TriangleAlert size={16} />Câu đã làm sai</Button>
      </div>
      {tab === "cards" ? <DueCards /> : <Mistakes />}
    </div>
  );
}

function DueCards() {
  const [round, setRound] = useState(0);
  const q = useQuery({ queryKey: ["due", round], queryFn: () => api.due(20), gcTime: 0 });
  if (q.isLoading) return <Skeleton className="h-80" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <Card className="p-5">
        {q.data.cards.length ? <FlashcardDeck key={round} cards={q.data.cards} /> : <EmptyState title="Không còn thẻ nào cần ôn hôm nay 🎉" />}
        <div className="mt-4 text-center"><Button variant="ghost" size="sm" onClick={() => setRound((r) => r + 1)}>Tải lượt mới</Button></div>
      </Card>
      <Card>
        <CardHeader><CardTitle>Cách lịch ôn hoạt động</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>{q.data.due_total} thẻ đến hạn. Mỗi lượt gồm thẻ đến hạn trước, rồi tối đa 10 từ mới theo thứ tự giáo trình.</p>
          <p>Thuật toán <b>SM-2</b>: “Chưa nhớ” → ôn lại ngày mai; nhớ được → khoảng cách tăng dần (1 ngày, 6 ngày, rồi nhân với hệ số dễ). Chọn “Khó” làm hệ số giảm, “Dễ” làm hệ số tăng.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Mistakes() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["mistakes"], queryFn: api.mistakes, refetchOnMount: "always" });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  if (q.isLoading) return <Skeleton className="h-80" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const list = q.data.mistakes;
  if (!list.length) return <EmptyState title="Chưa có câu sai nào" icon={<CheckCheck size={28} />}>Các câu trả lời sai (chấm tự động hoặc bạn tự đánh giá “cần xem lại”) sẽ xuất hiện ở đây.</EmptyState>;
  const check = async (m: (typeof list)[number]) => {
    const d = drafts[m.item_id];
    if (!isAnswered(m.item, d)) return;
    try {
      const r = await api.submitQuiz(m.quiz_id, { [m.item_id]: toResponse(m.item, d) });
      setResults((x) => ({ ...x, ...r.results }));
      if (r.results[m.item_id].verdict === "correct") toast.success("Đúng rồi! Câu này sẽ rời khỏi danh sách lỗi.");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không nộp được");
    }
  };
  return (
    <ul className="space-y-4">
      {list.map((m) => (
        <li key={m.item_id}>
          <p className="mb-1 text-xs text-muted"><Link className="text-primary underline" to={`/learn/${m.unit_id}`}>{m.unit_id} · {m.unit_title}</Link> · {m.step_title} · bạn đã trả lời “{m.response}”</p>
          <ItemCard item={m.item} unitId={m.unit_id} docPath="" draft={drafts[m.item_id]} onDraft={(d) => setDrafts((x) => ({ ...x, [m.item_id]: d }))}
            result={results[m.item_id]} locked={false}
            onSelfAssess={async (c) => { const r = results[m.item_id]; if (r) { const s = await api.selfAssess(r.attempt_id, c); setResults((x) => ({ ...x, [m.item_id]: s.result })); } }}
            onRetry={() => setResults((x) => { const n = { ...x }; delete n[m.item_id]; return n; })} onEnter={() => check(m)} />
          {!results[m.item_id] && <Button size="sm" className="mt-2" onClick={() => check(m)} disabled={!isAnswered(m.item, drafts[m.item_id])}>Kiểm tra lại</Button>}
        </li>
      ))}
    </ul>
  );
}
