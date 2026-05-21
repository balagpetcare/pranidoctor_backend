export type AuditAction =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_OTP_REQUEST'
  | 'AUTH_OTP_VERIFY'
  | 'AUTH_TOKEN_REFRESH'
  | 'AUTH_SESSION_REVOKE'
  | 'AUTH_MFA_VERIFY'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_ROLE_CHANGE'
  | 'DOCTOR_CREATE'
  | 'DOCTOR_UPDATE'
  | 'DOCTOR_VERIFY'
  | 'DOCTOR_SUSPEND'
  | 'CLINIC_CREATE'
  | 'CLINIC_UPDATE'
  | 'CLINIC_STAFF_ADD'
  | 'CLINIC_STAFF_REMOVE'
  | 'ANIMAL_CREATE'
  | 'ANIMAL_UPDATE'
  | 'ANIMAL_DELETE'
  | 'ANIMAL_MEDICAL_RECORD_ADD'
  | 'LEAD_CREATE'
  | 'LEAD_ASSIGN'
  | 'LEAD_CONVERT'
  | 'LEAD_STATUS_CHANGE'
  | 'AI_CONVERSATION_START'
  | 'AI_CONVERSATION_END'
  | 'AI_EMERGENCY_ESCALATE'
  | 'NOTIFICATION_SEND'
  | 'SETTINGS_UPDATE'
  | 'DATA_EXPORT'
  | 'DATA_DELETE'
  | 'PERMISSION_GRANT'
  | 'PERMISSION_REVOKE'
  | 'SYSTEM_CONFIG_CHANGE';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  severity: AuditSeverity;
  outcome: AuditOutcome;
  
  actorId?: string;
  actorType: 'user' | 'system' | 'api' | 'scheduler';
  actorRole?: string;
  actorIp?: string;
  actorUserAgent?: string;
  
  targetType?: string;
  targetId?: string;
  
  resourceType?: string;
  resourceId?: string;
  
  details?: Record<string, unknown>;
  changes?: {
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
  }[];
  
  requestId?: string;
  traceId?: string;
  sessionId?: string;
  
  tenantId?: string;
  
  errorCode?: string;
  errorMessage?: string;
}

export interface AuditLogFilter {
  action?: AuditAction | AuditAction[];
  severity?: AuditSeverity | AuditSeverity[];
  outcome?: AuditOutcome;
  actorId?: string;
  targetId?: string;
  resourceType?: string;
  resourceId?: string;
  tenantId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}
