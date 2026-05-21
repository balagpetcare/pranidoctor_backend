-- P1-09: additive auth audit actions for device lifecycle
ALTER TYPE "AuthAuditAction" ADD VALUE 'DEVICE_REGISTERED';
ALTER TYPE "AuthAuditAction" ADD VALUE 'DEVICE_REVOKED';
