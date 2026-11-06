import { ForbiddenError, NotFoundError } from '../../shared/errors/index.js';
import type { ModuleService } from '../../shared/module/module.types.js';

import { resolveAreaContext, type AreaContext } from './discovery.areas.js';
import { cachedFetch, discoveryCacheKey } from './discovery.cache.js';
import { DISCOVERY_CACHE_TTL, HUB_CATEGORIES, HUB_CATEGORY_BY_KEY } from './discovery.constants.js';
import { mapProviderRow } from './discovery.mapper.js';
import { listPublicOfferings } from './discovery.offerings.js';
import type { DiscoveryRepository } from './discovery.repository.js';
import type {
  HubResult,
  ProviderDetail,
  ProviderFilters,
  ProviderKindName,
  ProviderListResult,
} from './discovery.types.js';
import type { ProviderListQuery } from './discovery.validator.js';

async function requireArea(areaId: string | undefined): Promise<AreaContext | null> {
  if (!areaId) return null;
  const area = await resolveAreaContext(areaId);
  if (!area) throw new NotFoundError('AREA_NOT_FOUND', 'The selected area does not exist or is inactive');
  return area;
}

function filtersFromQuery(q: ProviderListQuery): ProviderFilters {
  const def = q.category ? HUB_CATEGORY_BY_KEY.get(q.category) : undefined;
  const kind = def?.kind ?? q.kind;
  if (!kind) {
    // Unreachable: the validator guarantees category or kind.
    throw new NotFoundError('CATEGORY_NOT_FOUND', 'Unknown service category');
  }
  return {
    kind,
    species: def?.species,
    emergencyOnly: def?.emergencyOnly === true || q.emergency === true,
    homeVisitOnly: def?.homeVisitOnly === true || q.homeVisit === true,
    onlineOnly: q.online === true,
  };
}

export class DiscoveryService implements ModuleService {
  readonly name = 'discovery-service';

  constructor(private readonly repository: DiscoveryRepository) {}

  /** Service-hub tiles with live counts for the user's area. Cached 60s per area. */
  async getHub(areaId: string | undefined): Promise<HubResult> {
    const area = await requireArea(areaId);
    return cachedFetch(
      discoveryCacheKey('hub', areaId),
      DISCOVERY_CACHE_TTL.hub,
      async (): Promise<HubResult> => {
        const categories = await Promise.all(
          HUB_CATEGORIES.map(async (def) => {
            const counts = await this.repository.countProviders(
              {
                kind: def.kind,
                species: def.species,
                emergencyOnly: def.emergencyOnly,
                homeVisitOnly: def.homeVisitOnly,
              },
              area,
            );
            return {
              key: def.key,
              kind: def.kind,
              labelBn: def.labelBn,
              labelEn: def.labelEn,
              hintBn: def.hintBn,
              total: counts.total,
              online: counts.online,
            };
          }),
        );
        return {
          area: area ? { id: area.id, name: area.name, nameBn: area.nameBn, type: area.type } : null,
          categories,
          generatedAt: new Date().toISOString(),
        };
      },
    );
  }

  async listProviders(q: ProviderListQuery): Promise<ProviderListResult> {
    const area = await requireArea(q.areaId);
    const filters = filtersFromQuery(q);
    const key = discoveryCacheKey(
      'list',
      filters.kind,
      filters.species,
      filters.emergencyOnly,
      filters.homeVisitOnly,
      filters.onlineOnly,
      q.areaId,
      q.sort,
      q.page,
      q.limit,
    );

    return cachedFetch(key, DISCOVERY_CACHE_TTL.list, async (): Promise<ProviderListResult> => {
      const { rows, total } = await this.repository.listProviders({
        filters,
        area,
        sort: q.sort,
        page: q.page,
        limit: q.limit,
      });
      const ancestorTypes = area?.ancestorTypes ?? [];
      return {
        items: rows.map((row) => mapProviderRow(filters.kind, row, ancestorTypes)),
        page: q.page,
        limit: q.limit,
        total,
        hasMore: q.page * q.limit < total,
      };
    });
  }

  async getProvider(kind: ProviderKindName, id: string, areaId: string | undefined): Promise<ProviderDetail> {
    const area = await requireArea(areaId);
    return cachedFetch(
      discoveryCacheKey('detail', kind, id, areaId),
      DISCOVERY_CACHE_TTL.detail,
      async (): Promise<ProviderDetail> => {
        const [row, coverageAreas, services] = await Promise.all([
          this.repository.findProvider(kind, id, area),
          this.repository.coverageAreas(kind, id),
          listPublicOfferings(kind, id),
        ]);
        if (!row) throw new NotFoundError('PROVIDER_NOT_FOUND', 'Provider not found');
        return {
          ...mapProviderRow(kind, row, area?.ancestorTypes ?? []),
          bio: row.bio ?? null,
          services: services.map(({ isActive: _isActive, ...rest }) => rest),
          coverageAreas,
        };
      },
    );
  }

  /**
   * Provider heartbeat / go-online switch. Authorisation comes from the database
   * (which profiles does this account own?), never from a client-supplied role or id.
   */
  async setPresence(
    userId: string,
    online: boolean,
  ): Promise<{ online: boolean; profiles: Array<{ kind: ProviderKindName; id: string }> }> {
    const profiles = await this.repository.profilesForUser(userId);
    if (profiles.length === 0) {
      throw new ForbiddenError('NOT_A_PROVIDER', 'This account has no service-provider profile');
    }

    const eligible = online ? profiles.filter((p) => p.active) : profiles;
    if (eligible.length === 0) {
      throw new ForbiddenError(
        'PROVIDER_NOT_ACTIVE',
        'Your profile is not active yet. Please wait for approval or contact support.',
      );
    }

    await Promise.all(eligible.map((p) => this.repository.upsertPresence(p.kind, p.id, online)));
    return { online, profiles: eligible.map((p) => ({ kind: p.kind, id: p.id })) };
  }
}
