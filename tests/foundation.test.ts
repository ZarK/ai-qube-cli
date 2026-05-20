import { describe, expect, it } from "vitest";

import { describeToolkitBoundary, toolkitBoundary } from "../src/index.js";

describe("package foundation", () => {
  it("exposes a real root API that states the toolkit boundary", () => {
    expect(toolkitBoundary).toEqual({
      packageKind: "cli-infrastructure",
      consumesCommandBehavior: false,
      mutatesConsumerState: false
    });

    expect(describeToolkitBoundary()).toContain("consuming packages own command behavior");
  });
});
