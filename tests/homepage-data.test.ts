import { describe, expect, it } from "vitest";
import { getProcessStepNumbers, processSteps, workflowOptions } from "../lib/homepage-data";

describe("homepage production content", () => {
  it("keeps the approved six-step production sequence", () => {
    expect(processSteps.map((step) => step.title)).toEqual([
      "Upload",
      "Artwork check",
      "Print",
      "Cure",
      "Quality check",
      "Pickup",
    ]);
    expect(getProcessStepNumbers()).toEqual(["01", "02", "03", "04", "05", "06"]);
  });

  it("offers every approved starting workflow", () => {
    expect(workflowOptions).toHaveLength(4);
    expect(workflowOptions.map((option) => option.title)).toContain("Full apparel project");
  });
});
