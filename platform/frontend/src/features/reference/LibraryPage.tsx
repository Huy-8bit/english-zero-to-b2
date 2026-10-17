import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { api } from "@/services/api";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";

const GROUPS: Record<string, string> = {
  "06-GRAMMAR-REFERENCE": "Tra cứu ngữ pháp", "00-GETTING-STARTED": "Bắt đầu & lộ trình", "13-LEARNING-TRACKER": "Công cụ theo dõi",
  root: "Tổng quan giáo trình",
};

export default function LibraryPage() {
  const q = useQuery({ queryKey: ["library"], queryFn: api.library });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const groups = q.data.documents.reduce((acc, d) => ((acc[d.group] ??= []).push(d), acc), {} as Record<string, typeof q.data.documents>);
  const order = ["06-GRAMMAR-REFERENCE", "00-GETTING-STARTED", "13-LEARNING-TRACKER", "root"];
  const keys = [...order.filter((k) => groups[k]), ...Object.keys(groups).filter((k) => !order.includes(k)).sort()];
  return (
    <div>
      <PageHeader title="Tra cứu" subtitle="Chế độ đọc toàn văn: bảng tổng hợp ngữ pháp, lộ trình, hướng dẫn và tài liệu gốc của giáo trình." />
      <div className="space-y-8">
        {keys.map((k) => (
          <section key={k}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{GROUPS[k] ?? k.replace(/^\d+-/, "").replace(/-/g, " ")}</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groups[k].map((d) => (
                <li key={d.path}>
                  <Link to={`/reference?path=${encodeURIComponent(d.path)}`} className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-sm hover:border-primary">
                    <FileText size={16} className="mt-0.5 shrink-0 text-muted" />
                    <span><span className="block font-medium">{d.title}</span><span className="block text-xs text-muted">{d.path}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
