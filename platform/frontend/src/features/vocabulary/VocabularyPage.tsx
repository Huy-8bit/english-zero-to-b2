import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Layers, Puzzle } from "lucide-react";
import { api } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { InlineMd } from "@/components/Markdown";
import { SpeakButton, TtsNote } from "@/components/SpeakButton";
import { FlashcardDeck } from "@/features/flashcards/FlashcardDeck";
import { MatchingGame } from "./MatchingGame";
import { cn } from "@/lib/utils";

export default function VocabularyPage() {
  const all = useQuery({ queryKey: ["vocabulary"], queryFn: () => api.vocabulary() });
  const [unit, setUnit] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "cards" | "match">("list");
  if (all.isLoading) return <Skeleton className="h-96" />;
  if (all.error || !all.data) return <ErrorBox error={all.error} onRetry={() => all.refetch()} />;
  const units = all.data.units;
  const current = unit ?? units[0]?.id;
  const cards = all.data.cards.filter((c) => c.unit_id === current);
  const topic = units.find((u) => u.id === current);
  return (
    <div>
      <PageHeader title="Từ vựng" subtitle={`${all.data.cards.length} từ/cụm từ từ 19 chủ đề, có IPA, nghĩa và ví dụ từ giáo trình.`}
        actions={<Link to="/review"><Button variant="outline"><Layers size={16} />Ôn thẻ đến hạn</Button></Link>} />
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Chủ đề" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {units.map((u) => (
            <button key={u.id} onClick={() => setUnit(u.id)} aria-current={u.id === current}
              className={cn("shrink-0 rounded-xl border px-3 py-2 text-left text-sm", u.id === current ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-primary/40")}>
              <span className="block font-medium">{u.title}</span>
              <span className="block text-xs text-muted">{u.id} · {u.seen}/{u.cards} đã học</span>
            </button>
          ))}
        </nav>
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-semibold">{topic?.title}</h2>
            {(["list", "cards", "match"] as const).map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "primary" : "outline"} onClick={() => setMode(m)} aria-pressed={mode === m}>
                {m === "list" ? <><BookOpen size={14} />Danh sách</> : m === "cards" ? <><Layers size={14} />Flashcards</> : <><Puzzle size={14} />Ghép nghĩa</>}
              </Button>
            ))}
            {current && <Link to={`/learn/${current}`}><Button size="sm" variant="secondary">Học bài & bài tập</Button></Link>}
          </div>
          {mode === "list" && (
            <>
              <TtsNote />
              <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
                {cards.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 p-3">
                    <SpeakButton text={c.word} label={`Nghe "${c.word}"`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.word} <span className="text-sm font-normal text-muted">{c.ipa} {c.pos && `· ${c.pos}`}</span></p>
                      <p className="text-sm"><InlineMd>{c.meaning}</InlineMd></p>
                      {c.example && <p className="text-sm text-muted"><InlineMd>{c.example}</InlineMd></p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge>{c.topic}</Badge>
                      {c.srs && <span className="text-[11px] text-muted">ôn lại {c.srs.due}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {mode === "cards" && <Card className="p-5"><FlashcardDeck key={current} cards={cards} onFinish={() => all.refetch()} /></Card>}
          {mode === "match" && <Card className="p-5"><MatchingGame key={current} cards={cards} /></Card>}
        </div>
      </div>
    </div>
  );
}
