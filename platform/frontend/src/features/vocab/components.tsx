import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, Volume2 } from "lucide-react";
import { speak, ttsSupported } from "@/lib/tts";
import { cn } from "@/lib/utils";
import { useUI } from "@/stores/ui";
import { Badge } from "@/components/ui/badge";
import { STATE_LABELS, STATE_TONES, vocab, type ProgressState, type WordCard } from "@/services/vocab";

const audioCache = new Map<string, string>();

/**
 * Pronunciation: server TTS (cached file; replaying never calls the AI again). If server audio is not available
 * (no AI configured / quota), falls back to the browser's synthetic voice and says so.
 */
export function useAudio() {
  const rate = useUI((s) => s.ttsRate);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const el = useRef<HTMLAudioElement | null>(null);
  const playUrl = (url: string) => {
    el.current?.pause();
    el.current = new Audio(url);
    el.current.playbackRate = rate;
    return el.current.play();
  };
  const play = async (key: string, load: () => Promise<{ url: string }>, fallbackText: () => Promise<string> | string) => {
    if (busy) return;
    const cached = audioCache.get(key);
    try {
      if (cached) {
        await playUrl(cached);
        return;
      }
      setBusy(true);
      const { url } = await load();
      audioCache.set(key, url);
      await playUrl(url);
    } catch {
      const text = await Promise.resolve(fallbackText()).catch(() => "");
      if (text && speak(text, { rate })) setFallback(true);
    } finally {
      setBusy(false);
    }
  };
  return { play, busy, fallback };
}

export function WordAudio({ entryId, text, accent = "uk", className, label }: { entryId: string; text: string; accent?: "uk" | "us"; className?: string; label?: string }) {
  const { play, busy, fallback } = useAudio();
  if (!entryId) return null;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); void play(`${entryId}:${accent}`, () => vocab.audio(entryId, accent), () => text); }}
      className={cn("inline-flex shrink-0 items-center justify-center gap-1 rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-primary", className)}
      aria-label={label ?? `Nghe phát âm “${text}”${accent === "us" ? " (Anh–Mỹ)" : ""}`} title={fallback ? "Đang dùng giọng đọc tổng hợp của trình duyệt" : "Nghe phát âm"}>
      {busy ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />}
      {accent === "us" && <span className="text-[10px] font-semibold">US</span>}
    </button>
  );
}

export function StateBadge({ state }: { state: ProgressState | undefined | null }) {
  const s = state ?? "new";
  return <Badge tone={STATE_TONES[s]}>{STATE_LABELS[s]}</Badge>;
}

export function Ipa({ uk, us, status }: { uk?: string | null; us?: string | null; status?: string }) {
  if (!uk && !us) return null;
  return (
    <span className="font-mono text-sm text-muted" title={status === "composed" ? "Ghép từ phát âm từng từ (Wiktionary)" : "Phát âm từ từ điển (Wiktionary)"}>
      {uk && <span>UK {uk}</span>}{uk && us && uk !== us && <span className="ml-2">US {us}</span>}{!uk && us && <span>US {us}</span>}
    </span>
  );
}

export function WordRow({ w, right }: { w: WordCard; right?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <WordAudio entryId={w.id} text={w.lemma} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/vocabulary/word/${encodeURIComponent(w.id)}`} className="font-semibold hover:text-primary">{w.headword}</Link>
          {w.pos_vi.length > 0 && <span className="text-xs text-muted">{w.pos_vi.join(", ")}</span>}
          {w.cefr && <Badge>{w.cefr}</Badge>}
          <Ipa uk={w.ipa_uk} status={w.ipa_status} />
        </div>
        <p className="mt-0.5 text-sm">{w.meaning_vi}</p>
        {w.example && <p className="mt-0.5 text-xs text-muted"><i>{w.example.en}</i>{w.example.vi && <> — {w.example.vi}</>}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StateBadge state={w.progress?.state} />
        {right}
      </div>
    </div>
  );
}

export function SourceNote({ status }: { status: string }) {
  const text = status === "curriculum" ? "Từ giáo trình" : status === "sourced" ? "Nghĩa từ Wiktionary (chưa được giáo viên rà soát)"
    : status === "reviewed" ? "AI bổ sung, đã được rà soát" : status === "user" ? "Từ của bạn (không thuộc kho chung)" : status;
  return <span className="text-xs text-muted">{text}</span>;
}

export function ttsNote(fallback: boolean) {
  return fallback && ttsSupported() ? "Đang dùng giọng đọc tổng hợp của trình duyệt (máy chủ chưa có âm thanh AI)." : null;
}

export function relDue(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime() - Date.now();
  const min = Math.round(ms / 60000);
  if (min <= 0) return "ngay bây giờ";
  if (min < 60) return `${min} phút nữa`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} giờ nữa`;
  const d = Math.round(h / 24);
  return d < 31 ? `${d} ngày nữa` : `${Math.round(d / 30)} tháng nữa`;
}
