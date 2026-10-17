import { useEffect, useRef, useState } from "react";
import { Highlighter, Timer, Trash2 } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";

/** Reading passage with a timer and text highlighting (highlights are saved with the lesson). */
export function ReadingPassage({ md, docPath, highlights, onHighlights }: { md: string; docPath: string; highlights: string[]; onHighlights: (h: string[]) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState("");
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  // Re-apply saved highlights by wrapping the first occurrence of each snippet in <mark>.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const snippet of highlights) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const idx = node.textContent?.indexOf(snippet) ?? -1;
        if (idx >= 0) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + snippet.length);
          const mark = document.createElement("mark");
          mark.className = "em-hl";
          try {
            range.surroundContents(mark);
          } catch {
            /* snippet spans elements: skip */
          }
          break;
        }
      }
    }
  }, [highlights, md]);
  const onMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    setSelection(text && ref.current?.contains(sel!.anchorNode) && text.length <= 300 ? text : "");
  };
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1 tabular-nums"><Timer size={13} />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
        <span>Bôi đen một đoạn rồi bấm “Tô sáng” để đánh dấu từ khóa.</span>
        {selection && <Button size="sm" variant="secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => { onHighlights([...highlights, selection]); setSelection(""); window.getSelection()?.removeAllRanges(); }}><Highlighter size={14} />Tô sáng</Button>}
        {highlights.length > 0 && <Button size="sm" variant="ghost" onClick={() => onHighlights([])}><Trash2 size={14} />Xóa tô sáng</Button>}
      </div>
      <div ref={ref} key={highlights.join("\u0001")} onMouseUp={onMouseUp} onTouchEnd={onMouseUp}>
        <Markdown docPath={docPath}>{md}</Markdown>
      </div>
    </div>
  );
}
