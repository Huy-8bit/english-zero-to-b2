import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpenText, CircleCheck, Flame, ListOrdered, Mic, PenLine, Play, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/ui/misc";
import { Kbd } from "@/components/ui/kbd";
import { ProgressRing } from "@/components/ui/stat";
import { cn } from "@/lib/utils";
import { DECK_ITEMS, DECK_TITLE, loadRush, masteredCount, planProgress, PLAN_HOURS, weakIds } from "./store";

const hm = (sec: number) => `${Math.floor(sec / 3600)}h${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}`;

/** VSTEP B2 in 2 days / 10 hours: irregular verbs + the chunks Writing and Speaking need, one block of about an hour at a time. */
export default function RushPage() {
  const nav = useNavigate();
  const [s, setS] = useState(loadRush);
  useEffect(() => { const t = setInterval(() => setS(loadRush()), 30_000); return () => clearInterval(t); }, []);
  const p = planProgress(s);
  const weak = weakIds(s).length;
  const firstDeck = (decks: string[]) => decks.find((d) => DECK_ITEMS[d] && masteredCount(s, DECK_ITEMS[d]) < DECK_ITEMS[d].length * 0.9) ?? decks[0];
  const go = (deck: string) => nav(`/rush/${deck}`);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;
      e.preventDefault();
      nav(`/rush/${firstDeck(p.current.decks)}`);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  return (
    <div>
      <PageHeader title="Cấp tốc VSTEP B2 · Nói & Viết" subtitle={`2 ngày, ${PLAN_HOURS} giờ: động từ bất quy tắc + ${p.total - DECK_ITEMS["iv-1"].length - DECK_ITEMS["iv-2"].length} cụm câu và collocation dùng được ngay trong bài Viết (thư, bài luận) và bài Nói (Part 1–3). Mỗi khối ≈ 1 giờ, học theo lô 8 mục: đọc to → chọn → tự nhớ lại; mục sai quay lại cuối lô.`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-wrap items-center gap-6 pt-5">
            <ProgressRing percent={Math.round((100 * p.learnt) / p.total)} label={`Đã thuộc ${p.learnt} trên ${p.total} mục`} size={132} />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-2xl font-bold">{p.learnt}/{p.total} <span className="text-base font-normal text-muted">mục đã thuộc</span></p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Thời gian học: <b>{hm(p.seconds)}</b> / {PLAN_HOURS} giờ · hôm nay {hm(p.today)}</span></div>
                <Progress value={Math.min(100, (100 * p.seconds) / (PLAN_HOURS * 3600))} label={`Đã học ${hm(p.seconds)} trên ${PLAN_HOURS} giờ`} />
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary-soft/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Khối {p.current.n}/10 · Ngày {p.current.day}</p>
                <p className="font-semibold">{p.current.title}</p>
                {p.current.total > 0 && <Progress className="mt-2" value={(100 * p.current.done) / p.current.total} label={`Khối ${p.current.n}: ${p.current.done}/${p.current.total}`} />}
                <Button size="lg" className="mt-3 h-auto whitespace-normal py-2.5 text-left" onClick={() => go(firstDeck(p.current.decks))}>
                  <Play size={18} className="shrink-0" />Học: {DECK_TITLE[firstDeck(p.current.decks)]}<Kbd>Enter</Kbd>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><Flame size={16} className="mr-1 inline" />Ôn nhanh</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Button className="w-full" variant={weak ? "primary" : "outline"} onClick={() => go("review")} disabled={!weak}>Ôn lỗi · {weak} mục còn sai</Button>
            <Button className="w-full" variant="outline" onClick={() => go("mixed")}><Shuffle size={16} />Ôn tổng ngẫu nhiên (24 mục)</Button>
            <Link to="/irregular-verbs" className="flex items-center gap-2 text-primary hover:underline"><ListOrdered size={16} />Bảng động từ bất quy tắc đầy đủ</Link>
            <p className="text-muted">Mẹo: đầu mỗi buổi ôn lỗi 5–10 phút, cuối ngày ôn tổng 1 lượt rồi đi ngủ — giấc ngủ giúp nhớ lâu.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Kế hoạch 2 ngày</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {p.blocks.map((b) => (
            <div key={b.n} className={cn("rounded-2xl border p-3", b.n === p.current.n ? "border-primary bg-primary-soft/20" : "border-border")}>
              <div className="flex items-center gap-2 text-sm">
                <Badge tone={b.complete ? "success" : b.n === p.current.n ? "primary" : "neutral"}>{b.complete ? <CircleCheck size={12} /> : null}Ngày {b.day} · Khối {b.n}</Badge>
                {b.total > 0 && <span className="ml-auto tabular-nums text-muted">{b.done}/{b.total}</span>}
              </div>
              <p className="mt-1 font-medium">{b.title}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.decks.map((d) => (
                  <Button key={d} size="sm" variant="outline" onClick={() => go(d)}>
                    {DECK_TITLE[d]}{DECK_ITEMS[d] && <span className="text-xs text-muted">{masteredCount(s, DECK_ITEMS[d])}/{DECK_ITEMS[d].length}</span>}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><PenLine size={16} className="mr-1 inline" />Dùng ngay trong bài Viết</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><b>Task 1 (≥120 từ, ~20 phút):</b> Dear … → I am writing to … (mục đích) → 2–3 đoạn nội dung, mỗi đoạn 1 ý của đề → I look forward to hearing from you. → Yours faithfully / sincerely / Best wishes.</p>
            <p><b>Task 2 (≥250 từ, ~40 phút):</b> Mở bài: It is often argued that … + From my perspective, … → Thân bài 1: Firstly, … For instance, … As a result, … → Thân bài 2: However, / On the other hand, … → Kết: In conclusion, … the advantages outweigh the disadvantages.</p>
            <p className="text-muted">Mỗi đoạn dùng 2–3 collocation của chủ đề trong đề (Giáo dục, Môi trường…) — giám khảo chấm từ vựng theo độ chính xác và đa dạng, không theo độ “khó”.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><Mic size={16} className="mr-1 inline" />Dùng ngay trong bài Nói</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><b>Part 1:</b> trả lời 2–3 câu: ý chính + lý do + ví dụ (Well, to be honest, … One of the main reasons is that …).</p>
            <p><b>Part 2:</b> I would choose … because … → The main advantage … → As for …, the problem is … → That's why I'd go for …</p>
            <p><b>Part 3:</b> I'd like to talk about … → First of all, … → Moving on to the second point, … → Last but not least, … → So, to sum up, …</p>
            <p className="text-muted">Bí quyết: nói to mọi câu khi học — miệng quen thì lúc thi mới bật ra được.</p>
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-sm text-muted"><BookOpenText size={14} className="mr-1 inline" />Tiến độ lưu trong trình duyệt này. Muốn học sâu hơn: mục Từ vựng có lịch ôn SRS và AI chấm câu tự đặt.</p>
    </div>
  );
}
