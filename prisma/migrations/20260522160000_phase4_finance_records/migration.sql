-- Phase 4 finance: expense and income records

CREATE TYPE "FinanceType" AS ENUM ('EXPENSE', 'INCOME');
CREATE TYPE "ExpenseCategory" AS ENUM ('FEED', 'MEDICINE', 'LABOR', 'EQUIPMENT', 'TRANSPORT', 'OTHER');
CREATE TYPE "IncomeSource" AS ENUM ('MILK_SALES', 'ANIMAL_SALES', 'SUBSIDY', 'SERVICE', 'OTHER');

CREATE TABLE "FinanceRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "FinanceType" NOT NULL,
    "amountBdt" DECIMAL(12,2) NOT NULL,
    "recordedDate" DATE NOT NULL,
    "category" "ExpenseCategory",
    "source" "IncomeSource",
    "farmRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceRecord_customerId_type_recordedDate_idx" ON "FinanceRecord"("customerId", "type", "recordedDate");
CREATE INDEX "FinanceRecord_category_idx" ON "FinanceRecord"("category");
CREATE INDEX "FinanceRecord_source_idx" ON "FinanceRecord"("source");

ALTER TABLE "FinanceRecord" ADD CONSTRAINT "FinanceRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
