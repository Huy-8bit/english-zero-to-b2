import { Link } from "react-router-dom";
import { BUDGET_DECKS, fixedWordCount } from "./budgetWritingFrames";
import { FrameTemplate } from "./FrameApplications";

export function BudgetFrameGuide({ frameId }: { frameId: string }) {
  const deck = BUDGET_DECKS.find((d) => d.id === frameId);
  if (!deck) return null;
  const count = fixedWordCount(deck);
  return <details className="my-6 rounded-2xl border border-primary/30 bg-primary-soft/20 p-5" data-testid="budget-frame-guide">
    <summary className="cursor-pointer text-lg font-semibold">Khung học thuộc · {count} từ có sẵn · Task {deck.task}</summary>
    <p className="mt-3 text-sm font-medium">{deck.title}</p>
    <p className="mt-2 text-sm leading-relaxed">{count} từ tiếng Anh cố định, không tính nội dung trong [ngoặc] hoặc dấu câu đứng riêng. Phần gạch chân là chữ để học thuộc; điền ý vào phần tô nền. {`Còn ít nhất ${(deck.task === 1 ? 120 : 250) - count} từ nội dung riêng để đạt mốc ${deck.task === 1 ? 120 : 250} từ của bài hoàn chỉnh.`}</p>
    <p className="mt-2 text-sm text-muted">{deck.note} Bài mẫu có thể diễn đạt khác; dùng khung này để tự viết, không coi mọi câu là bắt buộc.</p>
    <div className="mt-5 space-y-5">{deck.lines.map((line) => <div key={line.id}><h3 className="text-sm font-semibold">{line.part}</h3><p className="mt-1 text-xs text-muted">{line.vi}</p><p lang="en" className="mt-2 whitespace-pre-line text-lg leading-loose"><FrameTemplate text={line.en} /></p></div>)}</div>
    <Link className="mt-5 inline-flex rounded-xl border border-primary px-4 py-3 text-sm font-semibold text-primary" to={`/writing-studio?mode=exam&memoryFrame=${encodeURIComponent(deck.id)}`}>Gõ thuộc đúng khung này →</Link>
  </details>;
}
