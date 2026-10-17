import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Brain, Check, EyeOff, Flag, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorBox, Input, Skeleton, Textarea } from "@/components/ui/misc";
import { Markdown } from "@/components/Markdown";
import { toast } from "@/components/ui/toast";
import { AIErrorBox, AILoading } from "@/components/ai/AIStatus";
import { STATE_LABELS, VERDICT_LABELS, vocab, type Related, type WordDetail } from "@/services/vocab";
import { Ipa, SourceNote, StateBadge, WordAudio, relDue } from "./components";
import { SubNav, useStart } from "./VocabHome";

export default function WordPage() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["vocab-entry", id], queryFn: () => vocab.entry(id) });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  return <Word d={q.data} />;
}

function Word({ d }: { d: WordDetail }) {
  const qc = useQueryClient();
  const { start, busy } = useStart();
  const p = d.progress;
  const act = async (action: string, value?: string) => {
    try {
      await vocab.progress(d.id, action, value);
      qc.invalidateQueries({ queryKey: ["vocab-entry", d.id] });
      qc.invalidateQueries({ queryKey: ["vocab-overview"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được");
    }
  };
  return (
    <div>
      <SubNav />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold">{d.headword}</h1>
                <WordAudio entryId={d.id} text={d.lemma} />
                {d.ipa_us && d.ipa_us !== d.ipa_uk && <WordAudio entryId={d.id} text={d.lemma} accent="us" />}
                <Ipa uk={d.ipa_uk} us={d.ipa_us} status={d.ipa_status} />
                {d.cefr && <Badge tone="primary" title={d.cefr_source ?? ""}>{d.cefr} (ước lượng)</Badge>}
                <StateBadge state={p?.state} />
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                {d.pos_vi.length > 0 && <span>{d.pos_vi.join(", ")}</span>}
                {d.topic_names.map((t) => <Badge key={t}>{t}</Badge>)}
                {d.academic && <Badge tone="warning">Học thuật</Badge>}
                <SourceNote status={d.status} />
              </div>
              {d.review_flags.includes("ipa_curriculum_differs") && d.ipa_curriculum &&
                <p className="text-xs text-muted">Giáo trình ghi {d.ipa_curriculum}, khác từ điển — đang hiển thị phát âm từ điển, chờ rà soát.</p>}
              {d.ipa_status === "missing" && <p className="text-xs text-muted">Chưa có phát âm từ nguồn đáng tin cậy nên không hiển thị IPA.</p>}
              <ol className="space-y-2">
                {d.senses.map((s, i) => (
                  <li key={s.id} className="rounded-2xl bg-surface-2 px-4 py-3">
                    <p><span className="mr-2 text-muted">{i + 1}.</span>{s.pos_vi && <span className="mr-2 text-xs text-muted">{s.pos_vi}</span>}<b>{s.meaning_vi}</b></p>
                    {s.definition_en && <p className="text-sm text-muted">{s.definition_en}</p>}
                    {(s.usage.length > 0 || s.pattern) && <p className="text-xs text-muted">{[s.pattern, ...s.usage].filter(Boolean).join(" · ")}</p>}
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button disabled={!!busy} onClick={() => { void act("learn"); void start("learn", { entry_ids: [d.id], size: 3 }); }}><Play size={16} />Học ngay</Button>
                <Button variant="outline" onClick={() => act(p?.saved ? "unsave" : "save")} aria-pressed={!!p?.saved}>{p?.saved ? <><Check size={16} />Đã lưu</> : <><BookmarkPlus size={16} />Lưu vào sổ</>}</Button>
                <Button variant="outline" onClick={() => act(p?.difficult ? "not_difficult" : "difficult")} aria-pressed={!!p?.difficult}><Flag size={16} />{p?.difficult ? "Bỏ đánh dấu khó" : "Đánh dấu khó"}</Button>
                <Button variant="ghost" onClick={() => act(p?.known ? "unknown" : "known")} aria-pressed={!!p?.known}><EyeOff size={16} />{p?.known ? "Học lại từ này" : "Tôi đã biết từ này"}</Button>
              </div>
            </CardContent>
          </Card>
          {d.examples.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Ví dụ</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {d.examples.map((x) => (
                  <div key={x.id} className="flex gap-2">
                    <div className="flex-1"><p><i>{x.en}</i></p>{x.vi && <p className="text-sm text-muted">{x.vi}</p>}</div>
                    <span className="shrink-0 text-[11px] text-muted" title={x.ref ?? ""}>{x.source.startsWith("curriculum") ? "giáo trình" : x.source}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {(d.collocations.length > 0 || d.family.length > 0 || d.synonyms.length > 0 || d.antonyms.length > 0 || d.confused_with.length > 0 || d.common_mistakes.length > 0) && (
            <Card>
              <CardHeader><CardTitle>Cách dùng & quan hệ từ</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {d.collocations.length > 0 && <div><p className="font-medium">Collocations</p><p>{d.collocations.map((c) => c.phrase).join(" · ")}</p></div>}
                {d.family.length > 0 && <Rel title="Họ từ" xs={d.family} />}
                {d.synonyms.length > 0 && <Rel title="Gần nghĩa (theo nghĩa phổ biến nhất; không phải lúc nào cũng thay thế được)" xs={d.synonyms} />}
                {d.antonyms.length > 0 && <Rel title="Trái nghĩa" xs={d.antonyms} />}
                {d.confused_with.map((c, i) => (
                  <div key={i} className="rounded-xl bg-warning-soft px-3 py-2"><p><b>Dễ nhầm với:</b> {c.entries.map((e) => <RelLink key={e.word} r={e} />)}</p><p>{c.note_vi}</p>{c.example && <p className="text-muted"><i>{c.example}</i></p>}</div>
                ))}
                {d.common_mistakes.map((m, i) => <p key={i} className="rounded-xl bg-surface-2 px-3 py-2">Lỗi hay gặp: {m.vi && <>“{m.vi}” </>}{m.wrong && <>❌ {m.wrong} → ✅ {m.right}</>}</p>)}
              </CardContent>
            </Card>
          )}
          <Tutor d={d} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Tiến độ của bạn</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {p ? <>
                <Row k="Trạng thái" v={STATE_LABELS[p.state]} />
                <Row k="Lần ôn tới" v={p.state === "new" ? "—" : relDue(p.due)} />
                <Row k="Đúng / sai" v={`${p.correct_count} / ${p.incorrect_count}`} />
                <Row k="Quên (lapses)" v={String(p.lapses)} />
                <Row k="Đã nhớ lại sau ≥ 1 ngày" v={p.recalled_after_delay ? "Có" : "Chưa"} />
                <Row k="Đã dùng đúng trong câu" v={p.used_correctly ? `Có (${p.used_count} lần dùng)` : "Chưa"} />
              </> : <p className="text-muted">Chưa học từ này.</p>}
            </CardContent>
          </Card>
          <Notes d={d} onSave={act} />
          <Collections d={d} />
          {d.history.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Lịch sử ôn</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-xs">
                {d.history.map((h, i) => <p key={i}><span className="text-muted">{new Date(h.at + "Z").toLocaleString("vi-VN")}</span> · {h.mode} · {VERDICT_LABELS[h.verdict ?? ""] ?? h.verdict}{h.rating ? ` · FSRS ${h.rating}` : ""}</p>)}
              </CardContent>
            </Card>
          )}
          <Card><CardContent className="space-y-1 pt-5 text-xs text-muted">
            <p>Nguồn: {d.sources.join(", ")}</p>
            {d.ipa_source && <p>Phát âm: {d.ipa_source}</p>}
            {d.units.length > 0 && <p>Có trong bài: {d.units.map((u) => <Link key={u} to={`/learn/${u}`} className="mr-1 text-primary">{u}</Link>)}</p>}
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-2"><span className="text-muted">{k}</span><b className="text-right">{v}</b></div>;
const RelLink = ({ r }: { r: Related }) => r.entry_id ? <Link to={`/vocabulary/word/${encodeURIComponent(r.entry_id)}`} className="mr-2 text-primary">{r.word}</Link> : <span className="mr-2">{r.word}</span>;
const Rel = ({ title, xs }: { title: string; xs: Related[] }) => <div><p className="font-medium">{title}</p><p>{xs.map((r) => <RelLink key={r.word} r={r} />)}</p></div>;

function Notes({ d, onSave }: { d: WordDetail; onSave: (a: string, v?: string) => Promise<void> }) {
  const [note, setNote] = useState(d.progress?.note ?? "");
  const [ex, setEx] = useState(d.progress?.own_example ?? "");
  return (
    <Card>
      <CardHeader><CardTitle>Ghi chú của tôi</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mẹo nhớ, ghi chú…" aria-label="Ghi chú" onBlur={() => note !== (d.progress?.note ?? "") && onSave("note", note)} />
        <Input value={ex} onChange={(e) => setEx(e.target.value)} placeholder="Câu ví dụ của bạn" aria-label="Câu ví dụ của bạn" onBlur={() => ex !== (d.progress?.own_example ?? "") && onSave("own_example", ex)} />
        <p className="text-xs text-muted">Tự động lưu khi rời ô.</p>
      </CardContent>
    </Card>
  );
}

function Collections({ d }: { d: WordDetail }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["vocab-collections"], queryFn: vocab.collections });
  const custom = q.data?.collections.filter((c) => !c.system_key) ?? [];
  const inIds = new Set(d.collections.map((c) => c.id));
  return (
    <Card>
      <CardHeader><CardTitle>Bộ từ</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-1.5">{d.collections.map((c) => <Badge key={c.id} tone="primary">{c.name}</Badge>)}{!d.collections.length && <span className="text-muted">Chưa có trong bộ nào.</span>}</div>
        {custom.filter((c) => !inIds.has(c.id)).map((c) => (
          <button key={c.id} className="block text-primary" onClick={async () => {
            await vocab.addToCollection(c.id, d.id);
            qc.invalidateQueries({ queryKey: ["vocab-entry", d.id] });
            qc.invalidateQueries({ queryKey: ["vocab-collections"] });
          }}>+ Thêm vào “{c.name}”</button>
        ))}
        <Link to="/vocabulary/notebook" className="text-xs text-muted">Quản lý bộ từ →</Link>
      </CardContent>
    </Card>
  );
}

const ACTIONS: [string, string][] = [["explain", "Giải thích từ này"], ["examples", "Thêm ví dụ"], ["collocations", "Collocation thông dụng"], ["pronounce", "Cách phát âm"],
  ["formality", "Trang trọng hay thân mật?"], ["writing", "Dùng trong bài viết được không?"], ["quiz", "Đố tôi"], ["remember", "Giúp tôi nhớ"]];

function Tutor({ d }: { d: WordDetail }) {
  const [ans, setAns] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [cmp, setCmp] = useState(d.confused_with[0]?.words[0] ?? d.synonyms[0]?.word ?? "");
  const [question, setQuestion] = useState("");
  const ask = async (action: string, extra: { compare_with?: string; question?: string } = {}) => {
    setBusy(true);
    setErr(null);
    try {
      setAns((await vocab.tutor({ entry_id: d.id, action, ...extra })).answer);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader><CardTitle><Sparkles size={16} className="mr-1 inline text-primary" />Gia sư từ vựng AI</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">{ACTIONS.map(([a, l]) => <Button key={a} size="sm" variant="outline" disabled={busy} onClick={() => ask(a)}>{l}</Button>)}</div>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (cmp.trim()) void ask("difference", { compare_with: cmp.trim() }); }}>
          <span className="self-center text-sm">Phân biệt “{d.lemma}” với</span>
          <Input className="h-9 w-40" value={cmp} onChange={(e) => setCmp(e.target.value)} aria-label="Từ cần so sánh" />
          <Button size="sm" type="submit" disabled={busy || !cmp.trim()}><Brain size={14} />So sánh</Button>
        </form>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (question.trim()) void ask("chat", { question }); }}>
          <Input className="h-9" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Hỏi thêm về từ này…" aria-label="Câu hỏi cho gia sư" />
          <Button size="sm" type="submit" disabled={busy || !question.trim()}>Hỏi</Button>
        </form>
        {busy && <AILoading />}
        {err != null && <AIErrorBox error={err} />}
        {ans && <div className="rounded-2xl bg-surface-2 p-4"><Markdown className="text-sm">{ans}</Markdown></div>}
        <p className="text-xs text-muted">AI chỉ nhận dữ liệu của từ này và bài học liên quan, không gửi toàn bộ kho từ.</p>
      </CardContent>
    </Card>
  );
}
