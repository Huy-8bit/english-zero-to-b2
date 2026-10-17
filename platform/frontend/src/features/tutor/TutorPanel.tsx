import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/misc";
import { Markdown } from "@/components/Markdown";

const ACTIONS = [
  { id: "explain", label: "Giải thích khái niệm này" },
  { id: "example", label: "Cho tôi ví dụ khác" },
  { id: "simpler", label: "Giải thích đơn giản hơn" },
  { id: "why_wrong", label: "Vì sao tôi sai?" },
  { id: "practice", label: "Tạo bài luyện thêm" },
  { id: "quiz_me", label: "Hỏi tôi vài câu" },
];

/** Optional AI tutor (server-side key). Exercise answers are only shared after you submit them. */
export function TutorPanel({ unitId, stepIndex, lastItemId }: { unitId: string; stepIndex: number; lastItemId?: string }) {
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = async (action: string, label: string) => {
    setBusy(true);
    try {
      const r = await api.tutorAsk({ unit_id: unitId, step_index: stepIndex, action, message: action === "free" ? msg : undefined, item_id: action === "why_wrong" ? lastItemId : undefined });
      setLog((l) => [...l, { q: label, a: r.answer }]);
      if (action === "free") setMsg("");
    } catch (e) {
      setLog((l) => [...l, { q: label, a: `⚠️ ${e instanceof Error ? e.message : "Lỗi"}` }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-xs text-muted">Gia sư AI dùng nội dung slide hiện tại. Đáp án bài tập chỉ được chia sẻ sau khi bạn đã nộp câu đó. Câu trả lời của AI có thể sai — đối chiếu với giáo trình.</p>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Button key={a.id} size="sm" variant="outline" disabled={busy || (a.id === "why_wrong" && !lastItemId)} onClick={() => ask(a.id, a.label)}>{a.label}</Button>
        ))}
      </div>
      <div className="flex-1 space-y-3">
        {log.map((x, i) => (
          <div key={i} className="space-y-1">
            <p className="text-sm font-medium">🙋 {x.q}</p>
            <div className="rounded-xl bg-surface-2 p-3"><Markdown className="text-sm">{x.a}</Markdown></div>
          </div>
        ))}
        {busy && <p className="flex items-center gap-2 text-sm text-muted"><Bot size={16} className="animate-pulse" />Đang trả lời…</p>}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) ask("free", msg.trim()); }}>
        <Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Hỏi gia sư…" aria-label="Câu hỏi cho gia sư" />
        <Button type="submit" size="icon" disabled={busy || !msg.trim()} aria-label="Gửi"><Send size={16} /></Button>
      </form>
    </div>
  );
}
