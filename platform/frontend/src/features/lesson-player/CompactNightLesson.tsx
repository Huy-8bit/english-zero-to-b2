import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpenText, Coffee, Moon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, Skeleton } from "@/components/ui/misc";
import { Markdown } from "@/components/Markdown";
import { NoExampleVi } from "@/components/ExampleVi";
import type { GrammarBrief } from "./compactGrammar";
import { breakDue, clock, hideBriefQuiz, hoursMin, loadNight, nextNight, nightPace, recordBrief, startBriefQuiz, tookBreak } from "./nightPlan";
import { useNightSession } from "./useNightSession";
import { questionsForBrief } from "./briefQuestions";
import { BriefQuiz } from "./BriefQuiz";
import { ReaderControls } from "@/features/reader/ReaderControls";

/** Reading and local retrieval practice, without XP or source-completion writes. */
export function CompactNightLesson({ brief, onFull }: { brief: GrammarBrief; onFull?: () => void }) {
  const { path, session, setSession } = useNightSession();
  const nav = useNavigate();
  const [quiz, setQuiz] = useState(() => { const run = loadNight()?.briefQuiz; return !!run?.visible && run.key === brief.id; });
  const [card, setCard] = useState(quiz ? 2 : 0);
  const [now, setNow] = useState(Date.now());
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [started] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [card]);
  const cards = [
    { title: "Hiểu cách dùng", body: brief.idea },
    { title: "Khung câu và ví dụ", body: `${brief.form}\n\n${brief.examples}` },
    { title: "Điểm dễ nhầm", body: brief.trap },
  ];
  const finishReading = () => {
    if (quiz) hideBriefQuiz();
    const saved = recordBrief(brief.id);
    if (!saved) return;
    setSession(saved);
    const next = nextNight(saved, brief.id);
    nav(next ? `/learn/${next.id}?mode=night` : "/grammar-night");
  };
  const advance = () => { if (card < cards.length - 1) setCard(card + 1); else finishReading(); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (quiz || restUntil || !session || e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLElement && e.target.closest("button, a, input, textarea, select, summary")) return;
      if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); advance(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); setCard((i) => Math.max(0, i - 1)); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  if (path.isLoading) return <Skeleton className="m-8 h-96" />;
  if (path.error) return <ErrorBox error={path.error} onRetry={() => path.refetch()} />;
  if (!session) return <div className="p-8 text-center"><Link to="/grammar-night"><Button>Lên kế hoạch 3–4 giờ</Button></Link></div>;
  const p = nightPace(session, now);
  const pos = session.units.findIndex((u) => u.id === brief.id);
  const next = nextNight(session, brief.id);
  const checks = questionsForBrief(brief.id);
  const practice = () => { setSession(startBriefQuiz(brief.id, checks.map((q) => q.id))); setQuiz(true); };
  const readCard = (i: number) => { if (quiz) setSession(hideBriefQuiz()); setQuiz(false); setCard(i); };
  return (
    <NoExampleVi>
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => nav("/grammar-night")} aria-label="Thoát về trang đêm học"><X size={18} /></Button>
            <Badge tone="primary"><Moon size={12} />Ngữ pháp 1 đêm · Bản gọn</Badge>
            <span className="text-sm text-muted">{p.covered}/{p.total} chủ điểm · còn {hoursMin(p.msLeft)}</span>
            <span className="ml-auto font-mono text-sm" title="Thời gian đọc chủ điểm này">{clock((now - started) / 1000)}</span>
            <ReaderControls />
            {onFull && <Button size="sm" variant="ghost" onClick={onFull}><BookOpenText size={15} />Học đầy đủ bài này</Button>}
          </div>
          <Progress value={100 * p.covered / Math.max(1, p.total)} label={`Đã học/đọc ${p.covered}/${p.total} chủ điểm`} className="h-1 rounded-none" />
        </header>
        <main className="reader-page mx-auto max-w-4xl space-y-5 px-4 py-7 sm:px-8" data-testid="night-brief">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Chủ điểm {pos + 1}/{p.total} · {brief.level} · gộp {brief.sources.length} bài</p>
            <h1 className="text-2xl font-bold sm:text-3xl">{brief.title}</h1>
            <p className="text-sm text-muted">Đọc hiểu trước, luyện nói và viết sau. So sánh được giải thích ngay trong chủ điểm.</p>
          </div>
          {breakDue(session, now) && <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3 text-sm">
            <Coffee size={18} /><span>Đã đến giờ nghỉ 5 phút.</span>
            <Button size="sm" variant="outline" onClick={() => setRestUntil(Date.now() + 5 * 60_000)}>Nghỉ 5 phút</Button>
            <Button size="sm" variant="ghost" onClick={() => setSession(tookBreak(Date.now(), 10))}>Nhắc sau 10 phút</Button>
          </div>}
          <ol className="flex flex-wrap gap-2" aria-label="Các thẻ của chủ điểm">
            {cards.map((c, i) => <li key={c.title}><Button size="sm" variant={!quiz && i === card ? "primary" : "outline"} aria-current={!quiz && i === card ? "step" : undefined} onClick={() => readCard(i)}>{i + 1}. {c.title}</Button></li>)}
            <li><Button size="sm" variant={quiz ? "primary" : "outline"} aria-current={quiz ? "step" : undefined} onClick={practice}>4. Trắc nghiệm ({checks.length})</Button></li>
          </ol>
          {quiz ? <BriefQuiz session={session} paused={!!restUntil} onChange={() => setSession(loadNight())} onClose={() => { setQuiz(false); setCard(2); }}
            onContinue={finishReading} continueLabel={next ? "Đã học — chủ điểm tiếp" : "Đã học — xem tổng kết"} /> : <>
          <section className="reader-article rounded-3xl border border-border bg-surface p-5 text-[17px] leading-relaxed sm:p-7" aria-label={cards[card].title}>
            <h2 className="mb-4 text-xl font-bold">{cards[card].title}</h2>
            <Markdown>{cards[card].body}</Markdown>
          </section>
          {card === 2 && <details className="rounded-2xl border border-border p-4" data-testid="brief-self-check">
            <summary className="cursor-pointer font-medium text-primary">Tự kiểm tra 20 giây (tùy chọn)</summary>
            <p className="mt-3">{brief.question}</p>
            <details className="mt-3"><summary className="cursor-pointer text-sm text-primary">Xem cách trả lời</summary><p className="mt-2 text-muted">{brief.answer}</p></details>
          </details>}
          {card === 2 && <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft/30 p-4">
            <div className="min-w-0 flex-1"><p className="font-semibold">Nhớ được đến đâu? Thử {checks.length} câu trắc nghiệm</p><p className="text-sm text-muted">Chọn đáp án, xem giải thích rồi ôn lại câu sai. Có thể tạm dừng và học tiếp.</p></div>
            <Button onClick={practice}>Luyện {checks.length} câu để nhớ<ArrowRight size={16} /></Button>
          </div>}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" disabled={card === 0} onClick={() => setCard(card - 1)}><ArrowLeft size={16} />Trước</Button>
            <Button className="ml-auto h-auto whitespace-normal py-3" onClick={advance}>{card < 2 ? `Tiếp: ${cards[card + 1].title}` : next ? "Đã đọc — chủ điểm tiếp" : "Đã đọc — xem tổng kết"}<ArrowRight size={18} /></Button>
          </div>
          <p className="text-right text-xs text-muted">Enter / → tiếp · ← quay lại · đọc xong không tự đánh dấu hoàn thành bài gốc</p>
          </>}
          <details className="text-sm text-muted"><summary className="cursor-pointer">Các bài được gộp — mở khi cần học sâu</summary>
            <div className="mt-2 flex flex-wrap gap-3">{brief.sources.map((id) => <Link key={id} to={`/learn/${id}?mode=journey`} className="text-primary hover:underline">{id}</Link>)}</div>
          </details>
        </main>
        {restUntil && <div className="fixed inset-0 z-50 grid place-items-center bg-bg/95 p-6 backdrop-blur" role="dialog" aria-label="Nghỉ giải lao">
          <div className="space-y-4 text-center"><Coffee size={48} className="mx-auto text-primary" /><p className="font-mono text-4xl">{clock(Math.max(0, (restUntil - now) / 1000))}</p>
            <p>Rời màn hình, uống nước, nghỉ mắt.</p><Button onClick={() => { setSession(tookBreak()); setRestUntil(null); }}>Học tiếp</Button></div>
        </div>}
      </div>
    </NoExampleVi>
  );
}
