import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, ChevronRight, Info, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatHint, ChatInput } from "@/components/ChatInput";
import { Markdown } from "@/components/Markdown";
import { AIErrorBox, AILoading, useAIStatus } from "@/components/ai/AIStatus";
import { cn } from "@/lib/utils";
import { assistant, QUICK, type AssistantAction, type AssistantCard, type AssistantMessage } from "@/services/assistant";
import { useAssistant } from "./store";

/** Header button (never covers page content) + non-modal side panel, available on every page of the layout. */
export function AssistantButton() {
  const { open, setOpen } = useAssistant();
  const btn = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) btn.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  // Always opens (never toggles): a double click — or a click the OS counts twice — must not open and close at once.
  // The panel closes with its × button or Esc.
  return (
    <button ref={btn} onClick={() => setOpen(true)} aria-label="Mở trợ lý học tập" aria-expanded={open}
      title="Trợ lý học tập" className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-primary hover:bg-primary-soft">
      <Bot size={18} /><span className="hidden sm:inline">Trợ lý</span>
    </button>
  );
}

export function AssistantHost() {
  const { open, setOpen } = useAssistant();
  return open ? <AssistantPanel onClose={() => setOpen(false)} /> : null;
}

function AssistantPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const st = useAIStatus();
  const { pending, take } = useAssistant();
  const hist = useQuery({ queryKey: ["assistant-history"], queryFn: assistant.history, refetchOnMount: "always" });
  const [asking, setAsking] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ e: unknown; q: { action?: AssistantAction; message?: string } } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const messages: AssistantMessage[] = [...(hist.data ?? []), ...(asking ? [{ role: "user" as const, content: asking, cards: [] }] : [])];

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length, busy]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const ask = async (q: { action?: AssistantAction; message?: string }) => {
    if (busy) return;
    const label = q.message ?? QUICK.find((x) => x.action === q.action)?.label ?? "";
    setErr(null);
    setBusy(true);
    setAsking(label);
    try {
      const r = await assistant.chat(q);
      qc.setQueryData<AssistantMessage[]>(["assistant-history"], (old) => [...(old ?? []), { role: "user", content: label, cards: [] },
        { role: "assistant", content: r.answer, cards: r.cards, notice: r.notice, ai: r.ai }]);
    } catch (e) {
      setErr({ e, q });
    } finally {
      setAsking(null);
      setBusy(false);
    }
  };
  useEffect(() => {
    if (pending && hist.isSuccess) {
      void ask(pending);
      take();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, hist.isSuccess]);

  const clear = async () => {
    await assistant.clear();
    qc.setQueryData(["assistant-history"], []);
  };
  const send = () => {
    const m = text.trim();
    if (!m) return;
    setText("");
    void ask({ message: m });
  };

  return (
    <aside role="complementary" aria-label="Trợ lý học tập"
      className="fixed inset-0 z-50 flex flex-col border-l border-border bg-surface shadow-2xl sm:inset-auto sm:bottom-0 sm:right-0 sm:top-16 sm:w-[26rem]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Bot size={18} className="text-primary" />
        <h2 className="font-semibold">Trợ lý học tập</h2>
        <div className="ml-auto flex items-center gap-1">
          {messages.length > 0 && <button onClick={clear} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Xóa lịch sử trò chuyện" title="Xóa lịch sử"><Trash2 size={16} /></button>}
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Đóng trợ lý"><X size={18} /></button>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" role="log" aria-live="polite" aria-label="Hội thoại với trợ lý" tabIndex={0}>
        {messages.length === 0 && !busy && (
          <div className="space-y-2 text-sm text-muted">
            <p>Hỏi về tiến độ, từ vựng, thời gian hoàn thành, lỗi hay mắc, hoặc nên học gì tiếp. Số liệu lấy trực tiếp từ dữ liệu học của bạn.</p>
            {st.data && !st.data.enabled && <p className="flex gap-1.5 rounded-xl bg-surface-2 p-2"><Info size={14} className="mt-0.5 shrink-0" />AI đang tắt: các câu hỏi nhanh vẫn được trả lời từ dữ liệu; câu hỏi tự do cần AI.</p>}
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} m={m} onNavigate={() => { if (window.innerWidth < 640) onClose(); }} />)}
        {busy && <AILoading label="Trợ lý đang xem dữ liệu học của bạn…" />}
        {err && <AIErrorBox error={err.e} onRetry={() => ask(err.q)} />}
        <div ref={end} />
      </div>
      <div className="space-y-2 border-t border-border px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q.action} disabled={busy} onClick={() => ask({ action: q.action })}
              className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary/50 hover:bg-primary-soft disabled:opacity-50">{q.label}</button>
          ))}
        </div>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <ChatInput ref={input} value={text} onChange={setText} onSend={send} disabled={busy}
            placeholder="Ví dụ: Tuần này tôi nên tập trung vào gì?" label="Câu hỏi cho trợ lý" />
          <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Gửi"><Send size={16} /></Button>
        </form>
        <ChatHint />
      </div>
    </aside>
  );
}

function Bubble({ m, onNavigate }: { m: AssistantMessage; onNavigate: () => void }) {
  if (m.role === "user") return <div className="ml-8 rounded-2xl bg-primary px-3 py-2 text-sm text-primary-fg">{m.content}</div>;
  return (
    <div className="mr-4 space-y-2">
      {m.notice && <p className="flex gap-1.5 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning"><Info size={14} className="mt-0.5 shrink-0" />{m.notice}</p>}
      <div className="rounded-2xl bg-surface-2 px-3 py-2"><Markdown className="text-sm">{m.content}</Markdown></div>
      {m.cards.map((c, i) => <CardView key={i} c={c} onNavigate={onNavigate} />)}
    </div>
  );
}

function CardView({ c, onNavigate }: { c: AssistantCard; onNavigate: () => void }) {
  if (c.type === "stats") {
    return (
      <div className="rounded-2xl border border-border p-3 text-sm">
        <div className="mb-1 flex items-center justify-between"><p className="font-medium">{c.title}</p>
          {c.link && <Link to={c.link} onClick={onNavigate} className="text-xs text-primary">Xem chi tiết</Link>}</div>
        {c.rows.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><span className="text-muted">{k}</span><b className="text-right">{v}</b></div>)}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border p-3 text-sm">
      <p className="mb-1 font-medium">{c.title}</p>
      <ul className="space-y-1">
        {c.steps.map((s) => (
          <li key={s.title}>
            <Link to={s.link} onClick={onNavigate} className={cn("flex items-start gap-1 rounded-lg px-1 py-0.5 hover:bg-surface-2")}>
              <ChevronRight size={14} className="mt-0.5 shrink-0 text-primary" />
              <span><span className="font-medium">{s.title}</span><span className="block text-xs text-muted">{s.why_vi}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
