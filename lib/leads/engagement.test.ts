import { describe, expect, it } from "vitest";
import { engagementTagForTouchCount } from "./engagement";

describe("engagementTagForTouchCount", () => {
  it("progresses a repeated contact from curious through fan", () => {
    expect(engagementTagForTouchCount(1)).toBe("curious");
    expect(engagementTagForTouchCount(2)).toBe("interested");
    expect(engagementTagForTouchCount(3)).toBe("regular");
    expect(engagementTagForTouchCount(4)).toBe("fan");
    expect(engagementTagForTouchCount(5)).toBe("fan");
  });
});
