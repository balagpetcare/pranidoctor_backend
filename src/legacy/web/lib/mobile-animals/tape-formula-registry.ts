import { AnimalType } from "@/generated/prisma/client";

export type TapeFormulaResult = {
  formulaId: string;
  estimatedKg: number;
  lowConfidence: boolean;
};

const TAPE_UNSUPPORTED: AnimalType[] = [AnimalType.POULTRY];

export function isTapeSupported(animalType: AnimalType): boolean {
  return !TAPE_UNSUPPORTED.includes(animalType);
}

export function estimateWeightFromTape(params: {
  animalType: AnimalType;
  heartGirthCm: number;
  bodyLengthCm: number;
}): TapeFormulaResult {
  const { animalType, heartGirthCm, bodyLengthCm } = params;

  if (!isTapeSupported(animalType)) {
    throw new Error("TAPE_NOT_SUPPORTED");
  }

  if (heartGirthCm <= 0 || bodyLengthCm <= 0) {
    throw new Error("INVALID_TAPE_MEASUREMENT");
  }

  const hg = heartGirthCm;
  const bl = bodyLengthCm;

  let formulaId: string;
  let divisor: number;
  let lowConfidence = false;

  if (animalType === AnimalType.CATTLE) {
    formulaId = "CATTLE_METRIC_V1";
    divisor = 10800;
    if (hg < 80 || hg > 250 || bl < 100 || bl > 200) {
      throw new Error("TAPE_OUT_OF_RANGE");
    }
  } else if (animalType === AnimalType.GOAT) {
    formulaId = "SMALL_RUMINANT_METRIC_V1";
    divisor = 12000;
    if (hg < 40 || hg > 120 || bl < 40 || bl > 100) {
      throw new Error("TAPE_OUT_OF_RANGE");
    }
  } else {
    formulaId = "GENERIC_METRIC_V1";
    divisor = 12000;
    lowConfidence = true;
    if (hg < 20 || hg > 300 || bl < 20 || bl > 300) {
      throw new Error("TAPE_OUT_OF_RANGE");
    }
  }

  const estimatedKg = (hg * hg * bl) / divisor;

  return {
    formulaId,
    estimatedKg,
    lowConfidence,
  };
}

export function roundWeightKg(kg: number): string {
  return kg.toFixed(3);
}
