import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Markdown } from "./Markdown";

const wrap = (md: string, docPath?: string) => render(<MemoryRouter><Markdown docPath={docPath}>{md}</Markdown></MemoryRouter>);

describe("Markdown", () => {
  it("renders GFM tables", () => {
    wrap("| A | B |\n|---|---|\n| 1 | 2 |");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
  it("never renders raw HTML or scripts from Markdown", () => {
    const { container } = wrap('Hello <script>window.__x = 1</script><img src=x onerror="alert(1)"> **bold**');
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect((window as unknown as { __x?: number }).__x).toBeUndefined();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });
  it("turns curriculum links into Reference Mode links", () => {
    wrap("[Tenses](../../06-GRAMMAR-REFERENCE/ALL-TENSES-COMPARISON.md)", "02-A1-BEGINNER/grammar/A1-G001.md");
    expect(screen.getByRole("link", { name: "Tenses" })).toHaveAttribute("href", "/reference?path=06-GRAMMAR-REFERENCE%2FALL-TENSES-COMPARISON.md");
  });
  it("neutralises javascript: links", () => {
    wrap("[x](javascript:alert(1))");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
