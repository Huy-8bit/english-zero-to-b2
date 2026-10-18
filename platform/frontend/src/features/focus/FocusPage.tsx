import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Brain, CheckCircle2, Clock, Lock, LockOpen, Map, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, Input, PageHeader, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { focus, inLockApp, type FocusSession, type FocusSettings } from "@/services/focus";
import { useFocusStatus } from "./useFocus";

const STATUS_VI: Record<FocusSession["status"], string> = {
  active: "Đang khóa", completed: "Hoàn thành", expired: "Hết giờ an toàn", emergency: "Mở khẩn cấp", cancelled: "Đã hủy",
};

export default function FocusPage() {
  const st = useFocusStatus();
  const set = useQuery({ queryKey: ["focus-settings"], queryFn: focus.settings });
  if (st.isLoading || set.isLoading) return <Skeleton className="h-96" />;
  if (st.error || !st.data || !set.data) return <ErrorBox error={st.error ?? set.error} onRetry={() => { st.refetch(); set.refetch(); }} />;
  const s = st.data.session;
  return (
    <div>
      <PageHeader title="Học tập trung (khóa máy)" subtitle="Đặt mục tiêu cho buổi học. Ứng dụng English Focus Lock trên Mac sẽ khóa màn hình cho tới khi bạn học xong." />
      {st.data.locked && s ? <ActiveSession s={s} settings={set.data} /> : <Setup settings={set.data} last={s} />}
      <History />
    </div>
  );
}

function Setup({ settings, last }: { settings: FocusSettings; last: FocusSession | null }) {
  const qc = useQueryClient();
  const [lessons, setLessons] = useState(settings.default_lessons);
  const [minutes, setMinutes] = useState(settings.default_minutes);
  const [max, setMax] = useState(settings.max_minutes);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      await focus.start({ lessons, minutes, max_minutes: max });
      toast.success("Đã bắt đầu. Máy sẽ khóa cho tới khi xong mục tiêu.");
      qc.invalidateQueries({ queryKey: ["focus-status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không bắt đầu được");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle><Lock size={16} className="mr-1 inline" />Buổi học mới</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {last && last.status !== "active" && (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">Buổi trước: <b>{STATUS_VI[last.status]}</b> — {last.lessons_done.length}/{last.goal_lessons} bài, {Math.floor(last.minutes_done)}/{last.goal_minutes} phút. {last.end_reason}</p>
          )}
          <label className="block text-sm">Số bài cần hoàn thành: <b>{lessons}</b>
            <input type="range" min={0} max={10} value={lessons} onChange={(e) => setLessons(Number(e.target.value))} className="w-full" aria-label="Số bài cần hoàn thành" />
          </label>
          <label className="block text-sm">Số phút học thật: <b>{minutes}</b>
            <input type="range" min={0} max={180} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full" aria-label="Số phút học" />
          </label>
          <label className="block text-sm">Tự mở khóa sau tối đa: <b>{Math.max(max, minutes + 30)} phút</b> <span className="text-muted">(giới hạn an toàn)</span>
            <input type="range" min={30} max={480} step={15} value={max} onChange={(e) => setMax(Number(e.target.value))} className="w-full" aria-label="Thời gian khóa tối đa" />
          </label>
          <p className="text-xs text-muted">Bài được tính khi bạn hoàn thành bài (đi tới slide cuối và bấm Hoàn thành). Phút được tính khi bạn thật sự học (có thao tác) trong bài học, từ vựng hoặc các studio.</p>
          <Button size="lg" onClick={start} disabled={busy || (lessons === 0 && minutes === 0)}><Lock size={18} />Bắt đầu học & khóa máy</Button>
        </CardContent>
      </Card>
      <SafetyCard settings={settings} />
    </div>
  );
}

function SafetyCard({ settings }: { settings: FocusSettings }) {
  const qc = useQueryClient();
  const [pin, setPin] = useState("");
  const save = async (body: { pin?: string; clear_pin?: boolean }) => {
    try {
      await focus.saveSettings(body);
      setPin("");
      toast.success(body.clear_pin ? "Đã bỏ PIN" : "Đã lưu PIN");
      qc.invalidateQueries({ queryKey: ["focus-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được");
    }
  };
  return (
    <Card>
      <CardHeader><CardTitle><ShieldAlert size={16} className="mr-1 inline" />Lối thoát an toàn</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Tự mở khóa khi hết thời gian tối đa.</li>
          <li>Mở khẩn cấp: chờ 60 giây rồi nhập {settings.pin_set ? "PIN" : <>câu “{settings.phrase}”</>}.</li>
          <li>Nếu máy chủ học tập không chạy, máy tự mở khóa.</li>
          <li>Phím thoát của ứng dụng: giữ <kbd>Ctrl ⌥ ⌘ ⇧ U</kbd> rồi xác nhận.</li>
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (pin) void save({ pin }); }}>
          <Input className="h-9" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder={settings.pin_set ? "Đổi PIN" : "Đặt PIN (4–12 số)"} aria-label="PIN mở khẩn cấp" />
          <Button size="sm" type="submit" disabled={pin.length < 4}>Lưu</Button>
        </form>
        {settings.pin_set && <button className="text-xs text-muted underline" onClick={() => save({ clear_pin: true })}>Bỏ PIN (dùng câu xác nhận)</button>}
        <p className="text-xs text-muted">Cần cài ứng dụng English Focus Lock (xem <code>platform/focus-lock/README.md</code>). Không có ứng dụng, trang này chỉ theo dõi mục tiêu.</p>
      </CardContent>
    </Card>
  );
}

function ActiveSession({ s, settings }: { s: FocusSession; settings: FocusSettings }) {
  const lessonPct = s.goal_lessons ? Math.min(100, (s.lessons_done.length / s.goal_lessons) * 100) : 100;
  const minPct = s.goal_minutes ? Math.min(100, (s.minutes_done / s.goal_minutes) * 100) : 100;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="border-primary/40 lg:col-span-2">
        <CardHeader><CardTitle><Lock size={16} className="mr-1 inline text-primary" />Đang học tập trung</CardTitle><Badge tone="primary">Tự mở lúc {new Date(s.ends_by + "Z").toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</Badge></CardHeader>
        <CardContent className="space-y-4">
          {s.goal_lessons > 0 && (
            <div>
              <div className="flex justify-between text-sm"><span><BookOpen size={14} className="mr-1 inline" />Bài hoàn thành</span><b>{s.lessons_done.length}/{s.goal_lessons}</b></div>
              <Progress value={lessonPct} label="Tiến độ số bài" />
              {s.lessons_done.length > 0 && <p className="mt-1 text-xs text-muted">Đã xong: {s.lessons_done.join(", ")}</p>}
            </div>
          )}
          {s.goal_minutes > 0 && (
            <div>
              <div className="flex justify-between text-sm"><span><Clock size={14} className="mr-1 inline" />Phút học</span><b>{Math.floor(s.minutes_done)}/{s.goal_minutes}</b></div>
              <Progress value={minPct} label="Tiến độ số phút" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link to="/path"><Button><Map size={16} />Lộ trình học</Button></Link>
            <Link to="/vocabulary"><Button variant="outline"><Brain size={16} />Từ vựng</Button></Link>
            <Link to="/journal"><Button variant="ghost">Nhật ký hôm nay</Button></Link>
          </div>
          {!inLockApp() && <p className="text-xs text-muted">Nếu đã cài English Focus Lock, màn hình Mac đang bị khóa và bạn học ngay trong cửa sổ khóa.</p>}
        </CardContent>
      </Card>
      <Emergency s={s} settings={settings} />
    </div>
  );
}

function Emergency({ s, settings }: { s: FocusSession; settings: FocusSettings }) {
  const qc = useQueryClient();
  const [left, setLeft] = useState<number | null>(s.emergency?.wait_seconds ?? null);
  const [secret, setSecret] = useState("");
  useEffect(() => { setLeft(s.emergency?.wait_seconds ?? null); }, [s.emergency?.requested_at, s.emergency?.wait_seconds]);
  useEffect(() => {
    if (left === null || left <= 0) return;
    const t = setTimeout(() => setLeft((x) => (x === null ? null : x - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      qc.invalidateQueries({ queryKey: ["focus-status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thực hiện được");
    }
  };
  return (
    <Card>
      <CardHeader><CardTitle><LockOpen size={16} className="mr-1 inline" />Thoát</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {s.can_cancel && <Button variant="outline" size="sm" onClick={() => run(focus.cancel, "Đã hủy buổi học")}>Hủy (chỉ trong 60 giây đầu)</Button>}
        {left === null ? (
          <Button variant="ghost" size="sm" onClick={() => run(focus.emergencyRequest)}><ShieldAlert size={14} />Mở khóa khẩn cấp</Button>
        ) : left > 0 ? (
          <p className="text-muted">Mở khẩn cấp khả dụng sau <b>{left}</b> giây… (hãy cân nhắc học tiếp nhé)</p>
        ) : (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void run(() => focus.emergencyConfirm(settings.pin_set ? { pin: secret } : { phrase: secret }), "Đã mở khóa"); }}>
            <Input className="h-9" type={settings.pin_set ? "password" : "text"} value={secret} onChange={(e) => setSecret(e.target.value)}
              placeholder={settings.pin_set ? "Nhập PIN" : `Gõ: ${settings.phrase}`} aria-label={settings.pin_set ? "PIN" : "Câu xác nhận"} />
            <Button size="sm" variant="danger" type="submit" disabled={!secret}>Xác nhận mở khóa</Button>
          </form>
        )}
        <p className="text-xs text-muted">Lần mở khẩn cấp được ghi lại trong lịch sử.</p>
      </CardContent>
    </Card>
  );
}

function History() {
  const q = useQuery({ queryKey: ["focus-history"], queryFn: focus.history });
  if (!q.data?.length) return null;
  return (
    <Card className="mt-6">
      <CardHeader><CardTitle>Lịch sử buổi học tập trung</CardTitle></CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {q.data.map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-2">
            {h.status === "completed" ? <CheckCircle2 size={14} className="text-success" /> : <span className="h-3.5 w-3.5" />}
            <span className="text-muted">{new Date(h.started_at + "Z").toLocaleString("vi-VN")}</span>
            <Badge tone={h.status === "completed" ? "success" : h.status === "active" ? "primary" : "neutral"}>{STATUS_VI[h.status]}</Badge>
            <span>{h.lessons_done.length}/{h.goal_lessons} bài · {Math.floor(h.minutes_done)}/{h.goal_minutes} phút</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
