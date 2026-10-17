import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { ai, type Review } from "@/services/ai";
import { Badge } from "@/components/ui/badge";
import { ErrorBox, Skeleton } from "@/components/ui/misc";
import { ExerciseRunner } from "@/components/ai/ExerciseRunner";
import { AIErrorBox, AILoading, SimulatedBanner } from "@/components/ai/AIStatus";

export default function ExerciseSetPage() {
  const { setId = "" } = useParams();
  return <ExerciseSetPageSession key={setId} setId={setId} />;
}

function ExerciseSetPageSession({ setId }: { setId: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ai-set", setId], queryFn: () => ai.exercise(setId) });
  const [review, setReview] = useState<Review | null | undefined>(undefined);
  const [similar, setSimilar] = useState<"idle" | "busy" | unknown>("idle");
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} />;
  const es = q.data;
  const makeSimilar = async () => {
    setSimilar("busy");
    try {
      const n = await ai.similar(es.id);
      setSimilar("idle");
      nav(`/ai-practice/${n.id}`);
    } catch (e) {
      setSimilar(e);
    }
  };
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/ai-practice" className="mb-3 inline-flex items-center gap-1 text-sm text-primary"><ArrowLeft size={14} />Luyện tập với AI</Link>
      <h1 className="text-2xl font-bold">{es.title}</h1>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {es.lesson_id && <Link to={`/learn/${es.lesson_id}`}><Badge tone="primary">{es.lesson_id} · {es.lesson_title}</Badge></Link>}
        {es.level && <Badge>{es.level}</Badge>}<Badge>Độ khó: {es.difficulty}</Badge>
        {es.generation.rejected ? <Badge tone="warning">Đã loại {es.generation.rejected} câu không đạt kiểm tra</Badge> : null}
        {es.generation.blind_verified ? <Badge tone="success">{es.generation.blind_verified} câu đã được AI giải độc lập để đối chiếu đáp án</Badge> : null}
      </div>
      {es.objectives.length > 0 && <p className="mt-2 text-sm text-muted">Mục tiêu: {es.objectives.join(" · ")}</p>}
      <div className="mt-4"><SimulatedBanner /></div>
      <ExerciseRunner setId={es.id} questions={es.questions} review={review === undefined ? es.review : review}
        onReview={(r) => { setReview(r); qc.invalidateQueries({ queryKey: ["dashboard"] }); }} onSimilar={makeSimilar} />
      {similar === "busy" && <AILoading label="Đang tạo bộ bài tương tự…" />}
      {similar !== "idle" && similar !== "busy" && <AIErrorBox error={similar} onRetry={makeSimilar} />}
    </div>
  );
}
