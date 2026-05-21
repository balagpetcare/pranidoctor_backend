import { AnimalType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { CreateLivestockBreedBody, PatchLivestockBreedBody } from "./schemas";

export async function adminListLivestockBreeds(params: {
  q?: string;
  animalType?: AnimalType;
  isActive?: boolean;
  limit: number;
  offset: number;
}) {
  const where: Prisma.LivestockBreedWhereInput = {};
  if (params.isActive !== undefined) where.isActive = params.isActive;
  if (params.animalType) where.animalType = params.animalType;
  if (params.q?.trim()) {
    const q = params.q.trim();
    where.OR = [
      { nameEn: { contains: q, mode: "insensitive" } },
      { nameBn: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.livestockBreed.count({ where }),
    prisma.livestockBreed.findMany({
      where,
      orderBy: [{ nameEn: "asc" }],
      take: params.limit,
      skip: params.offset,
    }),
  ]);
  return { total, breeds: rows.map(serializeBreed) };
}

function serializeBreed(row: { id: string; slug: string; nameEn: string; nameBn: string; animalType: string; description: string | null; isActive: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    id: row.id,
    slug: row.slug,
    nameEn: row.nameEn,
    nameBn: row.nameBn,
    animalType: row.animalType,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function adminGetLivestockBreed(id: string) {
  const row = await prisma.livestockBreed.findUnique({ where: { id } });
  if (!row) return null;
  return serializeBreed(row);
}

export async function adminCreateLivestockBreed(body: CreateLivestockBreedBody) {
  const row = await prisma.livestockBreed.create({
    data: {
      slug: body.slug.trim().toLowerCase(),
      nameEn: body.nameEn.trim(),
      nameBn: body.nameBn.trim(),
      animalType: body.animalType,
      description: body.description?.trim() || null,
      isActive: body.isActive ?? true,
    },
  });
  return serializeBreed(row);
}

export async function adminPatchLivestockBreed(id: string, body: PatchLivestockBreedBody) {
  const existing = await prisma.livestockBreed.findUnique({ where: { id } });
  if (!existing) return null;
  const data: Prisma.LivestockBreedUpdateInput = {};
  if (body.slug !== undefined) data.slug = body.slug.trim().toLowerCase();
  if (body.nameEn !== undefined) data.nameEn = body.nameEn.trim();
  if (body.nameBn !== undefined) data.nameBn = body.nameBn.trim();
  if (body.animalType !== undefined) data.animalType = body.animalType;
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  const row = await prisma.livestockBreed.update({ where: { id }, data });
  return serializeBreed(row);
}
