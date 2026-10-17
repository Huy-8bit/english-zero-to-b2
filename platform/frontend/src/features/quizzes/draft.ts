import type { QuizItem } from "@/types/content";

export type SpeakingDraft = { notes: string; checklist: Record<string, boolean> };
export type Draft = string | number[] | SpeakingDraft | undefined;

export function isAnswered(item: QuizItem, d: Draft): boolean {
  if (item.kind === "speaking") {
    const s = d as SpeakingDraft | undefined;
    return !!s && (!!s.notes?.trim() || Object.values(s.checklist ?? {}).some(Boolean));
  }
  if (item.kind === "order") return Array.isArray(d) && d.length === (item.tokens?.length ?? 0) && d.length > 0;
  return typeof d === "string" && d.trim().length > 0;
}

/** Value sent to the server for grading. */
export function toResponse(item: QuizItem, d: Draft): string {
  if (item.kind === "order") return (d as number[]).map((i) => item.tokens![i]).join(" ");
  if (item.kind === "speaking") {
    const s = (d as SpeakingDraft) ?? { notes: "", checklist: {} };
    const done = Object.entries(s.checklist ?? {}).filter(([, v]) => v).map(([k]) => k);
    return [s.notes?.trim() || "[đã luyện nói]", done.length ? `Tự đánh giá: ${done.join("; ")}` : ""].filter(Boolean).join("\n");
  }
  return String(d ?? "");
}
