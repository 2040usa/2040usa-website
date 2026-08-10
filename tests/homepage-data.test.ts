import { describe, expect, it } from "vitest";
import { getProcessStepNumbers, processSteps, workflowOptions } from "../lib/homepage-data";

describe("homepage production content", () => {
  it("keeps the approved three-step draft sequence", () => {
    expect(processSteps.map((step) => step.title)).toEqual([
      "Choose a route",
      "Artwork & Layout",
      "Review draft",
    ]);
    expect(getProcessStepNumbers()).toEqual(["01", "02", "03"]);
  });

  it("offers every approved starting workflow", () => {
    expect(workflowOptions.map((option) => option.title)).toEqual(["Print-Ready Gang Sheet", "Individual Designs"]);
  });
});
