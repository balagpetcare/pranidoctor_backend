-- Phase 5: farm health, vaccine, treatment records (mobile customer app)

CREATE TYPE "HealthEventType" AS ENUM ('SYMPTOM', 'DIAGNOSIS', 'DISEASE', 'CHECKUP', 'TREATMENT_REF');
CREATE TYPE "VaccineStatus" AS ENUM ('SCHEDULED', 'DUE', 'OVERDUE', 'COMPLETED');
CREATE TYPE "FarmTreatmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TABLE "HealthEvent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "animalId" TEXT,
    "farmRef" TEXT,
    "eventType" "HealthEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "symptoms" TEXT,
    "diagnosis" TEXT,
    "diseaseName" TEXT,
    "treatmentRefId" TEXT,
    "vaccineRefId" TEXT,
    "notes" TEXT,
    "recordedDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VaccineRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "animalId" TEXT,
    "farmRef" TEXT,
    "vaccineName" TEXT NOT NULL,
    "vaccineType" TEXT,
    "scheduledDate" DATE NOT NULL,
    "administeredDate" DATE,
    "nextDueDate" DATE,
    "status" "VaccineStatus" NOT NULL DEFAULT 'SCHEDULED',
    "batchNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaccineRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmTreatment" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "animalId" TEXT,
    "farmRef" TEXT,
    "title" TEXT NOT NULL,
    "diagnosis" TEXT,
    "prescription" TEXT,
    "medicinesJson" JSONB,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "FarmTreatmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmTreatment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HealthEvent_customerId_recordedDate_idx" ON "HealthEvent"("customerId", "recordedDate");
CREATE INDEX "HealthEvent_animalId_idx" ON "HealthEvent"("animalId");
CREATE INDEX "HealthEvent_eventType_idx" ON "HealthEvent"("eventType");

CREATE INDEX "VaccineRecord_customerId_scheduledDate_idx" ON "VaccineRecord"("customerId", "scheduledDate");
CREATE INDEX "VaccineRecord_customerId_status_idx" ON "VaccineRecord"("customerId", "status");
CREATE INDEX "VaccineRecord_animalId_idx" ON "VaccineRecord"("animalId");

CREATE INDEX "FarmTreatment_customerId_startDate_idx" ON "FarmTreatment"("customerId", "startDate");
CREATE INDEX "FarmTreatment_customerId_status_idx" ON "FarmTreatment"("customerId", "status");
CREATE INDEX "FarmTreatment_animalId_idx" ON "FarmTreatment"("animalId");

ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "AnimalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VaccineRecord" ADD CONSTRAINT "VaccineRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VaccineRecord" ADD CONSTRAINT "VaccineRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "AnimalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FarmTreatment" ADD CONSTRAINT "FarmTreatment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmTreatment" ADD CONSTRAINT "FarmTreatment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "AnimalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
