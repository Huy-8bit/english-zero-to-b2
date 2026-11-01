import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { lessonExamples } from "@/lib/exampleExtract";
import { isExample } from "@/lib/exampleKey";
import { Markdown } from "./Markdown";
import { ExampleViProvider, NoExampleVi } from "./ExampleVi";

const md = `| Từ | Ví dụ |
|---|---|
| **its** | *The dog wagged **its** tail.* |
| **it's** | ***It's** raining.* |
| sở hữu | *my sister**'s** room, Nam**'s** car* |

Công thức *S + V + O*, từ *tell*, *câu tiếng Việt in nghiêng*. Ví dụ: *She said she was busy.* Hết.`;

describe("example translations", () => {
  it("picks sentences and phrases, not formulas, single words, gap-fills or Vietnamese", () => {
    expect(lessonExamples([md], ["Whose phone is this?", "OK."])).toEqual([
      "The dog wagged its tail.", "It's raining.", "my sister's room, Nam's car", "She said she was busy.", "Whose phone is this?",
    ]);
    expect(isExample("I ___ a student.")).toBe(false);
    expect(isExample("Alot‿of people | think")).toBe(false);
  });

  it("shows the Vietnamese the extractor keyed, under the example; never inside exercises", () => {
    const keys = lessonExamples([md]);
    const vi = Object.fromEntries(keys.map((k, i) => [k, { vi: `VI-${i}`, ...(i === 1 ? { wrong: true } : {}) }]));
    const { unmount } = render(<MemoryRouter><ExampleViProvider value={vi}><Markdown>{md}</Markdown></ExampleViProvider></MemoryRouter>);
    for (const i of [0, 2, 3]) expect(screen.getByText(`VI-${i}`)).toHaveClass("vi-tr");
    expect(screen.getByText(/câu sai — ý định nói: VI-1/)).toHaveClass("vi-wrong");
    unmount();
    render(<MemoryRouter><ExampleViProvider value={vi}><NoExampleVi><Markdown>{md}</Markdown></NoExampleVi></ExampleViProvider></MemoryRouter>);
    expect(screen.queryByText("VI-0")).toBeNull();
  });
});
