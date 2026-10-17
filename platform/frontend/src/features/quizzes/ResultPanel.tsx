import { CheckCircle2, CircleAlert, CircleHelp, XCircle } from "lucide-react";
import type { ItemResult } from "@/types/content";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIGradeButton } from "./AIGrade";

const META = {
  correct: { label: "Chính xác!", icon: CheckCircle2, cls: "border-success/40 bg-success-soft text-success" },
  incorrect: { label: "Chưa đúng", icon: XCircle, cls: "border-danger/40 bg-danger-soft text-danger" },
  mismatch: { label: "Chưa khớp đáp án mẫu — hãy so sánh và tự đánh giá", icon: CircleAlert, cls: "border-warning/40 bg-warning-soft text-warning" },
  submitted: { label: "Đã nộp — so sánh với đáp án gợi ý", icon: CircleHelp, cls: "border-primary/30 bg-primary-soft text-primary" },
};

export function ResultPanel({ result, docPath, onSelfAssess, onRetry }: {
  result: ItemResult; docPath?: string; onSelfAssess?: (correct: boolean) => void; onRetry?: () => void;
}) {
  const meta = META[result.verdict];
  const Icon = meta.icon;
  const needsSelf = (result.verdict === "mismatch" || result.verdict === "submitted") && result.self_correct === null;
  return (
    <div className={cn("mt-3 rounded-xl border p-3 text-sm", meta.cls)} role="status">
      <p className="flex items-center gap-2 font-semibold"><Icon size={16} />{meta.label}</p>
      <div className="mt-2 space-y-2 text-fg">
        {result.model_md ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{result.verdict === "submitted" ? "Đáp án / bài mẫu từ giáo trình" : "Đáp án"}</p>
            <Markdown docPath={docPath} className="text-sm">{result.model_md}</Markdown>
          </div>
        ) : (
          <p className="text-muted">Giáo trình không có đáp án cố định cho nhiệm vụ này — tự đánh giá theo hướng dẫn của bài.</p>
        )}
        {result.explanation_md && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Giải thích</p>
            <Markdown docPath={docPath} className="text-sm">{result.explanation_md}</Markdown>
          </div>
        )}
        {result.review && <div className="text-xs text-muted">Ôn lại: <Markdown inline docPath={docPath}>{result.review}</Markdown></div>}
      </div>
      {needsSelf && onSelfAssess && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-fg">
          <span className="text-xs text-muted">Câu trả lời của bạn có đúng ý không?</span>
          <Button size="sm" variant="success" onClick={() => onSelfAssess(true)}>Tôi làm đúng</Button>
          <Button size="sm" variant="outline" onClick={() => onSelfAssess(false)}>Tôi cần xem lại</Button>
        </div>
      )}
      {(result.verdict === "mismatch" || result.verdict === "submitted") && result.has_key && <AIGradeButton key={result.attempt_id} attemptId={result.attempt_id} />}
      {result.self_correct !== null && (
        <p className="mt-2 text-xs text-muted">Tự đánh giá: {result.self_correct ? "đúng ✓" : "cần xem lại"}</p>
      )}
      {onRetry && result.verdict !== "correct" && (
        <button className="mt-2 text-xs font-medium text-primary underline" onClick={onRetry}>Làm lại câu này</button>
      )}
    </div>
  );
}
