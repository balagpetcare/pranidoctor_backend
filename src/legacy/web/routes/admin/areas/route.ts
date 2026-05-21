import { z } from "zod";

import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { validateAreaParentPair } from "@/lib/admin-areas/parent-validation";
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

const postBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  nameBn: z.union([z.string().trim().max(200), z.null()]).optional(),
  slug: slugSchema,
  code: z.union([z.string().trim().max(48), z.null()]).optional(),
  type: areaTypeSchema,
  parentId: z.union([z.string().min(1).max(40), z.null()]).optional(),
  sortOrder: z.number().int().optional(),
  metadataJson: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
});

function parseBoolParam(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const typeRaw = url.searchParams.get("type");
  const isActive = parseBoolParam(url.searchParams.get("isActive"));

  let typeFilter: AreaType | undefined;
  if (typeRaw) {
    const t = areaTypeSchema.safeParse(typeRaw);
    if (!t.success) {
      return jsonError(
        "VALIDATION_ERROR",
        "Invalid type filter",
        422,
        t.error.flatten(),
      );
    }
    typeFilter = t.data;
  }

  const where: Prisma.AreaWhereInput = {};

  const filters: Prisma.AreaWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { nameBn: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (typeFilter) {
    filters.push({ type: typeFilter });
  }

  if (url.searchParams.has("parentId")) {
    const p = url.searchParams.get("parentId") ?? "";
    if (p === "" || p === "__root__") {
      filters.push({ parentId: null });
    } else {
      filters.push({ parentId: p });
    }
  }

  if (isActive !== undefined) {
    filters.push({ isActive });
  }

  if (filters.length > 0) {
    where.AND = filters;
  }

  let limit = Number(url.searchParams.get("limit") ?? "100");
  if (!Number.isFinite(limit)) limit = 100;
  limit = Math.min(Math.max(Math.trunc(limit), 1), 500);

  let offset = Number(url.searchParams.get("offset") ?? "0");
  if (!Number.isFinite(offset)) offset = 0;
  offset = Math.max(Math.trunc(offset), 0);

  try {
    const [total, areas] = await prisma.$transaction([
      prisma.area.count({ where }),
      prisma.area.findMany({
        where,
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
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: limit,
        skip: offset,
      }),
    ]);

    return jsonOk({
      areas,
      meta: { total, limit, offset },
    });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load areas", 500);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid area payload",
      422,
      parsed.error.flatten(),
    );
  }

  const body = parsed.data;
  const parentId =
    body.parentId === undefined ? null : body.parentId;

  const parent =
    parentId === null
      ? null
      : await prisma.area.findUnique({
          where: { id: parentId },
          select: { id: true, type: true },
        });

  if (parentId !== null && !parent) {
    return jsonError("INVALID_PARENT", "Parent area not found", 422);
  }

  const rule = validateAreaParentPair(body.type, parent);
  if (!rule.ok) {
    return jsonError("INVALID_HIERARCHY", rule.message, 422);
  }

  try {
    const created = await prisma.area.create({
      data: {
        name: body.name,
        nameBn: body.nameBn === undefined ? undefined : body.nameBn,
        slug: body.slug,
        code: body.code === undefined ? undefined : body.code,
        type: body.type,
        parentId,
        sortOrder: body.sortOrder ?? undefined,
        metadataJson:
          body.metadataJson === undefined
            ? undefined
            : body.metadataJson === null
              ? Prisma.JsonNull
              : (body.metadataJson as Prisma.InputJsonValue),
      },
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

    return jsonOk({ area: created }, { status: 201 });
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
    throw e;
  }
}
