import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Layers, Play, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorBox, Input, PageHeader, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { LEVEL_OPTIONS, vocab, type Collection, type EntryFilters } from "@/services/vocab";
import { WordRow } from "./components";
import { SubNav, useStart } from "./VocabHome";

type View = { kind: "saved" } | { kind: "difficult" } | { kind: "studied" } | { kind: "collection"; c: Collection };

export default function NotebookPage() {
  const qc = useQueryClient();
  const cols = useQuery({ queryKey: ["vocab-collections"], queryFn: vocab.collections });
  const [view, setView] = useState<View>({ kind: "saved" });
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const { start, busy } = useStart();
  const filters: EntryFilters = { q: q || undefined, level: level || undefined, page, size: 25,
    ...(view.kind === "saved" ? { saved: true } : view.kind === "difficult" ? { difficult: true } : view.kind === "studied" ? { mastery: "review" } : { collection: view.c.id }) };
  const list = useQuery({ queryKey: ["vocab-entries", "notebook", filters], queryFn: () => vocab.entries(filters), placeholderData: keepPreviousData });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["vocab-collections"] });
    qc.invalidateQueries({ queryKey: ["vocab-entries"] });
  };
  const create = async (template?: string) => {
    try {
      const c = await vocab.createCollection(template ? { template } : { name });
      setName("");
      refresh();
      setView({ kind: "collection", c });
      toast.success(`Đã tạo “${c.name}” (${c.count} từ)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tạo được bộ từ");
    }
  };
  const title = view.kind === "saved" ? "Từ đã lưu" : view.kind === "difficult" ? "Từ khó của tôi" : view.kind === "studied" ? "Đang ôn" : view.c.name;
  const practiceParams = view.kind === "collection" ? { collection: view.c.id } : { entry_ids: list.data?.items.map((x) => x.id).slice(0, 40) };
  const tab = (active: boolean) => `w-full rounded-xl px-3 py-2 text-left text-sm ${active ? "bg-primary-soft font-semibold text-primary" : "hover:bg-surface-2"}`;
  return (
    <div>
      <PageHeader title="Sổ từ của tôi" subtitle="Từ bạn lưu từ bài đọc, bài nghe, bài viết, luyện nói và bài học — tất cả dùng chung một lịch ôn." />
      <SubNav />
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <Card>
          <CardContent className="space-y-1 pt-4">
            <button className={tab(view.kind === "saved")} onClick={() => { setView({ kind: "saved" }); setPage(1); }}>Từ đã lưu</button>
            <button className={tab(view.kind === "difficult")} onClick={() => { setView({ kind: "difficult" }); setPage(1); }}>Từ khó</button>
            <button className={tab(view.kind === "studied")} onClick={() => { setView({ kind: "studied" }); setPage(1); }}>Đang ôn</button>
            <p className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Bộ từ</p>
            {cols.isLoading && <Skeleton className="h-24" />}
            {cols.data?.collections.map((c) => (
              <button key={c.id} className={tab(view.kind === "collection" && view.c.id === c.id)} onClick={() => { setView({ kind: "collection", c }); setPage(1); }}>
                {c.name} <span className="text-xs text-muted">({c.count})</span>
              </button>
            ))}
            <form className="flex gap-1 pt-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void create(); }}>
              <Input className="h-9 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên bộ từ mới" aria-label="Tên bộ từ mới" />
              <Button size="icon" type="submit" aria-label="Tạo bộ từ" disabled={!name.trim()}><FolderPlus size={16} /></Button>
            </form>
            <p className="px-1 pt-2 text-xs text-muted">Tạo nhanh:</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(cols.data?.templates ?? {}).map(([k, l]) => <Button key={k} size="sm" variant="ghost" onClick={() => create(k)}>{l}</Button>)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <div className="flex flex-wrap gap-2">
              {view.kind === "collection" && !view.c.system_key && (
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm(`Xóa bộ từ “${view.c.name}”? Tiến độ học của các từ vẫn được giữ.`)) return;
                  await vocab.deleteCollection(view.c.id);
                  setView({ kind: "saved" });
                  refresh();
                }}><Trash2 size={14} />Xóa bộ</Button>
              )}
              <Button size="sm" variant="outline" disabled={!!busy || !list.data?.total} onClick={() => start("flashcards", practiceParams)}><Layers size={14} />Flashcards</Button>
              <Button size="sm" disabled={!!busy || !list.data?.total} onClick={() => start("custom", practiceParams)}><Play size={14} />Luyện bộ này</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input className="h-9 max-w-xs" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Tìm trong sổ…" aria-label="Tìm trong sổ" />
              <select aria-label="Trình độ" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} className="h-9 rounded-xl border border-border bg-surface px-2 text-sm">
                <option value="">Mọi trình độ</option>{LEVEL_OPTIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            {list.isLoading ? <Skeleton className="h-64" /> : list.error || !list.data ? <ErrorBox error={list.error} /> : list.data.items.length ? (
              <>
                {list.data.items.map((w) => (
                  <WordRow key={w.id} w={w} right={view.kind === "collection" ? (
                    <Button size="sm" variant="ghost" aria-label={`Bỏ “${w.lemma}” khỏi bộ`} onClick={async () => { await vocab.removeFromCollection(view.c.id, w.id); refresh(); }}><X size={14} /></Button>
                  ) : undefined} />
                ))}
                {list.data.total > list.data.size && (
                  <div className="flex items-center justify-center gap-3 text-sm">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
                    <span>Trang {page}/{Math.ceil(list.data.total / list.data.size)}</span>
                    <Button size="sm" variant="outline" disabled={page * list.data.size >= list.data.total} onClick={() => setPage(page + 1)}>Sau</Button>
                  </div>
                )}
              </>
            ) : <EmptyState title="Chưa có từ nào ở đây">Lưu từ trong trang Khám phá, hoặc bấm vào từ khi đọc bài để thêm.</EmptyState>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
