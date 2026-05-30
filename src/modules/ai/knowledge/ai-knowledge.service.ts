import {
  AiKnowledgeAudience,
  AiKnowledgeContentType,
  AiKnowledgeStatus,
  type LivestockSpecies,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';

export class AiKnowledgeService {
  readonly name = 'AiKnowledgeService';

  async search(params: {
    query: string;
    locale: 'bn' | 'en';
    species?: LivestockSpecies;
    contentType?: AiKnowledgeContentType;
    limit?: number;
    audience?: AiKnowledgeAudience;
  }) {
    const q = params.query.trim().toLowerCase();
    const rows = await getPrisma().aiKnowledgeEntry.findMany({
      where: {
        status: AiKnowledgeStatus.PUBLISHED,
        audience: params.audience ?? AiKnowledgeAudience.FARMER,
        ...(params.contentType ? { contentType: params.contentType } : {}),
        ...(params.species ? { species: { has: params.species } } : {}),
        OR: [
          { searchText: { contains: q, mode: 'insensitive' } },
          { titleBn: { contains: q, mode: 'insensitive' } },
          { titleEn: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: params.limit ?? 10,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      contentType: r.contentType,
      title: params.locale === 'bn' ? r.titleBn : r.titleEn,
      excerpt: (params.locale === 'bn' ? r.bodyBn : r.bodyEn).slice(0, 280),
      species: r.species,
    }));
  }

  async getBySlug(slug: string, locale: 'bn' | 'en') {
    const row = await getPrisma().aiKnowledgeEntry.findUnique({ where: { slug } });
    if (!row || row.status !== AiKnowledgeStatus.PUBLISHED) return null;
    return {
      id: row.id,
      slug: row.slug,
      contentType: row.contentType,
      title: locale === 'bn' ? row.titleBn : row.titleEn,
      body: locale === 'bn' ? row.bodyBn : row.bodyEn,
      species: row.species,
    };
  }

  async retrieveForRag(params: {
    query: string;
    locale: 'bn' | 'en';
    species?: LivestockSpecies;
    limit?: number;
  }): Promise<string> {
    const hits = await this.search(
      omitUndefined({
        query: params.query,
        locale: params.locale,
        species: params.species,
        limit: params.limit ?? 4,
      }),
    );
    if (hits.length === 0) return '';
    return hits.map((h, i) => `[${i + 1}] ${h.title}: ${h.excerpt}`).join('\n\n');
  }

  async listAdmin(filters?: { status?: AiKnowledgeStatus; contentType?: AiKnowledgeContentType }) {
    return getPrisma().aiKnowledgeEntry.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.contentType ? { contentType: filters.contentType } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async create(data: {
    contentType: AiKnowledgeContentType;
    slug: string;
    titleBn: string;
    titleEn: string;
    bodyBn: string;
    bodyEn: string;
    species?: LivestockSpecies[];
    audience?: AiKnowledgeAudience;
    createdById?: string;
  }) {
    const searchText = `${data.titleBn} ${data.titleEn} ${data.bodyBn} ${data.bodyEn}`.toLowerCase();
    return getPrisma().aiKnowledgeEntry.create({
      data: {
        ...data,
        searchText,
        status: AiKnowledgeStatus.DRAFT,
      },
    });
  }

  async update(id: string, data: Partial<{
    titleBn: string;
    titleEn: string;
    bodyBn: string;
    bodyEn: string;
    species: LivestockSpecies[];
    status: AiKnowledgeStatus;
    reviewedById: string;
  }>) {
    const patch = { ...data };
    if (data.titleBn || data.titleEn || data.bodyBn || data.bodyEn) {
      const existing = await getPrisma().aiKnowledgeEntry.findUnique({ where: { id } });
      if (existing) {
        patch as Record<string, unknown>;
        const searchText = `${data.titleBn ?? existing.titleBn} ${data.titleEn ?? existing.titleEn} ${data.bodyBn ?? existing.bodyBn} ${data.bodyEn ?? existing.bodyEn}`.toLowerCase();
        return getPrisma().aiKnowledgeEntry.update({
          where: { id },
          data: { ...patch, searchText, version: { increment: 1 } },
        });
      }
    }
    return getPrisma().aiKnowledgeEntry.update({ where: { id }, data: patch });
  }

  async publish(id: string, reviewedById?: string) {
    return getPrisma().aiKnowledgeEntry.update({
      where: { id },
      data: omitUndefined({
        status: AiKnowledgeStatus.PUBLISHED,
        publishedAt: new Date(),
        reviewedById,
      }),
    });
  }
}

let service: AiKnowledgeService | null = null;

export function getAiKnowledgeService(): AiKnowledgeService {
  if (!service) service = new AiKnowledgeService();
  return service;
}
