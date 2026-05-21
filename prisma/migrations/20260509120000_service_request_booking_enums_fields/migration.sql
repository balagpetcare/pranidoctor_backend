-- Align ServiceRequestType enum with product names (PostgreSQL 10+).
ALTER TYPE "ServiceRequestType" RENAME VALUE 'DOCTOR_VISIT' TO 'DOCTOR_HOME_VISIT';
ALTER TYPE "ServiceRequestType" RENAME VALUE 'EMERGENCY' TO 'EMERGENCY_DOCTOR';
ALTER TYPE "ServiceRequestType" RENAME VALUE 'ONLINE_CONSULTATION' TO 'ONLINE_CONSULTATION_LATER';

-- Replace ServiceRequestStatus with simplified lifecycle (migrate existing rows).
CREATE TYPE "ServiceRequestStatus_new" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED'
);

ALTER TABLE "ServiceRequest" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "ServiceRequest" ALTER COLUMN "status" TYPE "ServiceRequestStatus_new" USING (
  CASE "status"::text
    WHEN 'SUBMITTED' THEN 'PENDING'::"ServiceRequestStatus_new"
    WHEN 'ASSIGNED' THEN 'ASSIGNED'::"ServiceRequestStatus_new"
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"ServiceRequestStatus_new"
    WHEN 'PENDING_PAYMENT' THEN 'IN_PROGRESS'::"ServiceRequestStatus_new"
    WHEN 'DISPATCHED' THEN 'ASSIGNED'::"ServiceRequestStatus_new"
    WHEN 'COMPLETED' THEN 'COMPLETED'::"ServiceRequestStatus_new"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"ServiceRequestStatus_new"
    WHEN 'NO_SHOW' THEN 'REJECTED'::"ServiceRequestStatus_new"
    ELSE 'PENDING'::"ServiceRequestStatus_new"
  END
);

ALTER TABLE "ServiceRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ServiceRequestStatus_new";

DROP TYPE "ServiceRequestStatus";
ALTER TYPE "ServiceRequestStatus_new" RENAME TO "ServiceRequestStatus";

-- New optional fields for customer-facing booking copy.
ALTER TABLE "ServiceRequest" ADD COLUMN "description" TEXT;
ALTER TABLE "ServiceRequest" ADD COLUMN "cancelReason" TEXT;
