import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Check, Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { AIErrorBox, AILoading } from "@/components/ai/AIStatus";
import { vocab } from "@/services/vocab";
import { Ipa, SourceNote, StateBadge, WordAudio } from "./components";

type Module = "reading" | "listening" | "writing" | "speaking" | "lesson";

function sentenceAround(text: string, start: number): string {
  const before = text.slice(0, start);
  const s = Math.max(before.lastIndexOf(". "), before.lastIndexOf("? "), before.lastIndexOf("! "), before.lastIndexOf("\n"));
  const rest = text.slice(start);
  const m = rest.search(/[.?!\n]/);
  return text.slice(s + 1, m >= 0 ? start + m + 1 : text.length).trim();
}

/**
 * Text whose English words can be clicked to look them up. The learner chooses which words to save
 * (nothing is added to the notebook automatically).
 */
export function LookupText({ text, module, refId, className }: { text: string; module: Module; refId?: string; className?: string }) {
  const [pick, setPick] = useState<{ word: string; sentence: string } | null>(null);
  const parts: ReactNode[] = [];
  const re = /[A-Za-z][A-Za-z'’-]*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>);
    const word = m[0];
    const at = m.index;
    parts.push(
      <span key={k++} role="button" tabIndex={0} className="cursor-pointer rounded hover:bg-primary-soft focus:bg-primary-soft focus:outline-none"
        onClick={() => setPick({ word, sentence: sentenceAround(text, at) })}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPick({ word, sentence: sentenceAround(text, at) }); } }}>
        {word}
      </span>,
    );
    last = at + word.length;
  }
  if (last < text.length) parts.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return (
    <>
      <span className={className}>{parts}</span>
      {pick && <LookupDialog word={pick.word} sentence={pick.sentence} module={module} refId={refId} onClose={() => setPick(null)} />}
    </>
  );
}

function LookupDialog({ word, sentence, module, refId, onClose }: { word: string; sentence: string; module: Module; refId?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["vocab-lookup", word.toLowerCase()], queryFn: () => vocab.lookup(word) });
  const [ctx, setCtx] = useState<{ meaning_vi_in_context: string; explanation_vi: string } | null>(null);
  const [ctxErr, setCtxErr] = useState<unknown>(null);
  const [ctxBusy, setCtxBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [meaning, setMeaning] = useState("");
  const e = q.data?.entries[0];
  const save = async () => {
    try {
      const r = await vocab.capture({ text: word, entry_id: e?.id, module, context: sentence, ref: refId, meaning_vi: e ? undefined : (meaning || ctx?.meaning_vi_in_context) });
      setSaved(true);
      toast.success(`Đã thêm “${r.lemma}” vào sổ từ và lịch học`);
      qc.invalidateQueries({ queryKey: ["vocab-overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được");
    }
  };
  const explain = async () => {
    setCtxBusy(true);
    setCtxErr(null);
    try {
      setCtx(await vocab.lookupContext(word, sentence));
    } catch (err) {
      setCtxErr(err);
    } finally {
      setCtxBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} title={e?.headword ?? word} description={sentence}>
      <div className="space-y-3 text-sm">
        {q.isLoading && <Skeleton className="h-24" />}
        {e && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <WordAudio entryId={e.id} text={e.lemma} /><Ipa uk={e.ipa_uk} us={e.ipa_us} />
              {e.cefr && <Badge>{e.cefr}</Badge>}<StateBadge state={e.progress?.state} />
              {e.lemma.toLowerCase() !== word.toLowerCase() && <span className="text-xs text-muted">({word} → {e.lemma})</span>}
            </div>
            <ol className="space-y-1">{e.senses.slice(0, 4).map((s, i) => <li key={s.id}>{i + 1}. <span className="text-xs text-muted">{s.pos_vi}</span> <b>{s.meaning_vi}</b>{s.definition_en && <span className="block text-xs text-muted">{s.definition_en}</span>}</li>)}</ol>
            <SourceNote status={e.status} />
          </div>
        )}
        {q.data && !e && (
          <div className="space-y-2">
            <p className="text-muted">“{word}” chưa có trong kho từ. Bạn vẫn có thể lưu thành từ riêng của mình.</p>
            <Input value={meaning} onChange={(ev) => setMeaning(ev.target.value)} placeholder="Nghĩa tiếng Việt (tùy chọn)" aria-label="Nghĩa tiếng Việt" />
          </div>
        )}
        {ctx && <div className="rounded-xl bg-primary-soft p-3"><p><b>Trong câu này:</b> {ctx.meaning_vi_in_context}</p><p className="text-xs text-muted">{ctx.explanation_vi}</p></div>}
        {ctxBusy && <AILoading label="AI đang xem ngữ cảnh…" />}
        {ctxErr != null && <AIErrorBox error={ctxErr} />}
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button onClick={save} disabled={saved}>{saved ? <><Check size={16} />Đã lưu</> : <><BookmarkPlus size={16} />Thêm vào sổ từ</>}</Button>
          {!ctx && <Button variant="outline" onClick={explain} disabled={ctxBusy}><Sparkles size={16} />Nghĩa trong câu này (AI)</Button>}
          {e && <Link to={`/vocabulary/word/${encodeURIComponent(e.id)}`} className="self-center text-primary" onClick={onClose}>Xem chi tiết →</Link>}
        </div>
      </div>
    </Dialog>
  );
}

/** Save a word/phrase suggested by AI feedback (Writing, Speaking) into the shared notebook. */
export function SaveWordButton({ text, module, meaning_vi, example, context }: { text: string; module: Module; meaning_vi?: string; example?: string; context?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" disabled={done} className="ml-1 inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-xs text-primary hover:bg-primary-soft disabled:text-success"
      aria-label={`Lưu “${text}” vào sổ từ`} onClick={async () => {
        try {
          await vocab.capture({ text, module, meaning_vi, example, context });
          setDone(true);
          toast.success(`Đã lưu “${text}” vào sổ từ`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Không lưu được");
        }
      }}>{done ? <Check size={12} /> : <BookmarkPlus size={12} />}{done ? "Đã lưu" : "Lưu"}</button>
  );
}
