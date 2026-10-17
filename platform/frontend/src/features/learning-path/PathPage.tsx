import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, CircleDot, Lock, RotateCcw, Star } from "lucide-react";
import { api } from "@/services/api";
import type { Unit } from "@/types/content";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { cn, KIND_LABELS, STATUS_LABELS } from "@/lib/utils";

const STATUS_STYLE: Record<string, { icon: typeof Circle; cls: string }> = {
  not_started: { icon: Circle, cls: "border-border bg-surface text-muted" },
  in_progress: { icon: CircleDot, cls: "border-primary bg-primary-soft text-primary" },
  completed: { icon: CheckCircle2, cls: "border-success bg-success-soft text-success" },
  review: { icon: RotateCcw, cls: "border-danger bg-danger-soft text-danger" },
};

export default function PathPage() {
  const path = useQuery({ queryKey: ["path"], queryFn: api.path, refetchOnMount: "always" });
  const rec = useQuery({ queryKey: ["recommendations"], queryFn: api.recommendations });
  const [level, setLevel] = useState<string | null>(null);
  if (path.isLoading) return <Skeleton className="h-96" />;
  if (path.error || !path.data) return <ErrorBox error={path.error} onRetry={() => path.refetch()} />;
  const active = level ?? rec.data?.current_level ?? "A0";
  const lv = path.data.levels.find((l) => l.id === active) ?? path.data.levels[0];
  const lessons = lv.blocks.flatMap((b) => b.lessons);
  const done = lessons.filter((l) => l.status === "completed").length;
  const nextId = rec.data?.next_lesson?.id;
  return (
    <div>
      <PageHeader title="Lộ trình học" subtitle="A0 → A1 → A2 → B1 → B2. Bấm vào bài bất kỳ để học — bạn có thể xem trước cả những bài chưa học." />
      <div role="tablist" aria-label="Cấp độ" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {path.data.levels.map((l) => {
          const ls = l.blocks.flatMap((b) => b.lessons);
          const c = ls.filter((x) => x.status === "completed").length;
          return (
            <button key={l.id} role="tab" aria-selected={l.id === active} onClick={() => setLevel(l.id)}
              className={cn("min-w-32 rounded-2xl border px-4 py-3 text-left transition", l.id === active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-primary/50")}>
              <span className="block text-lg font-bold">{l.id}</span>
              <span className="block text-xs text-muted">{l.name} · {c}/{ls.length}</span>
            </button>
          );
        })}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <p className="text-sm text-muted">{done}/{lessons.length} bài ngữ pháp {lv.id} đã hoàn thành</p>
        <Progress value={(done / Math.max(1, lessons.length)) * 100} className="max-w-xs" label={`Tiến độ ${lv.id}`} />
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          {Object.entries(STATUS_STYLE).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1"><v.icon size={13} />{STATUS_LABELS[k]}</span>)}
        </div>
      </div>
      <div className="space-y-8">
        {lv.blocks.map((b, bi) => (
          <section key={b.id} aria-labelledby={`blk-${b.id}`}>
            <h2 id={`blk-${b.id}`} className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Khối {bi + 1}{b.title ? ` · ${b.title}` : ""}</h2>
            <ol className="relative space-y-3 border-l-2 border-dashed border-border pl-6">
              {b.lessons.map((u) => <Node key={u.id} unit={u} recommended={u.id === nextId} />)}
            </ol>
          </section>
        ))}
        {lv.extras.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Kỹ năng, giao tiếp & kiểm tra {lv.id}</h2>
            <ol className="relative space-y-3 border-l-2 border-dashed border-border pl-6">
              {lv.extras.map((u) => <Node key={u.id} unit={u} recommended={false} />)}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

function Node({ unit, recommended }: { unit: Unit; recommended: boolean }) {
  const st = STATUS_STYLE[unit.status];
  const Icon = st.icon;
  return (
    <li className="relative">
      <span className={cn("absolute -left-[37px] top-3 grid h-6 w-6 place-items-center rounded-full border-2", st.cls)} aria-hidden><Icon size={13} /></span>
      <Link to={`/learn/${unit.id}`} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border bg-surface px-4 py-3 transition hover:border-primary hover:shadow-sm", recommended ? "border-primary ring-2 ring-primary/20" : "border-border")}>
        <span className="font-mono text-xs text-muted">{unit.id}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{unit.title}</span>
          {unit.title_vi && <span className="block text-sm text-muted">{unit.title_vi}</span>}
        </span>
        {unit.kind !== "grammar" && <Badge>{KIND_LABELS[unit.kind]}</Badge>}
        {recommended && <Badge tone="primary"><Star size={12} />Đề xuất</Badge>}
        {unit.status !== "not_started" && <Badge tone={unit.status === "completed" ? "success" : unit.status === "review" ? "danger" : "primary"}>{STATUS_LABELS[unit.status]}{unit.best_score !== null ? ` · ${Math.round(unit.best_score)}%` : ""}</Badge>}
        {unit.prerequisites.length > 0 && unit.status === "not_started" && <span className="inline-flex items-center gap-1 text-xs text-muted" title={`Nên học trước: ${unit.prerequisites.join(", ")}`}><Lock size={12} />{unit.prerequisites.length} bài tiên quyết</span>}
      </Link>
    </li>
  );
}
