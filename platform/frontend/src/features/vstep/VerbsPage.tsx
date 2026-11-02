import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, PageHeader } from "@/components/ui/misc";
import { SpeakButton } from "@/components/SpeakButton";
import { cn } from "@/lib/utils";
import { PATTERNS, VERBS, type VerbPattern } from "./verbs";
import { DECK_ITEMS, isMastered, loadRush, masteredCount, verbId } from "./store";

/** All irregular verbs: search, filter by pattern, listen, then drill the two groups. */
export default function VerbsPage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [pattern, setPattern] = useState<VerbPattern | "all" | "core">("all");
  const s = loadRush();
  const needle = q.trim().toLowerCase();
  const rows = VERBS.filter((v) => (pattern === "all" || (pattern === "core" ? v.core : v.pattern === pattern))
    && (!needle || [v.base, v.past, v.pp, v.vi].some((x) => x.toLowerCase().includes(needle))));
  return (
    <div>
      <PageHeader title="Động từ bất quy tắc" subtitle={`${VERBS.length} động từ hay dùng ở B2, chia theo cách biến đổi — học theo nhóm nhanh hơn học từng dòng. Thì hoàn thành và câu bị động đều cần dạng thứ 3 (V3).`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => nav("/rush/iv-1")}><Play size={16} />Luyện A–A–A, A–B–B · {masteredCount(s, DECK_ITEMS["iv-1"])}/{DECK_ITEMS["iv-1"].length}</Button>
            <Button onClick={() => nav("/rush/iv-2")}><Play size={16} />Luyện A–B–C, A–B–A · {masteredCount(s, DECK_ITEMS["iv-2"])}/{DECK_ITEMS["iv-2"].length}</Button>
          </div>
        } />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <Search size={16} className="absolute left-3 top-3.5 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm: went, viết, bought…" className="pl-9" aria-label="Tìm động từ" />
        </label>
        {(["all", "core", "AAA", "ABB", "ABC", "ABA"] as const).map((k) => (
          <Button key={k} size="sm" variant={pattern === k ? "primary" : "outline"} onClick={() => setPattern(k)}>
            {k === "all" ? "Tất cả" : k === "core" ? "Hay dùng nhất" : PATTERNS[k].title}
          </Button>
        ))}
      </div>
      {pattern in PATTERNS && <p className="mb-3 rounded-2xl bg-primary-soft/40 px-4 py-2 text-sm">{PATTERNS[pattern as VerbPattern].hint}</p>}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left text-[16px]">
            <thead className="bg-surface-2 text-sm text-muted">
              <tr><th className="px-4 py-2">Gốc (V1)</th><th className="px-4 py-2">Quá khứ (V2)</th><th className="px-4 py-2">Quá khứ phân từ (V3)</th><th className="px-4 py-2">Nghĩa</th><th className="px-4 py-2">Nhóm</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.base} className="border-t border-border">
                  <td className="px-4 py-2 font-semibold">
                    <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", isMastered(s, verbId(v)) ? "bg-success" : s.items[verbId(v)]?.seen ? "bg-warning" : "bg-border")}
                      title={isMastered(s, verbId(v)) ? "Đã thuộc" : s.items[verbId(v)]?.seen ? "Đang học" : "Chưa học"} />{v.base}
                  </td>
                  <td className="px-4 py-2">{v.past}</td>
                  <td className="px-4 py-2">{v.pp}</td>
                  <td className="px-4 py-2 text-muted">{v.vi}{v.note && <span className="block text-xs text-warning">{v.note}</span>}</td>
                  <td className="px-4 py-2 text-sm text-muted">{PATTERNS[v.pattern].title}</td>
                  <td className="px-2"><SpeakButton text={`${v.base}, ${v.past.replace("/", ", ")}, ${v.pp.replace("/", ", ")}`} label={`Nghe ${v.base}`} /></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Không có động từ khớp “{q}”.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
