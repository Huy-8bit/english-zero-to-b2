import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Languages, PenLine, Play, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { plan, type WritingStep as Step } from "@/services/plan";
import { vocab } from "@/services/vocab";

const RETURN = "/writing-daily";
const ICON = { translate: Languages, use: PenLine, paragraph: PenLine };

/** Daily writing ladder: sentences you translate → sentences you make → a paragraph at your level. */
export default function DailyWritingPage() {
  const q = useQuery({ queryKey: ["writing-daily"], queryFn: plan.writingDaily, refetchOnMount: "always" });
  const nav = useNavigate();
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const start = async (s: Step) => {
    try {
      if (s.key === "paragraph") return nav(`/writing-studio?level=${d.level}`);
      const ses = await vocab.start(s.key === "translate" ? "translate" : "use", { size: s.key === "translate" ? 8 : 5 });
      if (!ses.items.length) return toast.info("Hãy học vài từ trước — bài luyện viết dùng chính các từ bạn đã học.");
      nav(`/vocabulary/session/${ses.id}?return=${encodeURIComponent(RETURN)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không bắt đầu được");
    }
  };
  return (
    <div>
      <PageHeader title="Luyện viết mỗi ngày" subtitle={`Từ câu đến đoạn, theo trình độ ${d.level}, dùng chính các từ bạn đã học. Mỗi lỗi được giải thích và quay lại ở phần ôn tập.`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {d.steps.map((s, i) => {
            const Icon = ICON[s.key];
            const complete = s.done >= s.goal;
            return (
              <Card key={s.key}>
                <CardContent className="flex flex-wrap items-center gap-4 pt-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">{complete ? <CheckCircle2 size={20} /> : <Icon size={20} />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Bậc {i + 1}. {s.title}</p>
                    <p className="text-sm text-muted">{s.why_vi}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress className="max-w-xs flex-1" value={Math.min(100, (100 * s.done) / s.goal)} label={`${s.title}: ${s.done}/${s.goal}`} />
                      <span className="text-xs tabular-nums text-muted">{s.done}/{s.goal}{s.correct !== null && s.done ? ` · đúng ${s.correct}` : ""}</span>
                    </div>
                  </div>
                  <Button variant={complete ? "outline" : "primary"} onClick={() => void start(s)}><Play size={16} />{complete ? "Luyện thêm" : "Bắt đầu"}</Button>
                </CardContent>
              </Card>
            );
          })}
          {d.done_today && <p className="text-sm font-medium text-success"><CheckCircle2 size={16} className="mr-1 inline" />Xong cả 3 bậc hôm nay!</p>}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>7 ngày qua</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="flex justify-between"><span className="text-muted">Câu đã dịch</span><b>{d.week.translations}</b></p>
              <p className="flex justify-between"><span className="text-muted">Dịch đúng</span><b>{d.week.accuracy === null ? "—" : `${d.week.accuracy}%`}</b></p>
              <p className="flex justify-between"><span className="text-muted">Đoạn văn đã viết</span><b>{d.week.paragraphs}</b></p>
              {d.last_paragraph?.score_10 != null && <p className="flex justify-between"><span className="text-muted">Đoạn gần nhất (AI ước lượng)</span><b>{d.last_paragraph.score_10}/10</b></p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle><TriangleAlert size={16} className="mr-1 inline" />Lỗi hay gặp</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {d.common_errors.length ? d.common_errors.map((e) => <Badge key={e.type} tone="warning">{e.type} · {e.count}</Badge>)
                : <p className="text-sm text-muted">Chưa có dữ liệu — làm bậc 1 để bắt đầu.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
      {d.recent_translation_mistakes.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Câu dịch cần xem lại</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {d.recent_translation_mistakes.map((m, i) => (
                <li key={i} className="rounded-xl border border-border px-3 py-2">
                  <p>{m.vi}</p>
                  <p className="text-muted"><Circle size={10} className="mr-1 inline text-danger" />{m.answer || "(bỏ trống)"}</p>
                  <p><CheckCircle2 size={12} className="mr-1 inline text-success" /><b>{m.expected}</b></p>
                  {m.explanation_vi && <p className="text-xs text-muted">{m.explanation_vi}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
