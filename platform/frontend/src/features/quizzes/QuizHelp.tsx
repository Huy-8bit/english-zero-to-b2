import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { SpeakButton } from "@/components/SpeakButton";
import { ai, type QuizHelp as Help } from "@/services/ai";

/** Help for a question the learner cannot start: meanings of the words in it and a hint that never gives the answer. */
export function QuizHelpButton({ itemId }: { itemId: string }) {
  const [help, setHelp] = useState<Help | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = async () => {
    if (help || busy) return;
    setBusy(true);
    setErr(null);
    try {
      setHelp(await ai.quizHelp(itemId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Chưa lấy được gợi ý");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2">
      {!help && (
        <button type="button" onClick={() => void open()} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-60">
          <Lightbulb size={14} />{busy ? "Đang tìm gợi ý…" : "Gợi ý (nghĩa từ & cách làm)"}
        </button>
      )}
      {err && <p className="text-xs text-danger">{err}</p>}
      {help && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft/40 p-3 text-sm" data-testid="quiz-help">
          {help.words.length > 0 && (
            <>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Từ trong câu</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {help.words.map((w) => (
                  <li key={w.entry_id} className="flex items-center gap-1.5">
                    <SpeakButton text={w.lemma} size={13} className="p-0.5" label={`Nghe “${w.lemma}”`} />
                    <b>{w.word}</b>{w.ipa && <span className="font-mono text-xs text-muted">{w.ipa}</span>}
                    <span className="text-muted">— {w.meaning_vi}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2"><Lightbulb size={14} className="mr-1 inline text-primary" />
            {help.hint_vi ?? (help.ai ? "Chưa có gợi ý an toàn cho câu này (gợi ý không được để lộ đáp án)." : "AI chưa sẵn sàng — xem nghĩa các từ ở trên.")}</p>
          <p className="mt-1 text-xs text-muted">Vẫn chưa làm được? Bấm “Không biết — xem đáp án”.</p>
        </div>
      )}
    </div>
  );
}
