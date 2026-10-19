import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDot, RotateCcw } from "lucide-react";
import { api } from "@/services/api";
import type { Unit, UnitKind } from "@/types/content";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { cn, STATUS_LABELS } from "@/lib/utils";

const INFO: Record<string, { title: string; subtitle: string; note?: string; extraKinds?: UnitKind[] }> = {
  grammar: { title: "Ngữ pháp", subtitle: "128 bài từ A0 đến B2. Mỗi bài: khái niệm → công thức → ví dụ → lỗi thường gặp → bài tập có chấm → tổng kết." },
  pronunciation: { title: "Phát âm", subtitle: "IPA, nguyên âm/phụ âm, trọng âm, nối âm, ngữ điệu, shadowing.", note: "Âm thanh dùng giọng đọc AI (OpenAI TTS, giọng máy tạo); giáo trình không kèm file ghi âm. Vào Speaking Studio → Phát âm để được chấm và sửa phát âm từng từ." },
  listening: { title: "Nghe", subtitle: "Chiến lược nghe và bài luyện theo transcript.", note: "Không có file audio gốc: bài nghe được đọc bằng giọng AI (OpenAI TTS, giọng máy tạo), có chỉnh tốc độ, nghe lại và ẩn/hiện transcript.", extraKinds: ["skills"] },
  speaking: { title: "Nói", subtitle: "Từ đặt câu cơ bản đến VSTEP-style speaking (mô phỏng).", note: "Có bấm giờ, ghi âm (nếu trình duyệt cho phép), nghe lại và checklist tự đánh giá. Hệ thống không chấm điểm phát âm.", extraKinds: ["communication"] },
  reading: { title: "Đọc", subtitle: "Skimming, scanning, ý chính, suy luận, từ vựng theo ngữ cảnh.", note: "Bài đọc hiển thị cạnh câu hỏi trên màn hình rộng, có bấm giờ và tô sáng." },
  writing: { title: "Viết", subtitle: "Từ câu đơn đến email và bài luận.", note: "Trình soạn có đếm từ, bấm giờ, tự lưu bản nháp, lịch sử phiên bản, bài mẫu và tự đánh giá theo tiêu chí." },
  practice: { title: "Luyện tập", subtitle: "Drill ngữ pháp, sửa lỗi, viết lại câu, dịch, hội thoại, ôn tuần/tháng." },
  exam: { title: "Kiểm tra", subtitle: "Placement test, Exit test từng cấp, B2 mock test, VSTEP-style mock exam.", note: "Ở chế độ kiểm tra, đáp án chỉ hiện sau khi nộp toàn bài. Đề VSTEP-style là đề mô phỏng định dạng, không phải đề thi chính thức." },
};

export default function ModulePage({ kind }: { kind: UnitKind }) {
  const info = INFO[kind];
  const q = useQuery({ queryKey: ["lessons", kind], queryFn: () => api.lessons({}), refetchOnMount: "always" });
  const [level, setLevel] = useState<string>("all");
  const units = useMemo(() => (q.data ?? []).filter((u) => u.kind === kind || info.extraKinds?.includes(u.kind)), [q.data, kind, info]);
  const levels = Array.from(new Set(units.map((u) => u.level).filter(Boolean))) as string[];
  const shown = level === "all" ? units : units.filter((u) => u.level === level);
  const groups = kind === "grammar" ? groupBy(shown, (u) => u.level ?? "") : groupBy(shown, (u) => (u.kind === kind ? info.title : u.module));
  return (
    <div>
      <PageHeader title={info.title} subtitle={info.subtitle} />
      {info.note && <p className="mb-5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">{info.note}</p>}
      {levels.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Lọc theo cấp độ">
          {["all", ...levels].map((l) => (
            <button key={l} onClick={() => setLevel(l)} aria-pressed={level === l}
              className={cn("rounded-full border px-3 py-1 text-sm", level === l ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface")}>{l === "all" ? "Tất cả" : l}</button>
          ))}
        </div>
      )}
      {q.isLoading ? <Skeleton className="h-64" /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : shown.length === 0 ? <EmptyState title="Chưa có bài nào" /> : (
        <div className="space-y-8">
          {Object.entries(groups).map(([g, list]) => (
            <section key={g}>
              {Object.keys(groups).length > 1 && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{g}</h2>}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((u) => <UnitCard key={u.id} unit={u} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  return arr.reduce((acc, x) => ((acc[key(x)] ??= []).push(x), acc), {} as Record<string, T[]>);
}

export function UnitCard({ unit }: { unit: Unit }) {
  const icon = unit.status === "completed" ? <CheckCircle2 size={16} className="text-success" /> : unit.status === "review" ? <RotateCcw size={16} className="text-danger" /> : unit.status === "in_progress" ? <CircleDot size={16} className="text-primary" /> : null;
  return (
    <li>
      <Link to={`/learn/${unit.id}`} className="flex h-full flex-col rounded-2xl border border-border bg-surface p-4 transition hover:border-primary hover:shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">{unit.id}</span>
          {unit.level && <Badge tone="primary">{unit.level}</Badge>}
          <span className="ml-auto">{icon}</span>
        </div>
        <p className="mt-2 font-semibold leading-snug">{unit.title}</p>
        {unit.title_vi && <p className="text-sm text-muted">{unit.title_vi}</p>}
        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted">
          <span>{STATUS_LABELS[unit.status]}</span>
          {unit.best_score !== null && <span>· {Math.round(unit.best_score)}%</span>}
          {unit.status === "in_progress" && unit.total_steps ? <span>· slide {unit.current_step + 1}/{unit.total_steps}</span> : null}
          {unit.minutes ? <span className="ml-auto">{unit.minutes} phút</span> : null}
        </div>
      </Link>
    </li>
  );
}
