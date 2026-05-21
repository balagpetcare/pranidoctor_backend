-- Enterprise service instance workflow (semen template submissions → admin review → publish).

ALTER TYPE "MobileUploadPurpose" ADD VALUE 'AI_SERVICE_INSTANCE_COVER';
ALTER TYPE "MobileUploadPurpose" ADD VALUE 'AI_SERVICE_INSTANCE_GALLERY';
ALTER TYPE "MobileUploadPurpose" ADD VALUE 'AI_SERVICE_INSTANCE_VIDEO';
ALTER TYPE "MobileUploadPurpose" ADD VALUE 'AI_SERVICE_INSTANCE_DOCUMENT';

CREATE TYPE "ServiceInstanceStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_CORRECTION',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TYPE "ServiceInstanceMediaKind" AS ENUM (
  'COVER',
  'GALLERY',
  'VIDEO_UPLOAD',
  'VIDEO_URL',
  'DOCUMENT'
);

CREATE TYPE "ServiceInstanceMediaModerationStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "ServiceInstanceReviewDecision" AS ENUM (
  'APPROVE',
  'REJECT',
  'REQUEST_CORRECTION',
  'COMMENT'
);

CREATE TYPE "ServiceInstanceReviewVisibility" AS ENUM (
  'INTERNAL',
  'WORKER_VISIBLE'
);

CREATE TYPE "ServiceInstancePublishAction" AS ENUM (
  'PUBLISH',
  'UNPUBLISH',
  'ROLLBACK'
);

CREATE TYPE "ServiceInstanceAuditAction" AS ENUM (
  'CREATE',
  'EDIT',
  'SUBMIT',
  'REVIEW',
  'APPROVE',
  'REJECT',
  'PUBLISH',
  'ARCHIVE',
  'ROLLBACK',
  'STATUS_CHANGE'
);

CREATE TABLE "ServiceInstance" (
    "id" TEXT NOT NULL,
    "semenServiceTemplateId" TEXT NOT NULL,
    "aiTechnicianProfileId" TEXT NOT NULL,
    "status" "ServiceInstanceStatus" NOT NULL DEFAULT 'DRAFT',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "lockedSnapshotJson" JSONB,
    "validationResultJson" JSONB,
    "duplicateOfId" TEXT,
    "payloadFingerprint" TEXT,
    "correctionNote" TEXT,
    "adminInternalNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "lastReviewedById" TEXT,
    "publishedAiTechnicianServiceId" TEXT,
    "deploymentBranch" TEXT DEFAULT 'main',
    "tenantId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceInstance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceInstance_publishedAiTechnicianServiceId_key" ON "ServiceInstance"("publishedAiTechnicianServiceId");

CREATE TABLE "ServiceInstanceMedia" (
    "id" TEXT NOT NULL,
    "serviceInstanceId" TEXT NOT NULL,
    "kind" "ServiceInstanceMediaKind" NOT NULL,
    "uploadedFileId" TEXT,
    "externalUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "moderationStatus" "ServiceInstanceMediaModerationStatus" NOT NULL DEFAULT 'PENDING',
    "moderationNote" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceInstanceMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceInstanceStatusLog" (
    "id" TEXT NOT NULL,
    "serviceInstanceId" TEXT NOT NULL,
    "fromStatus" "ServiceInstanceStatus",
    "toStatus" "ServiceInstanceStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceInstanceStatusLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceInstanceReview" (
    "id" TEXT NOT NULL,
    "serviceInstanceId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "decision" "ServiceInstanceReviewDecision" NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "ServiceInstanceReviewVisibility" NOT NULL DEFAULT 'WORKER_VISIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceInstanceReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceInstancePublishLog" (
    "id" TEXT NOT NULL,
    "serviceInstanceId" TEXT NOT NULL,
    "action" "ServiceInstancePublishAction" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "previousPublishedServiceId" TEXT,
    "newPublishedServiceId" TEXT,
    "payloadSnapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceInstancePublishLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceInstanceAuditEvent" (
    "id" TEXT NOT NULL,
    "serviceInstanceId" TEXT NOT NULL,
    "action" "ServiceInstanceAuditAction" NOT NULL,
    "actorUserId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceInstanceAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceInstance_status_submittedAt_idx" ON "ServiceInstance"("status", "submittedAt");
CREATE INDEX "ServiceInstance_aiTechnicianProfileId_semenServiceTemplateId_idx" ON "ServiceInstance"("aiTechnicianProfileId", "semenServiceTemplateId");
CREATE INDEX "ServiceInstance_tenantId_deploymentBranch_idx" ON "ServiceInstance"("tenantId", "deploymentBranch");
CREATE INDEX "ServiceInstance_deploymentBranch_idx" ON "ServiceInstance"("deploymentBranch");
CREATE INDEX "ServiceInstance_deletedAt_idx" ON "ServiceInstance"("deletedAt");
CREATE INDEX "ServiceInstance_payloadFingerprint_idx" ON "ServiceInstance"("payloadFingerprint");
CREATE INDEX "ServiceInstance_semenServiceTemplateId_idx" ON "ServiceInstance"("semenServiceTemplateId");

CREATE INDEX "ServiceInstanceMedia_serviceInstanceId_idx" ON "ServiceInstanceMedia"("serviceInstanceId");
CREATE INDEX "ServiceInstanceMedia_sortOrder_idx" ON "ServiceInstanceMedia"("sortOrder");
CREATE INDEX "ServiceInstanceMedia_uploadedFileId_idx" ON "ServiceInstanceMedia"("uploadedFileId");

CREATE INDEX "ServiceInstanceStatusLog_serviceInstanceId_createdAt_idx" ON "ServiceInstanceStatusLog"("serviceInstanceId", "createdAt");
CREATE INDEX "ServiceInstanceStatusLog_actorUserId_idx" ON "ServiceInstanceStatusLog"("actorUserId");

CREATE INDEX "ServiceInstanceReview_serviceInstanceId_createdAt_idx" ON "ServiceInstanceReview"("serviceInstanceId", "createdAt");
CREATE INDEX "ServiceInstanceReview_reviewerUserId_idx" ON "ServiceInstanceReview"("reviewerUserId");

CREATE INDEX "ServiceInstancePublishLog_serviceInstanceId_createdAt_idx" ON "ServiceInstancePublishLog"("serviceInstanceId", "createdAt");
CREATE INDEX "ServiceInstancePublishLog_actorUserId_idx" ON "ServiceInstancePublishLog"("actorUserId");

CREATE INDEX "ServiceInstanceAuditEvent_serviceInstanceId_createdAt_idx" ON "ServiceInstanceAuditEvent"("serviceInstanceId", "createdAt");
CREATE INDEX "ServiceInstanceAuditEvent_actorUserId_idx" ON "ServiceInstanceAuditEvent"("actorUserId");

ALTER TABLE "ServiceInstance" ADD CONSTRAINT "ServiceInstance_semenServiceTemplateId_fkey" FOREIGN KEY ("semenServiceTemplateId") REFERENCES "SemenServiceTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceInstance" ADD CONSTRAINT "ServiceInstance_aiTechnicianProfileId_fkey" FOREIGN KEY ("aiTechnicianProfileId") REFERENCES "AiTechnicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceInstance" ADD CONSTRAINT "ServiceInstance_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "ServiceInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceInstance" ADD CONSTRAINT "ServiceInstance_lastReviewedById_fkey" FOREIGN KEY ("lastReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceInstance" ADD CONSTRAINT "ServiceInstance_publishedAiTechnicianServiceId_fkey" FOREIGN KEY ("publishedAiTechnicianServiceId") REFERENCES "AiTechnicianService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceInstanceMedia" ADD CONSTRAINT "ServiceInstanceMedia_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "ServiceInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceInstanceMedia" ADD CONSTRAINT "ServiceInstanceMedia_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceInstanceStatusLog" ADD CONSTRAINT "ServiceInstanceStatusLog_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "ServiceInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceInstanceStatusLog" ADD CONSTRAINT "ServiceInstanceStatusLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceInstanceReview" ADD CONSTRAINT "ServiceInstanceReview_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "ServiceInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceInstanceReview" ADD CONSTRAINT "ServiceInstanceReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceInstancePublishLog" ADD CONSTRAINT "ServiceInstancePublishLog_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "ServiceInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceInstancePublishLog" ADD CONSTRAINT "ServiceInstancePublishLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceInstanceAuditEvent" ADD CONSTRAINT "ServiceInstanceAuditEvent_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "ServiceInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceInstanceAuditEvent" ADD CONSTRAINT "ServiceInstanceAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
