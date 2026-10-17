import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MessagesSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, PageHeader } from "@/components/ui/misc";
import { AIErrorBox, AILoading, useAIStatus } from "@/components/ai/AIStatus";
import { vocab, type Dialogue } from "@/services/vocab";
import { SubNav } from "./VocabHome";

const SITUATION_VI: Record<string, string> = {
  daily: "Trò chuyện hằng ngày", job_interview: "Phỏng vấn xin việc", travel: "Du lịch", workplace: "Thảo luận ở công ty", technology: "Công nghệ", goals: "Mục tiêu cá nhân",
};

export default function DialoguePage() {
  const st = useAIStatus();
  const sit = useQuery({ queryKey: ["vocab-situations"], queryFn: vocab.situations });
  const [d, setD] = useState<Dialogue | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [d?.turns.length]);
  const begin = async (s: string) => {
    setBusy(true);
    setErr(null);
    try {
      setD(await vocab.dialogue(s));
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (!d || !text.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await vocab.reply(d.id, text.trim());
      setD(r.dialogue);
      setText("");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHeader title="Dùng từ trong tình huống thật" subtitle="AI đóng vai người đối thoại và tạo cơ hội để bạn dùng những từ đang học." />
      <SubNav />
      {!st.data?.enabled && <p className="mb-4 rounded-xl bg-warning-soft px-4 py-2 text-sm text-warning">Cần cấu hình AI để luyện hội thoại. Các chế độ học khác vẫn dùng bình thường.</p>}
      {!d ? (
        <Card>
          <CardHeader><CardTitle>Chọn tình huống</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            {Object.keys(sit.data ?? {}).map((k) => (
              <Button key={k} variant="outline" size="lg" disabled={busy || !st.data?.enabled} onClick={() => begin(k)}><MessagesSquare size={16} />{SITUATION_VI[k] ?? k}</Button>
            ))}
            {busy && <AILoading label="AI đang chuẩn bị hội thoại…" />}
            {err != null && <div className="sm:col-span-3"><AIErrorBox error={err} /></div>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
          <Card>
            <CardHeader><CardTitle>{SITUATION_VI[d.situation]}</CardTitle><Button size="sm" variant="ghost" onClick={() => setD(null)}>Đổi tình huống</Button></CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1" tabIndex={0} role="log" aria-label="Hội thoại">
                {d.turns.map((t, i) => (
                  <div key={i} className={t.role === "ai" ? "mr-10" : "ml-10 text-right"}>
                    <div className={`inline-block rounded-2xl px-4 py-2 text-left ${t.role === "ai" ? "bg-surface-2" : "bg-primary text-primary-fg"}`}>{t.text}</div>
                    {t.role === "ai" && t.hint_vi && <p className="mt-1 text-xs text-muted">💡 {t.hint_vi}</p>}
                    {t.role === "user" && (
                      <div className="mt-1 space-y-0.5 text-left text-xs">
                        {!!t.used?.length && <p className="text-success">Đã dùng: {t.used.join(", ")}</p>}
                        {t.corrections?.map((c, j) => <p key={j}>❌ {c.original} → ✅ <b>{c.correction}</b> — {c.explanation_vi}</p>)}
                        {t.feedback_vi && <p className="text-muted">{t.feedback_vi}</p>}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={end} />
              </div>
              {d.status === "active" ? (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                  <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Trả lời bằng tiếng Anh…" aria-label="Câu trả lời của bạn" disabled={busy} />
                  <Button type="submit" disabled={busy || !text.trim()}><Send size={16} /></Button>
                </form>
              ) : <p className="text-sm text-muted">Hội thoại đã kết thúc.</p>}
              {busy && <AILoading />}
              {err != null && <AIErrorBox error={err} onRetry={send} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Từ mục tiêu</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {d.targets.map((t) => (
                <div key={t.entry_id} className="flex items-start gap-2">
                  {d.used[t.lemma] ? <CheckCircle2 size={16} className="mt-0.5 text-success" /> : <span className="mt-1 h-3 w-3 rounded-full border border-border" />}
                  <span><b>{t.lemma}</b><span className="block text-xs text-muted">{t.meaning_vi}</span></span>
                  {d.used[t.lemma] ? <Badge tone="success" className="ml-auto">×{d.used[t.lemma]}</Badge> : null}
                </div>
              ))}
              <p className="text-xs text-muted">Từ dùng trong hội thoại được ghi vào tiến độ “đã dùng”.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
