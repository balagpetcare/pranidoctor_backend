import type {
  AiKnowledgeClinicalRiskTier,
  LivestockSpecies,
  VkKnowledgeEdgeClass,
  VkKnowledgeLinkDirection,
  VkKnowledgeLinkSourceSystem,
  VkKnowledgeLinkStatus,
  VkKnowledgeNodeRefType,
} from '../../../generated/prisma/index.js';

export type UvkgLinkUpsertInput = {
  edgeType: string;
  edgeClass: VkKnowledgeEdgeClass;
  fromRefType: VkKnowledgeNodeRefType;
  fromRefId: string;
  toRefType: VkKnowledgeNodeRefType;
  toRefId: string;
  sourceSystem: VkKnowledgeLinkSourceSystem;
  sourceEdgeId?: string;
  fromEntityId?: string;
  toEntityId?: string;
  direction?: VkKnowledgeLinkDirection;
  weight?: number;
  species?: LivestockSpecies[];
  regionScope?: string[];
  evidenceLevel?: string;
  confidenceScore?: number;
  clinicalRiskTier?: AiKnowledgeClinicalRiskTier;
  status?: VkKnowledgeLinkStatus;
  vkVersionId?: string;
  labelBn?: string;
  labelEn?: string;
  metadata?: Record<string, unknown>;
};

export type UvkgLinkView = {
  id: string;
  linkKey: string;
  edgeType: string;
  edgeClass: VkKnowledgeEdgeClass;
  fromRefType: VkKnowledgeNodeRefType;
  fromRefId: string;
  toRefType: VkKnowledgeNodeRefType;
  toRefId: string;
  weight: number;
  status: VkKnowledgeLinkStatus;
  sourceSystem: VkKnowledgeLinkSourceSystem;
  sourceEdgeId: string | null;
};

export type UvkgNeighborView = {
  edgeType: string;
  weight: number;
  direction: 'outbound' | 'inbound';
  refType: VkKnowledgeNodeRefType;
  refId: string;
  entityId: string | null;
  labelBn: string | null;
  labelEn: string | null;
};

export type UvkgTraversalResult = {
  neighbors: UvkgNeighborView[];
  source: 'uvkg' | 'disabled';
};

export type UvkgDriftReport = {
  generatedAt: string;
  feedLegacyCount: number;
  medicineLegacyCount: number;
  diseaseLegacyCount: number;
  uvkgCount: number;
  uvkgBySource: Record<string, number>;
  openConflicts: number;
  missingInUvkg: number;
};

export type UvkgSyncResult = {
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;
  errors: string[];
};

export type UvkgPopulationReport = {
  startedAt: string;
  completedAt: string;
  sources: Record<string, UvkgSyncResult>;
  derived: Record<string, number>;
  totalLinksAfter: number;
  totalEntitiesReferenced: number;
};

export type UvkgCoverageCategoryResult = {
  category: string;
  edgeTypes: string[];
  count: number;
  minimum: number;
  met: boolean;
};

export type UvkgCoverageReport = {
  generatedAt: string;
  totalEdges: number;
  totalEntities: number;
  byEdgeType: Record<string, number>;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  categories: UvkgCoverageCategoryResult[];
  targetsMet: boolean;
};

export type UvkgQualityIssue = {
  kind:
    | 'ORPHAN_NODE'
    | 'BROKEN_LINK'
    | 'DUPLICATE_EDGE'
    | 'CONFLICT'
    | 'CIRCULAR_DEPENDENCY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  linkKey?: string;
  message: string;
  repairSuggestion: string;
};

export type UvkgQualityReport = {
  generatedAt: string;
  issues: UvkgQualityIssue[];
  issueCounts: Record<string, number>;
};

export type UvkgGovernanceReport = {
  generatedAt: string;
  statusCounts: Record<string, number>;
  unpublishedInTraversalSample: number;
  traversalPublishedOnly: boolean;
  lifecycleTransitionsValidated: boolean;
  notes: string[];
};

export type UvkgAnalyticsDashboard = {
  generatedAt: string;
  entityCount: number;
  edgeCount: number;
  edgeCountByType: Record<string, number>;
  edgeCountByStatus: Record<string, number>;
  crossDomainCoverage: UvkgCoverageCategoryResult[];
  topConnectedEntities: Array<{ refId: string; refType: string; degree: number }>;
  orphanNodes: Array<{ refType: string; refId: string }>;
  drift: UvkgDriftReport;
};

export type UvkgBenchmarkOp = {
  operation: string;
  samples: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  targetMs: number;
  met: boolean;
};

export type UvkgBenchmarkReport = {
  generatedAt: string;
  operations: UvkgBenchmarkOp[];
  allMet: boolean;
};

export type UvkgPhase4ValidationReport = {
  generatedAt: string;
  population: UvkgPopulationReport;
  coverage: UvkgCoverageReport;
  quality: UvkgQualityReport;
  governance: UvkgGovernanceReport;
  analytics: UvkgAnalyticsDashboard;
  benchmarks: UvkgBenchmarkReport;
  drift: UvkgDriftReport;
  readinessScore: number;
  readinessForPhase5: 'READY' | 'NOT_READY' | 'CONDITIONAL';
  blockers: string[];
  recommendations: string[];
};

export type UvkgNormalizedEdge = {
  edgeType: string;
  neighborRefId: string;
  direction: 'outbound' | 'inbound';
};

export type UvkgShadowCompareResult = {
  feature: string;
  anchorRefType: string;
  anchorRefId: string;
  legacyCount: number;
  uvkgCount: number;
  matchedCount: number;
  parityRatio: number;
  legacyOnly: string[];
  uvkgOnly: string[];
  legacyMs: number;
  uvkgMs: number;
  legacyEmpty: boolean;
};

export type UvkgReadAccuracyResult = {
  category: string;
  label: string;
  samples: number;
  legacyEdges: number;
  uvkgEdges: number;
  matched: number;
  parityRatio: number;
  met: boolean;
  legacyEmptySamples: number;
};

export type UvkgAiValidationResult = {
  feature: string;
  profileId: string;
  fixtures: number;
  avgHintCount: number;
  avgSlugBoosts: number;
  retrievalParityRatio: number;
  groundingScore: number;
  citationScore: number;
  consistencyScore: number;
  met: boolean;
};

export type UvkgPerformanceCompareOp = {
  operation: string;
  legacyAvgMs: number;
  uvkgAvgMs: number;
  regressionRatio: number;
  met: boolean;
};

export type UvkgRolloutStepResult = {
  percent: number;
  bucketDistribution: Record<string, number>;
  valid: boolean;
};

export type UvkgPhase5ValidationReport = {
  generatedAt: string;
  config: {
    readEnabled: boolean;
    shadowReadEnabled: boolean;
    readPercent: number;
    legacyFallbackEnabled: boolean;
  };
  shadowReads: UvkgShadowCompareResult[];
  readAccuracy: UvkgReadAccuracyResult[];
  aiValidation: UvkgAiValidationResult[];
  performance: UvkgPerformanceCompareOp[];
  rollout: UvkgRolloutStepResult[];
  overallParityRatio: number;
  readinessScore: number;
  recommendation: 'READY_FOR_PHASE6' | 'NOT_READY';
  blockers: string[];
  recommendations: string[];
};
