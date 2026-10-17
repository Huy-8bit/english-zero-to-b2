import { useEffect, useRef, useState } from "react";
import { PhoneCall, PhoneOff, RotateCcw } from "lucide-react";
import { ai } from "@/services/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AIErrorBox, useAIStatus } from "@/components/ai/AIStatus";

type Line = { role: "ai" | "you"; text: string };

/**
 * Realtime voice conversation over WebRTC (experimental). The backend issues a short-lived client
 * secret; the standard API key never reaches the browser. The session is capped by max_seconds.
 */
export function RealtimePanel({ level, topic }: { level: string; topic: string }) {
  const st = useAIStatus();
  const [state, setState] = useState<"idle" | "connecting" | "live" | "dropped" | "ended">("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [left, setLeft] = useState(0);
  const pc = useRef<RTCPeerConnection | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const startedAt = useRef(0);
  const limit = useRef(300);

  const hangup = async (final: "ended" | "dropped" = "ended") => {
    pc.current?.close();
    pc.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (startedAt.current) {
      const secs = (Date.now() - startedAt.current) / 1000;
      startedAt.current = 0;
      ai.realtimeEnd(secs).catch(() => {});
    }
    setState(final);
  };
  useEffect(() => () => { void hangup(); }, []);
  useEffect(() => {
    if (state !== "live") return;
    const t = setInterval(() => {
      const remain = Math.max(0, limit.current - Math.floor((Date.now() - startedAt.current) / 1000));
      setLeft(remain);
      if (remain === 0) void hangup();
    }, 500);
    return () => clearInterval(t);
  }, [state]);

  const connect = async () => {
    setErr(null);
    setState("connecting");
    try {
      const s = await ai.realtime({ mode: "free", topic: topic || "everyday life", level });
      limit.current = s.max_seconds;
      const conn = new RTCPeerConnection();
      pc.current = conn;
      conn.ontrack = (e) => { if (audio.current) audio.current.srcObject = e.streams[0]; };
      conn.onconnectionstatechange = () => {
        if (["failed", "disconnected"].includes(conn.connectionState) && pc.current === conn) void hangup("dropped");
      };
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = ms;
      ms.getTracks().forEach((t) => conn.addTrack(t, ms));
      const dc = conn.createDataChannel("oai-events");
      dc.onmessage = (ev) => {
        try {
          const e = JSON.parse(ev.data) as { type?: string; transcript?: string };
          if (typeof e.transcript === "string" && e.transcript.trim() && /(done|completed)$/.test(e.type ?? "")) {
            setLines((l) => [...l, { role: (e.type ?? "").includes("input") ? "you" : "ai", text: e.transcript! }]);
          }
        } catch {
          /* ignore non-JSON events */
        }
      };
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      const res = await fetch(s.calls_url, { method: "POST", body: offer.sdp, headers: { Authorization: `Bearer ${s.client_secret}`, "Content-Type": "application/sdp" } });
      if (!res.ok) throw new Error(`Realtime API từ chối kết nối (${res.status}).`);
      await conn.setRemoteDescription({ type: "answer", sdp: await res.text() });
      startedAt.current = Date.now();
      setLeft(limit.current);
      setState("live");
    } catch (e) {
      await hangup("dropped");
      setErr(e);
    }
  };

  if (!st.data?.enabled) return <p className="text-sm text-muted">Cần cấu hình AI để dùng hội thoại thời gian thực.</p>;
  return (
    <Card>
      <CardContent className="space-y-3 pt-5 text-sm">
        <p className="rounded-xl bg-warning-soft px-3 py-2 text-warning">Thử nghiệm: hội thoại giọng nói trực tiếp qua OpenAI Realtime (WebRTC). Tính năng này chưa được kiểm thử với API thật trong môi trường phát triển; nếu không kết nối được, hãy dùng tab “Luyện nói”. Phiên tự kết thúc sau {Math.round(limit.current / 60)} phút.</p>
        <div className="flex flex-wrap items-center gap-2">
          {state === "live" ? <Button variant="danger" onClick={() => hangup()}><PhoneOff size={16} />Kết thúc ({left}s)</Button>
            : <Button onClick={connect} disabled={state === "connecting"}><PhoneCall size={16} />{state === "connecting" ? "Đang kết nối…" : state === "dropped" ? "Kết nối lại" : "Bắt đầu nói chuyện"}</Button>}
          {state === "dropped" && <span className="inline-flex items-center gap-1 text-danger"><RotateCcw size={14} />Mất kết nối</span>}
          <span className="text-muted">Trình độ {level}{topic ? ` · ${topic}` : ""}</span>
        </div>
        <audio ref={audio} autoPlay aria-label="Giọng AI" />
        {err != null && <AIErrorBox error={err} onRetry={connect} />}
        <ol className="space-y-1">{lines.map((l, i) => <li key={i}><b>{l.role === "ai" ? "AI" : "Bạn"}:</b> {l.text}</li>)}</ol>
      </CardContent>
    </Card>
  );
}
