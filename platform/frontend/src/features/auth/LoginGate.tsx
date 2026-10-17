import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { ai } from "@/services/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/misc";

/** When the server sets APP_ACCESS_TOKEN, ask for it once; the server keeps an HttpOnly session cookie. */
export function LoginGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const st = useQuery({ queryKey: ["auth"], queryFn: ai.authStatus, retry: false });
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    const on = () => qc.invalidateQueries({ queryKey: ["auth"] });
    window.addEventListener("em-auth-required", on);
    return () => window.removeEventListener("em-auth-required", on);
  }, [qc]);
  if (!st.data || !st.data.required || st.data.authenticated) return <>{children}</>;
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-surface p-6" onSubmit={async (e) => {
        e.preventDefault();
        setErr("");
        try { await ai.login(token); qc.invalidateQueries(); } catch { setErr("Sai mã truy cập"); }
      }}>
        <p className="flex items-center gap-2 text-lg font-semibold"><KeyRound size={18} />English Mastery</p>
        <p className="text-sm text-muted">Nhập mã truy cập (APP_ACCESS_TOKEN) do bạn cấu hình trên máy chủ.</p>
        <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} aria-label="Mã truy cập" autoFocus />
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button type="submit" className="w-full">Đăng nhập</Button>
      </form>
    </div>
  );
}
