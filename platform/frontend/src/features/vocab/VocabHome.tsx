import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, BookMarked, Brain, CalendarCheck, ChevronRight, Compass, GraduationCap, MessagesSquare, Play, Sparkles, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, PageHeader, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { LEVEL_OPTIONS, MODE_INFO, vocab, type Overview, type SessionKind, type SessionParams, type Topic } from "@/services/vocab";
import { WordRow } from "./components";

export function useStart() {
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const start = async (kind: SessionKind, params: SessionParams = {}) => {
    setBusy(kind);
    try {
      const s = await vocab.start(kind, params);
      nav(`/vocabulary/session/${s.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tạo được phiên học");
    } finally {
      setBusy(null);
    }
  };
  return { start, busy };
}

export const SubNav = () => (
  <nav aria-label="Từ vựng" className="mb-5 flex flex-wrap gap-2 text-sm">
    {[["/vocabulary", "Tổng quan"], ["/vocabulary/today", "Hôm nay"], ["/vocabulary/explore", "Khám phá từ"], ["/vocabulary/notebook", "Sổ từ của tôi"],
      ["/vocabulary/stats", "Thống kê"], ["/vocabulary/dialogue", "Tình huống thật"], ["/vocabulary/units", "Theo bài giáo trình"]].map(([to, l]) => (
      <Link key={to} to={to} className="rounded-full border border-border px-3 py-1 hover:bg-surface-2">{l}</Link>
    ))}
  </nav>
);

export default function VocabHome() {
  const q = useQuery({ queryKey: ["vocab-overview"], queryFn: vocab.overview });
  const topics = useQuery({ queryKey: ["vocab-topics"], queryFn: vocab.topics });
  const { start, busy } = useStart();
  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-60" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const o = q.data;
  const c = o.stats.counts;
  return (
    <div>
      <PageHeader title="Từ vựng" subtitle={<>{o.stats.total_available.toLocaleString("vi-VN")} từ & cụm từ A1–B2 · lịch ôn {o.stats.algorithm}</>} />
      <SubNav />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-primary/40 lg:col-span-2">
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Hôm nay</p>
                <p className="text-xl font-semibold">{o.plan.due_today ? `${o.plan.due_today} từ đến hạn ôn` : "Không có từ đến hạn"} · {o.plan.new_left} từ mới</p>
                {o.plan.minutes > 0 && <p className="text-sm text-muted">Khoảng {o.plan.minutes} phút</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="lg" onClick={() => start("review")} disabled={!!busy || !o.plan.due_today}><Brain size={18} />Ôn từ hôm nay{o.plan.due_today ? ` (${o.plan.due_today})` : ""}</Button>
                <Button size="lg" variant="outline" onClick={() => start("daily")} disabled={!!busy || !o.plan.tasks.length}><Play size={18} />Học theo kế hoạch</Button>
              </div>
            </div>
            {o.continue && (
              <Link to={`/vocabulary/session/${o.continue.id}`} className="flex items-center justify-between rounded-xl bg-primary-soft px-4 py-2 text-sm text-primary">
                <span>Tiếp tục: {o.continue.title_vi} ({o.continue.answered}/{o.continue.total})</span><ChevronRight size={16} />
              </Link>
            )}
            <ul className="grid gap-2 sm:grid-cols-2">
              {o.plan.tasks.map((t) => <li key={t.key} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm"><CalendarCheck size={16} className="text-primary" />{t.label_vi}</li>)}
              {!o.plan.tasks.length && <li className="text-sm text-muted">Bạn đã hoàn thành kế hoạch hôm nay. Có thể luyện thêm bằng các chế độ bên dưới.</li>}
            </ul>
            {(o.plan.adjustments_vi.length > 0 || o.plan.profile.samples >= 15) && (
              <p className="text-xs text-muted">{[o.plan.profile.reason_vi, ...o.plan.adjustments_vi].join(" ")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tiến độ thật</CardTitle><Link to="/vocabulary/stats" className="text-sm text-primary">Chi tiết</Link></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {([["encountered", "Đã gặp"], ["learned", "Đã học (nhớ lại được)"], ["answered_correctly", "Đã trả lời đúng"],
              ["recalled_after_delay", "Nhớ lại sau ≥ 1 ngày"], ["used_correctly", "Dùng đúng trong câu"], ["mastered", "Đã vững (ước lượng)"]] as const).map(([k, l]) => (
              <div key={k} className="flex justify-between"><span className="text-muted">{l}</span><b className="tabular-nums">{c[k] ?? 0}</b></div>
            ))}
            <div className="flex justify-between border-t border-border pt-1.5"><span className="text-muted">Quên gần đây</span><b className="tabular-nums">{c.forgotten ?? 0}</b></div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Chế độ luyện</CardTitle></CardHeader>
          <CardContent><ModeGrid busy={busy} start={start} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Theo trình độ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {LEVEL_OPTIONS.map((lv) => {
              const s = o.stats.by_level[lv];
              if (!s) return null;
              return (
                <div key={lv}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{lv}</span><span className="text-muted">{s.learned}/{s.total} đã học</span></div>
                  <Progress value={s.total ? (s.learned / s.total) * 100 : 0} label={`${lv}: ${s.learned} trên ${s.total}`} />
                  <div className="mt-1 flex gap-2">
                    <button className="text-xs text-primary" onClick={() => start("learn", { level: lv })}>Học từ mới {lv}</button>
                    <Link className="text-xs text-muted" to={`/vocabulary/explore?level=${lv}`}>Xem từ</Link>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Chủ đề</CardTitle><span className="text-xs text-muted">Chủ đề cơ bản trước, nâng cao sau</span></CardHeader>
          <CardContent>{topics.data ? <TopicGrid topics={topics.data} start={start} /> : <Skeleton className="h-40" />}</CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Từ hay quên</CardTitle>{o.weak.length > 0 && <Button size="sm" variant="ghost" onClick={() => start("weak")}><Target size={14} />Luyện</Button>}</CardHeader>
            <CardContent className="space-y-2">
              {o.weak.length ? o.weak.map((w) => <WordRow key={w.id} w={w} />) : <p className="text-sm text-muted">Chưa có từ yếu — hệ thống sẽ ghi nhận từ bạn hay quên hoặc dùng sai.</p>}
              {o.weak.length > 0 && <AIPractice />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Gần đây</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted">Mới học</p>
              <div className="flex flex-wrap gap-1.5">{o.recent.learned.map((x) => <Link key={x.entry_id} to={`/vocabulary/word/${encodeURIComponent(x.entry_id)}`}><Badge tone="success">{x.lemma}</Badge></Link>)}{!o.recent.learned.length && <span className="text-muted">—</span>}</div>
              <p className="text-muted">Vừa quên</p>
              <div className="flex flex-wrap gap-1.5">{o.recent.forgotten.map((x) => <Link key={x.entry_id} to={`/vocabulary/word/${encodeURIComponent(x.entry_id)}`}><Badge tone="warning">{x.lemma}</Badge></Link>)}{!o.recent.forgotten.length && <span className="text-muted">—</span>}</div>
            </CardContent>
          </Card>
          <QuickLinks />
        </div>
      </div>
    </div>
  );
}

export function ModeGrid({ busy, start, params = {} }: { busy: string | null; start: (k: SessionKind, p?: SessionParams) => void; params?: SessionParams }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {MODE_INFO.map((m) => (
        <button key={m.kind} disabled={!!busy} onClick={() => start(m.kind, params)}
          className="flex items-start gap-3 rounded-2xl border border-border p-3 text-left transition hover:border-primary/50 hover:bg-surface-2 disabled:opacity-60">
          <span className="mt-0.5 rounded-xl bg-primary-soft p-2 text-primary">{m.ai ? <Sparkles size={16} /> : <GraduationCap size={16} />}</span>
          <span><span className="font-medium">{m.title}</span>{m.ai && <Badge tone="primary" className="ml-2">AI</Badge>}<span className="block text-xs text-muted">{m.desc}</span></span>
        </button>
      ))}
      <Link to="/vocabulary/dialogue" className="flex items-start gap-3 rounded-2xl border border-border p-3 hover:border-primary/50 hover:bg-surface-2">
        <span className="mt-0.5 rounded-xl bg-primary-soft p-2 text-primary"><MessagesSquare size={16} /></span>
        <span><span className="font-medium">Dùng từ trong tình huống thật</span><Badge tone="primary" className="ml-2">AI</Badge><span className="block text-xs text-muted">Phỏng vấn, du lịch, công việc… AI đóng vai người đối thoại</span></span>
      </Link>
    </div>
  );
}

function TopicGrid({ topics, start }: { topics: Topic[]; start: (k: SessionKind, p?: SessionParams) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {topics.filter((t) => t.total > 0).map((t) => (
        <div key={t.id} className="rounded-2xl border border-border p-3">
          <div className="flex items-center justify-between gap-2"><p className="font-medium">{t.name_vi}</p><Badge>{t.band}</Badge></div>
          <p className="text-xs text-muted">{t.name} · {t.learned}/{t.total} đã học</p>
          <Progress className="mt-2" value={t.total ? (t.learned / t.total) * 100 : 0} label={`${t.name_vi}: ${t.learned} trên ${t.total}`} />
          <div className="mt-2 flex gap-3 text-xs">
            <button className="text-primary" onClick={() => start("learn", { topic: t.id })}>Học</button>
            <Link className="text-muted" to={`/vocabulary/explore?topic=${t.id}`}>Danh sách</Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function AIPractice() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="outline" size="sm" className="w-full" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const s = await vocab.startAI();
        nav(`/vocabulary/session/${s.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? `${e.message} Hãy dùng chế độ “Từ hay quên” (không cần AI).` : "Không tạo được bài tập AI");
      } finally {
        setBusy(false);
      }
    }}><Sparkles size={14} />{busy ? "AI đang tạo bài…" : "Bài tập AI cho từ hay quên"}</Button>
  );
}

function QuickLinks() {
  return (
    <Card>
      <CardContent className="grid gap-1 pt-5 text-sm">
        {[["/vocabulary/explore", "Khám phá & tra từ", Compass], ["/vocabulary/notebook", "Sổ từ của tôi", BookMarked], ["/vocabulary/stats", "Thống kê chi tiết", BarChart3]].map(([to, l, Icon]) => {
          const I = Icon as typeof Compass;
          return <Link key={to as string} to={to as string} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-2"><I size={16} className="text-primary" />{l as string}</Link>;
        })}
      </CardContent>
    </Card>
  );
}

export type { Overview };
