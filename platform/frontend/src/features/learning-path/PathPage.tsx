import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, CircleDot, Lock, RotateCcw, Star } from "lucide-react";
import { api, type ManualTarget } from "@/services/api";
import type { Unit } from "@/types/content";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { cn, KIND_LABELS, STATUS_LABELS } from "@/lib/utils";

const STATUS_STYLE: Record<string, { icon: typeof Circle; cls: string }> = {
  not_started: { icon: Circle, cls: "border-border bg-surface text-muted" },
  in_progress: { icon: CircleDot, cls: "border-primary bg-primary-soft text-primary" },
  completed: { icon: CheckCircle2, cls: "border-success bg-success-soft text-success" },
  review: { icon: RotateCcw, cls: "border-danger bg-danger-soft text-danger" },
};

export default function PathPage() {
  const qc = useQueryClient();
  const path = useQuery({ queryKey: ["path"], queryFn: api.path, refetchOnMount: "always" });
  const rec = useQuery({ queryKey: ["recommendations"], queryFn: api.recommendations });
  const [level, setLevel] = useState<string | null>(null);
  const [target, setTarget] = useState<(ManualTarget & { title: string; requiresSkills?: boolean }) | null>(null);
  const [includeSkills, setIncludeSkills] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<Unit>();
  const preview = useQuery({
    queryKey: ["manual-progress-preview", target, includeSkills],
    queryFn: () => api.markUpTo(target!, includeSkills, true),
    enabled: target !== null,
    staleTime: 0,
  });
  const refresh = () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "manual-progress-preview" });
  const mark = useMutation({
    mutationFn: () => api.markUpTo(target!, includeSkills),
    onSuccess: async () => { setTarget(null); await refresh(); },
  });
  const toggle = useMutation({
    mutationFn: (unit: Unit) => api.markLesson(unit.id, unit.status === "completed" ? "not_started" : "completed"),
    onSuccess: refresh,
    onSettled: () => setPendingToggle(undefined),
  });
  function choose(next: ManualTarget & { title: string; requiresSkills?: boolean }) {
    mark.reset();
    setIncludeSkills(next.requiresSkills ?? false);
    setTarget(next);
  }
  const controls = { onMark: (u: Unit) => choose({ unit_id: u.id, title: `${u.id} · ${u.title}`, requiresSkills: u.kind !== "grammar" }),
    onToggle: (u: Unit) => { setPendingToggle(u); toggle.mutate(u); }, pendingToggle,
    busy: !!pendingToggle || toggle.isPending || mark.isPending };
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
      <div className="mb-6 overflow-x-auto pb-1">
        <div className="min-w-[720px]">
          <div role="tablist" aria-label="Cấp độ" className="grid grid-cols-5 gap-2">
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
          <div className="mt-1 grid grid-cols-5 gap-2">
            {path.data.levels.map((l) => <Button key={l.id} size="sm" variant="ghost" disabled={controls.busy}
              onClick={() => choose({ level: l.id, title: `Hết level ${l.id}` })}
              aria-label={`Tôi đã học tới đây: hết ${l.id}`}>Tôi đã học tới đây</Button>)}
          </div>
        </div>
      </div>
      {toggle.error && <ErrorBox error={toggle.error} />}
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
              {b.lessons.map((u) => <Node key={u.id} unit={u} recommended={u.id === nextId} {...controls} />)}
            </ol>
          </section>
        ))}
        {lv.extras.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Kỹ năng, giao tiếp & kiểm tra {lv.id}</h2>
            <ol className="relative space-y-3 border-l-2 border-dashed border-border pl-6">
              {lv.extras.map((u) => <Node key={u.id} unit={u} recommended={false} {...controls} />)}
            </ol>
          </section>
        )}
      </div>
      <Dialog open={target !== null} onOpenChange={(open) => { if (!open && !mark.isPending) setTarget(null); }}
        title="Xác nhận tiến độ đã học" description={target?.title}>
        <p className="mb-3 text-sm text-muted">Đánh dấu từ đầu lộ trình tới mốc này. Giữ nguyên bài đã hoàn thành; không cộng XP, chuỗi ngày hay thành tích.</p>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeSkills} disabled={mark.isPending || target?.requiresSkills}
            onChange={(e) => setIncludeSkills(e.target.checked)} />
          Bao gồm bài kỹ năng và giao tiếp trước mốc này
        </label>
        {preview.isFetching ? <p role="status">Đang tính số bài…</p> : preview.error ? <ErrorBox error={preview.error} onRetry={() => preview.refetch()} /> : preview.data && <>
          <p role="status">Sẽ đánh dấu hoàn thành {preview.data.count} bài.</p>
          <ul className="my-3 max-h-40 overflow-y-auto text-sm text-muted">
            {preview.data.changes.map((u) => <li key={u.unit_id}>{u.unit_id} · {u.title}</li>)}
          </ul>
        </>}
        {mark.error && <ErrorBox error={mark.error} />}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" disabled={mark.isPending} onClick={() => setTarget(null)}>Hủy</Button>
          <Button disabled={mark.isPending || toggle.isPending || preview.isFetching || !!preview.error || !preview.data?.count}
            onClick={() => mark.mutate()}>{mark.isPending ? "Đang lưu…" : "Xác nhận đánh dấu"}</Button>
        </div>
      </Dialog>
    </div>
  );
}

function Node({ unit, recommended, onMark, onToggle, pendingToggle, busy }: {
  unit: Unit; recommended: boolean; onMark: (u: Unit) => void; onToggle: (u: Unit) => void; pendingToggle?: Unit; busy: boolean;
}) {
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
        {unit.manual && <Badge>đánh dấu thủ công</Badge>}
        {recommended && <Badge tone="primary"><Star size={12} />Đề xuất</Badge>}
        {unit.status !== "not_started" && <Badge tone={unit.status === "completed" ? "success" : unit.status === "review" ? "danger" : "primary"}>{STATUS_LABELS[unit.status]}{unit.best_score !== null ? ` · ${Math.round(unit.best_score)}%` : ""}</Badge>}
        {unit.prerequisites.length > 0 && unit.status === "not_started" && <span className="inline-flex items-center gap-1 text-xs text-muted" title={`Nên học trước: ${unit.prerequisites.join(", ")}`}><Lock size={12} />{unit.prerequisites.length} bài tiên quyết</span>}
      </Link>
      <div className="mt-1 flex flex-wrap items-center justify-end gap-3 px-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pendingToggle?.id === unit.id ? pendingToggle.status !== "completed" : unit.status === "completed"} disabled={busy}
            aria-label={`Hoàn thành ${unit.id}`} onChange={() => onToggle(unit)} />Đã hoàn thành
        </label>
        {["grammar", "skills", "communication"].includes(unit.kind) && <Button size="sm" variant="ghost" disabled={busy}
          onClick={() => onMark(unit)} aria-label={`Tôi đã học tới đây: ${unit.id}`}>Tôi đã học tới đây</Button>}
      </div>
    </li>
  );
}
