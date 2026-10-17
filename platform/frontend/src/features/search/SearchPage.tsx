import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, GraduationCap } from "lucide-react";
import { api } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { KIND_LABELS } from "@/lib/utils";

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const res = useQuery({ queryKey: ["search", q], queryFn: () => api.search(q), enabled: q.trim().length >= 2 });
  return (
    <div>
      <PageHeader title="Tìm kiếm" subtitle={q ? <>Kết quả cho “{q}” — tìm được cả tiếng Việt có hoặc không dấu.</> : "Nhập từ khóa vào ô tìm kiếm phía trên."} />
      {res.isLoading ? <Skeleton className="h-64" /> : res.error ? <ErrorBox error={res.error} /> : res.data && res.data.results.length === 0 ? (
        <EmptyState title="Không tìm thấy kết quả">Thử từ khóa khác, ví dụ “present perfect”, “câu điều kiện”, “travel”.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {res.data?.results.map((r) => (
            <li key={r.path} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">{KIND_LABELS[r.kind] ?? r.kind}</Badge>
                {r.level && <Badge>{r.level}</Badge>}
                <span className="font-mono text-xs text-muted">{r.unit_id ?? r.path}</span>
              </div>
              <p className="mt-1 font-semibold">{r.title}{r.title_vi && <span className="font-normal text-muted"> — {r.title_vi}</span>}</p>
              {r.heading && <p className="text-sm text-primary">§ {r.heading}</p>}
              <p className="mt-1 line-clamp-2 text-sm text-muted">…{r.snippet}…</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {r.unit_id && <Link className="inline-flex items-center gap-1 text-primary" to={`/learn/${r.unit_id}`}><GraduationCap size={15} />Học bài này</Link>}
                <Link className="inline-flex items-center gap-1 text-primary" to={`/reference?path=${encodeURIComponent(r.path)}`}><BookOpenText size={15} />Đọc toàn văn</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
