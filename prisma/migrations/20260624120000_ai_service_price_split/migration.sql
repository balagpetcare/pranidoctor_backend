-- AI technician pricing split: semen price + AI service charge (technician-controlled).
-- Additive and nullable: existing rows keep their current `basePrice` untouched.
-- When both columns are set the application keeps `basePrice` = "semenPrice" + "aiServiceCharge".

ALTER TABLE "AiTechnicianService"
  ADD COLUMN IF NOT EXISTS "semenPrice" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "aiServiceCharge" DECIMAL(12,2);
