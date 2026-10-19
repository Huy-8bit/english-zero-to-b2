import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, EyeOff, Play, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { vocab } from "@/services/vocab";
import { SubNav } from "./VocabHome";
import { WordAudio } from "./components";

const GOALS = [20, 50, 100];
const RETURN = "/vocabulary/sprint";

/** Intensive vocabulary: batches of 10 words from one topic — triage what you already know, then learn the rest. */
export default function SprintPage() {
  const q = useQuery({ queryKey: ["vocab-sprint"], queryFn: vocab.sprint, refetchOnMount: "always" });
  const qc = useQueryClient();
  const nav = useNavigate();
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [showMeaning, setShowMeaning] = useState(false);
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  const words = s.next.words;
  const toLearn = words.filter((w) => !known.has(w.entry_id)).slice(0, s.batch_size);
  const done = s.goal > 0 && s.new_left === 0;

  const setGoal = async (n: number) => {
    await vocab.saveSettings({ daily_new: n });
    qc.invalidateQueries({ queryKey: ["vocab-sprint"] });
    qc.invalidateQueries({ queryKey: ["vocab-plan"] });
    toast.success(`Mục tiêu mới: ${n} từ mỗi ngày`);
  };
  const startBatch = async () => {
    setBusy(true);
    try {
      const k = words.filter((w) => known.has(w.entry_id)).map((w) => w.entry_id);
      if (k.length) await vocab.sprintKnown(k);
      setKnown(new Set());
      if (!toLearn.length) {
        await q.refetch();
        return;
      }
      const ses = await vocab.start("sprint", { entry_ids: toLearn.map((w) => w.entry_id) });
      nav(`/vocabulary/session/${ses.id}?return=${encodeURIComponent(RETURN)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không bắt đầu được đợt học");
    } finally {
      setBusy(false);
    }
  };
  const review = async () => {
    const ses = await vocab.start("review");
    nav(`/vocabulary/session/${ses.id}?return=${encodeURIComponent(RETURN)}`);
  };
  const maxForecast = Math.max(1, ...s.review_forecast.map((d) => d.reviews));

  return (
    <div>
      <PageHeader title="Học cấp tốc" subtitle="Mỗi đợt 10 từ cùng chủ đề: bỏ qua từ đã biết → học từng từ → nhận ra → tự nhớ lại → nghe lại. Từ mới được ôn đúng hạn theo FSRS." />
      <SubNav />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted">Hôm nay đã học</p>
                <p className="text-3xl font-bold tabular-nums">{s.learned_today}<span className="text-lg font-normal text-muted"> / {s.goal} từ</span></p>
              </div>
              <div className="text-right text-sm text-muted">
                <p>Đợt {Math.min(s.batches_done + (done ? 0 : 1), s.batches_total)}/{s.batches_total} · ~{s.minutes_per_batch} phút/đợt</p>
                {!done && <p>Còn khoảng {s.minutes_left} phút học từ mới</p>}
              </div>
            </div>
            <Progress value={s.goal ? (100 * s.learned_today) / s.goal : 0} label={`Đã học ${s.learned_today} trên ${s.goal} từ hôm nay`} />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Mục tiêu mỗi ngày:</span>
              {GOALS.map((g) => <Button key={g} size="sm" variant={s.goal === g ? "primary" : "outline"} onClick={() => void setGoal(g)}>{g} từ</Button>)}
            </div>
            {s.adjustments_vi.map((a) => <p key={a} className="text-xs text-warning">{a}</p>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lịch ôn 7 ngày tới</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {s.review_forecast.map((d, i) => (
              <div key={d.day} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-muted">{i === 0 ? "Hôm nay" : `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`}</span>
                <span className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(2, (70 * d.reviews) / maxForecast)}%` }} />
                <span className="text-xs tabular-nums">{d.reviews}</span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted">Số từ đến hạn ôn mỗi ngày theo lịch FSRS hiện tại. Học càng nhiều từ mới, lịch ôn càng dày — hãy ôn hết trước khi học đợt mới.</p>
            {s.due_now > 0 && <Button size="sm" variant="outline" onClick={() => void review()}><RotateCcw size={14} />Ôn {s.due_now} từ đến hạn</Button>}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle><Zap size={16} className="mr-1 inline" />{done ? "Đã đủ mục tiêu hôm nay" : `Đợt tiếp theo${s.next.topic ? ` · Chủ đề: ${s.next.topic}` : ""}`}</CardTitle>
          {!!words.length && <Button size="sm" variant="ghost" onClick={() => setShowMeaning((x) => !x)}>{showMeaning ? <EyeOff size={14} /> : <Eye size={14} />}{showMeaning ? "Ẩn nghĩa" : "Hiện nghĩa"}</Button>}
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-sm">Bạn đã học đủ {s.goal} từ hôm nay 🎉 Phần còn lại: ôn các từ đến hạn để giữ chúng trong trí nhớ. Có thể nâng mục tiêu nếu còn sức.</p>
          ) : !words.length ? (
            <p className="text-sm text-muted">Không còn từ mới phù hợp trình độ hiện tại. Hãy đổi trình độ trong tùy chọn ở trang “Hôm nay”.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">Bấm vào từ bạn <b>đã biết chắc</b> (nghe, hiểu và dùng được) để bỏ qua — thời gian dành cho từ bạn chưa biết. Từ đã biết không được tính vào số từ học hôm nay.</p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {words.map((w) => {
                  const k = known.has(w.entry_id);
                  return (
                    <li key={w.entry_id} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", k ? "border-success/40 bg-success-soft/40 opacity-70" : "border-border")}>
                      <WordAudio entryId={w.entry_id} text={w.word} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{w.word} <span className="font-mono text-xs font-normal text-muted">{w.ipa}</span></p>
                        {showMeaning && <p className="truncate text-xs text-muted" title={w.meaning_vi}>{w.meaning_vi}</p>}
                      </div>
                      <button type="button" aria-pressed={k} onClick={() => setKnown((x) => { const n = new Set(x); if (k) n.delete(w.entry_id); else n.add(w.entry_id); return n; })}
                        className={cn("shrink-0 rounded-lg border px-2 py-1 text-xs", k ? "border-success bg-success text-white" : "border-border hover:border-primary")}>
                        {k ? <><Check size={12} className="mr-0.5 inline" />Biết rồi</> : "Biết rồi?"}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={() => void startBatch()} disabled={busy}>
                  <Play size={18} />{toLearn.length ? `Học đợt này (${toLearn.length} từ)` : "Bỏ qua tất cả — lấy đợt mới"}
                </Button>
                {known.size > 0 && <Badge tone="success">{known.size} từ đã biết sẽ được bỏ qua</Badge>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>Vì sao cách này giúp nhớ nhiều từ</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-muted">
            <li>• <b>Đợt nhỏ, cùng chủ đề:</b> 10 từ gắn với một khung cảnh dễ liên tưởng hơn 100 từ rời rạc.</li>
            <li>• <b>Tự nhớ lại thay vì đọc lại:</b> mỗi từ được nhận ra, rồi tự gõ lại, rồi nghe lại ở cuối đợt.</li>
            <li>• <b>Ôn ngắt quãng:</b> FSRS hẹn lại từ đúng lúc sắp quên. Với 100 từ/ngày, phần ôn tập sẽ tăng nhanh — luôn ôn hết từ đến hạn trước.</li>
            <li>• <b>Mẹo nhớ:</b> trên thẻ từ mới, bấm “Mẹo nhớ (AI)” để có liên tưởng ngắn và một câu tự luyện.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
