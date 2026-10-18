import { forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Chat box: Enter sends, Shift+Enter adds a new line, grows with the text.
 * Enter is ignored while an input method is composing (Vietnamese Telex/VNI, etc.), so confirming a
 * diacritic never sends half a message.
 */
export const ChatInput = forwardRef<HTMLTextAreaElement, {
  value: string; onChange: (v: string) => void; onSend: () => void; disabled?: boolean; placeholder?: string; label: string;
  maxLength?: number; className?: string;
}>(({ value, onChange, onSend, disabled, placeholder, label, maxLength = 1000, className }, ref) => {
  const el = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => el.current as HTMLTextAreaElement);
  useEffect(() => {
    const t = el.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
  }, [value]);
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    if (!disabled && value.trim()) onSend();
  };
  return (
    <textarea ref={el} rows={1} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} disabled={disabled}
      maxLength={maxLength} placeholder={placeholder} aria-label={label} aria-describedby="chat-input-hint"
      className={cn("max-h-40 min-h-10 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/20", className)} />
  );
});
ChatInput.displayName = "ChatInput";

export const ChatHint = () => <p id="chat-input-hint" className="text-[11px] text-muted">Enter để gửi · Shift+Enter để xuống dòng</p>;
