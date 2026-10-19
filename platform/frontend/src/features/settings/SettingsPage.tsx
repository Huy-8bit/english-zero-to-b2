import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/services/api";
import { ai } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input, PageHeader } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { AIErrorBox, useAIStatus } from "@/components/ai/AIStatus";

const FEATURE_LABELS: Record<string, string> = {
  exercise_generate: "Tạo bài tập", exercise_verify: "Kiểm tra câu hỏi", exercise_grade: "Chấm bài", curriculum_grade: "Chấm câu mở (bài học)",
  writing_evaluate: "Chấm bài viết", writing_prompt: "Tạo đề viết", speaking_question: "Câu hỏi nói", speaking_feedback: "Góp ý nói",
  speaking_summary: "Tổng kết nói", speaking_transcribe: "Chép lời (STT)", speaking_tts: "Giọng đọc (TTS)", app_tts: "Giọng đọc AI trong bài học", pronunciation: "Chấm phát âm (chép lời)", pronunciation_explain: "Giải thích lỗi phát âm", speaking_realtime: "Hội thoại thời gian thực",
  listening_generate: "Tạo bài nghe", listening_tts: "Âm thanh bài nghe", reading_generate: "Tạo bài đọc", placement_report: "Báo cáo xếp lớp",
  placement_writing: "Đánh giá viết (xếp lớp)", embedding: "Embedding",
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const st = useAIStatus();
  const prof = useQuery({ queryKey: ["profile"], queryFn: api.profile });
  const ls = useQuery({ queryKey: ["learning-settings"], queryFn: ai.settings });
  const usage = useQuery({ queryKey: ["ai-usage"], queryFn: () => ai.usage(30), refetchOnMount: "always" });
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [goals, setGoals] = useState<Record<string, unknown>>({});
  const [models, setModels] = useState<Record<string, { model: string; available: boolean }> | null>(null);
  const [modelErr, setModelErr] = useState<unknown>(null);
  useEffect(() => { if (ls.data) setForm(ls.data); }, [ls.data]);
  useEffect(() => { if (prof.data) setGoals(prof.data); }, [prof.data]);
  const save = async () => {
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([k]) => ["target_level", "explanation_language", "ai_enabled", "daily_request_limit", "monthly_budget_usd", "max_audio_seconds", "max_exercise_count"].includes(k)));
      await ai.saveSettings(body);
      await api.saveProfile({ name: String(goals.name ?? ""), daily_goal_minutes: Number(goals.daily_goal_minutes), weekly_goal_lessons: Number(goals.weekly_goal_lessons) });
      toast.success("Đã lưu cài đặt");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được");
    }
  };
  const num = (k: string) => (form[k] === null || form[k] === undefined ? "" : String(form[k]));
  const u = usage.data;
  const budget = u?.limits.monthly_budget_usd ?? null;
  return (
    <div className="space-y-6">
      <PageHeader title="Cài đặt" subtitle="Mục tiêu học tập, tính năng AI, giới hạn sử dụng và chi phí." actions={<Button onClick={save}>Lưu thay đổi</Button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Học tập</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <label>Tên hiển thị<Input className="mt-1" value={String(goals.name ?? "")} onChange={(e) => setGoals({ ...goals, name: e.target.value })} /></label>
            <label>Trình độ mục tiêu<select className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-2" value={String(form.target_level ?? "B2")} onChange={(e) => setForm({ ...form, target_level: e.target.value })}>{["A1", "A2", "B1", "B2", "C1"].map((l) => <option key={l}>{l}</option>)}</select></label>
            <label>Phút học mỗi ngày<Input type="number" className="mt-1" min={5} max={240} value={String(goals.daily_goal_minutes ?? 20)} onChange={(e) => setGoals({ ...goals, daily_goal_minutes: e.target.value })} /></label>
            <label>Bài học mỗi tuần<Input type="number" className="mt-1" min={1} max={50} value={String(goals.weekly_goal_lessons ?? 5)} onChange={(e) => setGoals({ ...goals, weekly_goal_lessons: e.target.value })} /></label>
            <label className="sm:col-span-2">Ngôn ngữ giải thích của AI<select className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-2" value={String(form.explanation_language ?? "vi")} onChange={(e) => setForm({ ...form, explanation_language: e.target.value })}>
              <option value="vi">Tiếng Việt (giữ thuật ngữ tiếng Anh)</option><option value="vi_en">Song ngữ Việt – Anh</option></select></label>
            {ls.data?.placement && <p className="sm:col-span-2 text-muted">Kết quả xếp lớp gần nhất: <b>{ls.data.placement.level}</b> ({new Date(ls.data.placement.date).toLocaleDateString("vi-VN")})</p>}
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Tính năng AI</CardTitle>{st.data && <Badge tone={st.data.enabled ? "success" : "warning"}>{st.data.enabled ? (st.data.simulated ? "Giả lập" : "Đang bật") : st.data.configured ? "Đang tắt" : "Chưa cấu hình"}</Badge>}</CardHeader>
          <CardContent className="space-y-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.ai_enabled !== false} onChange={(e) => setForm({ ...form, ai_enabled: e.target.checked })} />Bật các tính năng AI</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>Giới hạn yêu cầu / ngày<Input type="number" className="mt-1" placeholder={String(st.data?.limits.daily_request_limit ?? "")} value={num("daily_request_limit")} onChange={(e) => setForm({ ...form, daily_request_limit: e.target.value ? Number(e.target.value) : null })} /></label>
              <label>Ngân sách tháng (USD)<Input type="number" step="0.5" className="mt-1" placeholder={String(st.data?.limits.monthly_budget_usd ?? "")} value={num("monthly_budget_usd")} onChange={(e) => setForm({ ...form, monthly_budget_usd: e.target.value ? Number(e.target.value) : null })} /></label>
              <label>Ghi âm tối đa (giây)<Input type="number" className="mt-1" placeholder={String(st.data?.limits.max_audio_seconds ?? "")} value={num("max_audio_seconds")} onChange={(e) => setForm({ ...form, max_audio_seconds: e.target.value ? Number(e.target.value) : null })} /></label>
              <label>Số câu tối đa mỗi bộ bài<Input type="number" className="mt-1" placeholder={String(st.data?.limits.max_exercise_count ?? "")} value={num("max_exercise_count")} onChange={(e) => setForm({ ...form, max_exercise_count: e.target.value ? Number(e.target.value) : null })} /></label>
            </div>
            <p className="text-xs text-muted">Giới hạn tốc độ: {st.data?.limits.rate_limit_per_minute} yêu cầu/phút (cấu hình máy chủ). Khóa API chỉ nằm ở máy chủ, không bao giờ gửi tới trình duyệt.</p>
            {st.data?.models && <details><summary className="cursor-pointer text-primary">Model đang dùng</summary>
              <ul className="mt-1 space-y-0.5 text-xs">{Object.entries(st.data.models).map(([k, v]) => <li key={k}>{k}: <code>{v}</code>{models?.[k] && <Badge tone={models[k].available ? "success" : "danger"} className="ml-1">{models[k].available ? "truy cập được" : "không thấy"}</Badge>}</li>)}</ul>
              <Button size="sm" variant="outline" className="mt-2" onClick={async () => { setModelErr(null); try { setModels((await ai.checkModels()).models); } catch (e) { setModelErr(e); } }}><ShieldCheck size={14} />Kiểm tra quyền truy cập model</Button>
              {modelErr != null && <AIErrorBox error={modelErr} />}</details>}
          </CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Sử dụng AI & chi phí (30 ngày)</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {u && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Yêu cầu hôm nay" value={`${u.summary.today_requests} / ${u.limits.daily_request_limit}`} />
                <Stat label="Chi phí tháng này" value={`$${u.summary.month_cost.toFixed(4)}`} sub={budget != null ? `ngân sách $${budget}` : undefined} />
                <Stat label="Token vào / ra" value={`${u.totals.input_tokens.toLocaleString()} / ${u.totals.output_tokens.toLocaleString()}`} />
                <Stat label="Yêu cầu (30 ngày)" value={String(u.totals.requests)} sub={`$${u.totals.cost_usd.toFixed(4)}`} />
              </div>
              {budget != null && budget > 0 && <Progress value={(u.summary.month_cost / budget) * 100} label="Ngân sách tháng" />}
              {u.by_day.length > 0 && (
                <div className="h-56 w-full" role="img" aria-label="Biểu đồ chi phí theo ngày">
                  <ResponsiveContainer><BarChart data={u.by_day}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="requests" name="Yêu cầu" fill="var(--primary)" radius={4} /></BarChart></ResponsiveContainer>
                </div>
              )}
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted"><th className="py-1">Tính năng</th><th>Yêu cầu</th><th>Từ cache</th><th>Lỗi</th><th>Token vào</th><th>Token ra</th><th>Chi phí ước tính</th></tr></thead>
                <tbody>{u.by_feature.map((f) => <tr key={f.feature} className="border-t border-border"><td className="py-1">{FEATURE_LABELS[f.feature] ?? f.feature}</td><td>{f.requests}</td><td>{f.cached}</td><td>{f.errors}</td><td>{f.input_tokens}</td><td>{f.output_tokens}</td><td>${f.cost_usd.toFixed(4)}</td></tr>)}</tbody></table></div>
              <p className="text-xs text-muted">{u.pricing_note}</p>
            </>
          )}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Quyền riêng tư</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          {(["writing", "speaking", "all"] as const).map((w) => (
            <Button key={w} variant="outline" onClick={async () => { if (window.confirm("Xóa vĩnh viễn lịch sử này?")) { const r = await ai.deleteHistory(w); toast.success(`Đã xóa ${r.deleted} mục`); qc.invalidateQueries(); } }}>
              <Trash2 size={14} />{w === "writing" ? "Xóa lịch sử viết" : w === "speaking" ? "Xóa lịch sử nói (kèm âm thanh)" : "Xóa toàn bộ lịch sử viết & nói"}</Button>))}
        </CardContent></Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted">{label}</p><p className="text-lg font-bold">{value}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div>;
}
