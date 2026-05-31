import type {
  AiKnowledgeClinicalRiskTier,
  AiKnowledgeEvidenceLevel,
  AiKnowledgeSourceClass,
  VkEvidenceAssessmentMethod,
} from '../../../../generated/prisma/index.js';
import {
  assignProvisionalEvidenceLevel,
  finalizeEvidenceLevel,
  inferClinicalRiskTier,
} from '../../knowledge-ingestion/scoring/evidence-level.engine.js';
import type { AiKnowledgeContentType } from '../../../../generated/prisma/index.js';

const DOMAIN_CONTENT_TYPE: Record<string, AiKnowledgeContentType> = {
  DISEASE: 'DISEASE',
  MEDICINE: 'MEDICINE',
  VACCINE: 'VACCINE',
  FEED: 'FEED',
  EMERGENCY: 'EMERGENCY',
  FARM_MGMT: 'FARM_MGMT',
  CLINICAL_PROTOCOL: 'DISEASE',
  REGULATORY_BD: 'MEDICINE',
  BREED: 'FARM_MGMT',
  REPRODUCTION: 'FARM_MGMT',
};

export type EvidenceAssignmentResult = {
  evidenceLevel: AiKnowledgeEvidenceLevel;
  assessmentMethod: VkEvidenceAssessmentMethod;
  provisional: boolean;
  rationaleBn: string;
  rationaleEn: string;
};

export class EvidenceAssignmentService {
  readonly name = 'EvidenceAssignmentService';

  assignProvisional(params: {
    sourceClass: AiKnowledgeSourceClass;
    sourceDefaultLevel: AiKnowledgeEvidenceLevel;
    domain: string;
    trustTier: number;
    aiGeneratedDraft: boolean;
    hasStructuredRegistration?: boolean;
  }): EvidenceAssignmentResult {
    const contentType = DOMAIN_CONTENT_TYPE[params.domain] ?? 'FARM_MGMT';
    let level = assignProvisionalEvidenceLevel({
      sourceClass: params.sourceClass,
      sourceDefaultLevel: params.sourceDefaultLevel,
      contentType,
      ...(params.hasStructuredRegistration !== undefined
        ? { hasRegistrationField: params.hasStructuredRegistration }
        : {}),
    });

    if (params.trustTier >= 4) {
      level = 'L1';
    }

    if (params.aiGeneratedDraft) {
      level = 'L1';
    }

    return {
      evidenceLevel: level,
      assessmentMethod: 'INGEST_HEURISTIC',
      provisional: true,
      rationaleBn: `স্বয়ংক্রিয় ইমপোর্ট হিউরিস্টিক — উৎস শ্রেণি ${params.sourceClass}, বিশ্বাস স্তর ${params.trustTier}`,
      rationaleEn: `Automated ingest heuristic — source class ${params.sourceClass}, trust tier ${params.trustTier}`,
    };
  }

  finalize(params: {
    provisionalLevel: AiKnowledgeEvidenceLevel;
    reviewerLevel?: AiKnowledgeEvidenceLevel;
    clinicalRiskTier: AiKnowledgeClinicalRiskTier;
    domain: string;
  }): EvidenceAssignmentResult {
    const contentType = DOMAIN_CONTENT_TYPE[params.domain] ?? 'FARM_MGMT';
    const risk =
      params.clinicalRiskTier !== 'LOW'
        ? params.clinicalRiskTier
        : inferClinicalRiskTier(contentType);

    const level = finalizeEvidenceLevel({
      provisional: params.provisionalLevel,
      ...(params.reviewerLevel ? { reviewerLevel: params.reviewerLevel } : {}),
      clinicalRiskTier: risk,
    });

    return {
      evidenceLevel: level,
      assessmentMethod: 'VET_REVIEW',
      provisional: false,
      rationaleBn: 'ভেটেরিনারি অনুমোদনের পর চূড়ান্ত প্রমাণ স্তর',
      rationaleEn: 'Final evidence level after veterinary approval',
    };
  }
}

let service: EvidenceAssignmentService | null = null;

export function getEvidenceAssignmentService(): EvidenceAssignmentService {
  if (!service) service = new EvidenceAssignmentService();
  return service;
}

export function resetEvidenceAssignmentForTests(): void {
  service = null;
}
