import { Link } from "react-router-dom";
import { EmptyState } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <EmptyState title="Không tìm thấy trang">
      <Link className="text-primary underline" to="/">Về Dashboard</Link>
    </EmptyState>
  );
}
