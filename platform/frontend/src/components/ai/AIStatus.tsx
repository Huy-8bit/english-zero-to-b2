import { useQuery } from "@tanstack/react-query";
import { Bot, FlaskConical, RotateCcw, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { ai, AIRequestError } from "@/services/ai";
import { Button } from "@/components/ui/button";

export function useAIStatus() {
  return useQuery({ queryKey: ["ai-status"], queryFn: ai.status, staleTime: 60_000 });
}

export function SimulatedBanner() {
  const st = useAIStatus();
  if (!st.data?.simulated) return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning" role="note">
      <FlaskConical size={16} />AI đang ở chế độ giả lập (AI_PROVIDER=fake) dùng cho kiểm thử — nội dung không phải do AI thật tạo ra.
    </div>
  );
}

/** Shown instead of AI controls when AI is not configured / turned off. Learning without AI keeps working. */
export function AIUnavailable({ compact }: { compact?: boolean }) {
  const st = useAIStatus();
  if (!st.data || st.data.enabled) return null;
  const msg = st.data.configured ? "AI đang tắt trong Cài đặt." : "Chưa cấu hình AI (thiếu OPENAI_API_KEY trên máy chủ).";
  return (
    <div className={`rounded-xl border border-border bg-surface-2 ${compact ? "px-3 py-2 text-xs" : "p-4 text-sm"}`}>
      <p className="flex items-center gap-2 font-medium"><Bot size={16} />{msg}</p>
      {!compact && <p className="mt-1 text-muted">Bài học, bài tập có sẵn, flashcards và tiến độ vẫn hoạt động bình thường. Xem <Link className="text-primary underline" to="/settings">Cài đặt</Link>.</p>}
    </div>
  );
}

export function AIErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = error instanceof AIRequestError ? error : null;
  const msg = e?.message ?? (error instanceof Error ? error.message : String(error));
  return (
    <div role="alert" className="rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm">
      <p className="flex items-center gap-2 font-medium text-danger"><TriangleAlert size={16} />Không hoàn thành được yêu cầu AI</p>
      <p className="mt-1">{msg}</p>
      {onRetry && (e?.retryable ?? true) && <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}><RotateCcw size={14} />Thử lại</Button>}
    </div>
  );
}

export function AILoading({ label = "AI đang xử lý…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-muted" role="status" aria-live="polite">
      <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-primary" /></span>
      {label}
    </div>
  );
}
