import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  approximateDobFromAgeYears,
  categoryFromAnimalType,
  speciesLabelFromAnimalType,
  toAnimalJsonDto,
  type AnimalJsonDto,
} from "./animal-mapper";
import { AnimalWeightMeasurementSource } from "@/generated/prisma/client";

import { createMeasurementFromCapture } from "./animal-weight-service.js";
import type { CreateAnimalBody, PatchAnimalBody } from "./schemas.js";

export async function listAnimalsForCustomer(
  customerProfileId: string,
  includeInactive: boolean,
): Promise<AnimalJsonDto[]> {
  const rows = await prisma.animalProfile.findMany({
    where: {
      customerId: customerProfileId,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toAnimalJsonDto);
}

export type CreateAnimalResult = {
  animal: AnimalJsonDto;
  weightMeasurement?: Awaited<
    ReturnType<typeof createMeasurementFromCapture>
  >["measurement"];
  aiJob?: Awaited<ReturnType<typeof createMeasurementFromCapture>>["aiJob"];
};

export async function createAnimalForCustomer(
  customerProfileId: string,
  body: CreateAnimalBody,
): Promise<CreateAnimalResult> {
  const tag = body.tag?.trim();
  const namePart = body.name?.trim();
  const resolvedName = namePart || tag || "";

  let dateOfBirth: Date | undefined;
  if (body.dateOfBirth) {
    dateOfBirth = new Date(body.dateOfBirth);
  } else if (body.ageYears !== undefined) {
    dateOfBirth = approximateDobFromAgeYears(body.ageYears);
  }

  const category = body.category ?? categoryFromAnimalType(body.animalType);

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.animalProfile.create({
      data: {
        customerId: customerProfileId,
        name: resolvedName,
        species: speciesLabelFromAnimalType(body.animalType),
        category,
        animalType: body.animalType,
        breed: body.breed?.trim() || undefined,
        microchipOrTag: tag || undefined,
        dateOfBirth,
        sex: body.sex?.trim() || undefined,
        gender: body.gender,
        pregnancyStatus: body.pregnancyStatus,
        notes: body.notes?.trim() || undefined,
        photoUrl: body.photoUrl?.trim() || undefined,
        weightKg:
          body.weightCapture == null && body.weightKg !== undefined
            ? new Prisma.Decimal(body.weightKg.toFixed(3))
            : undefined,
      },
    });
    return created;
  });

  let weightResult:
    | Awaited<ReturnType<typeof createMeasurementFromCapture>>
    | undefined;

  if (body.weightCapture) {
    weightResult = await createMeasurementFromCapture(
      customerProfileId,
      row.id,
      body.animalType,
      body.weightCapture,
      AnimalWeightMeasurementSource.REGISTRATION,
    );
  }

  const refreshed = await prisma.animalProfile.findUniqueOrThrow({
    where: { id: row.id },
  });

  return {
    animal: toAnimalJsonDto(refreshed),
    weightMeasurement: weightResult?.measurement,
    aiJob: weightResult?.aiJob,
  };
}

export async function getAnimalForCustomer(
  customerProfileId: string,
  animalId: string,
): Promise<AnimalJsonDto | null> {
  const row = await prisma.animalProfile.findFirst({
    where: { id: animalId, customerId: customerProfileId },
  });
  return row ? toAnimalJsonDto(row) : null;
}

function buildPatchUpdateInput(body: PatchAnimalBody): Prisma.AnimalProfileUpdateInput {
  const data: Prisma.AnimalProfileUpdateInput = {};

  if (body.animalType !== undefined) {
    data.animalType = body.animalType;
    data.species = speciesLabelFromAnimalType(body.animalType);
    if (body.category === undefined) {
      data.category = categoryFromAnimalType(body.animalType);
    }
  }

  if (body.category !== undefined) {
    data.category = body.category;
  }

  if (body.name !== undefined) {
    data.name = body.name.trim();
  }

  if (body.tag !== undefined) {
    data.microchipOrTag =
      body.tag === null || body.tag.trim() === ""
        ? null
        : body.tag.trim();
  }

  if (body.breed !== undefined) {
    data.breed = body.breed;
  }

  if (body.dateOfBirth !== undefined) {
    if (body.dateOfBirth === null || body.dateOfBirth.trim() === "") {
      data.dateOfBirth = null;
    } else {
      data.dateOfBirth = new Date(body.dateOfBirth);
    }
  }

  if (body.ageYears !== undefined) {
    if (body.ageYears === null) {
      data.dateOfBirth = null;
    } else {
      data.dateOfBirth = approximateDobFromAgeYears(body.ageYears);
    }
  }

  if (body.sex !== undefined) {
    data.sex = body.sex;
  }

  if (body.gender !== undefined) {
    data.gender = body.gender;
  }

  if (body.pregnancyStatus !== undefined) {
    data.pregnancyStatus = body.pregnancyStatus;
  }

  if (body.notes !== undefined) {
    data.notes = body.notes;
  }

  if (body.photoUrl !== undefined) {
    data.photoUrl =
      body.photoUrl === null || body.photoUrl === ""
        ? null
        : body.photoUrl.trim();
  }

  if (body.weightKg !== undefined && body.weightCapture === undefined) {
    data.weightKg =
      body.weightKg === null
        ? null
        : new Prisma.Decimal(body.weightKg.toFixed(3));
  }

  if (body.active !== undefined) {
    data.active = body.active;
  }

  return data;
}

export async function patchAnimalForCustomer(
  customerProfileId: string,
  animalId: string,
  body: PatchAnimalBody,
): Promise<AnimalJsonDto | null> {
  const existing = await prisma.animalProfile.findFirst({
    where: { id: animalId, customerId: customerProfileId },
  });
  if (!existing) return null;

  if (body.weightCapture) {
    await createMeasurementFromCapture(
      customerProfileId,
      animalId,
      existing.animalType,
      body.weightCapture,
      AnimalWeightMeasurementSource.ANIMAL_DETAIL,
    );
  }

  const data = buildPatchUpdateInput(body);
  if (Object.keys(data).length === 0) {
    const refreshed = await prisma.animalProfile.findUniqueOrThrow({
      where: { id: animalId },
    });
    return toAnimalJsonDto(refreshed);
  }

  const row = await prisma.animalProfile.update({
    where: { id: animalId },
    data,
  });
  return toAnimalJsonDto(row);
}

export async function deactivateAnimalForCustomer(
  customerProfileId: string,
  animalId: string,
): Promise<AnimalJsonDto | null> {
  const existing = await prisma.animalProfile.findFirst({
    where: { id: animalId, customerId: customerProfileId },
  });
  if (!existing) return null;

  const row = await prisma.animalProfile.update({
    where: { id: animalId },
    data: { active: false },
  });
  return toAnimalJsonDto(row);
}
