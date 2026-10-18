import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useFocusStatus } from "./useFocus";

/** Compact progress of the running focus session (header of the app and of the lesson player). */
export function FocusBadge() {
  const st = useFocusStatus();
  const qc = useQueryClient();
  const was = useRef(false);
  const locked = !!st.data?.locked;
  useEffect(() => {
    if (was.current && !locked && st.data?.session) {
      const s = st.data.session;
      if (s.status === "completed") toast.success("Đã đạt mục tiêu buổi học! Máy đã mở khóa 🎉");
      qc.invalidateQueries({ queryKey: ["focus-history"] });
    }
    was.current = locked;
  }, [locked, st.data, qc]);
  if (!locked || !st.data?.session) return null;
  const s = st.data.session;
  const parts = [];
  if (s.goal_lessons) parts.push(`${s.lessons_done.length}/${s.goal_lessons} bài`);
  if (s.goal_minutes) parts.push(`${Math.floor(s.minutes_done)}/${s.goal_minutes} phút`);
  return (
    <Link to="/focus" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary" title="Đang học tập trung — xem tiến độ">
      <Lock size={12} />{parts.join(" · ")}
    </Link>
  );
}
