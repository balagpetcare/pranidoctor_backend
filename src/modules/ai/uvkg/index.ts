export { getUvkgConfig, resolveUvkgConfig, setUvkgConfigForTests } from './config/uvkg-config.js';
export type { UvkgConfig } from './config/uvkg-config.js';
export type {
  UvkgDriftReport,
  UvkgLinkUpsertInput,
  UvkgLinkView,
  UvkgNeighborView,
  UvkgSyncResult,
  UvkgTraversalResult,
} from './uvkg.types.js';
export {
  mapDiseaseEdgeType,
  mapFeedEdgeType,
  mapMedicineEdgeType,
  PROFILE_EDGE_ALLOWLIST,
} from './uvkg.edge-mapping.js';
export { getKnowledgeLinkRepository, resetKnowledgeLinkRepositoryForTests } from './repositories/knowledge-link.repository.js';
export {
  getKnowledgeLinkStagingRepository,
  resetKnowledgeLinkStagingRepositoryForTests,
} from './repositories/knowledge-link-staging.repository.js';
export { getUvkgEndpointResolverService, resetUvkgEndpointResolverServiceForTests } from './services/endpoint-resolver.service.js';
export { getUvkgDualWriteService, resetUvkgDualWriteServiceForTests } from './services/uvkg-dual-write.service.js';
export { getGraphSyncService, resetGraphSyncServiceForTests } from './services/graph-sync.service.js';
export { getUvkgDriftService, resetUvkgDriftServiceForTests } from './services/uvkg-drift.service.js';
export { getUvkgTraversalService, resetUvkgTraversalServiceForTests } from './services/uvkg-traversal.service.js';
export { getGraphPopulationService, resetGraphPopulationServiceForTests } from './services/graph-population.service.js';
export { getGraphCoverageService, resetGraphCoverageServiceForTests } from './services/graph-coverage.service.js';
export { getGraphQualityService, resetGraphQualityServiceForTests } from './services/graph-quality.service.js';
export { getGovernanceValidationService, resetGovernanceValidationServiceForTests } from './services/governance-validation.service.js';
export { getUvkgAnalyticsService, resetUvkgAnalyticsServiceForTests } from './services/uvkg-analytics.service.js';
export { getUvkgBenchmarkService, resetUvkgBenchmarkServiceForTests } from './services/uvkg-benchmark.service.js';
export { getPhase4ValidationService, resetPhase4ValidationServiceForTests } from './services/phase4-validation.service.js';
export { getPhase5ValidationService, resetPhase5ValidationServiceForTests } from './services/phase5-validation.service.js';
export { getShadowReadService, resetShadowReadServiceForTests } from './services/shadow-read.service.js';
export { getUvkgReadRouterService, resetUvkgReadRouterServiceForTests } from './services/uvkg-read-router.service.js';
export { getLegacyGraphReadService, resetLegacyGraphReadServiceForTests } from './services/legacy-graph-read.service.js';
export {
  shouldRouteToUvkgRead,
  uvkgReadCanaryBucket,
} from './config/uvkg-config.js';
export { formatPhase4ValidationMarkdown, formatPhase5ValidationMarkdown } from './uvkg-report.formatter.js';
export {
  UVKG_PHASE5_PARITY_TARGET,
  UVKG_READ_PERCENT_STEPS,
} from './uvkg-phase5.constants.js';
export { UVKG_PHASE4_TARGETS, UVKG_COVERAGE_MINIMUMS } from './uvkg-phase4.constants.js';
export { configureUvkgAdminRoutes } from './uvkg.routes.js';
export { getUvkgController, UvkgController } from './uvkg.controller.js';

import { resetKnowledgeLinkRepositoryForTests } from './repositories/knowledge-link.repository.js';
import { resetKnowledgeLinkStagingRepositoryForTests } from './repositories/knowledge-link-staging.repository.js';
import { resetGraphSyncServiceForTests } from './services/graph-sync.service.js';
import { resetUvkgDriftServiceForTests } from './services/uvkg-drift.service.js';
import { resetUvkgDualWriteServiceForTests } from './services/uvkg-dual-write.service.js';
import { resetUvkgEndpointResolverServiceForTests } from './services/endpoint-resolver.service.js';
import { resetUvkgTraversalServiceForTests } from './services/uvkg-traversal.service.js';
import { resetGraphPopulationServiceForTests } from './services/graph-population.service.js';
import { resetGraphCoverageServiceForTests } from './services/graph-coverage.service.js';
import { resetGraphQualityServiceForTests } from './services/graph-quality.service.js';
import { resetGovernanceValidationServiceForTests } from './services/governance-validation.service.js';
import { resetUvkgAnalyticsServiceForTests } from './services/uvkg-analytics.service.js';
import { resetUvkgBenchmarkServiceForTests } from './services/uvkg-benchmark.service.js';
import { resetPhase4ValidationServiceForTests } from './services/phase4-validation.service.js';
import { resetPhase5ValidationServiceForTests } from './services/phase5-validation.service.js';
import { resetShadowReadServiceForTests } from './services/shadow-read.service.js';
import { resetUvkgReadRouterServiceForTests } from './services/uvkg-read-router.service.js';
import { resetLegacyGraphReadServiceForTests } from './services/legacy-graph-read.service.js';
import { setUvkgConfigForTests } from './config/uvkg-config.js';

export function resetAllUvkgForTests(): void {
  setUvkgConfigForTests(null);
  resetKnowledgeLinkRepositoryForTests();
  resetKnowledgeLinkStagingRepositoryForTests();
  resetUvkgEndpointResolverServiceForTests();
  resetUvkgDualWriteServiceForTests();
  resetGraphSyncServiceForTests();
  resetUvkgDriftServiceForTests();
  resetUvkgTraversalServiceForTests();
  resetGraphPopulationServiceForTests();
  resetGraphCoverageServiceForTests();
  resetGraphQualityServiceForTests();
  resetGovernanceValidationServiceForTests();
  resetUvkgAnalyticsServiceForTests();
  resetUvkgBenchmarkServiceForTests();
  resetPhase4ValidationServiceForTests();
  resetPhase5ValidationServiceForTests();
  resetShadowReadServiceForTests();
  resetUvkgReadRouterServiceForTests();
  resetLegacyGraphReadServiceForTests();
}
