import type { ReactNode } from "react";

export interface FramePart { text: string; kind: "frame" | "detail"; labelVi?: string }

/** Decoration does not change the plain English, clipboard text or speech input. */
export function FrameLiteral({ children, title }: { children: ReactNode; title?: string }) {
  return <span data-frame="fixed" className="underline decoration-primary/70 decoration-2 underline-offset-4" title={title ?? "Câu khung: học để dùng lại khi phù hợp yêu cầu đề"}>{children}</span>;
}
export function FrameText({ text, parts, enabled = true }: { text: string; parts?: FramePart[]; enabled?: boolean }) {
  if (!enabled || !parts?.length) return <>{text}</>;
  return <>{parts.map((part, i) => part.kind === "frame" && /[\p{L}\p{N}]/u.test(part.text)
    ? <FrameLiteral key={i} title={part.labelVi}>{part.text}</FrameLiteral>
    : <span key={i} data-frame="detail" title={part.labelVi ? `Thay theo đề: ${part.labelVi}` : undefined}>{part.text}</span>)}</>;
}
export function FrameSkeleton({ text }: { text: string }) {
  return <>{text.split(/(\[[^\]]+\])/g).map((part, i) => part.startsWith("[")
    ? <span key={i} data-frame-slot className="rounded bg-primary-soft px-1 text-primary">{part}</span>
    : <FrameLiteral key={i}>{part}</FrameLiteral>)}</>;
}
