import { NotFoundError } from '../../../../shared/errors/http.errors.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { getDiseaseIntelligenceRepository } from '../disease-intelligence.repository.js';
import { getDiseaseAnalyticsService } from '../analytics/disease-analytics.service.js';
import type { DiePersona } from '../disease-intelligence.types.js';

export class VetAssistService {
  readonly name = 'VetAssistService';

  async getQueue(vetId: string) {
    return getDiseaseIntelligenceRepository().listVetReviewQueue(vetId, 'PENDING');
  }

  async openReview(caseId: string, vetId: string) {
    const repo = getDiseaseIntelligenceRepository();
    const prisma = (await import('../../../../shared/database/prisma.js')).getPrisma();
    const existing = await prisma.diVetCaseReview.findFirst({
      where: { caseId, vetId, status: { in: ['PENDING', 'IN_REVIEW'] } },
    });
    if (existing) return existing;
    const review = await repo.createVetReview(caseId, vetId);
    void getDiseaseAnalyticsService().track('VET_REVIEW', { caseId, metadata: { vetId } });
    return review;
  }

  async validateDifferential(params: {
    reviewId: string;
    vetId: string;
    overrides: Array<{ slug: string; rank: number; registryId?: string; notes?: string }>;
  }) {
    const prisma = (await import('../../../../shared/database/prisma.js')).getPrisma();
    const review = await prisma.diVetCaseReview.findFirst({
      where: { id: params.reviewId, vetId: params.vetId },
    });
    if (!review) throw new NotFoundError('REVIEW_NOT_FOUND', 'Vet review not found');

    await prisma.diVetDifferentialOverride.deleteMany({ where: { reviewId: review.id } });
    await prisma.diVetDifferentialOverride.createMany({
      data: params.overrides.map((o) =>
        omitUndefined({
          reviewId: review.id,
          slug: o.slug,
          rank: o.rank,
          registryId: o.registryId,
          notes: o.notes,
        }),
      ),
    });

    return prisma.diVetCaseReview.update({
      where: { id: review.id },
      data: { status: 'VALIDATED' },
      include: { overrides: true },
    });
  }

  async signOff(params: { reviewId: string; vetId: string; attestation: string }) {
    const prisma = (await import('../../../../shared/database/prisma.js')).getPrisma();
    const review = await prisma.diVetCaseReview.findFirst({
      where: { id: params.reviewId, vetId: params.vetId },
    });
    if (!review) throw new NotFoundError('REVIEW_NOT_FOUND', 'Vet review not found');

    await prisma.diVetSignOff.create({
      data: { reviewId: review.id, attestation: params.attestation },
    });

    return prisma.diVetCaseReview.update({
      where: { id: review.id },
      data: { status: 'CLOSED' },
    });
  }

  async createGapTicket(params: {
    vetId: string;
    caseId?: string;
    reviewId?: string;
    description: string;
  }) {
    const prisma = (await import('../../../../shared/database/prisma.js')).getPrisma();
    return prisma.diVetGapTicket.create({
      data: omitUndefined({
        caseId: params.caseId,
        reviewId: params.reviewId,
        description: params.description,
        status: 'OPEN',
      }),
    });
  }

  resolvePersona(role?: string): DiePersona {
    if (role === 'vet' || role === 'VET') return 'vet';
    if (role === 'paravet' || role === 'PARAVET') return 'paravet';
    return 'farmer';
  }
}

let service: VetAssistService | undefined;

export function getVetAssistService(): VetAssistService {
  service ??= new VetAssistService();
  return service;
}
