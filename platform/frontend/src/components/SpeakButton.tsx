import { Volume2 } from "lucide-react";
import { speak, ttsSupported } from "@/lib/tts";
import { plain, cn } from "@/lib/utils";
import { useUI } from "@/stores/ui";

/** Reads English text aloud with the browser's synthetic voice (TTS). */
export function SpeakButton({ text, label = "Nghe phát âm (giọng đọc tổng hợp)", className, size = 16 }: { text: string; label?: string; className?: string; size?: number }) {
  const rate = useUI((s) => s.ttsRate);
  if (!ttsSupported()) return null;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); speak(plain(text), { rate }); }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-primary", className)}
      aria-label={label} title={label}>
      <Volume2 size={size} />
    </button>
  );
}

export function TtsNote() {
  return ttsSupported()
    ? <p className="text-xs text-muted">🔊 Âm thanh dùng giọng đọc tổng hợp (TTS) của trình duyệt — không phải bản ghi âm gốc.</p>
    : <p className="text-xs text-muted">Trình duyệt này không hỗ trợ đọc văn bản (TTS). Hãy nhờ người khác đọc transcript hoặc dùng trình duyệt khác.</p>;
}
