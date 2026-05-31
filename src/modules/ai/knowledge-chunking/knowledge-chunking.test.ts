import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Knowledge Chunking Engines', () => {
  beforeEach(async () => {
    const { resetAllKnowledgeChunkingForTests } = await import('./index.js');
    resetAllKnowledgeChunkingForTests();
  });

  describe('ChunkEngineService', () => {
    it('builds medicine sections as separate chunks', async () => {
      const { getChunkEngineService } = await import('./chunking/chunk-engine.service.js');
      const chunks = getChunkEngineService().buildChunks({
        domain: 'MEDICINE',
        titleBn: 'অ্যামок্সিসিলিন',
        titleEn: 'Amoxicillin',
        bodyBn: 'indication\nজ্বর\n\ndose\n৫ মিগ্রা',
        bodyEn: 'indication\nFever treatment\n\ndose\n5 mg/kg',
      });
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0]?.chunkPolicyId).toBe('MEDICINE_BY_SECTION');
    });

    it('builds BN-first bilingual heading chunks for disease', async () => {
      const { getChunkEngineService } = await import('./chunking/chunk-engine.service.js');
      const chunks = getChunkEngineService().buildChunks({
        domain: 'DISEASE',
        titleBn: 'মাস্টাইটিস',
        titleEn: 'Mastitis',
        bodyBn: '## লক্ষণ\nজ্বর\n## চিকিৎসা\nঅ্যান্টিবায়োটিক',
        bodyEn: '## Signs\nFever\n## Treatment\nAntibiotic',
      });
      expect(chunks.length).toBe(2);
      expect(chunks[0]?.contentBn).toContain('জ্বর');
      expect(chunks[1]?.contentEn).toContain('Antibiotic');
    });
  });

  describe('CitationEngineService', () => {
    it('generates per-chunk inline citations with locators', async () => {
      const { getCitationEngineService } = await import('./citation/citation-engine.service.js');
      const citations = getCitationEngineService().attachChunkCitations({
        chunks: [
          {
            chunkIndex: 0,
            chunkPolicyId: 'DISEASE_BY_HEADING',
            contentBn: 'bn',
            contentEn: 'en',
            tokenEstimate: 10,
            headingPath: 'Treatment',
          },
        ],
        versionCitations: [
          {
            sourceId: 'src-1',
            documentId: 'doc-1',
            pageRef: '142',
            sectionRef: 'treatment',
            tableRef: null,
            rowRef: null,
            spanRefsJson: [{ page: 142, sectionId: 'treatment' }],
            contributionWeight: 1,
            inlineCitationKey: '[feed-ref|p.142]',
            sourceTrustTier: 2,
            source: {
              sourceKey: 'feed-ref',
              titleBn: 'bn title',
              titleEn: 'en title',
              publisher: 'DLS',
              publishYear: 2024,
              attributionTemplateBn: null,
              attributionTemplateEn: null,
              trustTier: 2,
            },
          },
        ],
      });
      expect(citations).toHaveLength(1);
      expect(citations[0]?.sectionRef).toBe('Treatment');
      expect(citations[0]?.sourceKey).toBe('feed-ref');
      expect(citations[0]?.sourceTrustTier).toBe(2);
      expect(citations[0]?.humanCitationEn).toContain('en title');
    });
  });

  describe('EvidenceAssignmentService', () => {
    it('caps AI-generated drafts at L1 provisional', async () => {
      const { getEvidenceAssignmentService } = await import('./evidence/evidence-assignment.service.js');
      const result = getEvidenceAssignmentService().assignProvisional({
        sourceClass: 'GOVT_LIVESTOCK',
        sourceDefaultLevel: 'L2',
        domain: 'DISEASE',
        trustTier: 2,
        aiGeneratedDraft: true,
      });
      expect(result.evidenceLevel).toBe('L1');
      expect(result.provisional).toBe(true);
    });

    it('finalizes evidence for high-risk clinical content', async () => {
      const { getEvidenceAssignmentService } = await import('./evidence/evidence-assignment.service.js');
      const result = getEvidenceAssignmentService().finalize({
        provisionalLevel: 'L3',
        clinicalRiskTier: 'HIGH',
        domain: 'MEDICINE',
      });
      expect(result.provisional).toBe(false);
      expect(['L2', 'L3', 'L4', 'L5']).toContain(result.evidenceLevel);
    });
  });

  describe('ConfidenceAssignmentService', () => {
    it('caps provisional confidence at 0.65', async () => {
      const { getConfidenceAssignmentService } = await import('./confidence/confidence-assignment.service.js');
      const result = getConfidenceAssignmentService().compute({
        evidenceLevel: 'L5',
        trustTier: 1,
        provisional: true,
        computedBy: 'INGEST_PIPELINE',
      });
      expect(result.score).toBeLessThanOrEqual(0.65);
      expect(result.components.evidence).toBeGreaterThan(0);
      expect(result.components.trust).toBeGreaterThan(0);
      expect(result.components.evidence).not.toBe(result.score);
    });

    it('blocks critical content from farmer-chat profile gate', async () => {
      const { getConfidenceAssignmentService } = await import('./confidence/confidence-assignment.service.js');
      const result = getConfidenceAssignmentService().compute({
        evidenceLevel: 'L2',
        trustTier: 2,
        provisional: false,
        computedBy: 'PUBLISH_JOB',
        clinicalRiskTier: 'CRITICAL',
        reviewCompletenessScore: 0.9,
      });
      expect(result.meetsProfileGates['farmer-chat-v1']).toBe(false);
    });
  });

  describe('ChunkMetadataEnricher', () => {
    it('builds RAG-ready metadata envelope v1', async () => {
      const { getChunkMetadataEnricher } = await import('./metadata/chunk-metadata.enricher.js');
      const envelope = getChunkMetadataEnricher().enrich({
        chunk: {
          chunkIndex: 0,
          chunkPolicyId: 'FEED_BY_NUTRIENT_BLOCK',
          contentBn: 'ভুট্টা',
          contentEn: 'Maize',
          tokenEstimate: 12,
        },
        entity: { id: 'ent-1', slug: 'maize', domain: 'FEED', entityType: 'FeedIngredient' },
        version: {
          id: 'ver-1',
          species: ['CATTLE'],
          audience: 'FARMER',
          regionScope: 'BD',
          clinicalRiskTier: 'LOW',
          importRunId: 'run-1',
        },
        evidence: {
          evidenceLevel: 'L3',
          assessmentMethod: 'INGEST_HEURISTIC',
          provisional: true,
          rationaleBn: 'bn',
          rationaleEn: 'en',
        },
        confidence: {
          score: 0.55,
          formulaVersion: 'v2',
          provisional: true,
          computedBy: 'INGEST_PIPELINE',
          components: {
            evidence: 0.5,
            trust: 2,
            recency: 0.5,
            review: 0,
            graph: 0,
            raw: 0.55,
            capped: 0.55,
          },
          meetsProfileGates: { 'farmer-chat-v1': true },
        },
        citation: {
          chunkIndex: 0,
          sourceId: 'src-1',
          sourceKey: 'feed-ref',
          sourceTrustTier: 2,
          contributionWeight: 1,
          inlineCitationKey: '[feed-ref|p.1]',
          humanCitationBn: 'bn cite',
          humanCitationEn: 'en cite',
        },
      });
      expect(envelope.schemaVersion).toBe('1.0');
      expect(envelope.versionId).toBe('ver-1');
      expect(envelope.embed.prefixTags.some((t) => t.startsWith('domain='))).toBe(true);
      expect(envelope.citationCache.primaryInlineToken).toBe('[feed-ref|p.1]');
      expect(envelope.citationCache.sourceKeys).toEqual(['feed-ref']);
      expect(envelope.citationCache.trustTierMin).toBe(2);
    });

    it('builds embedding text with BN-first content and cite token', async () => {
      const { getChunkMetadataEnricher } = await import('./metadata/chunk-metadata.enricher.js');
      const enricher = getChunkMetadataEnricher();
      const envelope = enricher.enrich({
        chunk: {
          chunkIndex: 0,
          chunkPolicyId: 'GENERIC_BY_PARAGRAPH',
          contentBn: 'bn body',
          contentEn: 'en body',
          tokenEstimate: 8,
        },
        entity: { id: 'e', slug: 's', domain: 'FEED', entityType: 'X' },
        version: {
          id: 'v',
          species: [],
          audience: 'FARMER',
          regionScope: 'BD',
          clinicalRiskTier: 'LOW',
          importRunId: null,
        },
        evidence: {
          evidenceLevel: 'L3',
          assessmentMethod: 'INGEST_HEURISTIC',
          provisional: true,
          rationaleBn: '',
          rationaleEn: '',
        },
        confidence: {
          score: 0.5,
          formulaVersion: 'v2',
          provisional: true,
          computedBy: 'INGEST_PIPELINE',
          components: {
            evidence: 0.5,
            trust: 3,
            recency: 0.5,
            review: 0,
            graph: 0,
            raw: 0.5,
            capped: 0.5,
          },
          meetsProfileGates: {},
        },
      });
      const text = enricher.buildEmbeddingText(envelope, 'bn body', 'en body');
      expect(text).toContain('bn body');
      expect(text).toContain('[cite=');
    });
  });
});
