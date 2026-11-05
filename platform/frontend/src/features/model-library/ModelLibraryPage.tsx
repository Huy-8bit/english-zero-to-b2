import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, Check, PenLine, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBox, Input, PageHeader, Skeleton } from "@/components/ui/misc";
import { SpeakButton, TtsNote } from "@/components/SpeakButton";
import { cn, safeStorage } from "@/lib/utils";
import { stopSpeaking } from "@/lib/tts";
import { fetchBucket, fetchIndex, loadProgress, matchesSearch, PROGRESS_KEY, selection, updateProgress, type LibraryIndex, type LibraryProgress, type Sample, type SampleSummary } from "./library";

const number = (n: number) => n.toLocaleString("vi-VN");
const selectClass = "mt-2 h-12 w-full min-w-0 rounded-xl border border-border bg-surface px-3 text-sm";
const linkClass = "inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2";

export default function ModelLibraryPage() {
  const query = useQuery({ queryKey: ["model-library-index"], queryFn: ({ signal }) => fetchIndex(signal), staleTime: 5 * 60_000, retry: 1 });
  return <div className="reader-page mx-auto max-w-6xl" data-testid="model-library">
    {query.isPending ? <><p role="status">Đang mở thư viện bài mẫu…</p><Skeleton className="mt-4 h-60" /></> : query.isError ? <ErrorBox error={query.error} onRetry={() => void query.refetch()} /> : <Library index={query.data} />}
  </div>;
}

function Library({ index }: { index: LibraryIndex }) {
  const [params, setParams] = useSearchParams();
  const [progress, setProgress] = useState(loadProgress);
  const current = selection(index, params);
  const { skill, groups, group, types, type, topic, sample } = current;
  const bucket = index.samples.filter((s) => s.group === group.id && s.type === type.id && s.topic === topic.id);
  const search = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const filtered = bucket.filter((s) => matchesSearch(s, search) && (status === "saved" ? progress.items[s.id]?.saved : status === "unread" ? !progress.items[s.id]?.read : true));
  const skillSamples = index.samples.filter((s) => groups.some((g) => g.id === s.group));
  const readCount = skillSamples.filter((s) => progress.items[s.id]?.read).length;
  const patch = (values: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => value === null ? next.delete(key) : next.set(key, value));
    setParams(next, { replace });
  };
  const open = (s: SampleSummary) => patch({ skill, group: s.group, type: s.type, topic: s.topic, sample: s.id });
  const toggle = (id: string, field: "saved" | "read") => {
    const next = updateProgress(progress, id, field);
    safeStorage().set(PROGRESS_KEY, next);
    setProgress(next);
  };
  if (sample) return <SampleReader key={sample.id} summary={sample} index={index} progress={progress} bucket={bucket} onOpen={open} onBack={() => patch({ sample: null, skill, group: group.id, type: type.id, topic: topic.id })} onToggle={toggle} />;
  return <>
    <PageHeader title="Thư viện bài mẫu" subtitle={`${number(index.total)} bài tham khảo Writing & Speaking · Dàn ý tiếng Việt · Cụm từ dễ áp dụng`} />
    {params.has("sample") && <p role="alert" className="mb-4 rounded-xl border border-border p-3 text-sm">Không tìm thấy bài trong liên kết này. Bạn có thể chọn lại từ danh mục bên dưới.</p>}
    <div className="mb-6 flex flex-wrap gap-2" aria-label="Kỹ năng">
      {(["writing", "speaking"] as const).map((s) => <Button key={s} variant={skill === s ? "primary" : "outline"} aria-pressed={skill === s} onClick={() => patch({ skill: s, group: null, type: null, topic: null, sample: null, q: null, status: null })}>
        {s === "writing" ? <PenLine size={16} /> : <Mic size={16} />}{s === "writing" ? "Writing" : "Speaking"} · {number(index.groups.filter((g) => g.skill === s).reduce((sum, g) => sum + g.count, 0))}
      </Button>)}
      <span className="self-center text-sm text-muted">Đã đọc {readCount}/{number(skillSamples.length)} bài</span>
    </div>
    <section className="mb-6 rounded-2xl border border-primary/30 bg-primary-soft/30 p-5">
      <h2 className="text-lg font-semibold">Mỗi lần một dạng, một chủ đề, 10 bài.</h2>
      <p className="mt-2 text-sm leading-relaxed">Đọc đề và dàn ý → đọc bài mẫu → ghi nhớ cụm từ → che gợi ý và thử viết hoặc nói lại. 50 tình huống được dùng xuyên các dạng để bạn ôn lại từ quen thuộc và thấy cách đổi khung theo yêu cầu đề.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Link className={linkClass} to={skill === "writing" ? "/writing-studio?mode=exam" : "/speaking-studio"}>{skill === "writing" ? "Gõ thuộc khung Writing" : "Mở luyện Speaking"}<ArrowRight size={15} /></Link>
        <details className="max-w-xl text-sm"><summary className="cursor-pointer py-2 text-muted">Có những dạng nào? Bài mẫu dùng thế nào?</summary><p className="mt-2 leading-relaxed">Writing Task 1: 10 mục đích thư/email. Task 2: 10 dạng và biến thể bài luận. Speaking: đủ 3 phần. Mỗi dạng/phần có 5 nhóm chủ đề × 10 bài. Đây là cách phân nhóm để tự học, không phải danh mục dạng đề cố định của kỳ thi.</p><p className="mt-2 leading-relaxed">Bài tự biên soạn, dùng chung khung với nội dung theo tình huống; không phải đề thi thật hay bài được chứng nhận điểm. Học cách triển khai và thay chi tiết cho đúng đề, không chép nguyên bài vào mọi chủ đề. Thư dài hơn mức tối thiểu để bạn có thêm câu tham khảo.</p><a className="mt-2 inline-block underline" href="https://vstep.vnu.edu.vn/test-format/" target="_blank" rel="noreferrer">Thể thức VSTEP · ĐHQGHN</a></details>
      </div>
    </section>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Task hoặc phần thi">
      {groups.map((g) => <button key={g.id} type="button" aria-pressed={group.id === g.id} className={cn("rounded-xl border p-4 text-left", group.id === g.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface hover:bg-surface-2")} onClick={() => patch({ group: g.id, type: null, q: null, status: null })}>
        <span className="block font-semibold">{g.label}</span><span className="mt-1 block text-sm">{g.count} bài · {g.skill === "writing" ? "10 dạng" : "5 chủ đề"}</span>
      </button>)}
    </div>
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <p className="mb-4 text-sm text-muted">{group.description}{group.minimum ? ` Bài thi cần ít nhất ${group.minimum} từ.` : ""}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-medium">1. Dạng bài<select className={selectClass} value={type.id} onChange={(e) => patch({ type: e.target.value, q: null, status: null })}>{types.map((t) => <option key={t.id} value={t.id}>{t.label} · 50 bài</option>)}</select></label>
        <label className="min-w-0 text-sm font-medium">2. Nhóm chủ đề<select className={selectClass} value={topic.id} onChange={(e) => patch({ topic: e.target.value, q: null, status: null })}>{index.topics.map((t) => <option key={t.id} value={t.id}>{t.label} · 10 bài</option>)}</select></label>
      </div>
      <div className="mt-4 grid items-end gap-4 sm:grid-cols-[1fr_15rem]">
        <label className="text-sm">Tìm trong 10 bài đang chọn<Input className="mt-2" value={search} placeholder="Ví dụ: online, môi trường…" onChange={(e) => patch({ q: e.target.value || null }, true)} /></label>
        <label className="text-sm">Tiến độ trong nhóm<select className={selectClass} value={status} onChange={(e) => patch({ status: e.target.value })}><option value="all">Tất cả bài</option><option value="saved">Bài đã lưu</option><option value="unread">Bài chưa đọc</option></select></label>
      </div>
    </div>
    <div className="mb-4 mt-7 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">{topic.label}</h2><p role="status" className="text-sm text-muted">{filtered.length}/{bucket.length} bài · đã đọc {bucket.filter((s) => progress.items[s.id]?.read).length}/{bucket.length}</p></div>
    {filtered.length ? <ol className="grid gap-3 sm:grid-cols-2" aria-label="Danh sách bài mẫu">{filtered.map((s) => <li key={s.id}>
      <button type="button" onClick={() => open(s)} className="flex h-full w-full gap-4 rounded-2xl border border-border bg-surface p-5 text-left transition hover:border-primary hover:bg-primary-soft/20">
        <span className="text-2xl font-semibold tabular-nums text-muted">{String(s.number).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1"><span className="block font-semibold">{s.title}</span><span lang="en" className="mt-1 block text-sm text-muted">{s.focus}</span><span className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted"><span>{s.wordCount} từ{group.id === "speaking-part3" ? " · gồm hỏi đáp" : ""}</span>{progress.items[s.id]?.read && <span className="inline-flex items-center gap-1"><Check size={13} />Đã đọc</span>}{progress.items[s.id]?.saved && <span className="inline-flex items-center gap-1"><Bookmark size={13} />Đã lưu</span>}<span className="ml-auto text-primary">Đọc bài →</span></span></span>
      </button>
    </li>)}</ol> : <EmptyState icon={<BookOpen />} title="Chưa có bài phù hợp"><p>Thử bỏ từ tìm kiếm hoặc đổi bộ lọc tiến độ trong nhóm này.</p><Button className="mt-3" variant="outline" onClick={() => patch({ q: null, status: null })}>Hiện đủ 10 bài</Button></EmptyState>}
  </>;
}

function SampleReader({ summary, index, progress, bucket, onOpen, onBack, onToggle }: {
  summary: SampleSummary; index: LibraryIndex; progress: LibraryProgress; bucket: SampleSummary[];
  onOpen: (sample: SampleSummary) => void; onBack: () => void; onToggle: (id: string, field: "saved" | "read") => void;
}) {
  const query = useQuery({ queryKey: ["model-library-bucket", index.version, summary.bucket], queryFn: ({ signal }) => fetchBucket(summary.bucket, index.version, signal), staleTime: Infinity, retry: 1 });
  const [notes, setNotes] = useState(true);
  const title = useRef<HTMLHeadingElement>(null);
  const group = index.groups.find((g) => g.id === summary.group)!;
  const type = index.types.find((t) => t.id === summary.type && t.group === summary.group)!;
  const topic = index.topics.find((t) => t.id === summary.topic)!;
  const sample = query.data?.find((s) => s.id === summary.id);
  const item = progress.items[summary.id];
  const position = bucket.findIndex((s) => s.id === summary.id);
  useEffect(() => { title.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); return () => stopSpeaking(); }, []);
  const navigation = <nav className="flex flex-wrap justify-between gap-3" aria-label="Chuyển bài trong chủ đề"><Button variant="outline" disabled={position === 0} onClick={() => onOpen(bucket[position - 1])}><ArrowLeft size={15} />Bài trước</Button><span className="self-center text-sm text-muted">Bài {summary.number}/{bucket.length}</span><Button variant="outline" disabled={position === bucket.length - 1} onClick={() => onOpen(bucket[position + 1])}>Bài tiếp<ArrowRight size={15} /></Button></nav>;
  return <div className="mx-auto max-w-4xl">
    <Button variant="ghost" className="mb-4" onClick={onBack}><ArrowLeft size={16} />Danh sách 10 bài</Button>
    <p className="text-sm text-muted">{group.label} / {type.label} / {topic.label}</p>
    <h1 ref={title} tabIndex={-1} className="mt-2 text-2xl font-bold outline-none">{String(summary.number).padStart(2, "0")}. {summary.title}</h1>
    <p lang="en" className="mt-1 text-muted">{summary.focus}</p>
    <div className="my-5 flex flex-wrap gap-2"><Button variant={item?.saved ? "primary" : "outline"} aria-pressed={!!item?.saved} onClick={() => onToggle(summary.id, "saved")}><Bookmark size={16} />{item?.saved ? "Đã lưu bài" : "Lưu bài"}</Button><Button variant={item?.read ? "success" : "outline"} aria-pressed={!!item?.read} onClick={() => onToggle(summary.id, "read")}><Check size={16} />{item?.read ? "Đã đọc bài" : "Đánh dấu đã đọc"}</Button><Button variant="outline" aria-pressed={!notes} onClick={() => setNotes(!notes)}>{notes ? "Chỉ đọc bài tiếng Anh" : "Hiện gợi ý tiếng Việt"}</Button></div>
    {navigation}
    {query.isPending ? <p role="status" className="py-8">Đang tải nội dung 10 bài của chủ đề…</p> : query.isError ? <div className="my-5"><ErrorBox error={query.error} onRetry={() => void query.refetch()} /></div> : !sample ? <div className="my-5"><ErrorBox error={new Error("Không tìm thấy nội dung bài. Hãy tải lại trang.")} /></div> : <>
      <section className="my-6 rounded-2xl border border-primary/30 bg-primary-soft/20 p-5" aria-labelledby="sample-prompt">
        <h2 id="sample-prompt" className="mb-3 font-semibold">Đề bài</h2><p lang="en" className="text-lg leading-relaxed">{sample.prompt}</p>
        {sample.options.length > 0 && <ol className="mt-3 list-inside list-decimal space-y-2" lang="en">{sample.options.map((option) => <li key={option}>{option}</li>)}</ol>}
        {notes && <div className="mt-5 border-t border-border pt-4"><h3 className="text-sm font-semibold">Đọc đề trước khi học bài mẫu</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{sample.requirementsVi.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>{sample.selectedOption !== null && <p className="mt-3 text-sm">Bài mẫu chọn phương án {sample.selectedOption + 1}; lý do cần bám điều kiện của đề.</p>}</div>}
      </section>
      <section aria-labelledby="sample-answer" className="rounded-2xl border border-border bg-surface p-5 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 id="sample-answer" className="text-xl font-semibold">Bài mẫu hoàn chỉnh</h2><span className="text-sm text-muted">{sample.mainWordCount || sample.wordCount} từ{sample.group === "speaking-part3" ? " + hỏi đáp mở rộng" : ""}</span></div>
        <Answer sample={sample} notes={notes} />
        <div className="mt-6 border-t border-border pt-4"><Button variant="ghost" size="sm" onClick={stopSpeaking}><Square size={13} />Dừng đọc</Button><TtsNote /></div>
      </section>
      {notes && <section className="my-6 rounded-2xl border border-border bg-surface p-5 sm:p-8" aria-labelledby="sample-phrases"><h2 id="sample-phrases" className="text-lg font-semibold">Nhớ ý trước, học cụm từ sau</h2><p className="mt-3 text-sm leading-relaxed">{sample.summaryVi}</p>
        <h3 className="mb-2 mt-5 text-sm font-semibold">3 cụm từ theo chủ đề</h3><ul className="space-y-3">{sample.phrases.map((p) => <li key={p.en} className="rounded-xl bg-surface-2 p-3"><div className="flex items-center justify-between gap-3"><b lang="en" className="font-medium">{p.en}</b><SpeakButton text={p.en} label={`Nghe cụm: ${p.en}`} /></div><p className="mt-1 text-sm text-muted">{p.vi}{!p.inAnswer && " · Mở rộng cùng chủ đề"}</p></li>)}</ul>
        {sample.framePhrases.length > 0 && <><h3 className="mb-2 mt-5 text-sm font-semibold">Câu nối có thể dùng lại từ bài này</h3><ul className="space-y-2 text-sm">{sample.framePhrases.map((p) => <li key={p.en}><span lang="en" className="font-medium">{p.en}…</span> <span className="text-muted">— {p.vi}</span></li>)}</ul></>}
        <p className="mt-5 text-sm text-muted">Thử nhắc lại mỗi đoạn bằng một câu. Sau đó dùng 3 cụm từ trên để viết hoặc nói về tình huống của bạn.</p>
        <Link className={cn(linkClass, "mt-4")} to={group.skill === "writing" ? "/writing-studio?mode=exam" : "/speaking-studio"}>{group.skill === "writing" ? "Tập gõ khung và viết áp dụng" : "Tập trả lời bằng giọng nói"}<ArrowRight size={15} /></Link>
      </section>}
      <div className="my-6 flex flex-wrap items-center gap-3"><Button variant={item?.read ? "outline" : "primary"} onClick={() => onToggle(summary.id, "read")}>{item?.read ? "Bỏ đánh dấu đã đọc" : "Tôi đã đọc xong bài này"}</Button><span className="text-sm text-muted">Lưu tiến độ để lần sau học tiếp.</span></div>
      {navigation}
    </>}
  </div>;
}

function Answer({ sample, notes }: { sample: Sample; notes: boolean }) {
  return <div className="space-y-7" data-testid="sample-answer-body">
    {sample.paragraphs.map((p, i) => <div key={p.label} className="reader-prose">
      <div className="mb-2 flex items-center justify-between gap-3">{notes ? <h3 className="text-sm font-semibold text-primary">{i + 1}. {p.label}</h3> : <span className="sr-only">Đoạn {i + 1}</span>}<SpeakButton text={p.text} label={`Nghe đoạn ${i + 1}`} /></div>
      <p lang="en" className="whitespace-pre-line text-lg leading-loose">{p.text}</p>{notes && <p className="mt-3 border-l-2 border-border pl-3 text-xs text-muted">{p.noteVi}</p>}
    </div>)}
    {sample.sections.map((section) => <section key={section.label} className="space-y-6"><h3 className="border-b border-border pb-3 font-semibold">{section.label}</h3>{section.questions.map((q, i) => <div key={q.question} className="reader-prose"><div className="mb-2 flex items-start justify-between gap-3"><h4 lang="en" className="font-semibold">{i + 1}. {q.question}</h4><SpeakButton text={q.answer} label={`Nghe trả lời: ${q.question}`} /></div><p lang="en" className="text-lg leading-loose">{q.answer}</p>{notes && <p className="mt-3 border-l-2 border-border pl-3 text-xs text-muted">{q.noteVi}</p>}</div>)}</section>)}
  </div>;
}
