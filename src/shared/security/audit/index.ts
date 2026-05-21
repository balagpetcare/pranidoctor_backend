export type {
  AuditLogEntry,
  AuditAction,
  AuditSeverity,
  AuditOutcome,
  AuditLogFilter,
} from './audit.types.js';

export {
  createAuditLog,
  createAuditLogAsync,
  getAuditLog,
  getAuditLogsByActor,
  getAuditLogsByAction,
  getAuditLogsByDate,
  auditAuth,
  auditUser,
  auditDoctor,
  auditDataAccess,
  type CreateAuditLogOptions,
} from './audit.service.js';
