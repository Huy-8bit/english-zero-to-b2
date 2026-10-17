import { useEffect, useRef, useState } from "react";
import { History, Save, Timer } from "lucide-react";
import { api } from "@/services/api";
import { Textarea } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { wordCount } from "@/lib/utils";

/** Writing task editor: word counter, timer, autosaved draft (via lesson state) and saved history. */
export function WritingEditor({ value, onChange, unitId, itemId, target, disabled }: {
  value: string; onChange: (v: string) => void; unitId: string; itemId: string; target?: [number, number] | null; disabled?: boolean;
}) {
  const [seconds, setSeconds] = useState(0);
  const started = useRef<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.writing>>>([]);
  useEffect(() => {
    const t = setInterval(() => {
      if (started.current) setSeconds(Math.floor((Date.now() - started.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const words = wordCount(value);
  const inRange = target ? words >= target[0] && words <= target[1] : null;
  const saveVersion = async () => {
    if (!value.trim()) return;
    try {
      await api.saveWriting({ unit_id: unitId, item_id: itemId, text: value, seconds });
      toast.success("Đã lưu bài viết vào lịch sử");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được");
    }
  };
  const openHistory = async () => {
    setHistory(await api.writing(itemId).catch(() => []));
    setHistoryOpen(true);
  };
  return (
    <div>
      <Textarea rows={8} value={value} disabled={disabled} aria-label="Bài viết của bạn"
        placeholder="Viết bài của bạn ở đây… (bản nháp tự động được lưu)"
        onChange={(e) => {
          if (!started.current) started.current = Date.now();
          onChange(e.target.value);
        }} />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className={inRange === false ? "text-warning font-medium" : inRange ? "text-success font-medium" : ""}>
          {words} từ{target ? ` / mục tiêu ${target[0]}–${target[1]}` : ""}
        </span>
        <span className="inline-flex items-center gap-1"><Timer size={13} />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={saveVersion} disabled={!value.trim()}><Save size={14} />Lưu phiên bản</Button>
          <Button size="sm" variant="ghost" onClick={openHistory}><History size={14} />Lịch sử</Button>
        </span>
      </div>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen} title="Lịch sử bài viết" description="Các phiên bản bạn đã lưu cho nhiệm vụ này.">
        {history.length === 0 ? <p className="text-sm text-muted">Chưa có phiên bản nào.</p> : (
          <ul className="space-y-3">
            {history.map((h) => (
              <li key={h.id} className="rounded-xl border border-border p-3 text-sm">
                <p className="text-xs text-muted">{new Date(h.created_at).toLocaleString("vi-VN")} · {h.word_count} từ</p>
                <p className="mt-1 whitespace-pre-wrap">{h.text}</p>
                <Button size="sm" variant="ghost" className="mt-1" onClick={() => { onChange(h.text); setHistoryOpen(false); }}>Dùng lại bản này</Button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  );
}

/** "80–100 từ" / "120–150 words" in a prompt → [80, 100]. */
export function wordTarget(prompt: string): [number, number] | null {
  const m = /(\d{2,3})\s*[–-]\s*(\d{2,3})\s*(từ|words)/i.exec(prompt);
  if (m) return [Number(m[1]), Number(m[2])];
  const least = /(?:ít nhất|at least)\s*(\d{2,3})\s*(từ|words)/i.exec(prompt);
  return least ? [Number(least[1]), Number(least[1]) * 2] : null;
}
