import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import type { Card } from "@/types/content";
import { Button } from "@/components/ui/button";
import { InlineMd } from "@/components/Markdown";
import { cn, plain } from "@/lib/utils";

/** Match English words with their Vietnamese meanings (pairs come straight from the vocabulary tables). */
export function MatchingGame({ cards }: { cards: Card[] }) {
  const [seed, setSeed] = useState(0);
  const round = useMemo(() => {
    const pool = [...cards].sort(() => Math.random() - 0.5).slice(0, 6);
    return { words: pool, meanings: [...pool].sort(() => Math.random() - 0.5) };
  }, [cards, seed]);
  const [picked, setPicked] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const reset = () => { setSeed((s) => s + 1); setMatched(new Set()); setPicked(null); setMistakes(0); };
  const choose = (id: string) => {
    if (!picked) return;
    if (picked === id) {
      setMatched((m) => new Set(m).add(id));
      setPicked(null);
    } else {
      setWrong(id);
      setMistakes((x) => x + 1);
      setTimeout(() => setWrong(null), 500);
    }
  };
  if (cards.length < 2) return <p className="text-sm text-muted">Cần ít nhất 2 từ.</p>;
  const finished = matched.size === round.words.length;
  return (
    <div>
      <p className="mb-3 text-sm text-muted">Chọn một từ tiếng Anh, rồi chọn nghĩa đúng. {finished ? `Xong! Sai ${mistakes} lần.` : `${matched.size}/${round.words.length} cặp`}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ul className="space-y-2" aria-label="Từ tiếng Anh">
          {round.words.map((c) => (
            <li key={c.id}>
              <button type="button" disabled={matched.has(c.id)} onClick={() => setPicked(c.id)} aria-pressed={picked === c.id}
                className={cn("w-full rounded-xl border px-3 py-2.5 text-left font-medium", matched.has(c.id) ? "border-success bg-success-soft text-success" : picked === c.id ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-primary/50")}>
                {c.word}
              </button>
            </li>
          ))}
        </ul>
        <ul className="space-y-2" aria-label="Nghĩa tiếng Việt">
          {round.meanings.map((c) => (
            <li key={c.id}>
              <button type="button" disabled={matched.has(c.id) || !picked} onClick={() => choose(c.id)}
                className={cn("w-full rounded-xl border px-3 py-2.5 text-left text-sm", matched.has(c.id) ? "border-success bg-success-soft" : wrong === c.id ? "border-danger bg-danger-soft" : "border-border bg-surface hover:border-primary/50")}
                aria-label={plain(c.meaning)}>
                <InlineMd>{c.meaning}</InlineMd>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Button variant="outline" size="sm" className="mt-4" onClick={reset}><Shuffle size={14} />Lượt mới</Button>
    </div>
  );
}
