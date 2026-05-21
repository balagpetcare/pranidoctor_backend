import type { PrismaClient } from "@/generated/prisma/client";
import { AreaType } from "@/generated/prisma/client";

export function validateAreaParentPair(
  childType: AreaType,
  parent: { type: AreaType } | null,
): { ok: true } | { ok: false; message: string } {
  if (childType === AreaType.DIVISION) {
    if (!parent) return { ok: true };
    if (parent.type === AreaType.DIVISION) return { ok: true };
    return {
      ok: false,
      message:
        "DIVISION areas must have no parent or a DIVISION parent (e.g. country → division).",
    };
  }

  if (!parent) {
    return {
      ok: false,
      message: `${childType} requires a parent area.`,
    };
  }

  switch (childType) {
    case AreaType.DISTRICT:
      if (parent.type !== AreaType.DIVISION) {
        return {
          ok: false,
          message: `DISTRICT must have a DIVISION parent (got ${parent.type}).`,
        };
      }
      break;
    case AreaType.UPAZILA:
      if (parent.type !== AreaType.DISTRICT) {
        return {
          ok: false,
          message: `UPAZILA must have a DISTRICT parent (got ${parent.type}).`,
        };
      }
      break;
    case AreaType.UNION:
      if (parent.type !== AreaType.UPAZILA) {
        return {
          ok: false,
          message: `UNION must have a UPAZILA parent (got ${parent.type}).`,
        };
      }
      break;
    case AreaType.VILLAGE:
      if (parent.type !== AreaType.UNION) {
        return {
          ok: false,
          message: `VILLAGE must have a UNION parent (got ${parent.type}).`,
        };
      }
      break;
    case AreaType.SERVICE_AREA:
      if (parent.type !== AreaType.VILLAGE) {
        return {
          ok: false,
          message: `SERVICE_AREA must have a VILLAGE parent (got ${parent.type}).`,
        };
      }
      break;
    default:
      return { ok: false, message: "Unsupported area type." };
  }

  return { ok: true };
}

export async function wouldAreaParentCreateCycle(
  db: PrismaClient,
  nodeId: string,
  newParentId: string,
): Promise<boolean> {
  let current: string | null = newParentId;
  const visited = new Set<string>();
  while (current) {
    if (current === nodeId) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    const parentRow: { parentId: string | null } | null = await db.area.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = parentRow?.parentId ?? null;
  }
  return false;
}
