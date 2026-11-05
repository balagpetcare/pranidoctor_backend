import { z } from "zod";

import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { getAncestorIds, getDescendantIds } from "@/lib/admin-areas/tree";
import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { AreaType } from "@/generated/prisma/client";

const AREA_TYPES = [
  AreaType.DIVISION,
  AreaType.DISTRICT,
  AreaType.UPAZILA,
  AreaType.UNION,
  AreaType.VILLAGE,
  AreaType.SERVICE_AREA,
] as const;

const bodySchema = z
  .object({
    /** Explicit selection (checked rows). Mutually exclusive with scopeId. */
    ids: z.array(z.string().min(1).max(40)).min(1).max(5000).optional(),
    /** Whole subtree under this area (e.g. a district → all upazilas/unions/villages). */
    scopeId: z.string().min(1).max(40).optional(),
    /** With scopeId: also change the scope area itself (default true). */
    includeSelf: z.boolean().optional(),
    /** Limit to these levels (e.g. only UNION). */
    types: z.array(z.enum(AREA_TYPES)).min(1).optional(),
    patch: z
      .object({
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
      .strict()
      .refine((p) => Object.keys(p).length > 0, "patch must change at least one field"),
    /** When activating, also activate every ancestor so the tree stays reachable (default true). */
    activateAncestors: z.boolean().optional(),
    /** Report what would change without writing. */
    dryRun: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Boolean(b.ids) !== Boolean(b.scopeId), "Provide exactly one of ids or scopeId");

type TypeCounts = Record<string, number>;

function countByType(rows: Array<{ type: string }>): TypeCounts {
  const out: TypeCounts = {};
  for (const r of rows) out[r.type] = (out[r.type] ?? 0) + 1;
  return out;
}

const CHUNK = 5000;

/** POST — bulk status/order change for checked rows or an entire district/upazila/union subtree. */
export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid bulk payload", 422, parsed.error.flatten());
  }
  const body = parsed.data;

  try {
    let targetIds: string[];

    if (body.scopeId) {
      const root = await prisma.area.findUnique({ where: { id: body.scopeId }, select: { id: true } });
      if (!root) return jsonError("NOT_FOUND", "Scope area not found", 404);
      const descendants = await getDescendantIds(prisma, body.scopeId);
      targetIds = body.includeSelf === false ? descendants : [body.scopeId, ...descendants];
    } else {
      targetIds = [...new Set(body.ids ?? [])];
    }

    const rows: Array<{ id: string; type: string; isActive: boolean; sortOrder: number }> = [];
    for (let i = 0; i < targetIds.length; i += CHUNK) {
      rows.push(
        ...(await prisma.area.findMany({
          where: {
            id: { in: targetIds.slice(i, i + CHUNK) },
            ...(body.types ? { type: { in: body.types } } : {}),
          },
          select: { id: true, type: true, isActive: true, sortOrder: true },
        })),
      );
    }

    const wantActive = body.patch.isActive;
    const wantSort = body.patch.sortOrder;
    const changing = rows.filter(
      (r) =>
        (wantActive !== undefined && r.isActive !== wantActive) ||
        (wantSort !== undefined && r.sortOrder !== wantSort),
    );

    let ancestorIdsToActivate: string[] = [];
    if (wantActive === true && body.activateAncestors !== false && rows.length > 0) {
      const ancestorIds = await getAncestorIds(
        prisma,
        rows.map((r) => r.id),
      );
      if (ancestorIds.length > 0) {
        const inactiveAncestors = await prisma.area.findMany({
          where: { id: { in: ancestorIds }, isActive: false },
          select: { id: true },
        });
        ancestorIdsToActivate = inactiveAncestors.map((a) => a.id);
      }
    }

    const summary = {
      matched: rows.length,
      willChange: changing.length,
      ancestorsToActivate: ancestorIdsToActivate.length,
      byType: countByType(rows),
      changingByType: countByType(changing),
    };

    if (body.dryRun) {
      return jsonOk({ dryRun: true, ...summary });
    }

    const changeIds = changing.map((r) => r.id);
    await prisma.$transaction(async (tx) => {
      const data = {
        ...(wantActive !== undefined ? { isActive: wantActive } : {}),
        ...(wantSort !== undefined ? { sortOrder: wantSort } : {}),
      };
      for (let i = 0; i < changeIds.length; i += CHUNK) {
        await tx.area.updateMany({ where: { id: { in: changeIds.slice(i, i + CHUNK) } }, data });
      }
      for (let i = 0; i < ancestorIdsToActivate.length; i += CHUNK) {
        await tx.area.updateMany({
          where: { id: { in: ancestorIdsToActivate.slice(i, i + CHUNK) } },
          data: { isActive: true },
        });
      }
    });

    return jsonOk({ dryRun: false, ...summary, updated: changeIds.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk update failed";
    return jsonError("AREA_BULK_FAILED", message, 500);
  }
}
