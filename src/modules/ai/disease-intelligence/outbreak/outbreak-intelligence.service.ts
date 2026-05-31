import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { getDiseaseIntelligenceRepository } from '../disease-intelligence.repository.js';
import { getDiseaseAnalyticsService } from '../analytics/disease-analytics.service.js';

const OUTBREAK_BOOST_THRESHOLD = 60;

export class OutbreakIntelligenceService {
  readonly name = 'OutbreakIntelligenceService';

  async listSignals(params: { diseaseSlug?: string; divisionId?: string }) {
    const since = new Date();
    since.setDate(since.getDate() - 90);
    return getDiseaseIntelligenceRepository().listOutbreakSignals({ ...params, since });
  }

  async outbreakBoostsForSlugs(slugs: string[], divisionId?: string): Promise<Map<string, number>> {
    const signals = await this.listSignals(omitUndefined({ divisionId }));
    const boosts = new Map<string, number>();
    for (const signal of signals) {
      if (!slugs.includes(signal.diseaseSlug)) continue;
      if (signal.riskIndex >= OUTBREAK_BOOST_THRESHOLD) {
        boosts.set(signal.diseaseSlug, 0.12);
      }
    }
    return boosts;
  }

  async subscribe(params: {
    userId: string;
    customerId?: string;
    species: LivestockSpecies[];
    divisionId?: string;
    channels?: string[];
  }) {
    const prisma = (await import('../../../../shared/database/prisma.js')).getPrisma();
    return prisma.diOutbreakSubscription.create({
      data: omitUndefined({
        userId: params.userId,
        customerId: params.customerId,
        species: params.species,
        divisionId: params.divisionId,
        channelsJson: params.channels ?? ['in_app'],
        active: true,
      }),
    });
  }

  async ingestAdminSignal(input: {
    diseaseSlug: string;
    registryId?: string;
    divisionId?: string;
    districtId?: string;
    riskIndex: number;
    effectiveDate: Date;
    notes?: string;
  }) {
    const data: Parameters<ReturnType<typeof getDiseaseIntelligenceRepository>['createOutbreakSignal']>[0] = {
      diseaseSlug: input.diseaseSlug,
      riskIndex: input.riskIndex,
      effectiveDate: input.effectiveDate,
      source: 'ADMIN',
    };
    if (input.registryId) data.registry = { connect: { id: input.registryId } };
    if (input.divisionId) data.divisionId = input.divisionId;
    if (input.districtId) data.districtId = input.districtId;
    if (input.notes) data.notes = input.notes;
    const signal = await getDiseaseIntelligenceRepository().createOutbreakSignal(data);
    void getDiseaseAnalyticsService().track('OUTBREAK_ALERT', {
      metadata: { diseaseSlug: input.diseaseSlug, riskIndex: input.riskIndex },
    });
    return signal;
  }

  async syncLegacy() {
    return getDiseaseIntelligenceRepository().syncLegacyOutbreakSignals();
  }
}

let service: OutbreakIntelligenceService | undefined;

export function getOutbreakIntelligenceService(): OutbreakIntelligenceService {
  service ??= new OutbreakIntelligenceService();
  return service;
}
