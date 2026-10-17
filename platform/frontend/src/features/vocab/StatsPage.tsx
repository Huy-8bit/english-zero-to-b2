import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, Database, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { AIErrorBox } from "@/components/ai/AIStatus";
import { vocab } from "@/services/vocab";
import { SubNav } from "./VocabHome";

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`);

export default function StatsPage() {
  const q = useQuery({ queryKey: ["vocab-stats"], queryFn: vocab.stats });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  const c = s.counts;
  const funnel: [string, number | undefined, string][] = [
    ["Đã gặp", c.encountered, "Từng xuất hiện trong phiên học / được lưu"], ["Đã luyện", c.practiced, "Có ít nhất một câu trả lời được chấm"],
    ["Đã học", c.learned, "Đã tự nhớ lại được (gõ, nghe-chép, flashcard)"], ["Đã trả lời đúng", c.answered_correctly, "Ít nhất một lần đúng"],
    ["Nhớ lại sau ≥ 1 ngày", c.recalled_after_delay, "Nhớ đúng khi ôn sau ít nhất một ngày"], ["Dùng đúng trong câu", c.used_correctly, "Tự đặt câu / Writing / Speaking / hội thoại không có lỗi ở từ đó"],
    ["Đã vững (ước lượng)", c.mastered, "FSRS: độ ổn định ≥ 21 ngày, ≥ 3 lần đúng"],
  ];
  return (
    <div>
      <PageHeader title="Thống kê từ vựng" subtitle={s.notes_vi} />
      <SubNav />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Từ trong kho" v={s.total_available.toLocaleString("vi-VN")} />
        <Kpi label="Đến hạn ôn" v={String(c.due ?? 0)} sub={`${c.in_schedule ?? 0} từ trong lịch ôn`} />
        <Kpi label="Độ chính xác khi nhớ lại (30 ngày)" v={pct(s.recall_accuracy)} sub={`${s.recall_30d} lượt · tổng ${pct(s.overall_accuracy)}`} />
        <Kpi label="Khả năng nhớ ước tính" v={pct(s.estimated_retention)} sub={`${s.retention_cards} từ đang ôn · ${s.algorithm}`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Các mức độ (không đánh đồng)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {funnel.map(([l, n, d]) => (
              <div key={l} className="flex items-center justify-between gap-3 text-sm" title={d}>
                <span><b>{l}</b><span className="block text-xs text-muted">{d}</span></span><span className="text-lg font-semibold tabular-nums">{n ?? 0}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 text-sm"><span>Từ vừa quên</span><b>{c.forgotten ?? 0}</b></div>
            <div className="flex justify-between text-sm"><span>Dùng trong Writing / Speaking</span><b>{c.used_writing ?? 0} / {c.used_speaking ?? 0}</b></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ôn tập 14 ngày</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.daily.map((d) => ({ ...d, day: d.date.slice(5), wrong: d.reviews - d.correct }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend />
                <Bar dataKey="correct" name="Đúng" stackId="a" fill="var(--color-success)" />
                <Bar dataKey="wrong" name="Sai" stackId="a" fill="var(--color-danger)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Theo trình độ (CEFR ước lượng)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(s.by_level).map(([lv, x]) => (
              <div key={lv}>
                <div className="flex justify-between text-sm"><b>{lv}</b><span className="text-muted">đã gặp {x.encountered} · đã học {x.learned} · vững {x.mastered} / {x.total}</span></div>
                <Progress value={x.total ? (x.learned / x.total) * 100 : 0} label={`${lv} đã học`} />
              </div>
            ))}
            <div className="border-t border-border pt-2 text-sm">Collocation: đã học {s.collocations.learned}/{s.collocations.total} · vững {s.collocations.mastered} · chính xác {pct(s.collocations.accuracy)} ({s.collocations.attempts_30d} lượt)</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Theo chủ đề</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto" tabIndex={0} role="region" aria-label="Tiến độ theo chủ đề">
            {s.by_topic.map((t) => (
              <div key={t.id} className="text-sm">
                <div className="flex justify-between"><span>{t.name_vi}</span><span className="text-muted">{t.learned}/{t.total}</span></div>
                <Progress value={t.total ? (t.learned / t.total) * 100 : 0} label={`${t.name_vi} đã học`} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <DataPanel />
    </div>
  );
}

function Kpi({ label, v, sub }: { label: string; v: string; sub?: string }) {
  return <Card><CardContent className="pt-5"><p className="text-xs text-muted">{label}</p><p className="text-2xl font-bold tabular-nums">{v}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</CardContent></Card>;
}

/** Data quality & AI enrichment review queue (pipeline stage "Review"). */
function DataPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["vocab-enrichment"], queryFn: vocab.enrichment });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["vocab-enrichment"] });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  if (!q.data) return null;
  const d = q.data;
  const counts = d.dataset.counts;
  return (
    <Card className="mt-6">
      <CardHeader><CardTitle><Database size={16} className="mr-1 inline" />Dữ liệu từ vựng & bổ sung bằng AI</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted">Bộ dữ liệu {d.dataset.version}: {counts.entries} mục từ, {counts.senses} nghĩa, {counts.examples} ví dụ (nguồn: giáo trình, CEFR-J, NGSL/NAWL, Wiktionary, Tatoeba). Phát âm chỉ lấy từ từ điển.</p>
        <p>{d.candidates.toLocaleString("vi-VN")} từ chưa có nghĩa tiếng Việt từ nguồn mở đang chờ bổ sung. Kết quả AI <b>không tự xuất bản</b> — cần duyệt từng mục.</p>
        <div className="flex flex-wrap gap-2">
          <Badge>Đang chờ: {d.waiting}</Badge><Badge tone="warning">Cần duyệt: {d.needs_review}</Badge>
          {Object.entries(d.jobs).map(([k, v]) => <Badge key={k}>{k}: {v}</Badge>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => vocab.enrichQueue(20))}>Xếp 20 từ vào hàng chờ</Button>
          <Button size="sm" disabled={busy || !d.waiting} onClick={() => run(() => vocab.enrichRun(1, 8))}><Sparkles size={14} />Chạy 1 lô (8 từ)</Button>
        </div>
        {err != null && <AIErrorBox error={err} />}
        {d.review.map((j) => (
          <div key={j.id} className="rounded-2xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p><b>{j.lemma}</b> <span className="text-xs text-muted">{j.result.cefr_estimate} · {j.model}</span></p>
              <div className="flex gap-1">
                <Button size="sm" variant="success" disabled={busy} onClick={() => run(async () => { await vocab.enrichDecide(j.id, "approve"); toast.success("Đã duyệt và xuất bản"); })}><Check size={14} />Duyệt</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => vocab.enrichDecide(j.id, "reject"))}><X size={14} />Bỏ</Button>
              </div>
            </div>
            {j.problems.length > 0 && <p className="text-xs text-danger">Kiểm tra tự động: {j.problems.join(", ")}</p>}
            <ul className="mt-1 text-sm">{j.result.senses.map((s, i) => <li key={i}>{s.pos}: <b>{s.meaning_vi}</b> — {s.definition_en}</li>)}</ul>
            {j.result.examples.map((x, i) => <p key={i} className="text-xs text-muted"><i>{x.en}</i> — {x.vi}</p>)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
