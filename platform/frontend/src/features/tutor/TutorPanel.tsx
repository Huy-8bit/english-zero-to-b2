import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { ai } from "@/services/ai";
import { Button } from "@/components/ui/button";
import { ChatHint, ChatInput } from "@/components/ChatInput";
import { Markdown } from "@/components/Markdown";
import { AIErrorBox, AILoading, AIUnavailable, SimulatedBanner, useAIStatus } from "@/components/ai/AIStatus";

const ACTIONS = [
  { id: "explain_simply", label: "Giải thích dễ hơn" },
  { id: "more_examples", label: "Cho thêm ví dụ" },
  { id: "compare", label: "So sánh cấu trúc khác" },
  { id: "why", label: "Tại sao dùng cấu trúc này?" },
  { id: "common_mistakes", label: "Lỗi thường gặp" },
  { id: "explain_mistake", label: "Giải thích câu tôi làm sai" },
];

interface Msg { role: string; content: string; sources?: { section_title: string; source_path: string }[] }

/** AI Tutor sidebar: knows the current lesson, slide, prerequisites and your recent mistakes. */
export function TutorPanel({ unitId, stepIndex, lastItemId }: { unitId: string; stepIndex: number; lastItemId?: string }) {
  const st = useAIStatus();
  const [log, setLog] = useState<Msg[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ e: unknown; retry: () => void } | null>(null);
  const conversation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ai.tutorHistory(unitId).then((h) => setLog(h.messages.map((m) => ({ role: m.role, content: m.content, sources: m.sources })))).catch(() => {});
  }, [unitId]);
  useEffect(() => {
    const container = conversation.current;
    container?.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [log, busy]);
  const ask = async (action: string, label: string, message?: string) => {
    setBusy(true);
    setErr(null);
    setLog((l) => [...l, { role: "user", content: message || label }]);
    try {
      const r = await ai.tutor({ unit_id: unitId, step_index: stepIndex, action, message, item_id: action === "explain_mistake" ? lastItemId : undefined });
      setLog((l) => [...l, { role: "assistant", content: r.answer, sources: r.sources }]);
      if (action === "chat") setMsg("");
    } catch (e) {
      setLog((l) => l.slice(0, -1));
      setErr({ e, retry: () => ask(action, label, message) });
    } finally {
      setBusy(false);
    }
  };
  if (st.data && !st.data.enabled) return <AIUnavailable />;
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div ref={conversation} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
        <SimulatedBanner />
        <p className="text-xs text-muted">Gia sư dựa trên slide đang học và đoạn giáo trình liên quan. Đáp án bài tập chỉ được dùng sau khi bạn đã nộp câu đó. AI có thể sai — đối chiếu với giáo trình.</p>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <Button key={a.id} size="sm" variant="outline" disabled={busy || (a.id === "explain_mistake" && !lastItemId)} onClick={() => ask(a.id, a.label)}>{a.label}</Button>
          ))}
        </div>
        <div className="flex-1 space-y-3" aria-live="polite">
          {log.map((x, i) => x.role === "user" ? (
            <p key={i} className="ml-8 rounded-xl bg-primary-soft px-3 py-2 text-sm">{x.content}</p>
          ) : (
            <div key={i} className="rounded-xl bg-surface-2 p-3">
              <Markdown className="text-sm">{x.content}</Markdown>
              {!!x.sources?.length && <p className="mt-2 text-[11px] text-muted">Nguồn: {x.sources.map((s) => s.section_title).join(" · ")}</p>}
            </div>
          ))}
          {busy && <AILoading label="Gia sư đang trả lời…" />}
          {err && <AIErrorBox error={err.e} onRetry={err.retry} />}
        </div>
      </div>
      <form className="flex shrink-0 items-end gap-2 border-t border-border pt-3" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) ask("chat", msg.trim(), msg.trim()); }}>
        <ChatInput value={msg} onChange={setMsg} onSend={() => { if (msg.trim()) ask("chat", msg.trim(), msg.trim()); }}
          disabled={busy} placeholder="Hỏi bất kỳ điều gì về bài này… (vd: Tại sao She goes mà I go?)" label="Câu hỏi cho gia sư" />
        <Button type="submit" size="icon" disabled={busy || !msg.trim()} aria-label="Gửi"><Send size={16} /></Button>
      </form>
      <ChatHint />
    </div>
  );
}
