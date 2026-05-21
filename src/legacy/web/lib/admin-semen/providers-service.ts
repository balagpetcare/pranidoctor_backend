import { Prisma, UploadedFileStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { CreateSemenProviderBody, PatchSemenProviderBody } from "./schemas";

export async function adminListSemenProviders(params: {
  q?: string;
  isActive?: boolean;
  limit: number;
  offset: number;
}) {
  const where: Prisma.SemenProviderWhereInput = {};
  if (params.isActive !== undefined) where.isActive = params.isActive;
  if (params.q?.trim()) {
    const q = params.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { nameBn: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.semenProvider.count({ where }),
    prisma.semenProvider.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: params.limit,
      skip: params.offset,
      include: { logoUploadedFile: { select: { id: true, mimeType: true } } },
    }),
  ]);
  return { total, providers: rows.map(serializeProvider) };
}

function serializeProvider(
  row: Prisma.SemenProviderGetPayload<{
    include: { logoUploadedFile: { select: { id: true; mimeType: true } } };
  }>,
) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameBn: row.nameBn,
    description: row.description,
    descriptionBn: row.descriptionBn,
    logoUploadedFileId: row.logoUploadedFileId,
    logoMimeType: row.logoUploadedFile?.mimeType ?? null,
    isActive: row.isActive,
    verificationStatus: row.verificationStatus,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function adminGetSemenProvider(id: string) {
  const row = await prisma.semenProvider.findUnique({
    where: { id },
    include: { logoUploadedFile: { select: { id: true, mimeType: true } } },
  });
  if (!row) return null;
  return serializeProvider(row);
}

export async function adminCreateSemenProvider(body: CreateSemenProviderBody) {
  if (body.logoUploadedFileId) {
    const f = await prisma.uploadedFile.findFirst({
      where: { id: body.logoUploadedFileId, status: UploadedFileStatus.ACTIVE },
      select: { id: true },
    });
    if (!f) {
      throw new Error("LOGO_FILE_NOT_FOUND");
    }
  }
  const row = await prisma.semenProvider.create({
    data: {
      slug: body.slug.trim().toLowerCase(),
      name: body.name.trim(),
      nameBn: body.nameBn?.trim() || null,
      description: body.description?.trim() || null,
      descriptionBn: body.descriptionBn?.trim() || null,
      logoUploadedFileId: body.logoUploadedFileId?.trim() || null,
      isActive: body.isActive ?? true,
      verificationStatus: body.verificationStatus,
      sortOrder: body.sortOrder ?? 0,
    },
    include: { logoUploadedFile: { select: { id: true, mimeType: true } } },
  });
  return serializeProvider(row);
}

export async function adminPatchSemenProvider(id: string, body: PatchSemenProviderBody) {
  const existing = await prisma.semenProvider.findUnique({ where: { id } });
  if (!existing) return null;
  if (body.logoUploadedFileId) {
    const f = await prisma.uploadedFile.findFirst({
      where: { id: body.logoUploadedFileId, status: UploadedFileStatus.ACTIVE },
      select: { id: true },
    });
    if (!f) throw new Error("LOGO_FILE_NOT_FOUND");
  }
  const data: Prisma.SemenProviderUpdateInput = {};
  if (body.slug !== undefined) data.slug = body.slug.trim().toLowerCase();
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.nameBn !== undefined) data.nameBn = body.nameBn?.trim() || null;
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.descriptionBn !== undefined) data.descriptionBn = body.descriptionBn?.trim() || null;
  if (body.logoUploadedFileId !== undefined) {
    if (body.logoUploadedFileId?.trim()) {
      data.logoUploadedFile = { connect: { id: body.logoUploadedFileId.trim() } };
    } else {
      data.logoUploadedFile = { disconnect: true };
    }
  }
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.verificationStatus !== undefined) data.verificationStatus = body.verificationStatus;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  const row = await prisma.semenProvider.update({
    where: { id },
    data,
    include: { logoUploadedFile: { select: { id: true, mimeType: true } } },
  });
  return serializeProvider(row);
}
