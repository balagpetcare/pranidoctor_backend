-- P5 — Treatment workflow domain layer (additive)

CREATE TYPE "TreatmentWorkflowStatus" AS ENUM (
  'ASSIGNED',
  'CONSULTATION_STARTED',
  'DIAGNOSED',
  'PRESCRIBED',
  'FOLLOWUP_PENDING',
  'CLOSED'
);

CREATE TYPE "TreatmentFollowupStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

CREATE TYPE "TreatmentNoteType" AS ENUM ('PRIVATE', 'SHARED', 'AUDIT');

CREATE TABLE "TreatmentWorkflow" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "status" "TreatmentWorkflowStatus" NOT NULL DEFAULT 'ASSIGNED',
  "treatmentCaseId" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TreatmentWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreatmentConsultation" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "observations" TEXT,
  "diagnosisSummary" TEXT,
  "attachmentRefs" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TreatmentConsultation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreatmentFollowup" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "reminderNote" TEXT,
  "status" "TreatmentFollowupStatus" NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TreatmentFollowup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreatmentNote" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "authorDoctorId" TEXT NOT NULL,
  "noteType" "TreatmentNoteType" NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TreatmentNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TreatmentWorkflow_serviceRequestId_key" ON "TreatmentWorkflow"("serviceRequestId");
CREATE UNIQUE INDEX "TreatmentWorkflow_treatmentCaseId_key" ON "TreatmentWorkflow"("treatmentCaseId");
CREATE INDEX "TreatmentWorkflow_doctorId_idx" ON "TreatmentWorkflow"("doctorId");
CREATE INDEX "TreatmentWorkflow_status_idx" ON "TreatmentWorkflow"("status");

CREATE INDEX "TreatmentConsultation_serviceRequestId_idx" ON "TreatmentConsultation"("serviceRequestId");
CREATE INDEX "TreatmentConsultation_workflowId_idx" ON "TreatmentConsultation"("workflowId");
CREATE INDEX "TreatmentConsultation_doctorId_idx" ON "TreatmentConsultation"("doctorId");

CREATE INDEX "TreatmentFollowup_serviceRequestId_idx" ON "TreatmentFollowup"("serviceRequestId");
CREATE INDEX "TreatmentFollowup_workflowId_idx" ON "TreatmentFollowup"("workflowId");
CREATE INDEX "TreatmentFollowup_doctorId_idx" ON "TreatmentFollowup"("doctorId");
CREATE INDEX "TreatmentFollowup_status_idx" ON "TreatmentFollowup"("status");

CREATE INDEX "TreatmentNote_serviceRequestId_idx" ON "TreatmentNote"("serviceRequestId");
CREATE INDEX "TreatmentNote_workflowId_idx" ON "TreatmentNote"("workflowId");
CREATE INDEX "TreatmentNote_authorDoctorId_idx" ON "TreatmentNote"("authorDoctorId");
CREATE INDEX "TreatmentNote_noteType_idx" ON "TreatmentNote"("noteType");

ALTER TABLE "TreatmentWorkflow"
  ADD CONSTRAINT "TreatmentWorkflow_serviceRequestId_fkey"
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TreatmentWorkflow"
  ADD CONSTRAINT "TreatmentWorkflow_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TreatmentWorkflow"
  ADD CONSTRAINT "TreatmentWorkflow_treatmentCaseId_fkey"
  FOREIGN KEY ("treatmentCaseId") REFERENCES "TreatmentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TreatmentConsultation"
  ADD CONSTRAINT "TreatmentConsultation_serviceRequestId_fkey"
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TreatmentConsultation"
  ADD CONSTRAINT "TreatmentConsultation_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "TreatmentWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TreatmentConsultation"
  ADD CONSTRAINT "TreatmentConsultation_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TreatmentFollowup"
  ADD CONSTRAINT "TreatmentFollowup_serviceRequestId_fkey"
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TreatmentFollowup"
  ADD CONSTRAINT "TreatmentFollowup_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "TreatmentWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TreatmentFollowup"
  ADD CONSTRAINT "TreatmentFollowup_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TreatmentNote"
  ADD CONSTRAINT "TreatmentNote_serviceRequestId_fkey"
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TreatmentNote"
  ADD CONSTRAINT "TreatmentNote_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "TreatmentWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TreatmentNote"
  ADD CONSTRAINT "TreatmentNote_authorDoctorId_fkey"
  FOREIGN KEY ("authorDoctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
