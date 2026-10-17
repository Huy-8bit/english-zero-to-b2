import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { Textarea } from "@/components/ui/misc";

/** Personal notes per lesson (e.g. vocabulary), saved to the server as you type. */
export function NotesPanel({ unitId }: { unitId: string }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    api.note(unitId).then((n) => { setText(n.text); setStatus("saved"); }).catch(() => setStatus("error"));
  }, [unitId]);
  const change = (v: string) => {
    setText(v);
    setStatus("saving");
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => api.saveNote(unitId, v).then(() => setStatus("saved")).catch(() => setStatus("error")), 600);
  };
  return (
    <div className="space-y-2">
      <Textarea rows={14} value={text} onChange={(e) => change(e.target.value)} disabled={status === "loading"}
        placeholder="Ghi chú từ vựng, ví dụ của riêng bạn, câu hỏi cần hỏi lại…" aria-label="Ghi chú bài học" />
      <p className="text-xs text-muted">{status === "saving" ? "Đang lưu…" : status === "saved" ? "Đã lưu" : status === "error" ? "Không lưu được — kiểm tra kết nối" : "Đang tải…"}</p>
    </div>
  );
}
