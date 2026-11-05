import { Link } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";

export function RescueLink() {
  return <Link to="/b2-four-hour" className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft/50 p-4 text-primary hover:bg-primary-soft">
    <Zap size={22} className="shrink-0" aria-hidden /><div className="min-w-0 flex-1"><p className="font-semibold">Chỉ còn 4 tiếng? Ôn từ vựng Writing & Speaking B2</p><p className="mt-1 text-sm text-muted">60 cụm lõi + từ theo 6 lĩnh vực · kinh tế, sức khỏe, học tập, giáo dục, trường học, việc làm</p></div><ArrowRight size={18} className="shrink-0" aria-hidden />
  </Link>;
}
