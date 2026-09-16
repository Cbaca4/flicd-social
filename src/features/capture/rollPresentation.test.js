import { describe, expect, it } from "vitest";
import { ROLL_STAGES, getNextRollStage } from "./rollPresentation.js";

describe("Roll presentation", () => {
  it("uses the physical-camera sequence from loading through finished", () => {
    expect(ROLL_STAGES).toEqual([
      "loading",
      "winding",
      "developing",
      "revealing",
      "finished",
    ]);
  });

  it("advances each stage without skipping the developing and reveal states", () => {
    expect(getNextRollStage("loading")).toBe("winding");
    expect(getNextRollStage("winding")).toBe("developing");
    expect(getNextRollStage("developing")).toBe("revealing");
    expect(getNextRollStage("revealing")).toBe("finished");
  });
});
