import { describe, expect, it } from "vitest";

import { weightCaptureSchema } from "./animal-weight-schemas";

describe("weightCaptureSchema", () => {
  it("accepts scale capture", () => {
    expect(
      weightCaptureSchema.safeParse({
        method: "SCALE",
        weightKg: 32.5,
      }).success,
    ).toBe(true);
  });

  it("requires AI disclaimer", () => {
    expect(
      weightCaptureSchema.safeParse({
        method: "AI_CAMERA",
        uploadIds: ["upload-1"],
      }).success,
    ).toBe(false);
  });
});
