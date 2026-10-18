import { useQuery } from "@tanstack/react-query";
import { focus } from "@/services/focus";

/** Shared focus status (polled while a session is active so progress and unlock show up quickly). */
export function useFocusStatus() {
  return useQuery({
    queryKey: ["focus-status"], queryFn: focus.status, refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.locked ? 10_000 : 60_000),
  });
}
