import type {
  AiKnowledgeAudience,
  AiKnowledgeClinicalRiskTier,
  VkKnowledgeDomain,
  VkReviewStage,
  VkVersionStatus,
} from '../../../generated/prisma/index.js';
import type { FoundationActor } from '../knowledge-foundation/knowledge-foundation.types.js';

export const KNOWLEDGE_GOVERNANCE_SCHEMA_VERSION = '6b4.0';

export const GOVERNANCE_STAGES = [
  'DRAFT',
  'REVIEW',
  'VET_REVIEW',
  'APPROVAL',
  'PUBLISHED',
  'ARCHIVED',
] as const;

export type GovernanceStage = (typeof GOVERNANCE_STAGES)[number];

export const GOVERNANCE_AUDIT_EVENTS = [
  'GOVERNANCE_STAGE_CHANGED',
  'CHANGE_REQUEST_OPENED',
  'CHANGE_REQUEST_RESOLVED',
  'VERSION_RESUBMITTED',
  'CONFLICT_OPENED',
  'CONFLICT_RESOLVED',
  'GOVERNANCE_APPROVAL_READY',
  'VERSION_ARCHIVED',
  'GOVERNANCE_OVERRIDE',
  'APPROVAL_EXPIRED',
  'REREVIEW_TRIGGERED',
  'SLA_BREACH_ESCALATED',
] as const;

export type GovernanceAuditEventType = (typeof GOVERNANCE_AUDIT_EVENTS)[number];

export type ChangeRequestChecklistItem = {
  code: string;
  description: string;
  required: boolean;
  resolved: boolean;
  resolvedAt?: string;
};

export type ChangeRequestDto = {
  id: string;
  versionId: string;
  reviewId: string;
  stage: VkReviewStage;
  requestedById: string;
  summaryBn: string | null;
  summaryEn: string | null;
  severity: 'MINOR' | 'MAJOR' | 'BLOCKING';
  status: 'OPEN' | 'RESOLVED' | 'CANCELLED';
  checklist: ChangeRequestChecklistItem[];
  dueAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type GovernanceConflictDto = {
  id: string;
  versionId: string;
  conflictType: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
  status: 'OPEN' | 'ESCALATED' | 'RESOLVED' | 'OVERRIDDEN';
  openedById: string;
  assignedToId: string | null;
  detailJson: Record<string, unknown> | null;
  resolutionJson: Record<string, unknown> | null;
  createdAt: string;
};

export type GovernanceVersionContext = {
  id: string;
  entityId: string;
  status: VkVersionStatus;
  domain: VkKnowledgeDomain;
  audience: AiKnowledgeAudience;
  clinicalRiskTier: AiKnowledgeClinicalRiskTier;
  aiGeneratedDraft: boolean;
  importRunId: string | null;
};

export type GovernanceActor = FoundationActor;

export type SubmitForReviewInput = {
  versionId: string;
  queueSource?: string;
  importRunId?: string;
};

export type CompleteGovernanceReviewInput = {
  reviewId: string;
  decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';
  reviewerId: string;
  comments?: string | undefined;
  changeRequest?: {
    summaryBn?: string | undefined;
    summaryEn?: string | undefined;
    severity?: 'MINOR' | 'MAJOR' | 'BLOCKING' | undefined;
    checklist?: ChangeRequestChecklistItem[] | undefined;
  } | undefined;
};

export type RecordGovernanceVetApprovalInput = {
  versionId: string;
  approverVetId: string;
  vetLicenseNo: string;
  approvalScope: string[];
  validUntil?: Date;
  dualApprovalRequired?: boolean;
  coApproverVetId?: string;
  notes?: string;
};

export type PublishGovernanceInput = {
  versionId: string;
  overrideReason?: string;
};

export type ArchiveGovernanceInput = {
  versionId: string;
  reason: string;
  archiveType: 'REJECT' | 'DEPRECATE' | 'EMERGENCY_UNPUBLISH';
};

export type ResolveChangeRequestItemInput = {
  changeRequestId: string;
  code: string;
};

export type ResolveConflictInput = {
  conflictId: string;
  decision: 'UPHOLD_VET' | 'RETURN_DRAFT' | 'FORK' | 'QUARANTINE' | 'OVERRIDE';
  rationale: string;
};
