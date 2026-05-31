import type { RawExtract } from '../knowledge-import.types.js';
import type { ValidationFailure } from '../knowledge-import.types.js';

export class ValidationPipelineService {
  readonly name = 'ValidationPipelineService';

  validateExtract(
    extract: RawExtract,
    context: {
      licenseActive: boolean;
      allowsAiExtraction: boolean;
      allowedDomains: string[];
    },
  ): { passed: boolean; failures: ValidationFailure[]; warnings: string[] } {
    const failures: ValidationFailure[] = [];
    const warnings: string[] = [];

    if (!context.licenseActive) {
      failures.push({ code: 'LICENSE_EXPIRED', message: 'Source license has expired' });
    }
    if (!context.allowsAiExtraction) {
      failures.push({ code: 'AI_EXTRACTION_DENIED', message: 'License blocks extraction' });
    }

    if (!extract.titleEn.trim() || !extract.bodyEn.trim()) {
      failures.push({ code: 'EN_REQUIRED', message: 'English title and body are required' });
    }

    if (!extract.titleBn.trim() || !extract.bodyBn.trim()) {
      warnings.push('BN_PENDING');
    }

    const domain = contentTypeToDomain(extract.contentType, extract.domain);
    if (!context.allowedDomains.includes(domain)) {
      failures.push({
        code: 'DOMAIN_NOT_ALLOWED',
        message: `Domain ${domain} not allowed for this source profile`,
      });
    }

    if (extract.contentType === 'MEDICINE') {
      const hasDose =
        Boolean(extract.structuredJson?.genericName) ||
        Boolean(extract.structuredJson?.speciesDoseMatrix) ||
        extract.bodyEn.toLowerCase().includes('dose');
      if (!hasDose) {
        failures.push({
          code: 'INCOMPLETE_CLINICAL',
          message: 'Medicine extract missing dose or generic name reference',
        });
      }
    }

    return { passed: failures.length === 0, failures, warnings };
  }
}

function contentTypeToDomain(contentType: string, domainOverride?: string): string {
  if (domainOverride) return domainOverride;
  const map: Record<string, string> = {
    DISEASE: 'DISEASE',
    MEDICINE: 'MEDICINE',
    VACCINE: 'VACCINE',
    FEED: 'FEED',
    FARM_MGMT: 'FARM_MGMT',
    EMERGENCY: 'EMERGENCY',
    BREED: 'BREED',
    REPRODUCTION: 'REPRODUCTION',
    CLINICAL_PROTOCOL: 'CLINICAL_PROTOCOL',
    REGULATORY_BD: 'REGULATORY_BD',
  };
  return map[contentType] ?? 'FARM_MGMT';
}

let service: ValidationPipelineService | null = null;

export function getValidationPipelineService(): ValidationPipelineService {
  if (!service) service = new ValidationPipelineService();
  return service;
}

export function resetValidationPipelineForTests(): void {
  service = null;
}
