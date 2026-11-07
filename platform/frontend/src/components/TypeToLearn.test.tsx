import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { nextTypable, TypeToLearn, typeKey } from "./TypeToLearn";

const chars = [..."get up!"];

describe("TypeToLearn", () => {
  it("accepts only the expected letter, case-insensitively, and skips spaces and punctuation", () => {
    expect(typeKey(chars, 0, "G")).toBe(1);
    expect(typeKey(chars, 0, "x")).toBeNull(); // a miss is not typed in
    expect(typeKey(chars, 2, "t")).toBe(4); // the space after "get" fills itself
    expect(typeKey(chars, 5, "p")).toBe(7); // "!" too: done
    expect(nextTypable([..."'n"], 0)).toBe(1);
  });

  it("goes on only once the whole answer is typed; a wrong key is counted, not entered", () => {
    const onDone = vi.fn();
    render(<TypeToLearn target="get up" onDone={onDone} />);
    const input = screen.getByLabelText(/Gõ lại đáp án đúng/);
    for (const k of ["g", "x", "e", "t", " ", "u"]) fireEvent.change(input, { target: { value: k } });
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "p" } });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Sai 1 chữ/)).toBeInTheDocument();
  });

  it("says perfect when nothing was missed, and handles a whole pasted word", () => {
    const onDone = vi.fn();
    render(<TypeToLearn target="went" onDone={onDone} />);
    fireEvent.change(screen.getByLabelText(/Gõ lại đáp án đúng/), { target: { value: "went" } });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Hoàn hảo/)).toBeInTheDocument();
  });
});
