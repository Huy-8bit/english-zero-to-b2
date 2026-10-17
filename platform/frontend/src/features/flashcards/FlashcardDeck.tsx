import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, RotateCcw, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Card } from "@/types/content";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { InlineMd } from "@/components/Markdown";
import { SpeakButton } from "@/components/SpeakButton";
import { toast } from "@/components/ui/toast";

const GRADES = [
  { grade: 1, label: "Quên", hint: "Hỏi lại sau ~10 phút", key: "1", variant: "danger" as const },
  { grade: 3, label: "Khó", hint: "Nhớ nhưng chật vật", key: "2", variant: "outline" as const },
  { grade: 4, label: "Nhớ", hint: "Nhớ được", key: "3", variant: "success" as const },
  { grade: 5, label: "Dễ", hint: "Nhớ ngay", key: "4", variant: "outline" as const },
];

/**
 * Flip cards; each answer is sent to the server, which schedules the next review with FSRS (shared vocabulary progress).
 * `simple` shows only Know / Don't know (mapped to grades 4 and 1).
 */
export function FlashcardDeck({ cards, simple = false, onFinish }: { cards: Card[]; simple?: boolean; onFinish?: (stats: { known: number; total: number }) => void }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const card = cards[i];

  const grade = async (g: number) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      const r = await api.review(card.id, g);
      if (r.xp_gained) toast.success(`+${r.xp_gained} XP`);
      if (g >= 3) setKnown((k) => k + 1);
      setFlipped(false);
      if (i + 1 >= cards.length) {
        onFinish?.({ known: known + (g >= 3 ? 1 : 0), total: cards.length });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      }
      setI((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được kết quả ôn tập");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " " ) { e.preventDefault(); setFlipped((f) => !f); }
      if (!flipped) return;
      if (simple) {
        if (e.key === "1") grade(1);
        if (e.key === "2") grade(4);
      } else {
        const g = GRADES.find((x) => x.key === e.key);
        if (g) grade(g.grade);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!cards.length) return <p className="text-muted">Không có thẻ nào.</p>;
  if (!card) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-lg font-semibold">Hoàn thành lượt ôn 🎉</p>
        <p className="mt-1 text-muted">Bạn nhớ {known}/{cards.length} thẻ. Lịch ôn tiếp theo đã được lưu.</p>
        <Button variant="outline" className="mt-4" onClick={() => { setI(0); setKnown(0); }}><RotateCcw size={16} /> Ôn lại bộ này</Button>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-xl">
      <p className="mb-2 text-center text-sm text-muted">Thẻ {i + 1}/{cards.length} · Nhấn Space để lật</p>
      <div className="[perspective:1200px]">
        <AnimatePresence mode="wait">
          <motion.button key={`${card.id}-${flipped}`} type="button" onClick={() => setFlipped((f) => !f)}
            initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="flex min-h-64 w-full flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-surface p-8 text-center shadow-sm"
            aria-label={flipped ? "Mặt sau — nhấn để lật lại" : "Mặt trước — nhấn để xem nghĩa"}>
            {!flipped ? (
              <>
                <span className="text-3xl font-bold">{card.word}</span>
                {card.ipa && <span className="text-muted">{card.ipa}</span>}
                {card.pos && <span className="text-xs text-muted">{card.pos}</span>}
                <span className="mt-2 text-xs text-muted">{card.unit_title} · {card.topic}</span>
              </>
            ) : (
              <>
                <span className="text-xl font-semibold"><InlineMd>{card.meaning}</InlineMd></span>
                {card.example && <span className="text-muted"><InlineMd>{card.example}</InlineMd></span>}
                <span className="text-xs text-muted">{card.word} {card.ipa}</span>
              </>
            )}
          </motion.button>
        </AnimatePresence>
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <SpeakButton text={card.word} label={`Nghe "${card.word}"`} />
        {card.example && <SpeakButton text={card.example} label="Nghe câu ví dụ" />}
      </div>
      {flipped ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(simple ? [GRADES[0], GRADES[2]] : GRADES).map((g, idx) => (
            <Button key={g.grade} variant={g.variant} disabled={busy} onClick={() => grade(g.grade)} className="h-auto flex-col py-2">
              <span className="flex items-center gap-1">{g.grade === 1 ? <X size={14} /> : g.grade >= 4 ? <Check size={14} /> : null}{simple ? (g.grade === 1 ? "Chưa biết" : "Đã biết") : g.label}</span>
              <span className="text-[11px] opacity-80">{simple ? `phím ${idx + 1}` : `${g.hint} · phím ${g.key}`}</span>
            </Button>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex justify-center"><Button onClick={() => setFlipped(true)}>Lật thẻ</Button></div>
      )}
    </div>
  );
}
