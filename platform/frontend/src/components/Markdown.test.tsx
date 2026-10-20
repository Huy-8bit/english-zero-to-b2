import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown, fixIntrawordBold } from "./Markdown";

describe("intraword bold with an apostrophe (curriculum style)", () => {
  it("moves the apostrophe outside the bold so it renders", () => {
    expect(fixIntrawordBold("*my sister**'s** room, Nam**'s** car*")).toBe("*my sister'**s** room, Nam'**s** car*");
    expect(fixIntrawordBold("I**'m** happy; the students**'** books")).toBe("I'**m** happy; the students' books");
  });
  it("renders without literal asterisks", () => {
    const { container } = render(<Markdown>{"| a |\n|---|\n| *my sister**'s** room* |"}</Markdown>);
    expect(container.textContent).not.toContain("*");
    expect(container.querySelector("strong")?.textContent).toBe("s");
  });
});
