-- Disease Intelligence Ecosystem (D1-D10)

CREATE TYPE "DiDiseaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED', 'MERGED');
CREATE TYPE "DiDiseaseCategory" AS ENUM ('INFECTIOUS', 'PARASITIC', 'METABOLIC', 'NUTRITIONAL', 'TOXIC', 'TRAUMA', 'REPRODUCTIVE', 'GENETIC', 'NEOPLASTIC', 'IDIOPATHIC', 'OTHER');
CREATE TYPE "DiNotifiableClass" AS ENUM ('NONE', 'BD_NOTIFIABLE', 'OIE_LISTED', 'ZOONOTIC');
CREATE TYPE "DiGraphNodeKind" AS ENUM ('DISEASE', 'SYMPTOM', 'PROTOCOL', 'MEDICINE_GENERIC', 'VACCINE', 'EMERGENCY');
CREATE TYPE "DiGraphEdgeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');
CREATE TYPE "DiSymptomAliasType" AS ENUM ('COMMON', 'SCIENTIFIC', 'LEGACY');
CREATE TYPE "DiCaseSessionState" AS ENUM ('CREATED', 'INTAKE', 'AWAITING_CLARIFICATION', 'ANALYZING', 'EMERGENCY_TRIAGE', 'COMPLETE', 'ESCALATED', 'ABANDONED');
CREATE TYPE "DiSafetyDecisionAction" AS ENUM ('PROCEED', 'BLOCK', 'ESCALATE', 'EMERGENCY_HANDOFF');
CREATE TYPE "DiOutbreakSignalSource" AS ENUM ('ADMIN', 'OFFICIAL', 'SYNDROMIC', 'LEGACY');
CREATE TYPE "DiVetReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'VALIDATED', 'OVERRIDDEN', 'CLOSED');
CREATE TYPE "DiPrevalenceBand" AS ENUM ('RARE', 'UNCOMMON', 'COMMON', 'ENDEMIC');
CREATE TYPE "DiAnalyticsEventType" AS ENUM ('REGISTRY_VIEW', 'SYMPTOM_RESOLVE', 'DIFFERENTIAL_COMPUTE', 'CASE_CREATED', 'CASE_ANALYZE', 'SAFETY_BLOCK', 'OUTBREAK_ALERT', 'VET_REVIEW', 'CORPUS_GAP');

CREATE TABLE "di_disease_registry" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "labelBn" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "category" "DiDiseaseCategory" NOT NULL,
    "notifiableClass" "DiNotifiableClass" NOT NULL DEFAULT 'NONE',
    "zoonoticRisk" BOOLEAN NOT NULL DEFAULT false,
    "status" "DiDiseaseStatus" NOT NULL DEFAULT 'DRAFT',
    "vkEntityId" TEXT,
    "legacyKnowledgeEntryId" TEXT,
    "defaultEvidenceLevel" VARCHAR(8) NOT NULL DEFAULT 'L2',
    "clinicalRiskTier" "AiKnowledgeClinicalRiskTier" NOT NULL DEFAULT 'LOW',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "di_disease_registry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_disease_registry_code_key" ON "di_disease_registry"("code");
CREATE UNIQUE INDEX "di_disease_registry_slug_key" ON "di_disease_registry"("slug");
CREATE UNIQUE INDEX "di_disease_registry_vkEntityId_key" ON "di_disease_registry"("vkEntityId");
CREATE INDEX "di_disease_registry_status_category_idx" ON "di_disease_registry"("status", "category");

CREATE TABLE "di_disease_aliases" (
    "id" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "locale" VARCHAR(8) NOT NULL,
    "alias" VARCHAR(256) NOT NULL,
    "aliasType" "DiSymptomAliasType" NOT NULL DEFAULT 'COMMON',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_disease_aliases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_disease_aliases_alias_idx" ON "di_disease_aliases"("alias");
CREATE INDEX "di_disease_aliases_registryId_idx" ON "di_disease_aliases"("registryId");
ALTER TABLE "di_disease_aliases" ADD CONSTRAINT "di_disease_aliases_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "di_disease_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_disease_species_matrix" (
    "id" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "species" "LivestockSpecies" NOT NULL,
    "prevalenceBand" "DiPrevalenceBand" NOT NULL DEFAULT 'COMMON',
    "endemicBd" BOOLEAN NOT NULL DEFAULT true,
    "ageMinMonths" INTEGER,
    "ageMaxMonths" INTEGER,
    CONSTRAINT "di_disease_species_matrix_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_disease_species_matrix_registryId_species_key" ON "di_disease_species_matrix"("registryId", "species");
ALTER TABLE "di_disease_species_matrix" ADD CONSTRAINT "di_disease_species_matrix_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "di_disease_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_disease_version_pointer" (
    "id" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "vkPublishedVersionId" VARCHAR(64) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    CONSTRAINT "di_disease_version_pointer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_disease_version_pointer_registryId_effectiveFrom_idx" ON "di_disease_version_pointer"("registryId", "effectiveFrom");
ALTER TABLE "di_disease_version_pointer" ADD CONSTRAINT "di_disease_version_pointer_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "di_disease_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_graph_nodes" (
    "id" TEXT NOT NULL,
    "nodeKind" "DiGraphNodeKind" NOT NULL,
    "refId" VARCHAR(128) NOT NULL,
    "labelBn" TEXT,
    "labelEn" TEXT,
    "registryId" TEXT,
    "legacySymptomNodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_graph_nodes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_graph_nodes_nodeKind_refId_key" ON "di_graph_nodes"("nodeKind", "refId");
CREATE UNIQUE INDEX "di_graph_nodes_legacySymptomNodeId_key" ON "di_graph_nodes"("legacySymptomNodeId");
CREATE INDEX "di_graph_nodes_nodeKind_idx" ON "di_graph_nodes"("nodeKind");
ALTER TABLE "di_graph_nodes" ADD CONSTRAINT "di_graph_nodes_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "di_disease_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "di_graph_edges" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "edgeType" VARCHAR(64) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "species" "LivestockSpecies"[],
    "evidenceLevel" VARCHAR(8) NOT NULL DEFAULT 'L2',
    "status" "DiGraphEdgeStatus" NOT NULL DEFAULT 'DRAFT',
    "vkVersionId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "di_graph_edges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_graph_edges_fromNodeId_toNodeId_edgeType_key" ON "di_graph_edges"("fromNodeId", "toNodeId", "edgeType");
CREATE INDEX "di_graph_edges_edgeType_status_idx" ON "di_graph_edges"("edgeType", "status");
ALTER TABLE "di_graph_edges" ADD CONSTRAINT "di_graph_edges_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "di_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "di_graph_edges" ADD CONSTRAINT "di_graph_edges_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "di_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_graph_edge_evidence" (
    "id" TEXT NOT NULL,
    "edgeId" TEXT NOT NULL,
    "sourceId" VARCHAR(64),
    "spanLocator" VARCHAR(128),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_graph_edge_evidence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "di_graph_edge_evidence" ADD CONSTRAINT "di_graph_edge_evidence_edgeId_fkey" FOREIGN KEY ("edgeId") REFERENCES "di_graph_edges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_symptom_taxonomy" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "species" "LivestockSpecies"[],
    "bodySystem" TEXT NOT NULL,
    "labelBn" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "redFlag" BOOLEAN NOT NULL DEFAULT false,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "parentCode" TEXT,
    "legacyNodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "di_symptom_taxonomy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_symptom_taxonomy_code_key" ON "di_symptom_taxonomy"("code");
CREATE UNIQUE INDEX "di_symptom_taxonomy_legacyNodeId_key" ON "di_symptom_taxonomy"("legacyNodeId");
CREATE INDEX "di_symptom_taxonomy_bodySystem_idx" ON "di_symptom_taxonomy"("bodySystem");

CREATE TABLE "di_symptom_colloquial" (
    "id" TEXT NOT NULL,
    "symptomCode" TEXT NOT NULL,
    "locale" VARCHAR(8) NOT NULL,
    "phrase" VARCHAR(256) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_symptom_colloquial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_symptom_colloquial_phrase_idx" ON "di_symptom_colloquial"("phrase");
ALTER TABLE "di_symptom_colloquial" ADD CONSTRAINT "di_symptom_colloquial_symptomCode_fkey" FOREIGN KEY ("symptomCode") REFERENCES "di_symptom_taxonomy"("code") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_differential_runs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "inputsHash" VARCHAR(64) NOT NULL,
    "modelVersion" VARCHAR(32) NOT NULL DEFAULT 'die-v1',
    "outputJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_differential_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_differential_runs_caseId_createdAt_idx" ON "di_differential_runs"("caseId", "createdAt");

CREATE TABLE "di_differential_candidates" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "registryId" TEXT,
    "slug" VARCHAR(128) NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(8,4) NOT NULL,
    "reasonCodesJson" JSONB NOT NULL,
    "citationsJson" JSONB NOT NULL,
    CONSTRAINT "di_differential_candidates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_differential_candidates_runId_rank_idx" ON "di_differential_candidates"("runId", "rank");
ALTER TABLE "di_differential_candidates" ADD CONSTRAINT "di_differential_candidates_runId_fkey" FOREIGN KEY ("runId") REFERENCES "di_differential_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "di_differential_candidates" ADD CONSTRAINT "di_differential_candidates_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "di_disease_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "di_species_profiles" (
    "id" TEXT NOT NULL,
    "species" "LivestockSpecies" NOT NULL,
    "profileJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "di_species_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_species_profiles_species_key" ON "di_species_profiles"("species");

CREATE TABLE "di_prevalence_table" (
    "id" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "species" "LivestockSpecies" NOT NULL,
    "divisionId" VARCHAR(32),
    "season" VARCHAR(16),
    "prevalenceBand" "DiPrevalenceBand" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    CONSTRAINT "di_prevalence_table_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_prevalence_table_registryId_species_idx" ON "di_prevalence_table"("registryId", "species");
ALTER TABLE "di_prevalence_table" ADD CONSTRAINT "di_prevalence_table_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "di_disease_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_outbreak_signals" (
    "id" TEXT NOT NULL,
    "registryId" TEXT,
    "diseaseSlug" VARCHAR(128) NOT NULL,
    "divisionId" VARCHAR(32),
    "districtId" VARCHAR(32),
    "riskIndex" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "effectiveDate" DATE NOT NULL,
    "source" "DiOutbreakSignalSource" NOT NULL DEFAULT 'ADMIN',
    "sourceAttributionId" VARCHAR(64),
    "notes" TEXT,
    "legacyRegionalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_outbreak_signals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_outbreak_signals_legacyRegionalId_key" ON "di_outbreak_signals"("legacyRegionalId");
CREATE INDEX "di_outbreak_signals_effectiveDate_idx" ON "di_outbreak_signals"("effectiveDate");
CREATE INDEX "di_outbreak_signals_diseaseSlug_idx" ON "di_outbreak_signals"("diseaseSlug");
CREATE INDEX "di_outbreak_signals_registryId_idx" ON "di_outbreak_signals"("registryId");
ALTER TABLE "di_outbreak_signals" ADD CONSTRAINT "di_outbreak_signals_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "di_disease_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "di_outbreak_aggregates" (
    "id" TEXT NOT NULL,
    "diseaseSlug" VARCHAR(128) NOT NULL,
    "registryId" VARCHAR(64),
    "divisionId" VARCHAR(32),
    "districtId" VARCHAR(32),
    "aggregateDate" DATE NOT NULL,
    "avgRiskIndex" INTEGER NOT NULL,
    "signalCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_outbreak_aggregates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_outbreak_aggregates_diseaseSlug_divisionId_districtId_agg_key" ON "di_outbreak_aggregates"("diseaseSlug", "divisionId", "districtId", "aggregateDate");

CREATE TABLE "di_outbreak_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT,
    "species" "LivestockSpecies"[],
    "divisionId" VARCHAR(32),
    "channelsJson" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_outbreak_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_outbreak_subscriptions_userId_active_idx" ON "di_outbreak_subscriptions"("userId", "active");

CREATE TABLE "di_outbreak_alert_logs" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "signalId" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" VARCHAR(32) NOT NULL,
    "metadataJson" JSONB,
    CONSTRAINT "di_outbreak_alert_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_outbreak_alert_logs_subscriptionId_deliveredAt_idx" ON "di_outbreak_alert_logs"("subscriptionId", "deliveredAt");

CREATE TABLE "di_safety_policies" (
    "id" TEXT NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "rulesJson" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByVetId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_safety_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_safety_policies_version_key" ON "di_safety_policies"("version");

CREATE TABLE "di_safety_evaluation_logs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "policyVersion" VARCHAR(32) NOT NULL,
    "action" "DiSafetyDecisionAction" NOT NULL,
    "reasonCodesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_safety_evaluation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_safety_evaluation_logs_caseId_createdAt_idx" ON "di_safety_evaluation_logs"("caseId", "createdAt");
ALTER TABLE "di_safety_evaluation_logs" ADD CONSTRAINT "di_safety_evaluation_logs_policyVersion_fkey" FOREIGN KEY ("policyVersion") REFERENCES "di_safety_policies"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "di_case_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT,
    "livestockId" TEXT,
    "species" "LivestockSpecies" NOT NULL,
    "locale" VARCHAR(8) NOT NULL DEFAULT 'bn',
    "state" "DiCaseSessionState" NOT NULL DEFAULT 'CREATED',
    "sessionId" TEXT,
    "symptomsJson" JSONB,
    "contextJson" JSONB,
    "legacyMemoryKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "di_case_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_case_sessions_legacyMemoryKey_key" ON "di_case_sessions"("legacyMemoryKey");
CREATE INDEX "di_case_sessions_userId_createdAt_idx" ON "di_case_sessions"("userId", "createdAt");
CREATE INDEX "di_case_sessions_customerId_idx" ON "di_case_sessions"("customerId");

CREATE TABLE "di_case_turns" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "turnIndex" INTEGER NOT NULL,
    "retrievalPackId" VARCHAR(64),
    "routingJson" JSONB,
    "inputJson" JSONB,
    "outputJson" JSONB,
    "safetyAction" "DiSafetyDecisionAction",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_case_turns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_case_turns_caseId_turnIndex_key" ON "di_case_turns"("caseId", "turnIndex");
ALTER TABLE "di_case_turns" ADD CONSTRAINT "di_case_turns_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "di_case_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_case_escalations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reasonCode" VARCHAR(64) NOT NULL,
    "urgencyTier" VARCHAR(32),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_case_escalations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_case_escalations_caseId_idx" ON "di_case_escalations"("caseId");
ALTER TABLE "di_case_escalations" ADD CONSTRAINT "di_case_escalations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "di_case_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_analytics_events" (
    "id" TEXT NOT NULL,
    "eventType" "DiAnalyticsEventType" NOT NULL,
    "caseId" TEXT,
    "registryId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_analytics_events_eventType_createdAt_idx" ON "di_analytics_events"("eventType", "createdAt");

CREATE TABLE "di_analytics_daily" (
    "id" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "dimensionKey" VARCHAR(128) NOT NULL,
    "countsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_analytics_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "di_analytics_daily_metricDate_dimensionKey_key" ON "di_analytics_daily"("metricDate", "dimensionKey");

CREATE TABLE "di_corpus_gap_tickets" (
    "id" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "locale" VARCHAR(8) NOT NULL,
    "species" "LivestockSpecies",
    "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "di_corpus_gap_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_corpus_gap_tickets_status_createdAt_idx" ON "di_corpus_gap_tickets"("status", "createdAt");

CREATE TABLE "di_vet_case_reviews" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "vetId" VARCHAR(64) NOT NULL,
    "status" "DiVetReviewStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "di_vet_case_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_vet_case_reviews_vetId_status_idx" ON "di_vet_case_reviews"("vetId", "status");
ALTER TABLE "di_vet_case_reviews" ADD CONSTRAINT "di_vet_case_reviews_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "di_case_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_vet_differential_overrides" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "registryId" VARCHAR(64),
    "slug" VARCHAR(128) NOT NULL,
    "rank" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_vet_differential_overrides_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "di_vet_differential_overrides" ADD CONSTRAINT "di_vet_differential_overrides_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "di_vet_case_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_vet_sign_offs" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "attestation" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_vet_sign_offs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "di_vet_sign_offs" ADD CONSTRAINT "di_vet_sign_offs_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "di_vet_case_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "di_vet_gap_tickets" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT,
    "caseId" TEXT,
    "description" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    "vkChangeRequestId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "di_vet_gap_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "di_vet_gap_tickets_status_idx" ON "di_vet_gap_tickets"("status");

-- Seed default safety policy
INSERT INTO "di_safety_policies" ("id", "version", "rulesJson", "effectiveFrom")
VALUES (
  'die-policy-v1',
  'die-v1',
  '{"blockAutonomousDiagnosis":true,"blockAutonomousPrescription":true,"blockAutonomousTreatmentPlan":true,"treatmentIntentBlock":true,"prescriptionIntentBlock":true,"requireCitationsForDifferentials":true,"zoonoticWarn":true,"notifiablePrompt":true}'::jsonb,
  CURRENT_TIMESTAMP
);
