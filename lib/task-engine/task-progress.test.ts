import { describe, expect, it } from "vitest";
import { isValidQuantityDone } from "./task-progress";

describe("task progress", () => {
  it("allows any non-negative progress when a task has no quantity target", () => {
    expect(isValidQuantityDone(12, null)).toBe(true);
  });

  it("caps progress at the required quantity", () => {
    expect(isValidQuantityDone(4, 4)).toBe(true);
    expect(isValidQuantityDone(5, 4)).toBe(false);
  });
});
