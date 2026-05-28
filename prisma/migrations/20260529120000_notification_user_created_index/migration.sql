-- Stabilization: list notifications by user ordered by createdAt
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
