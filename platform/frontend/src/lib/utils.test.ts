import { plain, resolveDocPath, wordCount } from "./utils";
import { isAnswered, toResponse } from "@/features/quizzes/draft";
import { wordTarget } from "@/features/quizzes/WritingEditor";
import type { QuizItem } from "@/types/content";

const item = (p: Partial<QuizItem>): QuizItem => ({
  id: "X:1", label: "1", kind: "text", prompt_md: "", instruction_md: "", options: null, prefill: null, tokens: null, multiline: false, has_key: true, ...p,
});

describe("utils", () => {
  it("resolves relative curriculum links", () => {
    expect(resolveDocPath("02-A1-BEGINNER/grammar/A1-G001-x.md", "../../06-GRAMMAR-REFERENCE/ALL.md#a")).toEqual({ path: "06-GRAMMAR-REFERENCE/ALL.md", hash: "a" });
    expect(resolveDocPath("a/b.md", "#top")).toEqual({ path: "a/b.md", hash: "top" });
    expect(resolveDocPath("a/b.md", "https://x.y")).toBeNull();
  });
  it("strips inline markdown for speech", () => {
    expect(plain("*She **works** in a [bank](x.md).*")).toBe("She works in a bank.");
  });
  it("counts words", () => {
    expect(wordCount("  I have  two cats ")).toBe(4);
    expect(wordCount("")).toBe(0);
  });
  it("reads word targets from prompts", () => {
    expect(wordTarget("Viết đoạn văn 80–100 từ")).toEqual([80, 100]);
    expect(wordTarget("write at least 120 words")).toEqual([120, 240]);
    expect(wordTarget("Dịch câu")).toBeNull();
  });
});

describe("draft answers", () => {
  it("requires every token for sentence ordering", () => {
    const it = item({ kind: "order", tokens: ["is", "my", "sister"] });
    expect(isAnswered(it, [1, 2])).toBe(false);
    expect(isAnswered(it, [1, 2, 0])).toBe(true);
    expect(toResponse(it, [1, 2, 0])).toBe("my sister is");
  });
  it("serialises speaking practice", () => {
    const it = item({ kind: "speaking" });
    expect(isAnswered(it, { notes: "", checklist: {} })).toBe(false);
    expect(toResponse(it, { notes: "", checklist: { "Nói liên tục": true } })).toContain("Nói liên tục");
  });
  it("trims text answers", () => {
    expect(isAnswered(item({}), "   ")).toBe(false);
  });
});
