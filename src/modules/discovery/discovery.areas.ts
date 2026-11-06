import { Prisma } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import { cachedFetch, discoveryCacheKey } from './discovery.cache.js';
import { DISCOVERY_CACHE_TTL, DISCOVERY_LIMITS } from './discovery.constants.js';
import type { AreaMatch } from './discovery.types.js';

export interface AreaContext {
  id: string;
  name: string;
  nameBn: string | null;
  type: string;
  /** Parent chain, nearest first (excludes the area itself). */
  ancestorIds: string[];
  ancestorTypes: string[];
  /** The area itself plus its descendants (villages excluded). A provider covering any of these is an exact match. */
  exactIds: string[];
  /** exactIds ∪ ancestorIds — every area whose providers can serve this location. */
  scopeIds: string[];
}

interface AncestorRow {
  id: string;
  name: string;
  nameBn: string | null;
  type: string;
  depth: number;
}

/** Pure: translate a coverage rank (0 = exact, n = n-th ancestor) to a label. */
export function matchFromRank(rank: number | null, ancestorTypes: readonly string[]): AreaMatch {
  if (rank === null || rank === undefined) return 'REGION';
  if (rank <= 0) return 'EXACT';
  const type = ancestorTypes[rank - 1];
  if (type === 'UNION' || type === 'UPAZILA') return 'NEAR';
  if (type === 'DISTRICT') return 'DISTRICT';
  return 'REGION';
}

async function loadAreaContext(areaId: string): Promise<AreaContext | null> {
  const prisma = getPrisma();

  const [ancestors, descendants] = await Promise.all([
    prisma.$queryRaw<AncestorRow[]>(Prisma.sql`
      WITH RECURSIVE up AS (
        SELECT a.id, a.name, a."nameBn", a.type::text AS type, a."parentId", 0 AS depth
        FROM "Area" a
        WHERE a.id = ${areaId} AND a."isActive" = true
        UNION ALL
        SELECT p.id, p.name, p."nameBn", p.type::text, p."parentId", up.depth + 1
        FROM "Area" p
        JOIN up ON p.id = up."parentId"
        WHERE p."isActive" = true AND up.depth < 8
      )
      SELECT id, name, "nameBn", type, depth FROM up ORDER BY depth ASC
    `),
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH RECURSIVE down AS (
        SELECT a.id, 0 AS depth
        FROM "Area" a
        WHERE a.id = ${areaId} AND a."isActive" = true
        UNION ALL
        SELECT c.id, down.depth + 1
        FROM "Area" c
        JOIN down ON c."parentId" = down.id
        WHERE c."isActive" = true AND c.type::text <> 'VILLAGE' AND down.depth < 6
      )
      SELECT id FROM down LIMIT ${DISCOVERY_LIMITS.maxScopeAreas}
    `),
  ]);

  const self = ancestors[0];
  if (!self || self.id !== areaId) return null;

  const rest = ancestors.slice(1);
  const exactIds = descendants.map((r) => r.id);
  const ancestorIds = rest.map((r) => r.id);

  return {
    id: self.id,
    name: self.name,
    nameBn: self.nameBn,
    type: self.type,
    ancestorIds,
    ancestorTypes: rest.map((r) => r.type),
    exactIds,
    scopeIds: [...new Set([...exactIds, ...ancestorIds])],
  };
}

/** Area tree changes rarely → cache the resolved context (also guards the recursive CTEs). */
export async function resolveAreaContext(areaId: string): Promise<AreaContext | null> {
  return cachedFetch<AreaContext | null>(
    discoveryCacheKey('area', areaId),
    DISCOVERY_CACHE_TTL.area,
    () => loadAreaContext(areaId),
  );
}
