import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { plan } from "@/services/plan";
import { Ring, useStartBlock } from "./TodayPlanPage";
import { useBlockTimer } from "./timerStore";

/** Dashboard entry: today's focus-block plan and one button to start the next block. */
export function TodayPlanCard() {
  const q = useQuery({ queryKey: ["day-plan"], queryFn: plan.today });
  const start = useStartBlock();
  const running = useBlockTimer((s) => s.block);
  if (!q.data) return null;
  const p = q.data;
  const cur = p.blocks.find((b) => b.id === p.current_block);
  return (
    <Card className="mb-6 border-primary/40">
      <CardContent className="flex flex-wrap items-center gap-5 pt-5">
        <Ring percent={p.percent} size={88} label={`Hôm nay ${p.minutes_today}/${p.target_minutes} phút`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted"><CalendarClock size={14} className="mr-1 inline" />Lịch học hôm nay · {p.blocks_done}/{p.blocks_total} khối</p>
          <p className="text-lg font-semibold">{p.minutes_today} / {p.target_minutes} phút{cur ? ` · tiếp theo: ${cur.title}` : " · đã xong mọi khối 🎉"}</p>
          <p className="text-xs text-muted">{p.quests.filter((x) => x.done).length}/{p.quests.length} nhiệm vụ · streak {p.streak} ngày</p>
        </div>
        <div className="flex gap-2">
          {cur && !running && <Button onClick={() => start(p, cur)}><Play size={16} />Bắt đầu khối</Button>}
          <Link to="/today"><Button variant="outline">Xem lịch</Button></Link>
        </div>
      </CardContent>
    </Card>
  );
}
