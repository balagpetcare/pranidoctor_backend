import { z } from "zod";

import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  validateAreaParentPair,
  wouldAreaParentCreateCycle,
} from "@/lib/admin-areas/parent-validation";
import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { AreaType, Prisma } from "@/generated/prisma/client";

const AREA_TYPES = [
  AreaType.DIVISION,
  AreaType.DISTRICT,
  AreaType.UPAZILA,
  AreaType.UNION,
  AreaType.VILLAGE,
  AreaType.SERVICE_AREA,
] as const;

const areaTypeSchema = z.enum(AREA_TYPES);

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens");

const patchBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    nameBn: z.union([z.string().trim().max(200), z.null()]).optional(),
    slug: slugSchema.optional(),
    code: z.union([z.string().trim().max(48), z.null()]).optional(),
    type: areaTypeSchema.optional(),
    parentId: z.union([z.string().min(1).max(40), z.null()]).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    metadataJson: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
  })
  .strict();

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  try {
    const area = await prisma.area.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            nameBn: true,
            slug: true,
            type: true,
            isActive: true,
          },
        },
        _count: { select: { children: true } },
      },
    });

    if (!area) {
      return jsonError("NOT_FOUND", "Area not found", 404);
    }

    return jsonOk({ area });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load area", 500);
  }
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid area payload",
      422,
      parsed.error.flatten(),
    );
  }

  const body = parsed.data;
  if (Object.keys(body).length === 0) {
    return jsonError("VALIDATION_ERROR", "No fields to update", 422);
  }

  const existing = await prisma.area.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      parentId: true,
    },
  });

  if (!existing) {
    return jsonError("NOT_FOUND", "Area not found", 404);
  }

  const nextType = body.type ?? existing.type;
  const nextParentId =
    body.parentId !== undefined ? body.parentId : existing.parentId;

  if (nextParentId === id) {
    return jsonError(
      "INVALID_PARENT",
      "An area cannot be its own parent",
      422,
    );
  }

  if (nextParentId !== null) {
    const cycle = await wouldAreaParentCreateCycle(prisma, id, nextParentId);
    if (cycle) {
      return jsonError(
        "INVALID_PARENT",
        "Parent assignment would create a circular hierarchy",
        422,
      );
    }
  }

  const parent =
    nextParentId === null
      ? null
      : await prisma.area.findUnique({
          where: { id: nextParentId },
          select: { id: true, type: true },
        });

  if (nextParentId !== null && !parent) {
    return jsonError("INVALID_PARENT", "Parent area not found", 422);
  }

  const rule = validateAreaParentPair(nextType, parent);
  if (!rule.ok) {
    return jsonError("INVALID_HIERARCHY", rule.message, 422);
  }

  const data: Prisma.AreaUpdateInput = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.nameBn !== undefined) data.nameBn = body.nameBn;
  if (body.slug !== undefined) data.slug = body.slug;
  if (body.code !== undefined) data.code = body.code;
  if (body.type !== undefined) data.type = body.type;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  if (body.parentId !== undefined) {
    data.parent =
      nextParentId === null
        ? { disconnect: true }
        : { connect: { id: nextParentId } };
  }

  if (body.metadataJson !== undefined) {
    data.metadataJson =
      body.metadataJson === null
        ? Prisma.JsonNull
        : (body.metadataJson as Prisma.InputJsonValue);
  }

  try {
    const updated = await prisma.area.update({
      where: { id },
      data,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            nameBn: true,
            slug: true,
            type: true,
            isActive: true,
          },
        },
        _count: { select: { children: true } },
      },
    });

    return jsonOk({ area: updated });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return jsonError(
        "DUPLICATE_SLUG",
        "An area with this slug already exists",
        409,
      );
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return jsonError("NOT_FOUND", "Area not found", 404);
    }
    throw e;
  }
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await ctx.params;

  try {
    const updated = await prisma.area.update({
      where: { id },
      data: { isActive: false },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            nameBn: true,
            slug: true,
            type: true,
            isActive: true,
          },
        },
        _count: { select: { children: true } },
      },
    });

    return jsonOk({
      area: updated,
      deactivated: true as const,
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return jsonError("NOT_FOUND", "Area not found", 404);
    }
    throw e;
  }
}
