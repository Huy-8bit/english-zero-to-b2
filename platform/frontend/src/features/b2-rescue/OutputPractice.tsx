import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { wordCount } from "@/lib/utils";
import { SPEAKING_TASKS, WRITING_TASKS } from "./topics";
import { HighlightChunks } from "./TopicLab";
import { phraseHits, type RescueState } from "./state";

function LocalRecording({ limit }: { limit: number }) {
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (recorder.current?.state === "recording") recorder.current.stop(); stream.current?.getTracks().forEach((t) => t.stop()); }; }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setElapsed(seconds);
      if (seconds >= limit && recorder.current?.state === "recording") recorder.current.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [recording, limit]);
  const start = async () => {
    setPending(true); setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("unsupported");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { media.getTracks().forEach((t) => t.stop()); return; }
      stream.current = media;
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        if (alive.current) { setRecording(false); setUrl(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }))); }
      };
      rec.onerror = () => { media.getTracks().forEach((t) => t.stop()); if (alive.current) { setRecording(false); setError("Ghi âm bị gián đoạn. Bạn vẫn có thể luyện nói và tự đánh dấu bên dưới."); } };
      rec.start(); setElapsed(0); setRecording(true);
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (alive.current) setError("Chưa dùng được micro. Cấp quyền trong trình duyệt hoặc nói thành tiếng rồi tự đánh dấu checklist.");
    } finally { if (alive.current) setPending(false); }
  };
  return <div className="space-y-3 rounded-xl bg-surface-2 p-4">
    <div className="flex flex-wrap items-center gap-3"><Button disabled={pending} variant={recording ? "danger" : "outline"} onClick={() => { if (recording) recorder.current?.stop(); else void start(); }}>{pending ? "Đang mở micro…" : recording ? "Dừng ghi âm" : "Ghi âm để nghe lại"}</Button><span className="text-sm tabular-nums">{elapsed}s / {limit}s</span></div>
    {url && <audio src={url} controls className="w-full" aria-label="Bản nói của tôi" />}
    {error && <p role="alert" className="text-sm">{error}</p>}
    <p className="text-xs text-muted">Ghi âm chỉ ở tab này, mất khi đổi bài hoặc tải lại. Không chấm phát âm tự động. Không có micro vẫn luyện được.</p>
  </div>;
}

const WRITING_CHECKS = ["Đã trả lời đúng các yêu cầu của đề", "Mỗi ý chính có lý do hoặc ví dụ cụ thể", "Cụm từ hợp nghĩa và đúng giới từ / dạng động từ", "Giọng văn phù hợp người nhận hoặc loại bài"];
export function OutputPractice({ kind, state, update }: { kind: "writing" | "speaking"; state: RescueState; update: (fn: (s: RescueState) => RescueState) => void }) {
  const [writingId, setWritingId] = useState("formal");
  const [speakingId, setSpeakingId] = useState("part1");
  const writing = kind === "writing";
  const task = writing ? WRITING_TASKS.find((t) => t.id === writingId)! : SPEAKING_TASKS.find((t) => t.id === speakingId)!;
  const key = `${kind}-${task.id}`;
  const draft = state.drafts[key] ?? { text: "", checks: {}, at: 0 };
  const checks = "checklist" in task ? task.checklist : WRITING_CHECKS;
  const hits = phraseHits(draft.text);
  const save = (patch: Partial<typeof draft>) => update((s) => ({ ...s, drafts: { ...s.drafts, [key]: { ...(s.drafts[key] ?? draft), ...patch, at: Date.now() } } }));
  return <Card className="space-y-5 p-5 sm:p-7">
    <h2 className="text-xl font-bold">{writing ? "Từ nhớ được → viết thành bài" : "Từ nhớ được → nói thành ý"}</h2>
    <p className="text-sm text-muted">{writing ? "30 phút: 5 phút lên ý, 12 phút viết một thư, 8 phút viết đoạn Task 2, 5 phút sửa. Chọn một loại thư để luyện; mẫu còn lại để tra cứu." : "25 phút: 5 phút Part 1, 8 phút Part 2, 8 phút Part 3, 4 phút nghe lại và sửa. Dùng ít cụm nhưng đúng ngữ cảnh."}</p>
    <label className="block text-sm font-medium">Bài vận dụng<select className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3" value={task.id} onChange={(e) => writing ? setWritingId(e.target.value) : setSpeakingId(e.target.value)}>{(writing ? WRITING_TASKS : SPEAKING_TASKS).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
    <p className="rounded-xl bg-surface-2 p-4 leading-relaxed">{"brief" in task ? task.brief : task.prompt}</p>
    {"help" in task && <p className="text-sm text-muted">{task.help}</p>}
    {"seconds" in task && <LocalRecording key={task.id} limit={task.seconds} />}
    <label className="block text-sm font-medium">{writing ? "Bài viết của tôi" : "Ý chính / lời tôi đã nói"}<textarea className="mt-2 min-h-56 w-full rounded-xl border border-border bg-surface p-4 text-base leading-7" value={draft.text} onChange={(e) => save({ text: e.target.value })} placeholder={writing ? "Tự viết trước, mở bài mẫu sau. Bản nháp được lưu tự động." : "Ghi 3 ý bằng từ khóa, nói thành tiếng rồi tự kiểm tra."} /></label>
    <p className="text-sm text-muted">{wordCount(draft.text)} từ{writing && "target" in task ? ` · bài hoàn chỉnh cần ít nhất ${task.target} từ` : ""} · Tự lưu bản nháp</p>
    <div className="space-y-2 rounded-xl border border-border p-4"><p className="text-sm font-medium">Nhận diện {hits.length} cụm trong bộ đã học</p><div className="flex flex-wrap gap-2">{hits.map((p) => <span key={p.id} className="rounded-lg bg-primary-soft px-2 py-1 text-sm text-primary" lang="en">{p.en}</span>)}</div><p className="text-xs text-muted">Chỉ tìm cụm trùng chữ, chưa chấm ngữ pháp, nghĩa hay trình độ B2. Cụm đã chia động từ có thể không được nhận diện; không cần nhồi nhiều cụm.</p></div>
    <fieldset className="space-y-3"><legend className="mb-2 font-medium">Tự kiểm tra sau khi viết / nói</legend>{checks.map((label, i) => <label key={label} className="flex items-start gap-3 text-sm"><input className="mt-0.5 h-4 w-4" type="checkbox" checked={draft.checks[i] ?? false} onChange={(e) => save({ checks: { ...draft.checks, [i]: e.target.checked } })} />{label}</label>)}</fieldset>
    <details key={key} className="rounded-xl border border-border p-4"><summary className="cursor-pointer font-medium">Đối chiếu bài mẫu · mở sau khi tự làm</summary><p className="my-3 text-xs text-muted">Bài tự soạn để học cách vận dụng, không phải bài được giám khảo chấm. Cụm lõi được gạch chân.</p><div className="leading-8"><HighlightChunks text={task.model} /></div></details>
    <Link className="inline-block text-sm font-medium text-primary underline" to={writing ? "/writing-studio?mode=exam" : "/speaking-studio"}>{writing ? "Mở khung Writing đã học →" : "Luyện thêm ở Speaking Studio →"}</Link>
  </Card>;
}
