import { Prisma } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import type { AreaContext } from './discovery.areas.js';
import { HOME_VISIT_CATEGORY_SLUGS, PRESENCE_STALE_SECONDS } from './discovery.constants.js';
import type { ProviderRow } from './discovery.mapper.js';
import type { ProviderFilters, ProviderKindName, ProviderSort } from './discovery.types.js';

/**
 * Every identifier below is a compile-time constant. User input only ever reaches the database
 * as bound parameters (Prisma.sql tagged templates) — never concatenated into SQL text.
 */
interface KindSpec {
  table: Prisma.Sql;
  areaTable: Prisma.Sql;
  fk: Prisma.Sql;
  columns: Prisma.Sql;
  extraWhere: Prisma.Sql;
}

const homeSlugs = [...HOME_VISIT_CATEGORY_SLUGS];

function specFor(kind: ProviderKindName): KindSpec {
  switch (kind) {
    case 'DOCTOR':
      return {
        table: Prisma.raw('"DoctorProfile"'),
        areaTable: Prisma.raw('"DoctorProfileArea"'),
        fk: Prisma.raw('"doctorId"'),
        extraWhere: Prisma.sql`TRUE`,
        columns: Prisma.sql`
          d."displayName" AS name,
          COALESCE(NULLIF(d.degree, ''), d.specialization) AS subtitle,
          d."profilePhotoUrl" AS photo,
          d."licenseNumber" AS reg_no,
          (d."verifiedAt" IS NOT NULL) AS verified,
          d."experienceYears" AS exp,
          d."ratingAvg"::float8 AS rating_avg,
          d."ratingCount"::int AS rating_count,
          d."visitFeeBdt"::float8 AS fee_visit,
          d."emergencyFeeBdt"::float8 AS fee_emergency,
          d."onlineFeeBdt"::float8 AS fee_online,
          NULL::float8 AS fee_service,
          d."acceptsEmergency" AS accepts_emergency,
          d."acceptsOnlineConsultation" AS accepts_online,
          EXISTS (
            SELECT 1 FROM "DoctorProfileServiceCategory" dc
            JOIN "ServiceCategory" sc ON sc.id = dc."serviceCategoryId"
            WHERE dc."doctorId" = d.id AND sc.slug = ANY(${homeSlugs}::text[])
          ) AS accepts_home_visit,
          d."speciesFocus" AS tags,
          d.bio AS bio`,
      };
    case 'AI_TECHNICIAN':
      return {
        table: Prisma.raw('"AiTechnicianProfile"'),
        areaTable: Prisma.raw('"AiTechnicianProfileArea"'),
        fk: Prisma.raw('"aiTechnicianId"'),
        extraWhere: Prisma.sql`d.status::text IN ('APPROVED', 'PUBLISHED')`,
        columns: Prisma.sql`
          d."displayName" AS name,
          d.certification AS subtitle,
          NULL::text AS photo,
          d."certificateNumber" AS reg_no,
          (d."verifiedAt" IS NOT NULL) AS verified,
          d."experienceYears" AS exp,
          d."ratingAvg"::float8 AS rating_avg,
          d."ratingCount"::int AS rating_count,
          NULL::float8 AS fee_visit,
          NULL::float8 AS fee_emergency,
          NULL::float8 AS fee_online,
          d."serviceFeeBdt"::float8 AS fee_service,
          d."acceptsEmergency" AS accepts_emergency,
          FALSE AS accepts_online,
          TRUE AS accepts_home_visit,
          CASE WHEN jsonb_typeof(d."metadataJson"->'livestockFocus') = 'array'
               THEN ARRAY(SELECT jsonb_array_elements_text(d."metadataJson"->'livestockFocus'))
               ELSE ARRAY[]::text[] END AS tags,
          d.bio AS bio`,
      };
    case 'HEALTH_WORKER':
      return {
        table: Prisma.raw('"HealthWorkerProfile"'),
        areaTable: Prisma.raw('"HealthWorkerProfileArea"'),
        fk: Prisma.raw('"healthWorkerId"'),
        extraWhere: Prisma.sql`TRUE`,
        columns: Prisma.sql`
          d."displayName" AS name,
          d.certification AS subtitle,
          d."profilePhotoUrl" AS photo,
          NULL::text AS reg_no,
          (d."verifiedAt" IS NOT NULL) AS verified,
          d."experienceYears" AS exp,
          d."ratingAvg"::float8 AS rating_avg,
          d."ratingCount"::int AS rating_count,
          NULL::float8 AS fee_visit,
          NULL::float8 AS fee_emergency,
          NULL::float8 AS fee_online,
          d."serviceFeeBdt"::float8 AS fee_service,
          FALSE AS accepts_emergency,
          FALSE AS accepts_online,
          d."acceptsHomeVisit" AS accepts_home_visit,
          CASE WHEN jsonb_typeof(d."servicesJson"->'services') = 'array'
               THEN ARRAY(SELECT jsonb_array_elements_text(d."servicesJson"->'services'))
               ELSE ARRAY[]::text[] END AS tags,
          d.bio AS bio`,
      };
  }
}

const SORTS: Record<ProviderSort, Prisma.Sql> = {
  recommended: Prisma.sql`t.is_online DESC, t.match_rank ASC NULLS LAST, t.rating_avg DESC, t.rating_count DESC, t.id ASC`,
  rating: Prisma.sql`t.rating_avg DESC, t.rating_count DESC, t.match_rank ASC NULLS LAST, t.id ASC`,
  fee_low: Prisma.sql`COALESCE(t.fee_visit, t.fee_service, t.fee_online) ASC NULLS LAST, t.match_rank ASC NULLS LAST, t.id ASC`,
  experience: Prisma.sql`t.exp DESC NULLS LAST, t.match_rank ASC NULLS LAST, t.id ASC`,
};

interface BaseOptions {
  kind: ProviderKindName;
  area: AreaContext | null;
  /** true → only providers covering the area; false → rank only (detail view). */
  restrictToArea: boolean;
  idFilter?: string;
}

function baseQuery(opts: BaseOptions): Prisma.Sql {
  const spec = specFor(opts.kind);
  const kindLiteral = opts.kind; // one of three constants (validated by zod enum upstream)

  const rank = opts.area
    ? Prisma.sql`(
        SELECT MIN(CASE WHEN a."areaId" = ANY(${opts.area.exactIds}::text[]) THEN 0
                        ELSE array_position(${opts.area.ancestorIds}::text[], a."areaId") END)
        FROM ${spec.areaTable} a
        WHERE a.${spec.fk} = d.id AND a."areaId" = ANY(${opts.area.scopeIds}::text[])
      )`
    : Prisma.sql`0`;

  const areaFilter =
    opts.area && opts.restrictToArea
      ? Prisma.sql`AND d.id IN (
          SELECT a.${spec.fk} FROM ${spec.areaTable} a WHERE a."areaId" = ANY(${opts.area.scopeIds}::text[])
        )`
      : Prisma.empty;

  const idFilter = opts.idFilter ? Prisma.sql`AND d.id = ${opts.idFilter}` : Prisma.empty;

  return Prisma.sql`
    SELECT
      d.id AS id,
      ${spec.columns},
      COALESCE((
        SELECT p."isOnline" AND p."lastSeenAt" > now() - make_interval(secs => ${PRESENCE_STALE_SECONDS})
        FROM "ProviderPresence" p
        WHERE p.kind = ${kindLiteral}::"ProviderKind" AND p."providerId" = d.id
      ), false) AS is_online,
      ${rank}::int AS match_rank
    FROM ${spec.table} d
    WHERE d."providerStatus" = 'ACTIVE'
      AND ${spec.extraWhere}
      ${areaFilter}
      ${idFilter}`;
}

function filterConditions(filters: ProviderFilters, includeOnline: boolean): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  if (filters.species) conds.push(Prisma.sql`${filters.species} = ANY(t.tags)`);
  if (filters.emergencyOnly) conds.push(Prisma.sql`t.accepts_emergency = true`);
  if (filters.homeVisitOnly) conds.push(Prisma.sql`t.accepts_home_visit = true`);
  if (includeOnline && filters.onlineOnly) conds.push(Prisma.sql`t.is_online = true`);
  return conds.length > 0 ? Prisma.join(conds, ' AND ') : Prisma.sql`TRUE`;
}

export interface ListArgs {
  filters: ProviderFilters;
  area: AreaContext | null;
  sort: ProviderSort;
  page: number;
  limit: number;
}

export class DiscoveryRepository {
  async listProviders(args: ListArgs): Promise<{ rows: ProviderRow[]; total: number }> {
    const prisma = getPrisma();
    const offset = (args.page - 1) * args.limit;
    const base = baseQuery({ kind: args.filters.kind, area: args.area, restrictToArea: true });

    const rows = await prisma.$queryRaw<ProviderRow[]>(Prisma.sql`
      SELECT t.*, (COUNT(*) OVER())::int AS total
      FROM (${base}) t
      WHERE ${filterConditions(args.filters, true)}
      ORDER BY ${SORTS[args.sort]}
      LIMIT ${args.limit} OFFSET ${offset}`);

    const first = rows[0];
    return { rows, total: first?.total !== undefined && first.total !== null ? Number(first.total) : 0 };
  }

  /** total = matching providers; online = those currently online (ignores the online filter itself). */
  async countProviders(
    filters: ProviderFilters,
    area: AreaContext | null,
  ): Promise<{ total: number; online: number }> {
    const prisma = getPrisma();
    const base = baseQuery({ kind: filters.kind, area, restrictToArea: true });
    const result = await prisma.$queryRaw<Array<{ total: number; online: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE t.is_online))::int AS online
      FROM (${base}) t
      WHERE ${filterConditions(filters, false)}`);
    return result[0] ?? { total: 0, online: 0 };
  }

  async findProvider(
    kind: ProviderKindName,
    id: string,
    area: AreaContext | null,
  ): Promise<ProviderRow | null> {
    const prisma = getPrisma();
    const base = baseQuery({ kind, area, restrictToArea: false, idFilter: id });
    const rows = await prisma.$queryRaw<ProviderRow[]>(Prisma.sql`SELECT t.* FROM (${base}) t LIMIT 1`);
    return rows[0] ?? null;
  }

  async coverageAreas(
    kind: ProviderKindName,
    id: string,
  ): Promise<Array<{ id: string; name: string; nameBn: string | null; type: string }>> {
    const prisma = getPrisma();
    const spec = specFor(kind);
    return prisma.$queryRaw(Prisma.sql`
      SELECT ar.id, ar.name, ar."nameBn", ar.type::text AS type
      FROM ${spec.areaTable} a
      JOIN "Area" ar ON ar.id = a."areaId"
      WHERE a.${spec.fk} = ${id} AND ar."isActive" = true
      ORDER BY a.priority ASC NULLS LAST, ar.name ASC
      LIMIT 20`);
  }

  /** Resolve the provider profiles owned by a user (a user may hold more than one). */
  async profilesForUser(userId: string): Promise<Array<{ kind: ProviderKindName; id: string; active: boolean }>> {
    const prisma = getPrisma();
    const [doctor, tech, worker] = await Promise.all([
      prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
      prisma.aiTechnicianProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
      prisma.healthWorkerProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
    ]);
    const out: Array<{ kind: ProviderKindName; id: string; active: boolean }> = [];
    if (doctor) out.push({ kind: 'DOCTOR', id: doctor.id, active: doctor.providerStatus === 'ACTIVE' });
    if (tech) out.push({ kind: 'AI_TECHNICIAN', id: tech.id, active: tech.providerStatus === 'ACTIVE' });
    if (worker) out.push({ kind: 'HEALTH_WORKER', id: worker.id, active: worker.providerStatus === 'ACTIVE' });
    return out;
  }

  async upsertPresence(kind: ProviderKindName, providerId: string, isOnline: boolean): Promise<void> {
    const prisma = getPrisma();
    await prisma.providerPresence.upsert({
      where: { kind_providerId: { kind, providerId } },
      create: { kind, providerId, isOnline, lastSeenAt: new Date() },
      update: { isOnline, lastSeenAt: new Date() },
    });
  }
}
