import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { LEVEL_OPTIONS, vocab, type VocabSettings } from "@/services/vocab";
import { ModeGrid, SubNav, useStart } from "./VocabHome";

const PROFILE_VI = { support: "Hỗ trợ thêm", steady: "Ổn định", stretch: "Nâng độ khó" };

export default function TodayPage() {
  const q = useQuery({ queryKey: ["vocab-plan"], queryFn: vocab.plan });
  const topics = useQuery({ queryKey: ["vocab-topics"], queryFn: vocab.topics });
  const { start, busy } = useStart();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data;
  return (
    <div>
      <PageHeader title="Từ vựng hôm nay" subtitle="Kế hoạch được tính từ lịch ôn FSRS, kết quả gần đây và tùy chọn của bạn." />
      <SubNav />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Kế hoạch hôm nay</CardTitle><span className="text-sm text-muted">{p.minutes ? `≈ ${p.minutes} phút` : ""}</span></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Box n={p.new_left} label={`Từ mới (mục tiêu ${p.new_goal})`} />
              <Box n={p.due_today} label="Đến hạn hôm nay" />
              <Box n={p.weak.length} label="Từ hay quên" />
              <Box n={p.collocations} label="Collocation cần luyện" />
            </div>
            <ol className="space-y-2">
              {p.tasks.map((t, i) => <li key={t.key} className="flex items-center gap-2 text-sm"><CalendarCheck size={16} className="text-primary" />{i + 1}. {t.label_vi}</li>)}
            </ol>
            {!p.tasks.length && <p className="text-sm text-muted">Hôm nay không còn việc bắt buộc. Bạn có thể luyện thêm.</p>}
            <p className="text-xs text-muted">Mức độ: <b>{PROFILE_VI[p.profile.name]}</b> — {p.profile.reason_vi} {p.adjustments_vi.join(" ")}</p>
            <Button size="lg" onClick={() => start("daily")} disabled={!!busy || !p.tasks.length}><Play size={18} />Bắt đầu: ôn → học mới → nhớ lại → ngữ cảnh</Button>
          </CardContent>
        </Card>
        <SettingsCard s={p.settings} />
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle>Luyện theo lựa chọn</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select aria-label="Chủ đề" value={topic} onChange={(e) => setTopic(e.target.value)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm">
              <option value="">Mọi chủ đề</option>
              {topics.data?.filter((t) => t.total).map((t) => <option key={t.id} value={t.id}>{t.name_vi} ({t.total})</option>)}
            </select>
            <select aria-label="Trình độ" value={level} onChange={(e) => setLevel(e.target.value)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm">
              <option value="">Mọi trình độ</option>
              {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <ModeGrid busy={busy} start={start} params={{ topic: topic || undefined, level: level || undefined }} />
        </CardContent>
      </Card>
    </div>
  );
}

function Box({ n, label }: { n: number; label: string }) {
  return <div className="rounded-2xl bg-surface-2 p-3 text-center"><p className="text-2xl font-bold tabular-nums">{n}</p><p className="text-xs text-muted">{label}</p></div>;
}

function SettingsCard({ s }: { s: VocabSettings }) {
  const qc = useQueryClient();
  const [v, setV] = useState(s);
  useEffect(() => setV(s), [s]);
  const save = async () => {
    try {
      await vocab.saveSettings(v);
      toast.success("Đã lưu tùy chọn từ vựng");
      qc.invalidateQueries({ queryKey: ["vocab-plan"] });
      qc.invalidateQueries({ queryKey: ["vocab-overview"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được");
    }
  };
  return (
    <Card>
      <CardHeader><CardTitle>Tùy chọn</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <label className="block">Số từ mới mỗi ngày: <b>{v.daily_new}</b>
          <input type="range" min={0} max={20} value={v.daily_new} onChange={(e) => setV({ ...v, daily_new: Number(e.target.value) })} className="w-full" />
        </label>
        <label className="block">Mức ghi nhớ mong muốn: <b>{Math.round(v.retention * 100)}%</b>
          <input type="range" min={80} max={95} value={Math.round(v.retention * 100)} onChange={(e) => setV({ ...v, retention: Number(e.target.value) / 100 })} className="w-full" />
          <span className="text-xs text-muted">Cao hơn = ôn thường xuyên hơn (FSRS desired retention).</span>
        </label>
        <label className="flex items-center justify-between gap-2">Trình độ để chọn từ mới
          <select value={v.level ?? ""} onChange={(e) => setV({ ...v, level: e.target.value || null })} className="h-9 rounded-xl border border-border bg-surface px-2">
            <option value="">Tự động</option>{LEVEL_OPTIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">Giọng phát âm mặc định
          <select value={v.accent} onChange={(e) => setV({ ...v, accent: e.target.value as "uk" | "us" })} className="h-9 rounded-xl border border-border bg-surface px-2">
            <option value="uk">Anh–Anh</option><option value="us">Anh–Mỹ</option>
          </select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.timed_speed} onChange={(e) => setV({ ...v, timed_speed: e.target.checked })} />Hiện đồng hồ nhịp trong “Ôn nhanh” (không tính sai khi hết giờ)</label>
        <Button onClick={save}><Save size={16} />Lưu</Button>
      </CardContent>
    </Card>
  );
}
