import { describe, expect, it } from "vitest";

import { AnimalType } from "@/generated/prisma/client";

import {
  createAnimalBodySchema,
  listAnimalsQuerySchema,
} from "./schemas";

describe("createAnimalBodySchema", () => {
  it("requires animalType and either name or tag", () => {
    expect(
      createAnimalBodySchema.safeParse({
        animalType: AnimalType.GOAT,
        name: "Lalu",
      }).success,
    ).toBe(true);

    expect(
      createAnimalBodySchema.safeParse({
        animalType: AnimalType.GOAT,
        tag: "T-1",
      }).success,
    ).toBe(true);

    expect(
      createAnimalBodySchema.safeParse({
        animalType: AnimalType.GOAT,
      }).success,
    ).toBe(false);
  });
});

describe("listAnimalsQuerySchema", () => {
  it("parses includeInactive", () => {
    expect(
      listAnimalsQuerySchema.safeParse({ includeInactive: "true" }).data,
    ).toEqual({ includeInactive: true });
    expect(
      listAnimalsQuerySchema.safeParse({ includeInactive: undefined }).data,
    ).toEqual({ includeInactive: false });
  });
});
