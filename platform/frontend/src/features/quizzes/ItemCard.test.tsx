import { render as renderComponent, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ItemCard } from "./ItemCard";
import type { ItemResult, QuizItem } from "@/types/content";

vi.mock("@/services/ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/ai")>();
  return { ...original, ai: { ...original.ai, status: vi.fn().mockResolvedValue({ enabled: false }),
    attemptGrade: vi.fn().mockResolvedValue({ result: null }) } };
});

function render(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderComponent(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const mc: QuizItem = {
  id: "A1-G011:L1.1", label: "L1.1", kind: "mc", prompt_md: "___ the window, please.", instruction_md: "",
  options: [{ key: "A", text: "Closes" }, { key: "B", text: "Close" }], prefill: null, tokens: null, multiline: false, has_key: true,
};

const result: ItemResult = {
  item_id: mc.id, attempt_id: 1, response: "A", verdict: "incorrect", auto: true, self_correct: null, correct_option: "B",
  model_md: "**B. Close**", explanation_md: "Động từ nguyên mẫu.", review: "", has_key: true,
};

describe("ItemCard", () => {
  it("selects an option without revealing the answer", async () => {
    const onDraft = vi.fn();
    render(<MemoryRouter><ItemCard item={mc} unitId="A1-G011" docPath="" draft={undefined} onDraft={onDraft} locked={false} onSelfAssess={() => {}} onRetry={() => {}} /></MemoryRouter>);
    expect(screen.queryByText(/Đáp án/)).toBeNull();
    await userEvent.click(screen.getAllByRole("radio")[1]);
    expect(onDraft).toHaveBeenCalledWith("B");
  });
  it("shows feedback, the correct option and the explanation after grading", () => {
    render(<MemoryRouter><ItemCard item={mc} unitId="A1-G011" docPath="" draft="A" onDraft={() => {}} result={result} locked={false} onSelfAssess={() => {}} onRetry={() => {}} /></MemoryRouter>);
    expect(screen.getByText("Chưa đúng")).toBeInTheDocument();
    expect(screen.getByText("Động từ nguyên mẫu.")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")[0]).toBeDisabled();
  });
  it("offers self-assessment for open answers", async () => {
    const onSelf = vi.fn();
    const text: QuizItem = { ...mc, kind: "text", options: null };
    render(<MemoryRouter><ItemCard item={text} unitId="x" docPath="" draft="Shut the window" onDraft={() => {}} result={{ ...result, verdict: "mismatch", auto: false, correct_option: null }} locked={false} onSelfAssess={onSelf} onRetry={() => {}} /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: "Tôi làm đúng" }));
    expect(onSelf).toHaveBeenCalledWith(true);
  });
});
