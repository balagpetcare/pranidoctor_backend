import {
  DEFAULT_AI_CONSENT_SUMMARY,
  DEFAULT_PRIVACY_SUMMARY,
  DEFAULT_TERMS_SUMMARY,
  DEFAULT_AI_CONSENT_VERSION,
  DEFAULT_PRIVACY_VERSION,
  DEFAULT_TERMS_VERSION,
} from '../../legacy/web/lib/mobile-settings/legal-defaults.js';

import { LEGAL_DOCUMENT_KEYS } from './document-keys.js';
import { upsertLegalDocument } from './legal-acceptance.service.js';

const CURRENT_VERSION = DEFAULT_TERMS_VERSION;

const PROVIDER_DOCTOR_SUMMARY = `As a veterinary provider on Prani Doctor you confirm that you hold a valid license, that clinical decisions are your sole responsibility, and that you will provide care consistent with professional standards.

You agree not to share customer contact details outside the platform and to maintain accurate availability and service area information.`;

const PROVIDER_TECHNICIAN_SUMMARY = `As an AI / livestock service provider you confirm that listings and service records are accurate, that you operate within your verified service areas, and that you comply with applicable breeding and animal welfare regulations.

You are an independent contractor, not an employee of Prani Doctor.`;

const ADMIN_AUP_SUMMARY = `Prani Doctor personnel agree to protect customer and provider data, use admin tools only for authorized operations, and follow audit and verification procedures.

Unauthorized data export, credential sharing, or bypass of moderation workflows is prohibited.`;

const ENTERPRISE_SUMMARY = `Enterprise service submitters warrant that semen and livestock service listings are accurate, that media is owned or licensed, and that published offerings comply with applicable regulations.

Prani Doctor may reject, archive, or unpublish submissions that violate platform policies.`;

type SeedDoc = {
  documentKey: string;
  locale: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  publicUrl?: string;
};

function customerDocs(): SeedDoc[] {
  const baseUrl = process.env.MOBILE_TERMS_OF_SERVICE_URL?.trim() || 'https://pranidoctor.com/terms';
  const privacyUrl = process.env.MOBILE_PRIVACY_POLICY_URL?.trim() || 'https://pranidoctor.com/privacy';

  return [
    {
      documentKey: LEGAL_DOCUMENT_KEYS.TOS_CUSTOMER,
      locale: 'bn-BD',
      title: 'সেবার শর্তাবলী',
      summary: DEFAULT_TERMS_SUMMARY,
      contentMarkdown: `${DEFAULT_TERMS_SUMMARY}\n\nসম্পূর্ণ নীতি: ${baseUrl}`,
      publicUrl: baseUrl,
    },
    {
      documentKey: LEGAL_DOCUMENT_KEYS.TOS_CUSTOMER,
      locale: 'en-US',
      title: 'Terms of Service',
      summary: DEFAULT_TERMS_SUMMARY,
      contentMarkdown: `${DEFAULT_TERMS_SUMMARY}\n\nFull policy: ${baseUrl}`,
      publicUrl: baseUrl,
    },
    {
      documentKey: LEGAL_DOCUMENT_KEYS.PRIVACY_POLICY,
      locale: 'bn-BD',
      title: 'গোপনীয়তা নীতি',
      summary: DEFAULT_PRIVACY_SUMMARY,
      contentMarkdown: `${DEFAULT_PRIVACY_SUMMARY}\n\nসম্পূর্ণ নীতি: ${privacyUrl}`,
      publicUrl: privacyUrl,
    },
    {
      documentKey: LEGAL_DOCUMENT_KEYS.PRIVACY_POLICY,
      locale: 'en-US',
      title: 'Privacy Policy',
      summary: DEFAULT_PRIVACY_SUMMARY,
      contentMarkdown: `${DEFAULT_PRIVACY_SUMMARY}\n\nFull policy: ${privacyUrl}`,
      publicUrl: privacyUrl,
    },
    {
      documentKey: LEGAL_DOCUMENT_KEYS.AI_CONSENT,
      locale: 'bn-BD',
      title: 'AI প্রক্রিয়াকরণ সম্মতি',
      summary: DEFAULT_AI_CONSENT_SUMMARY,
      contentMarkdown: DEFAULT_AI_CONSENT_SUMMARY,
      publicUrl: privacyUrl,
    },
    {
      documentKey: LEGAL_DOCUMENT_KEYS.AI_CONSENT,
      locale: 'en-US',
      title: 'AI Processing Consent',
      summary: DEFAULT_AI_CONSENT_SUMMARY,
      contentMarkdown: DEFAULT_AI_CONSENT_SUMMARY,
      publicUrl: privacyUrl,
    },
  ];
}

function providerDocs(): SeedDoc[] {
  return [
    {
      documentKey: LEGAL_DOCUMENT_KEYS.TOS_PROVIDER_DOCTOR,
      locale: 'en-US',
      title: 'Veterinary Provider Agreement',
      summary: PROVIDER_DOCTOR_SUMMARY,
      contentMarkdown: PROVIDER_DOCTOR_SUMMARY,
      publicUrl: 'https://pranidoctor.com/terms/providers/doctors',
    },
    {
      documentKey: LEGAL_DOCUMENT_KEYS.TOS_PROVIDER_DOCTOR,
      locale: 'bn-BD',
      title: 'ভেটেরিনারি সেবাদাতা চুক্তি',
      summary: PROVIDER_DOCTOR_SUMMARY,
      contentMarkdown: PROVIDER_DOCTOR_SUMMARY,
      publicUrl: 'https://pranidoctor.com/terms/providers/doctors',
    },
    {
      documentKey: LEGAL_DOCUMENT_KEYS.TOS_PROVIDER_TECHNICIAN,
      locale: 'en-US',
      title: 'AI Technician Provider Agreement',
      summary: PROVIDER_TECHNICIAN_SUMMARY,
      contentMarkdown: PROVIDER_TECHNICIAN_SUMMARY,
      publicUrl: 'https://pranidoctor.com/terms/providers/technicians',
    },
    {
      documentKey: LEGAL_DOCUMENT_KEYS.TOS_ADMIN,
      locale: 'en-US',
      title: 'Admin Acceptable Use Policy',
      summary: ADMIN_AUP_SUMMARY,
      contentMarkdown: ADMIN_AUP_SUMMARY,
      publicUrl: 'https://pranidoctor.com/legal/acceptable-use',
    },
    {
      documentKey: LEGAL_DOCUMENT_KEYS.TOS_ENTERPRISE,
      locale: 'en-US',
      title: 'Enterprise Listing Terms',
      summary: ENTERPRISE_SUMMARY,
      contentMarkdown: ENTERPRISE_SUMMARY,
      publicUrl: 'https://pranidoctor.com/terms/enterprise',
    },
  ];
}

/** Idempotent seed of published legal documents for the current version. */
export async function seedLegalDocuments(): Promise<void> {
  const version = CURRENT_VERSION;
  const all = [...customerDocs(), ...providerDocs()];

  for (const doc of all) {
    await upsertLegalDocument({
      documentKey: doc.documentKey,
      version,
      locale: doc.locale,
      title: doc.title,
      summary: doc.summary,
      contentMarkdown: doc.contentMarkdown,
      publicUrl: doc.publicUrl ?? null,
      requiresReaccept: false,
    });
  }
}

export { CURRENT_VERSION as LEGAL_DOCUMENT_CURRENT_VERSION };
