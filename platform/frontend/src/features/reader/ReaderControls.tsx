import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useUI } from "@/stores/ui";
import { DEFAULT_READER, type ReaderSettings } from "./readerSettings";

export function ReaderControls() {
  const [open, setOpen] = useState(false);
  const { reader, setReader, theme, toggleTheme } = useUI();
  return <>
    <button type="button" aria-label="Tùy chỉnh trang đọc" title="Trang đọc: nền giấy, cỡ chữ và giãn dòng" onClick={() => setOpen(true)}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-fg"><BookOpen size={18} /></button>
    <Dialog open={open} onOpenChange={setOpen} title="Trang đọc" description="Chỉnh trang sách cho vừa mắt bạn. Lựa chọn được lưu trên trình duyệt.">
      <div className="space-y-5" data-testid="reader-settings">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={reader.enabled} onChange={(e) => setReader({ enabled: e.target.checked })} />Giao diện máy đọc sách</label>
        {reader.enabled ? <>
          <Choices label="Nền trang" value={reader.tone} options={[["paper", "Giấy"], ["warm", "Ấm"], ["night", "Đêm"], ["black", "Đen"]]} onChange={(tone) => setReader({ tone })} />
          <Choices label="Cỡ chữ nội dung" value={reader.size} options={[[17, "17"], [19, "19"], [21, "21"], [23, "23"]]} onChange={(size) => setReader({ size })} />
          <Choices label="Kiểu chữ" value={reader.font} options={[["book", "Chữ sách"], ["sans", "Chữ hiện đại"]]} onChange={(font) => setReader({ font })} />
          <Choices label="Giãn dòng" value={reader.spacing} options={[["normal", "Thoáng"], ["wide", "Rộng"]]} onChange={(spacing) => setReader({ spacing })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reader.focus} onChange={(e) => setReader({ focus: e.target.checked })} />Ẩn thanh bên để tập trung đọc</label>
          <div className="reader-preview rounded-lg border border-border bg-surface p-4" aria-label="Xem trước trang đọc">
            <p className="mb-2 text-xs font-medium text-muted">Xem trước</p>
            <p style={{ fontSize: reader.size, lineHeight: reader.spacing === "wide" ? 2.1 : 1.85, fontFamily: reader.font === "book" ? 'Georgia, "Times New Roman", serif' : "var(--font-sans)" }}>Học từng ý, đọc từng câu.<br /><strong>I believe that practice makes a difference.</strong></p>
          </div>
          <p className="text-xs text-muted">Trang đọc giảm màu nổi, bóng đổ và chuyển động. Đúng/sai vẫn có nhãn và màu riêng để dễ nhận ra.</p>
        </> : <Button variant="outline" onClick={toggleTheme}>Giao diện ứng dụng: {theme === "dark" ? "Tối" : "Sáng"} — đổi màu</Button>}
        <div className="flex flex-wrap justify-between gap-2"><Button variant="ghost" onClick={() => setReader(DEFAULT_READER)}>Về mặc định</Button><Button onClick={() => setOpen(false)}>Xong</Button></div>
      </div>
    </Dialog>
  </>;
}

function Choices<T extends ReaderSettings[keyof ReaderSettings]>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return <fieldset><legend className="mb-2 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-2">
    {options.map(([key, text]) => <label key={String(key)} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${value === key ? "border-fg bg-surface-2" : "border-border"}`}>
      <input type="radio" name={label} checked={value === key} onChange={() => onChange(key)} />{text}
    </label>)}
  </div></fieldset>;
}
