import { randomUUID } from 'node:crypto';

import type { KnowledgeContextPack } from '../../knowledge-retrieval/knowledge-retrieval.types.js';
import type {
  EscalationType,
  PrescriptionAccessMode,
  PrescriptionLocale,
  PrescriptionSafetyReport,
  SafetyRiskLevel,
  SafetyWarning,
} from '../ai-prescription.types.js';
import { evaluateContraindications } from './contraindication.engine.js';
import { analyzeDrugInteractions } from './interaction.engine.js';
import {
  isAntimicrobialClass,
  parseMedicineStructured,
  type PublishedMedicineEntry,
} from './medicine-metadata.util.js';
import { evaluateSpeciesEligibility, evaluateAgeEligibility } from './species-eligibility.engine.js';
import { resolveWithdrawalSummaries } from './withdrawal.engine.js';
import { evaluateVaccineMedicineConflicts } from './vaccine-interaction.engine.js';

function maxRisk(a: SafetyRiskLevel, b: SafetyRiskLevel): SafetyRiskLevel {
  const order: SafetyRiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

export async function buildPrescriptionSafetyReport(params: {
  entries: PublishedMedicineEntry[];
  species: import('../../../../generated/prisma/index.js').LivestockSpecies;
  locale: PrescriptionLocale;
  mode: PrescriptionAccessMode;
  pregnancy: boolean;
  lactating: boolean;
  vaccineSlugs: string[];
  ageDays?: number;
  pack?: KnowledgeContextPack;
}): Promise<PrescriptionSafetyReport> {
  const warnings: SafetyWarning[] = [];
  const blockReasons: string[] = [];
  let overallRisk: SafetyRiskLevel = 'LOW';
  let escalationRequired = false;
  let escalationType: EscalationType | undefined;

  for (const entry of params.entries) {
    const structured = parseMedicineStructured(entry.metadataJson);

    if (structured.bannedSubstance) {
      overallRisk = 'CRITICAL';
      blockReasons.push('BANNED_SUBSTANCE');
      warnings.push({
        code: 'PX-07-BANNED',
        severity: 'CRITICAL',
        messageBn: `${entry.titleBn}: নিষিদ্ধ পদার্থ — ব্যবহারযোগ্য নয়`,
        messageEn: `${entry.titleEn}: banned substance — not permitted`,
        citationRequired: true,
      });
      escalationRequired = true;
      escalationType = 'REGULATORY_REFERRAL';
    }

    const speciesResult = evaluateSpeciesEligibility(entry, params.species);
    if (speciesResult === 'OFF_LABEL') {
      overallRisk = maxRisk(overallRisk, 'HIGH');
      blockReasons.push('OFF_LABEL_SPECIES');
      warnings.push({
        code: 'SP-05-OFF-LABEL',
        severity: 'HIGH',
        messageBn: `${entry.titleBn}: এই প্রজাতির জন্য যাচাইকৃত তথ্য নেই`,
        messageEn: `${entry.titleEn}: no verified data for this species`,
        citationRequired: true,
      });
      escalationRequired = true;
      escalationType = escalationType ?? 'VET_BOOKING';
    }

    if (params.ageDays !== undefined) {
      const ageCheck = evaluateAgeEligibility(entry, params.species, params.ageDays);
      if (!ageCheck.eligible) {
        overallRisk = maxRisk(overallRisk, 'HIGH');
        blockReasons.push('AGE_RESTRICTION');
        warnings.push({
          code: 'AGE-RESTRICTION',
          severity: 'HIGH',
          messageBn: `${entry.titleBn}: এই বয়সের জন্য যাচাইকৃত মাত্রা তথ্য নেই`,
          messageEn: `${entry.titleEn}: no verified dose data for this age band`,
          citationRequired: true,
        });
        escalationRequired = true;
        escalationType = escalationType ?? 'VET_BOOKING';
      }
    }

    if (
      params.mode === 'FARMER_REFERENCE' &&
      isAntimicrobialClass(structured.drugClass, structured.antimicrobialClass)
    ) {
      overallRisk = maxRisk(overallRisk, 'HIGH');
      warnings.push({
        code: 'SP-09-ANTIBIOTIC',
        severity: 'HIGH',
        messageBn: 'অ্যান্টিবায়োটিক — শুধুমাত্র পশুচিকিত্সকের তত্ত্বাবধানে',
        messageEn: 'Antibiotic — licensed veterinary supervision required',
        citationRequired: true,
      });
      escalationRequired = true;
      escalationType = escalationType ?? 'VET_BOOKING';
    }
  }

  const contraindications = evaluateContraindications({
    entries: params.entries,
    species: params.species,
    pregnancy: params.pregnancy,
    lactating: params.lactating,
    locale: params.locale,
  });

  for (const ci of contraindications) {
    if (ci.severity === 'ABSOLUTE') {
      overallRisk = maxRisk(overallRisk, 'CRITICAL');
      escalationRequired = true;
      escalationType = escalationType ?? 'VET_CALL_NOW';
    } else if (ci.severity === 'RELATIVE') {
      overallRisk = maxRisk(overallRisk, 'HIGH');
    }
  }

  const interactionBundle = analyzeDrugInteractions(params.entries);
  overallRisk = maxRisk(overallRisk, interactionBundle.overallRisk);

  if (interactionBundle.pairs.some((p) => p.severity === 'CONTRAINDICATED')) {
    blockReasons.push('CONTRAINDICATED_INTERACTION');
    escalationRequired = true;
    escalationType = escalationType ?? 'VET_CALL_NOW';
  }

  if (interactionBundle.unresolvedPairs.length > 0 && params.entries.length >= 2) {
    overallRisk = maxRisk(overallRisk, 'MODERATE');
    warnings.push({
      code: 'UNRESOLVED_INTERACTION',
      severity: 'CAUTION',
      messageBn: 'কিছু ওষুধের মধ্যে মিথস্ক্রিয়া তথ্য অসম্পূর্ণ — পশুচিকিত্সকের পরামর্শ নিন',
      messageEn: 'Incomplete interaction data — consult a veterinarian',
      citationRequired: false,
    });
    escalationRequired = true;
    escalationType = escalationType ?? 'ASYNC_VET_REVIEW';
  }

  const vaccineConflicts = await evaluateVaccineMedicineConflicts({
    medicineEntries: params.entries,
    vaccineSlugs: params.vaccineSlugs,
  });

  for (const vc of vaccineConflicts) {
    if (vc.severity === 'SEVERE') {
      overallRisk = maxRisk(overallRisk, 'HIGH');
      escalationRequired = true;
      escalationType = escalationType ?? 'VET_BOOKING';
    }
  }

  const withdrawalSummaries = resolveWithdrawalSummaries(params.entries, params.species);
  const withdrawalSummary =
    withdrawalSummaries.find((w) => w.periods.length > 0) ?? withdrawalSummaries[0];

  if (params.pack?.routingDecision.action === 'BLOCK') {
    overallRisk = maxRisk(overallRisk, 'HIGH');
    blockReasons.push(params.pack.routingDecision.reason);
    escalationRequired = true;
    escalationType = escalationType ?? 'VET_BOOKING';
  }

  const citations = [
    ...params.entries.flatMap((e) => [
      {
        token: `[cite:${e.slug}]`,
        entityId: e.id,
        slug: e.slug,
        sourceKey: e.sourceKey ?? e.slug,
        evidenceLevel: e.evidenceLevel,
      },
    ]),
    ...(params.pack?.chunks.map((c) => ({
      token: c.inlineCitation,
      entityId: c.knowledgeEntryId,
      slug: c.slug,
      sourceKey: c.sources[0]?.sourceKey ?? c.slug,
      evidenceLevel: c.evidenceLevel,
    })) ?? []),
  ];

  const uniqueCitations = [...new Map(citations.map((c) => [c.token, c])).values()];

  return {
    reportId: randomUUID(),
    overallRisk,
    safetyClassification: overallRisk,
    warnings,
    contraindications,
    interactions: interactionBundle.pairs,
    vaccineConflicts,
    ...(withdrawalSummary && withdrawalSummary.periods.length > 0
      ? { withdrawalSummary }
      : {}),
    escalationRequired,
    ...(escalationType !== undefined ? { escalationType } : {}),
    blockReasons,
    citations: uniqueCitations,
  };
}
