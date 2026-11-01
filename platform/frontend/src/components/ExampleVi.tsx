/** Vietnamese under the English examples of a lesson (italic examples in the text, dialogue lines).
 *  The lesson provides its translations; exercises opt out so a translation never hints at an answer. */
import { createContext, useContext, type ReactNode } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exampleKey } from "@/lib/exampleKey";
import { useUI } from "@/stores/ui";
import type { ExampleVi } from "@/types/content";

export const ExampleViContext = createContext<ExampleVi | null>(null);

/** The lesson's translations, while the learner keeps them on. */
export function ExampleViProvider({ value, children }: { value?: ExampleVi | null; children: ReactNode }) {
  const show = useUI((s) => s.showVi);
  return <ExampleViContext.Provider value={show ? value ?? null : null}>{children}</ExampleViContext.Provider>;
}

/** No translations inside (exercises, worked examples that carry their own translation). */
export function NoExampleVi({ children }: { children: ReactNode }) {
  return <ExampleViContext.Provider value={null}>{children}</ExampleViContext.Provider>;
}

/** The translation of `text`, if it is one of the lesson's examples. */
export function ViText({ text, className }: { text: string; className?: string }) {
  const e = useContext(ExampleViContext)?.[exampleKey(text)];
  if (!e) return null;
  return (
    <span lang="vi" className={cn("vi-tr", e.wrong && "vi-wrong", className)}>
      {e.wrong ? <>✗ câu sai — ý định nói: {e.vi}</> : e.vi}
    </span>
  );
}

export function ViToggle({ className }: { className?: string }) {
  const { showVi, toggleVi } = useUI();
  return (
    <Button variant="ghost" size="sm" onClick={toggleVi} aria-pressed={showVi} className={className}
      title={showVi ? "Ẩn bản dịch dưới các câu ví dụ (tự dịch trong đầu)" : "Hiện bản dịch tiếng Việt dưới các câu ví dụ"}>
      <Languages size={16} /><span className="hidden md:inline">{showVi ? "Ẩn dịch" : "Dịch ví dụ"}</span>
    </Button>
  );
}
