import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ai } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { SimulatedBanner } from "@/components/ai/AIStatus";
import { GeneratorForm } from "./GeneratorForm";

export default function PracticeStudioPage() {
  const hist = useQuery({ queryKey: ["ai-sets", "practice"], queryFn: () => ai.exercises("practice"), refetchOnMount: "always" });
  return (
    <div>
      <PageHeader title="Luyện tập với AI" subtitle="Tạo bộ bài tập mới theo bài học, chủ điểm yếu hoặc lỗi bạn đã gặp. Mọi bộ bài được lưu để làm lại." />
      <SimulatedBanner />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card><CardHeader><CardTitle>Tạo bài tập</CardTitle></CardHeader><CardContent><GeneratorForm /></CardContent></Card>
        <Card>
          <CardHeader><CardTitle>Lịch sử</CardTitle></CardHeader>
          <CardContent>
            {!hist.data?.sets.length ? <EmptyState title="Chưa có bộ bài nào" /> : (
              <ul className="space-y-2">
                {hist.data.sets.map((s) => (
                  <li key={s.id}>
                    <Link to={`/ai-practice/${s.id}`} className="block rounded-xl border border-border p-3 text-sm hover:border-primary">
                      <span className="block font-medium">{s.title}</span>
                      <span className="mt-1 flex flex-wrap gap-1 text-xs text-muted">
                        {s.lesson_id && <Badge>{s.lesson_id}</Badge>}<Badge>{s.questions} câu</Badge><Badge>{s.difficulty}</Badge>
                        {s.attempts ? <Badge tone="success">{s.last_score}/{s.questions} · {s.attempts} lần</Badge> : <Badge tone="warning">chưa làm</Badge>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
