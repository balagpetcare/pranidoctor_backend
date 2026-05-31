import { randomUUID } from 'node:crypto';

import type { KnowledgeContextPack } from '../../knowledge-retrieval/knowledge-retrieval.types.js';
import type {
  BoosterStatus,
  EligibilityResult,
  MissedVaccineAlert,
  VaccineInteractionReport,
  VaccineSafetyReport,
} from '../ai-vaccine.types.js';
import type { PublishedVaccineEntry } from './vaccine-metadata.util.js';
import { buildVaccineCitation, parseVaccineStructured } from './vaccine-metadata.util.js';

export function buildDefaultSafetyMessaging(): import('../ai-vaccine.types.js').SafetyMessagingBlock {
  return {
    disclaimerBn:
      'এই তথ্য শিক্ষামূলক টিকা পরিকল্পনার সহায়তা — রোগ নির্ণয় বা চিকিৎসার বিকল্প নয়।',
    disclaimerEn:
      'This is educational vaccination planning support — not a diagnosis or treatment substitute.',
    vetSupervisionBn: 'টিকা প্রয়োগের আগে লাইসেন্সপ্রাপ্ত পশুচিকিৎসকের পরামর্শ বাধ্যতামূলক।',
    vetSupervisionEn: 'Licensed veterinary supervision is required before vaccine administration.',
    notDiagnosisBn: 'এই সহায়ক রোগ নির্ণয় করে না।',
    notDiagnosisEn: 'This assistant does not diagnose disease.',
  };
}

export function buildVaccineSafetyReport(params: {
  entries: PublishedVaccineEntry[];
  eligibility: EligibilityResult[];
  missedAlerts: MissedVaccineAlert[];
  boosters: BoosterStatus[];
  interactions?: VaccineInteractionReport;
  pregnancy: boolean;
  pack?: KnowledgeContextPack;
}): VaccineSafetyReport {
  const warnings: VaccineSafetyReport['warnings'] = [];
  const blockReasons: string[] = [];
  const citations = [
    ...params.entries.map((e) => buildVaccineCitation(e)),
    ...params.eligibility.flatMap((e) => e.citations),
    ...params.missedAlerts.flatMap((a) => a.citations),
  ];

  for (const entry of params.entries) {
    const structured = parseVaccineStructured(entry.metadataJson);
    const temp = structured.storageTempC;
    if (temp !== undefined && temp <= 8) {
      warnings.push({
        code: 'VC-01',
        severity: 'CAUTION',
        messageBn: `টিকা ${entry.titleBn}: ২–৮°C এ সংরক্ষণ করুন; হিমায়িত করবেন না।`,
        messageEn: `Keep ${entry.titleEn} at cold chain temperature; do not freeze.`,
      });
    }
  }

  if (params.pregnancy) {
    warnings.push({
      code: 'VC-03',
      severity: 'HIGH',
      messageBn: 'গর্ভাবস্থায় টিকা — অবশ্যই পশুচিকিৎসকের পরামর্শ নিন।',
      messageEn: 'Pregnancy and vaccination — veterinary consultation required.',
    });
    blockReasons.push('PREGNANCY_VACCINE');
  }

  for (const alert of params.missedAlerts) {
    if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
      warnings.push({
        code: 'VC-04',
        severity: 'HIGH',
        messageBn: alert.messageBn,
        messageEn: alert.messageEn,
      });
      blockReasons.push('MISSED_CORE_VACCINE');
    }
  }

  for (const el of params.eligibility) {
    if (el.status === 'OVERDUE_PRIMARY') {
      warnings.push({
        code: 'VC-02',
        severity: 'CAUTION',
        messageBn: 'প্রাথমিক টিকার সময়সীমা পেরিয়ে যেতে পারে — ভেটের পরামর্শ নিন।',
        messageEn: 'Primary vaccination window may have passed — consult your vet.',
      });
    }
  }

  if (params.interactions?.overallRisk === 'CRITICAL') {
    blockReasons.push('INTERACTION_CONTRAINDICATED');
  }

  const routingBlock = params.pack?.routingDecision.action === 'BLOCK';
  if (routingBlock) blockReasons.push('VACCINE_SCHEDULE_BLOCK');

  let overallRisk: VaccineSafetyReport['overallRisk'] = 'LOW';
  if (params.interactions?.overallRisk === 'CRITICAL' || blockReasons.includes('INTERACTION_CONTRAINDICATED')) {
    overallRisk = 'CRITICAL';
  } else if (
    blockReasons.includes('MISSED_CORE_VACCINE') ||
    params.interactions?.overallRisk === 'HIGH' ||
    warnings.some((w) => w.severity === 'HIGH')
  ) {
    overallRisk = 'HIGH';
  } else if (warnings.length > 0 || params.interactions?.overallRisk === 'MODERATE') {
    overallRisk = 'MODERATE';
  }

  const escalationRequired =
    overallRisk === 'CRITICAL' ||
    overallRisk === 'HIGH' ||
    routingBlock ||
    blockReasons.length > 0;

  const escalationType =
    overallRisk === 'CRITICAL'
      ? 'VET_CALL_NOW'
      : routingBlock
        ? 'ASYNC_VET_REVIEW'
        : overallRisk === 'HIGH'
          ? 'VET_BOOKING'
          : undefined;

  return {
    reportId: randomUUID(),
    overallRisk,
    safetyClassification: overallRisk,
    warnings,
    eligibility: params.eligibility,
    missedAlerts: params.missedAlerts,
    ...(params.interactions !== undefined ? { interactions: params.interactions } : {}),
    escalationRequired,
    ...(escalationType !== undefined ? { escalationType } : {}),
    blockReasons,
    citations: [...new Map(citations.map((c) => [c.token, c])).values()],
  };
}
