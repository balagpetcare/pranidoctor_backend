import type { PrismaClient } from "@/generated/prisma/client";

/** Max frontier size per query — keeps the IN list well below Postgres' 32k bind limit. */
const CHUNK = 5000;

type AreaDb = Pick<PrismaClient, "area">;

/**
 * All descendant area ids of `rootId` (breadth-first). Hierarchy is at most ~6 levels deep,
 * so this is a handful of indexed `parentId IN (...)` queries.
 */
export async function getDescendantIds(prisma: AreaDb, rootId: string): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>([rootId]);
  let frontier = [rootId];

  while (frontier.length > 0) {
    const next: string[] = [];
    for (let i = 0; i < frontier.length; i += CHUNK) {
      const rows = await prisma.area.findMany({
        where: { parentId: { in: frontier.slice(i, i + CHUNK) } },
        select: { id: true },
      });
      for (const r of rows) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          out.push(r.id);
          next.push(r.id);
        }
      }
    }
    frontier = next;
  }
  return out;
}

/** Ancestor ids for every id in `ids`, excluding the ids themselves. */
export async function getAncestorIds(prisma: AreaDb, ids: readonly string[]): Promise<string[]> {
  const own = new Set(ids);
  const out = new Set<string>();
  let frontier = [...own];

  while (frontier.length > 0) {
    const parents = new Set<string>();
    for (let i = 0; i < frontier.length; i += CHUNK) {
      const rows = await prisma.area.findMany({
        where: { id: { in: frontier.slice(i, i + CHUNK) }, parentId: { not: null } },
        select: { parentId: true },
      });
      for (const r of rows) {
        if (r.parentId && !own.has(r.parentId) && !out.has(r.parentId)) {
          parents.add(r.parentId);
        }
      }
    }
    for (const p of parents) out.add(p);
    frontier = [...parents];
  }
  return [...out];
}

export type AncestorSummary = {
  id: string;
  name: string;
  nameBn: string | null;
  type: string;
  isActive: boolean;
};

/** Ancestor chain for a single area, top-down (division first). */
export async function getAncestorChain(prisma: AreaDb, areaId: string): Promise<AncestorSummary[]> {
  const chain: AncestorSummary[] = [];
  const seen = new Set<string>([areaId]);
  let parentId = (await prisma.area.findUnique({ where: { id: areaId }, select: { parentId: true } }))?.parentId ?? null;

  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = await prisma.area.findUnique({
      where: { id: parentId },
      select: { id: true, name: true, nameBn: true, type: true, isActive: true, parentId: true },
    });
    if (!parent) break;
    chain.unshift({
      id: parent.id,
      name: parent.name,
      nameBn: parent.nameBn,
      type: parent.type,
      isActive: parent.isActive,
    });
    parentId = parent.parentId;
  }
  return chain;
}
