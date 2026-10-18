import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Coffee, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useCelebrate } from "@/components/Celebrate";
import { mmss, useBlockTimer } from "./timerStore";

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Header chip with the running focus block (app header and lesson player header). */
export function BlockTimerChip() {
  const { block, brk } = useBlockTimer();
  const now = useNow(!!block || !!brk);
  if (block) {
    return (
      <Link to="/today" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium tabular-nums" title={`Khối: ${block.title}`}>
        <Timer size={12} className="text-primary" />{mmss(block.endsAt - now)}
      </Link>
    );
  }
  if (brk) return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs text-success"><Coffee size={12} />Nghỉ {mmss(brk.endsAt - now)}</span>;
  return null;
}

/** Ends blocks on time and shows the active-break screen (mounted once at the app root, also over lessons). */
export function BlockTimerHost() {
  const { block, brk, finishBlock, endBreak } = useBlockTimer();
  const fire = useCelebrate((s) => s.fire);
  const nav = useNavigate();
  const now = useNow(!!block || !!brk);
  useEffect(() => {
    if (block && now >= block.endsAt) {
      fire(`Xong khối “${block.title}” 💪`);
      finishBlock(block.after);
    }
  }, [block, now, finishBlock, fire]);
  useEffect(() => {
    if (brk && now >= brk.endsAt) {
      toast.info(brk.nextTitle ? `Hết giờ nghỉ — khối tiếp theo: ${brk.nextTitle}` : "Hết giờ nghỉ");
      endBreak();
    }
  }, [brk, now, endBreak]);
  if (!brk) return null;
  const tip = brk.tips[Math.floor((brk.endsAt - now) / 20_000) % brk.tips.length];
  return (
    <div role="dialog" aria-modal="true" aria-label="Giờ nghỉ" className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-surface p-6 text-center shadow-2xl">
        <Coffee className="mx-auto text-success" size={36} />
        <p className="text-xl font-semibold">{brk.long ? "Nghỉ dài" : "Nghỉ ngắn"}: {mmss(brk.endsAt - now)}</p>
        <p className="text-sm text-muted">Nghỉ đúng giờ giúp não củng cố những gì vừa học và giữ bạn tỉnh táo cho khối sau.</p>
        <p className="rounded-2xl bg-success-soft px-4 py-3 font-medium text-success">{tip}</p>
        <ul className="space-y-1 text-left text-sm text-muted">{brk.tips.map((t) => <li key={t}>• {t}</li>)}</ul>
        {brk.nextTitle && <p className="text-sm">Tiếp theo: <b>{brk.nextTitle}</b></p>}
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => { endBreak(); nav("/today"); }}>Kết thúc nghỉ sớm</Button>
          <Button variant="ghost" onClick={() => endBreak()}>Đóng</Button>
        </div>
      </div>
    </div>
  );
}

