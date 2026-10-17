import { act, renderHook, waitFor } from "@testing-library/react";
import { api } from "@/services/api";
import type { StepsPayload } from "@/types/content";
import { usePlayerState } from "./usePlayerState";

vi.mock("@/services/api", () => ({ api: { saveProgress: vi.fn() } }));

it("serializes navigation saves so a slow old response cannot overwrite the next slide", async () => {
  localStorage.clear();
  let releaseFirst!: () => void;
  const first = new Promise<void>((resolve) => { releaseFirst = resolve; });
  vi.mocked(api.saveProgress).mockImplementationOnce(async () => {
    await first;
    return { current_step: 1, max_step: 1, status: "in_progress" };
  }).mockResolvedValue({ current_step: 2, max_step: 2, status: "in_progress" });
  const data = { steps: [{}, {}, {}], progress: null, results: {} } as unknown as StepsPayload;
  const { result } = renderHook(() => usePlayerState("save-order-test", data));
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => result.current.setStep(1));
  await waitFor(() => expect(api.saveProgress).toHaveBeenCalledTimes(1));
  act(() => result.current.setStep(2));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  expect(api.saveProgress).toHaveBeenCalledTimes(1);
  await act(async () => { releaseFirst(); });
  await waitFor(() => expect(api.saveProgress).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.saveProgress).mock.calls.map((call) => call[1])).toEqual([1, 2]);
  expect(JSON.parse(localStorage.getItem("em-lesson-save-order-test")!).step).toBe(2);
});
