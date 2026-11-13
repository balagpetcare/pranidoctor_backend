-- Free Zone: customer reservations of doctors' free slots
CREATE TABLE "FreeSlotBooking" (
  "id" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'BOOKED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "FreeSlotBooking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FreeSlotBooking_slotId_customerId_key" ON "FreeSlotBooking"("slotId", "customerId");
CREATE INDEX "FreeSlotBooking_customerId_status_idx" ON "FreeSlotBooking"("customerId", "status");
CREATE INDEX "FreeSlotBooking_slotId_status_idx" ON "FreeSlotBooking"("slotId", "status");
ALTER TABLE "FreeSlotBooking" ADD CONSTRAINT "FreeSlotBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "PartnerFreeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
