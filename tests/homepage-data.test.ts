import { describe, expect, it } from "vitest";
import { getProcessStepNumbers, processSteps, workflowOptions } from "../lib/homepage-data";

describe("homepage production content", () => {
  it("keeps the approved six-step production sequence", () => {
    expect(processSteps.map((step) => step.title)).toEqual([
      "Choose a route",
      "Upload",
      "Project details",
      "Review draft",
    ]);
    expect(getProcessStepNumbers()).toEqual(["01", "02", "03", "04"]);
  });

  it("offers every approved starting workflow", () => {
    expect(workflowOptions.map((option) => option.title)).toEqual(["Print-Ready Gang Sheet", "Individual Designs"]);
  });
});
