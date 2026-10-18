import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  BookOpen, BookText, Brain, ClipboardCheck, Ear, FlaskConical, GraduationCap, Headphones, Home, Library, LineChart,
  Map, Menu, Mic, Moon, PenLine, Search, Sun, X, Layers, Sparkles, PenSquare, AudioLines, Headset, BookOpenCheck, Target,
  NotebookPen, Settings, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUI } from "@/stores/ui";
import { AssistantButton, AssistantHost } from "@/features/assistant/AssistantPanel";
import { useModuleHeartbeat } from "@/features/journal/useModuleHeartbeat";

export const NAV_GROUPS = [
  { title: "Học", items: [
    { to: "/", label: "Dashboard", icon: Home },
    { to: "/path", label: "Lộ trình học", icon: Map },
    { to: "/grammar", label: "Ngữ pháp", icon: BookText },
    { to: "/vocabulary", label: "Từ vựng", icon: Layers },
    { to: "/pronunciation", label: "Phát âm", icon: Ear },
    { to: "/listening", label: "Nghe", icon: Headphones },
    { to: "/speaking", label: "Nói", icon: Mic },
    { to: "/reading", label: "Đọc", icon: BookOpen },
    { to: "/writing", label: "Viết", icon: PenLine },
    { to: "/practice", label: "Luyện tập", icon: FlaskConical },
    { to: "/exams", label: "Kiểm tra", icon: ClipboardCheck },
  ] },
  { title: "Luyện với AI", items: [
    { to: "/ai-practice", label: "Tạo bài tập AI", icon: Sparkles },
    { to: "/writing-studio", label: "Writing Studio", icon: PenSquare },
    { to: "/speaking-studio", label: "Speaking Studio", icon: AudioLines },
    { to: "/listening-studio", label: "Listening Studio", icon: Headset },
    { to: "/reading-studio", label: "Reading Studio", icon: BookOpenCheck },
    { to: "/placement", label: "Kiểm tra xếp lớp", icon: Target },
  ] },
  { title: "Theo dõi", items: [
    { to: "/progress", label: "Tiến độ & phân tích", icon: LineChart },
    { to: "/journal", label: "Nhật ký học tập", icon: CalendarDays },
    { to: "/mistakes", label: "Sổ lỗi sai", icon: NotebookPen },
    { to: "/review", label: "Ôn tập & Flashcards", icon: Brain },
    { to: "/library", label: "Tra cứu", icon: Library },
    { to: "/settings", label: "Cài đặt", icon: Settings },
  ] },
];
export const NAV = NAV_GROUPS.flatMap((g) => g.items);

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-3">
      {NAV_GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</p>
          <div className="flex flex-col gap-0.5">
            {g.items.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === "/"} onClick={onNavigate}
                className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm transition",
                  isActive ? "bg-primary-soft text-primary font-semibold" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                <Icon size={17} aria-hidden />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SearchBox() {
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState(new URLSearchParams(loc.search).get("q") ?? "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement))) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length >= 2) nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  return (
    <form onSubmit={submit} role="search" className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm trong giáo trình"
        placeholder="Tìm bài học: present perfect, câu bị động…"
        className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-12 text-sm outline-none focus:border-primary" />
      <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-[10px] text-muted sm:block">⌘K</kbd>
    </form>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useUI();
  return (
    <button onClick={toggleTheme} className="rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-fg"
      aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}>
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export function Layout() {
  const { sidebarOpen, setSidebarOpen } = useUI();
  const loc = useLocation();
  useEffect(() => { setSidebarOpen(false); }, [loc.pathname, setSidebarOpen]);
  useModuleHeartbeat(loc.pathname);
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">Bỏ qua tới nội dung</a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-surface px-3 py-4 lg:flex">
        <Brand />
        <div className="mt-4 flex-1 overflow-y-auto"><SideNav /></div>
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface px-3 py-4 shadow-xl">
            <div className="flex items-center justify-between"><Brand /><button aria-label="Đóng menu" className="rounded-lg p-2" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
            <div className="mt-4 flex-1 overflow-y-auto"><SideNav onNavigate={() => setSidebarOpen(false)} /></div>
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-6">
          <button className="rounded-xl p-2 lg:hidden" aria-label="Mở menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <SearchBox />
          <div className="ml-auto flex items-center gap-1"><AssistantButton /><ThemeToggle /></div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
      <AssistantHost />
    </div>
  );
}

function Brand() {
  return (
    <NavLink to="/" className="flex items-center gap-2 px-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-fg"><GraduationCap size={20} /></span>
      <span className="leading-tight"><span className="block font-bold">English Mastery</span><span className="block text-xs text-muted">A0 → B2</span></span>
    </NavLink>
  );
}
