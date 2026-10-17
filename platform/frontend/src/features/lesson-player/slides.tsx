import { useMemo, useState } from "react";
import { Eye, EyeOff, Lightbulb, Pause, Play } from "lucide-react";
import type { Card, Step } from "@/types/content";
import { InlineMd, Markdown } from "@/components/Markdown";
import { SpeakButton, TtsNote } from "@/components/SpeakButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/misc";
import { plain, cn } from "@/lib/utils";
import { speak, speakSequence, stopSpeaking, ttsSupported } from "@/lib/tts";
import { useUI } from "@/stores/ui";
import { FlashcardDeck } from "@/features/flashcards/FlashcardDeck";

export function ConceptSlide({ step, docPath }: { step: Step; docPath: string }) {
  return <Markdown docPath={docPath}>{step.md}</Markdown>;
}

/** Formula slide: the source tables plus clickable formula parts explained by the lesson's own legend. */
export function FormulaSlide({ step, docPath }: { step: Step; docPath: string }) {
  const symbols = step.symbols ?? {};
  function lookup(tok: string) {
    const base = tok.replace(/[?.!]/g, "").replace(/\(.*\)/, "").trim();
    return symbols[tok] ?? symbols[base] ?? Object.entries(symbols).find(([k]) => k.toLowerCase() === base.toLowerCase())?.[1];
  }
  const formulas = useMemo(() => {
    const out: string[] = [];
    for (const line of step.md.split("\n")) {
      for (const cell of line.split("|")) {
        const t = plain(cell).trim();
        if (/^(?:[A-Za-z][\w'’()/-]*\??|\+|…|\.\.\.)(\s+\+\s+\S.*)$/.test(t) && t.length < 80 && !out.includes(t)) out.push(t);
      }
    }
    return out.filter((f) => f.split(/\s+\+\s+/).some((t) => lookup(t))).slice(0, 8);
  }, [step.md]);
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="space-y-5">
      {formulas.length > 0 && Object.keys(symbols).length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary-soft/50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><Lightbulb size={16} />Bấm vào từng thành phần để xem giải thích</p>
          <div className="space-y-2">
            {formulas.map((f) => (
              <div key={f} className="flex flex-wrap items-center gap-1.5">
                {f.split(/\s+(\+)\s+/).map((tok, i) =>
                  tok === "+" ? <span key={i} className="text-muted">+</span> : (
                    <button key={i} type="button" onClick={() => setActive(active === `${f}:${i}` ? null : `${f}:${i}`)}
                      className={cn("rounded-lg border px-2.5 py-1 font-mono text-sm transition",
                        lookup(tok) ? "border-primary/40 bg-surface hover:border-primary" : "border-border bg-surface",
                        active === `${f}:${i}` && "border-primary bg-primary text-primary-fg")}>{tok}</button>
                  ))}
                {formulas.length && active?.startsWith(`${f}:`) && (
                  <span className="basis-full text-sm">
                    {(() => {
                      const tok = f.split(/\s+(\+)\s+/)[Number(active.split(":").pop())];
                      return lookup(tok) ? <><b>{tok}</b> = {lookup(tok)}</> : <span className="text-muted">Thành phần này được giải thích trong bảng bên dưới.</span>;
                    })()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <Markdown docPath={docPath}>{step.md}</Markdown>
    </div>
  );
}

export function ExamplesSlide({ step, docPath }: { step: Step; docPath: string }) {
  const [showVi, setShowVi] = useState(false);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const examples = step.examples ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowVi((v) => !v)} aria-pressed={showVi}>
          {showVi ? <EyeOff size={14} /> : <Eye size={14} />}{showVi ? "Ẩn tất cả bản dịch" : "Hiện tất cả bản dịch"}
        </Button>
        <span className="text-xs text-muted">Thử tự dịch trước, rồi bấm vào ví dụ để xem bản dịch và phân tích.</span>
      </div>
      <ul className="space-y-3">
        {examples.map((ex, i) => {
          const expanded = showVi || open[i];
          return (
            <li key={i} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start gap-2">
                <button type="button" className="min-w-0 flex-1 text-left text-[17px] leading-relaxed" onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))} aria-expanded={!!expanded}>
                  {ex.use && <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-primary"><InlineMd>{ex.use}</InlineMd></span>}
                  <InlineMd>{ex.en}</InlineMd>
                </button>
                <SpeakButton text={ex.en} />
              </div>
              {expanded && (
                <div className="mt-2 space-y-1 border-t border-border pt-2 text-sm">
                  {ex.vi && <p className="text-muted">🇻🇳 <InlineMd>{ex.vi}</InlineMd></p>}
                  {ex.note && <p><span className="font-medium">Phân tích:</span> <InlineMd>{ex.note}</InlineMd></p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {step.md && <Markdown docPath={docPath}>{step.md}</Markdown>}
    </div>
  );
}

export function MistakesSlide({ step, docPath }: { step: Step; docPath: string }) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [attempts, setAttempts] = useState<Record<number, string>>({});
  const list = step.mistakes ?? [];
  const done = Object.values(revealed).filter(Boolean).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Mỗi câu dưới đây có lỗi. Tự tìm và sửa trước, rồi bấm “Xem câu đúng”. ({done}/{list.length} đã xem)</p>
      <ul className="space-y-3">
        {list.map((m, i) => (
          <li key={i} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-[16px]"><span className="mr-2 rounded bg-danger-soft px-1.5 py-0.5 text-xs font-semibold text-danger">Sai</span><InlineMd>{m.wrong}</InlineMd></p>
            {!revealed[i] ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input value={attempts[i] ?? ""} onChange={(e) => setAttempts((a) => ({ ...a, [i]: e.target.value }))} placeholder="Câu bạn sửa (không bắt buộc)" aria-label="Câu bạn sửa" />
                <Button variant="secondary" className="whitespace-nowrap" onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}>Xem câu đúng</Button>
              </div>
            ) : (
              <div className="mt-3 space-y-1 text-sm">
                {attempts[i] && <p className="text-muted">Bạn sửa: {attempts[i]}</p>}
                <p className="text-[16px]"><span className="mr-2 rounded bg-success-soft px-1.5 py-0.5 text-xs font-semibold text-success">Đúng</span><InlineMd>{m.right}</InlineMd></p>
                {m.cause && <p><span className="font-medium">Nguyên nhân:</span> <InlineMd>{m.cause}</InlineMd></p>}
                {m.tip && <p><span className="font-medium">Cách tránh:</span> <InlineMd>{m.tip}</InlineMd></p>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {step.md && <Markdown docPath={docPath}>{step.md}</Markdown>}
    </div>
  );
}

export function DialogueSlide({ step, docPath }: { step: Step; docPath: string }) {
  const rate = useUI((s) => s.ttsRate);
  const [current, setCurrent] = useState(-1);
  const [stopFn, setStopFn] = useState<null | (() => void)>(null);
  const lines = step.lines ?? [];
  const speakers = Array.from(new Set(lines.map((l) => l.speaker).filter(Boolean)));
  const playAll = () => {
    const stop = speakSequence(lines.filter((l) => l.speaker), { rate, onLine: setCurrent, onDone: () => { setCurrent(-1); setStopFn(null); } });
    setStopFn(() => stop);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {stopFn ? <Button size="sm" variant="outline" onClick={() => { stopFn(); stopSpeaking(); setStopFn(null); setCurrent(-1); }}><Pause size={14} />Dừng</Button>
          : <Button size="sm" onClick={playAll} disabled={!ttsSupported()}><Play size={14} />Nghe cả đoạn hội thoại</Button>}
        <TtsNote />
      </div>
      <ol className="space-y-2">
        {lines.filter((l) => l.speaker).map((l, i) => {
          const right = speakers.indexOf(l.speaker) % 2 === 1;
          return (
            <li key={i} className={cn("flex items-end gap-2", right && "flex-row-reverse")}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary" aria-hidden>{l.speaker.slice(0, 2)}</span>
              <div className={cn("max-w-[85%] rounded-2xl border px-3 py-2 text-[15px]", right ? "border-primary/30 bg-primary-soft" : "border-border bg-surface", current === i && "ring-2 ring-primary")}>
                <p className="text-xs font-semibold text-muted">{l.speaker}</p>
                <p>{l.text}</p>
              </div>
              <button type="button" className="mb-1 rounded-lg p-1 text-muted hover:text-primary" aria-label={`Nghe câu của ${l.speaker}`}
                onClick={() => speak(l.text, { rate, voiceIndex: speakers.indexOf(l.speaker) })}>▶</button>
            </li>
          );
        })}
      </ol>
      {step.md && (
        <details className="rounded-2xl border border-border bg-surface p-4" open>
          <summary className="cursor-pointer font-medium">Giải thích & cụm từ hữu ích</summary>
          <Markdown docPath={docPath} className="mt-3">{step.md}</Markdown>
        </details>
      )}
    </div>
  );
}

export function PassageSlide({ step, docPath }: { step: Step; docPath: string }) {
  const rate = useUI((s) => s.ttsRate);
  return (
    <div className="space-y-3">
      {step.tts && ttsSupported() && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => speak(step.tts!, { rate })}><Play size={14} />Nghe đoạn văn</Button>
          <Button size="sm" variant="ghost" onClick={stopSpeaking}><Pause size={14} />Dừng</Button>
          <TtsNote />
        </div>
      )}
      <Markdown docPath={docPath}>{step.md}</Markdown>
    </div>
  );
}

export function RecapSlide({ step, docPath, checked, onChecked }: { step: Step; docPath: string; checked: Record<string, boolean>; onChecked: (v: Record<string, boolean>) => void }) {
  const list = step.checklist ?? [];
  return (
    <div className="space-y-5">
      {list.length > 0 && (
        <fieldset className="rounded-2xl border border-border bg-surface p-4">
          <legend className="px-1 text-sm font-semibold">Checklist — tôi đã làm được</legend>
          {list.map((c) => (
            <label key={c} className="flex items-start gap-2 py-1">
              <input type="checkbox" className="mt-1.5" checked={!!checked[c]} onChange={(e) => onChecked({ ...checked, [c]: e.target.checked })} />
              <InlineMd>{c}</InlineMd>
            </label>
          ))}
        </fieldset>
      )}
      <Markdown docPath={docPath}>{step.md}</Markdown>
    </div>
  );
}

export function VocabSlide({ step, cards }: { step: Step; cards: Record<string, Card> }) {
  const [hide, setHide] = useState(false);
  const list = (step.card_ids ?? []).map((id) => cards[id]).filter(Boolean);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setHide((v) => !v)} aria-pressed={hide}>{hide ? <Eye size={14} /> : <EyeOff size={14} />}{hide ? "Hiện nghĩa" : "Che nghĩa để tự kiểm tra"}</Button>
        <TtsNote />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((c) => <WordCard key={c.id} card={c} hide={hide} />)}
      </ul>
    </div>
  );
}

function WordCard({ card, hide }: { card: Card; hide: boolean }) {
  const [peek, setPeek] = useState(false);
  const rate = useUI((s) => s.ttsRate);
  const show = !hide || peek;
  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">{card.word}</p>
          <p className="text-sm text-muted">{[card.ipa, card.pos].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" className="rounded-lg p-1.5 text-muted hover:text-primary" aria-label={`Nghe "${card.word}"`} onClick={() => speak(card.word, { rate })}>🔊</button>
      </div>
      <button type="button" className="mt-2 w-full text-left text-sm" onClick={() => setPeek((v) => !v)} aria-expanded={show}>
        {show ? (
          <>
            <p><InlineMd>{card.meaning}</InlineMd></p>
            {card.example && <p className="mt-1 text-muted"><InlineMd>{card.example}</InlineMd></p>}
          </>
        ) : <span className="text-primary">Bấm để xem nghĩa</span>}
      </button>
    </li>
  );
}

export function FlashcardsSlide({ step, cards }: { step: Step; cards: Record<string, Card> }) {
  const list = (step.card_ids ?? []).map((id) => cards[id]).filter(Boolean);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Lật thẻ, tự nhớ nghĩa, rồi chọn Đã biết / Chưa biết. Kết quả được đưa vào lịch ôn tập ngắt quãng (SM-2) ở trang Ôn tập.</p>
      <FlashcardDeck cards={list} simple />
    </div>
  );
}
