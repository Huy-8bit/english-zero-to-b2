import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, KeyRound } from "lucide-react";
import { api } from "@/services/api";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { ErrorBox, Skeleton } from "@/components/ui/misc";

/** Reference Mode: the full original Markdown document, rendered safely. */
export default function ReferencePage() {
  const [params] = useSearchParams();
  const loc = useLocation();
  const path = params.get("path") ?? "";
  const q = useQuery({ queryKey: ["doc", path], queryFn: () => api.doc(path), enabled: path.length > 2 });
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { setConfirmed(false); }, [path]);
  useEffect(() => {
    if (!q.data || !loc.hash) return;
    const id = decodeURIComponent(loc.hash.slice(1));
    setTimeout(() => {
      const el = Array.from(document.querySelectorAll("h1,h2,h3,h4")).find((h) => slug(h.textContent ?? "") === id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, [q.data, loc.hash]);
  if (!path) return <ErrorBox error="Thiếu đường dẫn tài liệu" />;
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} />;
  const d = q.data;
  return (
    <article>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link to="/library" className="text-primary">Tra cứu</Link><span className="text-muted">/</span><span className="truncate text-muted">{d.path}</span>
        {d.unit_id && <Link to={`/learn/${d.unit_id}`} className="ml-auto"><Button size="sm"><GraduationCap size={15} />Học theo từng slide</Button></Link>}
      </div>
      <p className="mb-4 rounded-xl border border-border bg-surface px-4 py-2 text-xs text-muted">Chế độ tra cứu: đọc toàn bộ tài liệu gốc. Để học có bài tập được chấm và lưu tiến độ, dùng chế độ học theo slide.</p>
      {d.is_answer_file && !confirmed ? (
        <div className="rounded-2xl border border-warning/40 bg-warning-soft p-6">
          <p className="flex items-center gap-2 font-semibold"><KeyRound size={18} />Đây là file đáp án</p>
          <p className="mt-1 text-sm">Hãy làm bài trước khi xem đáp án. Trong chế độ học, đáp án của từng câu tự hiện sau khi bạn nộp.</p>
          <Button className="mt-3" variant="outline" onClick={() => setConfirmed(true)}>Tôi đã làm bài — mở đáp án</Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-8"><Markdown docPath={d.path}>{d.markdown}</Markdown></div>
      )}
    </article>
  );
}

function slug(t: string) {
  return t.trim().toLowerCase().replace(/[^\p{L}\p{N}\- ]/gu, "").replace(/ /g, "-");
}
