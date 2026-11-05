import { FrameLiteral } from "@/components/FrameText";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/misc";
import { wordCount } from "@/lib/utils";
import { fillFrame, fixedFrameText, frameSlots, type ExtendedDeck } from "./extendedWritingFrames";

const SLOT_LABELS: Record<string, string> = {
  "affected group": "Nhóm bị tác động — danh từ chỉ người", "group situation": "Hoàn cảnh của nhóm — phần nối sau who", "long-term effect": "Tác dụng lâu dài — động từ nguyên mẫu",
  name: "Tên người nhận", "your name": "Tên của bạn", "title and surname": "Danh xưng và họ người nhận", "full name": "Họ tên của bạn",
  topic: "Chủ đề / danh từ hoặc cụm V-ing", "point one": "Ý thứ nhất — viết một mệnh đề", "second point": "Điều tiếp theo được hỏi",
  suggestion: "Gợi ý — danh từ hoặc V-ing", reason: "Lý do — chủ ngữ + động từ", "final detail": "Chi tiết cuối — chủ ngữ + động từ",
  "first action": "Hành động đầu — V-ing", benefit: "Lợi ích — chủ ngữ + động từ", "second action": "Hành động khác — động từ nguyên mẫu", offer: "Việc bạn giúp — động từ nguyên mẫu",
  event: "Sự kiện", day: "Ngày", place: "Địa điểm", time: "Giờ", activity: "Hoạt động — động từ nguyên mẫu", preparation: "Việc chuẩn bị — động từ nguyên mẫu",
  "travel plan": "Cách đi lại — động từ nguyên mẫu", "another day": "Ngày hẹn khác", "alternative activity": "Hoạt động thay thế — động từ nguyên mẫu",
  help: "Việc được giúp — V-ing", "specific action": "Việc cụ thể — V-ing", result: "Kết quả — động từ nguyên mẫu", "return favour": "Cách cảm ơn — động từ nguyên mẫu",
  mistake: "Việc cần xin lỗi — V-ing", effect: "Ảnh hưởng — phần nối với câu trong khung", solution: "Cách khắc phục — động từ nguyên mẫu", prevention: "Cách tránh lặp lại — động từ nguyên mẫu",
  service: "Dịch vụ / khóa học", need: "Nhu cầu — chủ ngữ + động từ", "question one": "Câu hỏi gián tiếp 1 — wh/whether + chủ ngữ + động từ", "question two": "Câu hỏi gián tiếp 2 — wh/whether + chủ ngữ + động từ", "next step": "Bước tiếp — động từ nguyên mẫu",
  "problem one": "Vấn đề thứ nhất — chủ ngữ + động từ", "problem two": "Vấn đề thứ hai — chủ ngữ + động từ", promise: "Điều đã được hứa — chủ ngữ + động từ",
  position: "Lập trường / vị trí ứng tuyển (xem câu gốc)", motivation: "Lý do quan tâm — chủ ngữ + động từ", experience: "Kinh nghiệm — V-ing", skill: "Kỹ năng — động từ nguyên mẫu", availability: "Thời gian có thể phỏng vấn",
  view: "Quan điểm trong đề — chủ ngữ + động từ", "reason one": "Lý do 1 — chủ ngữ + động từ", "reason two": "Lý do 2 — chủ ngữ + động từ", "explanation one": "Giải thích 1 — chủ ngữ + động từ", "explanation two": "Giải thích 2 — chủ ngữ + động từ",
  "example one": "Ví dụ thứ nhất — một câu / tình huống", "example two": "Ví dụ thứ hai — xem cách nối trong khung", "result one": "Kết quả ví dụ 1 — chủ ngữ + động từ", "result two": "Kết quả ví dụ 2 — chủ ngữ + động từ",
  "summary one": "Tóm tắt ý 1 — cụm danh từ", "summary two": "Tóm tắt ý 2 — cụm danh từ", limit: "Giới hạn / việc cần giữ — động từ nguyên mẫu", condition: "Điều kiện — xem cách nối trong khung", "limit example": "Ví dụ cho giới hạn — chủ ngữ + động từ",
  "view one": "Quan điểm thứ nhất — chủ ngữ + động từ", "view two": "Quan điểm thứ hai — chủ ngữ + động từ", "priority one": "Điều phía một coi trọng — danh từ", "priority two": "Điều phía hai coi trọng — danh từ", "final reason": "Lý do chọn — chủ ngữ + động từ",
  "useful action": "Việc có ích — động từ nguyên mẫu", situation: "Hoàn cảnh — chủ ngữ + động từ", drawback: "Bất lợi — chủ ngữ + động từ", people: "Nhóm người liên quan", difficulty: "Khó khăn — chủ ngữ + động từ", "stronger reason": "Lý do bên này quan trọng hơn", comparison: "So sánh tác động — chủ ngữ + động từ",
  cause: "Nguyên nhân — chủ ngữ + động từ", behaviour: "Hành vi — động từ nguyên mẫu", actor: "Ai thực hiện — người / tổ chức", action: "Hành động — động từ nguyên mẫu", mechanism: "Cách tạo tác dụng — V-ing", "practical example": "Ví dụ thực hiện — chủ ngữ + động từ",
  problem: "Tác hại — chủ ngữ + động từ", "summary cause": "Tóm tắt nguyên nhân — chủ ngữ + động từ", "summary action": "Tóm tắt hành động — V-ing", "summary result": "Tác dụng — động từ nguyên mẫu", "effect example": "Ví dụ tác hại — chủ ngữ + động từ",
  trend: "Xu hướng — chủ ngữ + động từ", "positive or negative": "Chọn positive (tích cực) hoặc negative (tiêu cực)", "evaluation reason": "Lý do đánh giá — chủ ngữ + động từ", explanation: "Giải thích — chủ ngữ + động từ", purpose: "Mục đích — chủ ngữ + động từ", "summary reason": "Tóm tắt nguyên nhân — danh từ", "summary evaluation": "Tóm tắt đánh giá — chủ ngữ + động từ",
};

/** A consistent boundary between reusable English and topic-specific content. */
export function FrameTemplate({ text, values }: { text: string; values?: Record<string, string> }) {
  return <>{text.split(/(\[[^\]]+\])/g).map((part, i) => part.startsWith("[")
    ? <span key={i} className="rounded bg-primary-soft px-0.5 font-semibold text-primary" title={SLOT_LABELS[part.slice(1, -1)] ?? "Ý thay theo đề"}>{values?.[part.slice(1, -1)]?.trim() ? values[part.slice(1, -1)] : part}</span>
    : <FrameLiteral key={i}>{part}</FrameLiteral>)}</>;
}

export function FrameApplications({ deck, saved, onSave }: {
  deck: ExtendedDeck; saved?: { topic: number; values: Record<string, string> }; onSave: (state: { topic: number; values: Record<string, string> }) => void;
}) {
  const [showSlots, setShowSlots] = useState(false);
  const topic = saved?.topic ?? 0;
  const values = saved?.values ?? deck.applications[topic].values;
  const skeleton = deck.lines.map((line) => line.en).join("\n\n");
  const text = fillFrame(skeleton, values);
  const slots = frameSlots(skeleton);
  const count = wordCount(fixedFrameText(text));
  const minimum = deck.task === 1 ? 120 : 250;
  const unfilled = slots.filter((slot) => !values[slot]?.trim()).length;
  return <details className="rounded-xl border border-primary/30 bg-surface p-4" data-testid="frame-applications">
    <summary className="cursor-pointer font-semibold text-primary">Cùng một khung, đổi sang {deck.applications.length} chủ đề</summary>
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted">Phần gạch chân là khung cần thuộc. Phần được tô nền là ý thay theo đề. Chọn một chủ đề để xem sẵn cách điền; sau đó sửa vài ý cho phù hợp với bài của bạn.</p>
      <label className="block text-sm font-medium">Chủ đề minh họa<select aria-label="Chủ đề minh họa" className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3" value={topic} onChange={(e) => { const next = Number(e.target.value); onSave({ topic: next, values: { ...deck.applications[next].values } }); }}>{deck.applications.map((app, i) => <option key={app.title} value={i}>{app.title}</option>)}</select></label>
      <p className="text-xs text-muted">Đổi chủ đề sẽ nạp lại các ý mẫu cho khung này. Bài viết trong Writing Studio và lượt gõ thuộc không bị thay đổi.</p>
      <div className="flex flex-wrap gap-2"><Badge tone="primary">{wordCount(fixedFrameText(skeleton))} từ cố định</Badge><Badge>{count} từ sau khi điền</Badge></div>
      {unfilled > 0 && <p role="status" className="text-sm text-warning">Còn {unfilled} ý chưa điền. Các chỗ này vẫn được giữ trong ngoặc.</p>}
      <div className="space-y-4" data-testid="filled-frame">{deck.lines.map((line) => <div key={line.id}><p className="text-xs text-muted">{line.part} · {line.vi}</p><p className="mt-1 whitespace-pre-wrap break-words leading-relaxed"><FrameTemplate text={line.en} values={values} /></p></div>)}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showSlots} onChange={(e) => setShowSlots(e.target.checked)} />Đổi ý của tôi — có gợi ý sẵn</label>
      {showSlots && <div className="space-y-4">{slots.map((slot) => <div key={slot}>
        <label className="block text-sm font-medium" htmlFor={`slot-${slot.replace(/\W/g, "-")}`}>{slot === "reason" && deck.id === "decline" ? "Việc phải làm — động từ nguyên mẫu" : slot === "benefit" && deck.task === 1 ? "Lợi ích — động từ nguyên mẫu" : SLOT_LABELS[slot] ?? slot}</label>
        <Textarea className="mt-1" id={`slot-${slot.replace(/\W/g, "-")}`} aria-label={`Thay ý: ${slot}`} rows={2} value={values[slot] ?? ""} onChange={(e) => onSave({ topic, values: { ...values, [slot]: e.target.value } })} />
        <p className="mt-1 text-xs text-muted">Gợi ý: {deck.applications[topic].values[slot]}</p>
      </div>)}</div>}
      <details><summary className="cursor-pointer text-sm font-medium">Xem văn bản để chọn và sao chép</summary><Textarea aria-label="Bài minh họa đã ghép" className="mt-2" rows={12} readOnly value={text} /></details>
      <p className="text-xs text-muted">{count < minimum ? `Bản minh họa hiện có ${count} từ; cần thêm ít nhất ${minimum - count} từ để đạt mốc ${minimum} từ của Task ${deck.task}. Hãy bổ sung chi tiết hoặc ví dụ trả lời đúng đề.` : "Đã đủ số từ tham khảo. Vẫn cần đối chiếu từng yêu cầu của đề và sửa những ý không phù hợp."} Các đoạn này minh họa cách dùng khung, chưa được chấm như một bài thi.</p>
    </div>
  </details>;
}
