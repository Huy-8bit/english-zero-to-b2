import { safeStorage } from "@/lib/utils";

export type Skill = "writing" | "speaking";
export interface Group { id: string; skill: Skill; label: string; description: string; minimum?: number; count: number }
export interface SampleSummary {
  id: string; group: string; type: string; topic: string; number: number;
  title: string; focus: string; wordCount: number; bucket: string;
}
export interface LibraryIndex {
  version: string; total: number; groups: Group[]; topics: { id: string; label: string }[];
  types: { id: string; label: string; group: string }[]; samples: SampleSummary[]; sourceUrl: string;
}
export interface Sample extends Omit<SampleSummary, "bucket"> {
  prompt: string; requirementsVi: string[]; summaryVi: string; mainWordCount: number;
  paragraphs: { label: string; text: string; noteVi: string }[];
  sections: { label: string; questions: { question: string; answer: string; noteVi: string }[] }[];
  options: string[]; selectedOption: number | null;
  phrases: { en: string; vi: string; inAnswer: boolean }[];
  framePhrases: { en: string; vi: string }[];
}
export interface LibraryProgress { items: Record<string, { read: boolean; saved: boolean; at: number }> }
export const PROGRESS_KEY = "em-model-library";
export const emptyProgress = (): LibraryProgress => ({ items: {} });
export function loadProgress(): LibraryProgress {
  const raw = safeStorage().get<unknown>(PROGRESS_KEY, null);
  if (!raw || typeof raw !== "object" || !("items" in raw) || !raw.items || typeof raw.items !== "object") return emptyProgress();
  return { items: Object.fromEntries(Object.entries(raw.items).filter(([, value]) => value && typeof value.read === "boolean" && typeof value.saved === "boolean" && Number.isFinite(value.at))) };
}
export function updateProgress(progress: LibraryProgress, id: string, field: "read" | "saved", at = Date.now()): LibraryProgress {
  const old = progress.items[id] ?? { read: false, saved: false, at: 0 };
  return { items: { ...progress.items, [id]: { ...old, [field]: !old[field], at } } };
}
export const normalise = (text: string) => text.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
export function matchesSearch(sample: SampleSummary, query: string): boolean {
  const text = normalise(`${sample.title} ${sample.focus} ${sample.number}`);
  return normalise(query).trim().split(/\s+/).every((word) => text.includes(word));
}
export function selection(index: LibraryIndex, params: URLSearchParams) {
  const sample = index.samples.find((s) => s.id === params.get("sample"));
  const skill: Skill = sample ? index.groups.find((g) => g.id === sample.group)!.skill : params.get("skill") === "speaking" ? "speaking" : "writing";
  const groups = index.groups.filter((g) => g.skill === skill);
  const group = groups.find((g) => g.id === (sample?.group ?? params.get("group"))) ?? groups[0];
  const types = index.types.filter((t) => t.group === group.id);
  const type = types.find((t) => t.id === (sample?.type ?? params.get("type"))) ?? types[0];
  const topic = index.topics.find((t) => t.id === (sample?.topic ?? params.get("topic"))) ?? index.topics[0];
  return { skill, groups, group, types, type, topic, sample };
}
async function json<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error("Chưa tải được bài mẫu. Hãy kiểm tra kết nối và thử lại.");
  try { return await response.json() as T; }
  catch { throw new Error("Dữ liệu bài mẫu chưa sẵn sàng. Hãy tải lại trang."); }
}
export async function fetchIndex(signal?: AbortSignal): Promise<LibraryIndex> {
  const data = await json<LibraryIndex>("/model-library-data/index.json", signal);
  if (!Array.isArray(data.samples) || !data.groups?.length || !data.types?.length || !data.topics?.length || data.samples.length !== data.total) throw new Error("Danh mục bài mẫu chưa đầy đủ. Hãy tải lại trang.");
  return data;
}
export async function fetchBucket(bucket: string, version: string, signal?: AbortSignal): Promise<Sample[]> {
  const data = await json<{ version: string; samples: Sample[] }>(`/model-library-data/${bucket}?v=${encodeURIComponent(version)}`, signal);
  if (data.version !== version || !Array.isArray(data.samples) || data.samples.length !== 10) throw new Error("Bộ bài vừa được cập nhật. Hãy tải lại trang để đọc phiên bản mới.");
  return data.samples;
}
