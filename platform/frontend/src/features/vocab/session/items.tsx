import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKE } from "react";
import { motion } from "motion/react";
import { Eye, Headphones, Lightbulb, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { useUI } from "@/stores/ui";
import { vocab, type SessionItem } from "@/services/vocab";
import { Markdown } from "@/components/Markdown";
import { Ipa, WordAudio, useAudio } from "../components";

export type Submit = (body: Record<string, unknown>) => void;
interface P { it: SessionItem; sid: string; submit: Submit; busy: boolean }

const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

/** MODE 1 teaching card: one idea at a time (word → sound → meaning → example → usage). */
export function LearnItem({ it, submit, busy }: P) {
  const [step, setStep] = useState(0);
  const steps = 3 + (it.usage?.length || it.collocations?.length || it.mistake || it.confused ? 1 : 0);
  const next = () => (step + 1 < steps ? setStep(step + 1) : submit({}));
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (!typing(e) && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  return (
    <div className="space-y-5 text-center">
      <Badge tone="primary">Từ mới</Badge>
      <div>
        <p data-testid="learn-word" className="text-4xl font-bold tracking-tight sm:text-5xl">{it.word}</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <WordAudio entryId={it.entry_id!} text={it.lemma ?? it.word ?? ""} />
          {it.ipa_us && it.ipa_us !== it.ipa_uk && <WordAudio entryId={it.entry_id!} text={it.lemma ?? ""} accent="us" />}
          <Ipa uk={it.ipa_uk} us={it.ipa_us} />
          {it.pos_vi && <span className="text-sm text-muted">· {it.pos_vi}</span>}
        </div>
      </div>
      {step >= 1 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl rounded-2xl bg-primary-soft p-4">
          <p data-testid="learn-meaning" className="text-xl font-semibold text-primary">{it.meaning_vi}</p>
          {it.definition_en && <p className="mt-1 text-sm text-muted">{it.definition_en}</p>}
          {(it.senses?.length ?? 0) > 1 && (
            <ul className="mt-2 space-y-0.5 text-left text-sm">
              {it.senses!.slice(1).map((s, i) => <li key={i}>• <span className="text-muted">{s.pos_vi}</span> {s.meaning_vi}</li>)}
            </ul>
          )}
        </motion.div>
      )}
      {step >= 1 && it.entry_id && <Mnemonic entryId={it.entry_id} />}
      {step >= 2 && it.example && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl text-left">
          <p className="text-lg"><i>{it.example.en}</i></p>
          {it.example.vi && <p className="text-sm text-muted">{it.example.vi}</p>}
        </motion.div>
      )}
      {step >= 3 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl space-y-2 text-left text-sm">
          {!!it.usage?.length && <p><b>Cách dùng:</b> {it.usage.join(" · ")}</p>}
          {!!it.collocations?.length && <p><b>Hay đi với:</b> {it.collocations.join(" · ")}</p>}
          {!!it.family?.length && <p><b>Họ từ:</b> {it.family.join(", ")}</p>}
          {it.mistake && <p className="rounded-xl bg-warning-soft px-3 py-2"><b>Lỗi hay gặp:</b> {it.mistake.vi && <>“{it.mistake.vi}”: </>}❌ {it.mistake.wrong} → ✅ {it.mistake.right}</p>}
          {it.confused && <p className="rounded-xl bg-surface-2 px-3 py-2"><b>Dễ nhầm với:</b> {it.confused.words.join(", ")} — {it.confused.note_vi}</p>}
        </motion.div>
      )}
      <Button size="lg" onClick={next} disabled={busy}>{step + 1 < steps ? ["Xem nghĩa", "Xem ví dụ", "Xem cách dùng"][step] : "Tiếp tục"} <kbd className="ml-1 text-xs opacity-70">Enter</kbd></Button>
    </div>
  );
}

/** AI memory hint for a new word (association + a real-life phrase + a sentence to practise); cached per word on the server. */
function Mnemonic({ entryId }: { entryId: string }) {
  const [state, setState] = useState<{ busy: boolean; text: string | null; err: string | null }>({ busy: false, text: null, err: null });
  if (state.text) return <div className="mx-auto max-w-xl rounded-2xl border border-border p-3 text-left text-sm"><p className="mb-1 text-xs font-semibold text-muted">Mẹo nhớ (AI gợi ý)</p><Markdown className="text-sm">{state.text}</Markdown></div>;
  return (
    <div>
      <button type="button" disabled={state.busy} className="inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50"
        onClick={async () => {
          setState({ busy: true, text: null, err: null });
          try { setState({ busy: false, text: (await vocab.tutor({ entry_id: entryId, action: "remember" })).answer, err: null }); }
          catch (e) { setState({ busy: false, text: null, err: e instanceof Error ? e.message : "AI chưa sẵn sàng" }); }
        }}><Lightbulb size={14} />{state.busy ? "Đang nghĩ mẹo nhớ…" : "Mẹo nhớ (AI)"}</button>
      {state.err && <p className="text-xs text-warning">{state.err}</p>}
    </div>
  );
}

/** MODE 2 flashcard: try to recall first; ratings update the real FSRS schedule. */
export function FlashcardItem({ it, submit, busy }: P) {
  const [flipped, setFlipped] = useState(false);
  const ratings = [
    { r: 1, label: "Quên", hint: "Không nhớ", v: "danger" as const }, { r: 2, label: "Khó", hint: "Nhớ rất chật vật", v: "outline" as const },
    { r: 3, label: "Nhớ", hint: "Nhớ được", v: "success" as const }, { r: 4, label: "Dễ", hint: "Nhớ ngay", v: "outline" as const },
  ];
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (typing(e) || busy) return;
      if (e.key === " " || (e.key === "Enter" && !flipped)) { e.preventDefault(); setFlipped(true); }
      if (flipped && ["1", "2", "3", "4"].includes(e.key)) submit({ rating: Number(e.key) });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [flipped, busy, submit]);
  return (
    <div className="space-y-5">
      <div className="mx-auto w-full max-w-xl [perspective:1200px]">
        <motion.div animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.35 }} className="relative min-h-64 [transform-style:preserve-3d]">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-surface p-6 text-center shadow-sm [backface-visibility:hidden]">
            <p data-testid="card-word" className="text-4xl font-bold">{it.word}</p>
            <div className="flex items-center gap-2"><WordAudio entryId={it.entry_id!} text={it.lemma ?? ""} /><Ipa uk={it.ipa_uk} us={it.ipa_us} /></div>
            {it.context && <p className="max-w-md text-sm text-muted"><i>{it.context}</i></p>}
            <p className="text-xs text-muted">Hãy cố nhớ nghĩa trước khi lật thẻ.</p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-3xl border border-primary/40 bg-surface p-6 text-center shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-sm text-muted">{it.word} · {it.pos_vi}</p>
            <p className="text-2xl font-semibold text-primary">{it.meaning_vi}</p>
            {it.definition_en && <p className="text-sm text-muted">{it.definition_en}</p>}
            {it.example && <p className="text-sm"><i>{it.example.en}</i>{it.example.vi && <span className="block text-muted">{it.example.vi}</span>}</p>}
            {!!it.collocations?.length && <p className="text-xs text-muted">{it.collocations.slice(0, 3).join(" · ")}</p>}
          </div>
        </motion.div>
      </div>
      {!flipped ? (
        <div className="text-center"><Button size="lg" onClick={() => setFlipped(true)}><Eye size={18} />Lật thẻ <kbd className="ml-1 text-xs opacity-70">Space</kbd></Button></div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Bạn nhớ từ này thế nào?">
          {ratings.map((x) => (
            <Button key={x.r} variant={x.v} disabled={busy} onClick={() => submit({ rating: x.r })} className="h-auto flex-col py-2">
              <span>{x.label} <kbd className="text-xs opacity-70">{x.r}</kbd></span><span className="text-[11px] font-normal opacity-80">{x.hint}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Recognition / contextual / collocation / confusable / listening-choice items. Keys 1–4 choose. */
export function ChoiceItem({ it, sid, submit, busy }: P) {
  const { play, fallback } = useAudio();
  const rate = useUI((s) => s.ttsRate);
  const isListen = it.type === "listen_choose";
  const playItem = () => play(`${sid}:${it.id}`, () => vocab.itemAudio(sid, it.id), async () => atob((await vocab.itemSpeakText(sid, it.id)).b64));
  useEffect(() => {
    if (isListen) void playItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it.id]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (typing(e) || busy) return;
      const n = Number(e.key);
      if (n >= 1 && n <= (it.options?.length ?? 0)) submit({ choice: n - 1 });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [it, busy, submit]);
  const title = it.type === "mc_meaning" ? it.word : it.type === "mc_word" ? it.meaning_vi : null;
  return (
    <div className="space-y-5">
      <p className="text-center text-sm font-medium text-muted">{it.prompt_vi}{it.ai_generated && <Badge tone="primary" className="ml-2">AI tạo</Badge>}</p>
      {title && <p data-testid="choice-title" className="text-center text-3xl font-bold">{title}{it.pos_vi && <span className="ml-2 text-base font-normal text-muted">({it.pos_vi})</span>}</p>}
      {it.type === "mc_meaning" && <div className="flex justify-center"><WordAudio entryId={it.entry_id!} text={it.word ?? ""} /></div>}
      {(it.sentence || it.phrase) && <p className="mx-auto max-w-2xl text-center text-xl leading-relaxed sm:text-2xl">{it.sentence ?? it.phrase}</p>}
      {it.type === "collocation" && it.meaning_vi && <p className="text-center text-sm text-muted">Nghĩa: {it.meaning_vi}</p>}
      {isListen && (
        <div className="flex flex-col items-center gap-1">
          <Button variant="outline" onClick={() => void playItem()}><Headphones size={18} />Nghe lại</Button>
          {fallback && <p className="text-xs text-muted">Giọng đọc tổng hợp của trình duyệt (rate {rate}).</p>}
        </div>
      )}
      <div className="mx-auto grid max-w-2xl gap-2 sm:grid-cols-2">
        {it.options?.map((o, i) => (
          <Button key={i} variant="outline" size="lg" disabled={busy} onClick={() => submit({ choice: i })} className="h-auto justify-start py-3 text-left">
            <kbd className="mr-2 rounded-md bg-surface-2 px-1.5 text-xs text-muted">{i + 1}</kbd>{o}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** MODE 3 type the answer / MODE 4 dictation. */
export function TypeItem({ it, sid, submit, busy }: P) {
  const [v, setV] = useState("");
  const [showHint, setShowHint] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const { play, fallback } = useAudio();
  const dict = it.type === "dictation";
  const playItem = () => play(`${sid}:${it.id}`, () => vocab.itemAudio(sid, it.id), async () => atob((await vocab.itemSpeakText(sid, it.id)).b64));
  useEffect(() => {
    ref.current?.focus();
    if (dict) void playItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it.id]);
  const send = () => { if (!busy) submit({ answer: v }); };
  return (
    <div className="space-y-5 text-center">
      <p className="text-sm font-medium text-muted">{it.prompt_vi}</p>
      {dict ? (
        <div className="flex flex-col items-center gap-2">
          <Button size="lg" variant="outline" onClick={() => void playItem()}><Headphones size={20} />Nghe ({it.words} từ)</Button>
          {fallback && <p className="text-xs text-muted">Đang dùng giọng đọc tổng hợp của trình duyệt.</p>}
        </div>
      ) : (
        <div>
          <p data-testid="type-meaning" className="text-3xl font-bold">{it.meaning_vi}</p>
          {it.pos_vi && <p className="text-sm text-muted">{it.pos_vi}</p>}
          {it.example_vi && <p className="mt-2 text-sm text-muted">Ví dụ: {it.example_vi}</p>}
        </div>
      )}
      <form className="mx-auto flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Input ref={ref} value={v} onChange={(e) => setV(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}
          aria-label="Câu trả lời tiếng Anh" placeholder={showHint && it.hint ? `${it.hint.first}${"_".repeat(Math.max(0, it.hint.length - 1))}` : "Gõ tiếng Anh…"} />
        <Button type="submit" disabled={busy}><Send size={16} />Kiểm tra</Button>
      </form>
      <div className="flex justify-center gap-2">
        {it.hint && !showHint && <Button variant="ghost" size="sm" onClick={() => setShowHint(true)}><Lightbulb size={14} />Gợi ý chữ đầu</Button>}
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => submit({ answer: "" })}>Tôi không nhớ</Button>
      </div>
    </div>
  );
}

/** MODE 7 sentence builder: click/Enter to move a word, drag to reorder, Backspace removes the last word. */
export function BuilderItem({ it, submit, busy }: P) {
  const tokens = useMemo(() => (it.tokens ?? []).map((t, i) => ({ t, i })), [it.tokens]);
  const [line, setLine] = useState<number[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const pool = tokens.filter((x) => !line.includes(x.i));
  const add = (i: number) => setLine((l) => [...l, i]);
  const remove = (i: number) => setLine((l) => l.filter((x) => x !== i));
  const move = (from: number, to: number) => setLine((l) => {
    const c = [...l];
    const [x] = c.splice(from, 1);
    c.splice(to, 0, x);
    return c;
  });
  const onKey = (e: RKE<HTMLDivElement>) => {
    if (e.key === "Backspace" && line.length) { e.preventDefault(); setLine((l) => l.slice(0, -1)); }
  };
  return (
    <div className="space-y-5" onKeyDown={onKey}>
      <p className="text-center text-sm font-medium text-muted">{it.prompt_vi}{it.meaning_vi && <span className="block text-fg">“{it.meaning_vi}”</span>}</p>
      <div aria-label="Câu của bạn" className="mx-auto flex min-h-16 max-w-2xl flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-border p-3">
        {line.length === 0 && <span className="text-sm text-muted">Chọn các từ bên dưới theo đúng thứ tự…</span>}
        {line.map((ti, pos) => (
          <button key={ti} draggable onDragStart={() => setDrag(pos)} onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (drag !== null) move(drag, pos); setDrag(null); }}
            onClick={() => remove(ti)} className="rounded-xl bg-primary px-3 py-1.5 text-primary-fg" aria-label={`Bỏ “${tokens[ti].t}”`}>
            {tokens[ti].t}
          </button>
        ))}
        {line.length > 0 && <span className="text-muted">{it.end}</span>}
      </div>
      <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2">
        {pool.map((x) => (
          <button key={x.i} onClick={() => add(x.i)} className="rounded-xl border border-border bg-surface px-3 py-1.5 hover:bg-surface-2 focus:ring-2 focus:ring-primary/30" aria-label={`Thêm “${x.t}”`}>
            {x.t}
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="ghost" onClick={() => setLine([])} disabled={!line.length}><RotateCcw size={16} />Làm lại</Button>
        <Button disabled={busy || pool.length > 0} onClick={() => submit({ tokens: line.map((i) => tokens[i].t) })}><Send size={16} />Kiểm tra</Button>
      </div>
    </div>
  );
}

/** MODE 8: write your own sentence; AI grades. Without AI: compare with the example and self-assess. */
export function UseItItem({ it, submit, busy, aiDown }: P & { aiDown: boolean }) {
  const [v, setV] = useState("");
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm font-medium text-muted">{it.prompt_vi}</p>
        <p className="mt-1 text-3xl font-bold">{it.word}</p>
        <p className="text-sm text-muted">{it.pos_vi} · {it.meaning_vi}</p>
      </div>
      <Textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder="Viết một câu tiếng Anh của bạn…" aria-label="Câu của bạn" className="mx-auto max-w-2xl" />
      {!aiDown ? (
        <div className="text-center"><Button disabled={busy || v.trim().split(/\s+/).length < 3} onClick={() => submit({ sentence: v })}><Send size={16} />Nhờ AI chấm</Button></div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-2 rounded-2xl bg-surface-2 p-4 text-sm">
          <p>AI đang không khả dụng. So sánh câu của bạn với câu mẫu rồi tự đánh giá:</p>
          {it.example && <p><i>{it.example.en}</i>{it.example.vi && <> — {it.example.vi}</>}</p>}
          <div className="flex flex-wrap gap-2">
            {([["correct", "Câu của tôi đúng"], ["partly", "Gần đúng"], ["wrong", "Chưa đúng"]] as const).map(([k, l]) => (
              <Button key={k} variant="outline" size="sm" disabled={busy || !v.trim()} onClick={() => submit({ sentence: v, self: k })}>{l}</Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ItemView(props: P & { aiDown: boolean }) {
  const t = props.it.type;
  if (t === "learn") return <LearnItem {...props} />;
  if (t === "flashcard") return <FlashcardItem {...props} />;
  if (t === "type_word" || t === "dictation") return <TypeItem {...props} />;
  if (t === "builder") return <BuilderItem {...props} />;
  if (t === "use_it") return <UseItItem {...props} />;
  return <ChoiceItem {...props} />;
}

export const typeLabel: Record<string, string> = {
  learn: "Học từ", flashcard: "Flashcard", mc_meaning: "Nhận diện", mc_word: "Nhận diện", listen_choose: "Nghe chọn", type_word: "Nhớ lại",
  dictation: "Chính tả", cloze: "Ngữ cảnh", collocation: "Collocation", builder: "Sắp xếp câu", confusable: "Từ dễ nhầm", use_it: "Tự đặt câu",
};
