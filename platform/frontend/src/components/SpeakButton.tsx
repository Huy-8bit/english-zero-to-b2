import { Volume2 } from "lucide-react";
import { speak, ttsSupported } from "@/lib/tts";
import { plain, cn } from "@/lib/utils";
import { useUI } from "@/stores/ui";

/** Reads English text aloud with a natural AI voice (OpenAI TTS); the browser voice is the fallback. */
export function SpeakButton({ text, label = "Nghe phát âm (giọng AI)", className, size = 16 }: { text: string; label?: string; className?: string; size?: number }) {
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
    ? <p className="text-xs text-muted">🔊 Giọng đọc AI (OpenAI TTS) — giọng do máy tạo, không phải bản ghi âm người thật. Khi AI không dùng được, app đọc bằng giọng của trình duyệt.</p>
    : <p className="text-xs text-muted">Trình duyệt này không hỗ trợ đọc văn bản (TTS). Hãy nhờ người khác đọc transcript hoặc dùng trình duyệt khác.</p>;
}
