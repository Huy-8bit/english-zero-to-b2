import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Turtle, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/misc";
import { AIErrorBox, AILoading } from "@/components/ai/AIStatus";
import { speak } from "@/lib/tts";
import { ai, type PronunciationResult } from "@/services/ai";
import { PronunciationFeedback, RecordButton } from "./PronunciationFeedback";

/** Sentences that contain sounds Vietnamese speakers often find hard (th, final consonants, -s/-ed, clusters, v/w, sh). */
const STARTERS = [
  { label: "Âm th", text: "I think these three things are thirty dollars." },
  { label: "Âm cuối", text: "I like the black cat and the big red bag." },
  { label: "Đuôi -s", text: "She likes watching videos with her friends." },
  { label: "Đuôi -ed", text: "We walked to the park and played football." },
  { label: "Cụm phụ âm", text: "Please stop at the street near the bridge." },
  { label: "v / w / sh", text: "We visited a very old shop in Washington." },
];

export function PronunciationPractice({ level }: { level: string }) {
  const [text, setText] = useState(STARTERS[0].text);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const qc = useQueryClient();
  const sum = useQuery({ queryKey: ["pronunciation-summary"], queryFn: ai.pronunciationSummary });
  const choose = (t: string) => { setText(t); setResult(null); setErr(null); };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Luyện phát âm: đọc to rồi xem từng từ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {STARTERS.map((s) => <Button key={s.label} size="sm" variant={text === s.text ? "primary" : "outline"} onClick={() => choose(s.text)}>{s.label}</Button>)}
          </div>
          <Textarea rows={2} value={text} maxLength={400} onChange={(e) => choose(e.target.value)} aria-label="Câu cần đọc" />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => speak(text)}><Volume2 size={14} />Nghe mẫu</Button>
            <Button size="sm" variant="outline" onClick={() => speak(text, { slow: true })}><Turtle size={14} />Nghe chậm</Button>
            <RecordButton label="Ghi âm & chấm" disabled={busy || !text.trim()} onRecorded={async (rec) => {
              setBusy(true);
              setErr(null);
              try {
                setResult(await ai.assessPronunciation(rec.blob, text.trim(), { seconds: rec.seconds, source: "practice", level }));
                qc.invalidateQueries({ queryKey: ["pronunciation-summary"] });
              } catch (e) {
                setErr(e);
              } finally {
                setBusy(false);
              }
            }} />
          </div>
          {busy && <AILoading label="Đang nghe và chấm từng từ…" />}
          {err != null && <AIErrorBox error={err} />}
          {result && <PronunciationFeedback key={result.attempt_id} result={result} level={level} />}
          <p className="text-xs text-muted">Cách chấm: máy chép lại đúng những gì nghe được (không biết trước câu mẫu), rồi so từng từ với câu mẫu. Từ bị nghe thành từ khác hoặc nghe chưa rõ được đánh dấu để sửa. IPA lấy từ từ điển; giọng mẫu là giọng AI.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Từ hay đọc sai</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {sum.data?.average_score != null && <p className="text-muted">{sum.data.attempts} lần đọc · độ rõ trung bình <b className="text-fg">{sum.data.average_score}%</b></p>}
          {sum.data?.hard_words.length ? (
            <ul className="space-y-1.5">
              {sum.data.hard_words.map((w) => (
                <li key={w.word} className="flex items-center gap-2">
                  <button type="button" className="font-semibold text-primary hover:underline" onClick={() => choose(w.word)}>{w.word}</button>
                  {w.ipa && <span className="font-mono text-xs text-muted">{w.ipa}</span>}
                  <span className="ml-auto text-xs text-muted">{w.missed}/{w.seen} lần</span>
                  <Button size="icon" variant="ghost" aria-label={`Nghe “${w.word}”`} onClick={() => speak(w.word, { slow: true })}><Volume2 size={14} /></Button>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted">Chưa có — đọc vài câu để hệ thống tìm ra từ bạn cần luyện.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
