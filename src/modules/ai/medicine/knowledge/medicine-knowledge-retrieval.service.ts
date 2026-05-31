import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getKnowledgeRetrievalService } from '../../knowledge-retrieval/knowledge-retrieval.service.js';
import type { 
  KnowledgeContextPack, 
  RetrievalRequest, 
  RetrievedChunk 
} from '../../knowledge-retrieval/knowledge-retrieval.types.js';
import { getMedicineKnowledgeService } from './medicine-knowledge.service.js';
import { getGenericBrandMappingService } from '../mapping/generic-brand-mapping.service.js';
import type { MedicineGenericView, MedicineBrandView } from '../medicine.types.js';

export type MedicineKnowledgeRetrievalContext = {
  genericCode?: string;
  brandCode?: string;
  companyCode?: string;
  species?: LivestockSpecies;
  indicationType?: string;
  contraindicationType?: string;
  interactionCheck?: boolean;
  withdrawalInfo?: boolean;
};

export type EnrichedMedicineKnowledge = {
  knowledgeContext: KnowledgeContextPack;
  medicineContext?: {
    generic?: MedicineGenericView;
    brands?: MedicineBrandView[];
    relatedGenerics?: MedicineGenericView[];
    safetyWarnings?: string[];
    clinicalNotes?: string[];
  };
  retrievalMetadata: {
    medicineEntitiesFound: number;
    brandMappingsFound: number;
    safetyFlagsTriggered: string[];
    knowledgeGapsDetected: string[];
  };
};

export class MedicineKnowledgeRetrievalService {
  readonly name = 'MedicineKnowledgeRetrievalService';

  private knowledgeRetrieval = getKnowledgeRetrievalService();
  private medicineKnowledge = getMedicineKnowledgeService();
  private mappingService = getGenericBrandMappingService();

  /**
   * Retrieve medicine knowledge with enhanced context from Medicine Intelligence
   */
  async retrieveWithMedicineContext(
    query: string,
    context: MedicineKnowledgeRetrievalContext,
    sessionId?: string,
  ): Promise<EnrichedMedicineKnowledge> {
    // First, get base knowledge retrieval
    const retrievalRequest: RetrievalRequest = {
      query,
      profileId: 'prescription-v1', // Use medicine-focused profile
      sessionId: sessionId || `medicine-${Date.now()}`,
      taskType: 'PRESCRIPTION_ANALYSIS',
      species: context.species,
      locale: 'en',
    };

    const knowledgeContext = await this.knowledgeRetrieval.retrieve(retrievalRequest);

    // Enrich with medicine intelligence data
    const medicineContext = await this.enrichWithMedicineIntelligence(query, context);

    // Detect knowledge gaps and safety issues
    const metadata = await this.buildRetrievalMetadata(knowledgeContext, medicineContext, context);

    return {
      knowledgeContext,
      medicineContext,
      retrievalMetadata: metadata,
    };
  }

  /**
   * Get medicine-specific knowledge for a generic drug
   */
  async getMedicineKnowledgeForGeneric(
    genericCode: string,
    context: { species?: LivestockSpecies; includeContraindications?: boolean }
  ): Promise<{
    generic: MedicineGenericView | null;
    brands: MedicineBrandView[];
    knowledgeEntries: RetrievedChunk[];
    safetyWarnings: string[];
  }> {
    const genericRegistry = this.medicineKnowledge.getGenericRegistry();
    const mappingService = this.mappingService;

    // Get generic details
    const generic = await genericRegistry.getByCode(genericCode);
    if (!generic) {
      return { generic: null, brands: [], knowledgeEntries: [], safetyWarnings: [] };
    }

    // Get associated brands
    const brands = await mappingService.getBrandsForGenericCode(genericCode);

    // Get knowledge entries linked to this generic
    const knowledgeEntries: RetrievedChunk[] = [];
    if (generic.knowledgeEntryId) {
      const retrievalRequest: RetrievalRequest = {
        query: `${generic.genericNameEn} ${generic.drugClass || ''} ${context.species || ''}`.trim(),
        profileId: 'prescription-v1',
        sessionId: `generic-lookup-${Date.now()}`,
        taskType: 'PRESCRIPTION_ANALYSIS',
        species: context.species,
        locale: 'en',
      };

      const knowledgeContext = await this.knowledgeRetrieval.retrieve(retrievalRequest);
      knowledgeEntries.push(...knowledgeContext.chunks);
    }

    // Generate safety warnings
    const safetyWarnings = this.generateSafetyWarnings(generic, context);

    return { generic, brands, knowledgeEntries, safetyWarnings };
  }

  /**
   * Search for medicine knowledge with intelligent disambiguation
   */
  async searchMedicineKnowledge(
    query: string,
    options: {
      species?: LivestockSpecies;
      preferGeneric?: boolean;
      includeAlternatives?: boolean;
      limit?: number;
    }
  ): Promise<{
    matches: Array<{
      type: 'generic' | 'brand';
      entity: MedicineGenericView | MedicineBrandView;
      confidence: number;
      reasonCode: string;
    }>;
    suggestions: string[];
    knowledgeContext: KnowledgeContextPack;
  }> {
    // Get AI-powered knowledge retrieval first
    const retrievalRequest: RetrievalRequest = {
      query,
      profileId: 'prescription-v1',
      sessionId: `medicine-search-${Date.now()}`,
      taskType: 'PRESCRIPTION_ANALYSIS',
      species: options.species,
      locale: 'en',
    };

    const knowledgeContext = await this.knowledgeRetrieval.retrieve(retrievalRequest);

    // Search medicine entities
    const genericMatches = await this.medicineKnowledge.searchMedicines(query, {
      species: options.species,
      limit: options.limit || 10,
    });

    // Enhance with confidence scoring based on knowledge context
    const enhancedMatches = await Promise.all(
      genericMatches.items.map(async (match) => {
        const confidence = this.calculateMedicineMatchConfidence(match, knowledgeContext, query);
        const reasonCode = this.determineMedicineMatchReason(match, knowledgeContext);

        if (match.type === 'generic') {
          return {
            type: 'generic' as const,
            entity: match.generic,
            confidence,
            reasonCode,
          };
        } else {
          return {
            type: 'brand' as const,
            entity: match.brand,
            confidence,
            reasonCode,
          };
        }
      })
    );

    // Generate suggestions for refinement
    const suggestions = this.generateSearchSuggestions(query, enhancedMatches, options);

    return {
      matches: enhancedMatches.sort((a, b) => b.confidence - a.confidence),
      suggestions,
      knowledgeContext,
    };
  }

  private async enrichWithMedicineIntelligence(
    query: string,
    context: MedicineKnowledgeRetrievalContext
  ) {
    const medicineContext: any = {
      safetyWarnings: [],
      clinicalNotes: [],
    };

    // Resolve generic if provided
    if (context.genericCode) {
      medicineContext.generic = await this.medicineKnowledge.getGenericRegistry().getByCode(context.genericCode);
      if (medicineContext.generic) {
        medicineContext.brands = await this.mappingService.getBrandsForGenericCode(context.genericCode);
        medicineContext.relatedGenerics = await this.mappingService.findSameTherapeuticClassGenerics(medicineContext.generic.id);
      }
    }

    // Resolve brand if provided
    if (context.brandCode) {
      const brand = await this.medicineKnowledge.getBrandRegistry().getByCode(context.brandCode);
      if (brand) {
        medicineContext.brands = [brand];
        medicineContext.generic = await this.medicineKnowledge.getGenericRegistry().getById(brand.genericId);
      }
    }

    // Add safety warnings based on context
    if (medicineContext.generic) {
      const safetyWarnings = this.generateSafetyWarnings(medicineContext.generic, context);
      medicineContext.safetyWarnings.push(...safetyWarnings);
    }

    return medicineContext;
  }

  private async buildRetrievalMetadata(
    knowledgeContext: KnowledgeContextPack,
    medicineContext: any,
    requestContext: MedicineKnowledgeRetrievalContext
  ) {
    const metadata = {
      medicineEntitiesFound: 0,
      brandMappingsFound: 0,
      safetyFlagsTriggered: [],
      knowledgeGapsDetected: [],
    };

    // Count medicine entities found
    if (medicineContext?.generic) metadata.medicineEntitiesFound++;
    if (medicineContext?.brands?.length) {
      metadata.medicineEntitiesFound += medicineContext.brands.length;
      metadata.brandMappingsFound = medicineContext.brands.length;
    }

    // Detect safety flags
    if (medicineContext?.generic?.bannedSubstance) {
      metadata.safetyFlagsTriggered.push('BANNED_SUBSTANCE');
    }
    if (medicineContext?.generic?.controlledSubstance) {
      metadata.safetyFlagsTriggered.push('CONTROLLED_SUBSTANCE');
    }
    if (medicineContext?.generic?.prescriptionRequired) {
      metadata.safetyFlagsTriggered.push('PRESCRIPTION_REQUIRED');
    }

    // Detect knowledge gaps
    if (knowledgeContext.chunks.length === 0) {
      metadata.knowledgeGapsDetected.push('NO_KNOWLEDGE_CHUNKS');
    }
    if (!medicineContext?.generic && requestContext.genericCode) {
      metadata.knowledgeGapsDetected.push('GENERIC_NOT_FOUND');
    }
    if (medicineContext?.brands?.length === 0 && medicineContext?.generic) {
      metadata.knowledgeGapsDetected.push('NO_BRANDS_AVAILABLE');
    }

    return metadata;
  }

  private generateSafetyWarnings(
    generic: MedicineGenericView, 
    context: { species?: LivestockSpecies; [key: string]: any }
  ): string[] {
    const warnings: string[] = [];

    if (generic.bannedSubstance) {
      warnings.push(`${generic.genericNameEn} is a banned substance and should not be used`);
    }

    if (generic.controlledSubstance) {
      warnings.push(`${generic.genericNameEn} is a controlled substance requiring special authorization`);
    }

    if (generic.prescriptionRequired) {
      warnings.push(`${generic.genericNameEn} requires a veterinary prescription`);
    }

    if (context.species && generic.species?.length) {
      if (!generic.species.includes(context.species)) {
        warnings.push(`${generic.genericNameEn} may not be suitable for ${context.species.toLowerCase()}`);
      }
    }

    if (generic.defaultWithdrawalMeatDays && generic.defaultWithdrawalMeatDays > 0) {
      warnings.push(`Meat withdrawal period: ${generic.defaultWithdrawalMeatDays} days`);
    }

    if (generic.defaultWithdrawalMilkDays && generic.defaultWithdrawalMilkDays > 0) {
      warnings.push(`Milk withdrawal period: ${generic.defaultWithdrawalMilkDays} days`);
    }

    return warnings;
  }

  private calculateMedicineMatchConfidence(
    match: any,
    knowledgeContext: KnowledgeContextPack,
    query: string
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost if found in knowledge base
    const hasKnowledgeMatch = knowledgeContext.chunks.some(chunk => 
      chunk.title.toLowerCase().includes(match.nameEn?.toLowerCase() || match.genericNameEn?.toLowerCase() || '')
    );
    if (hasKnowledgeMatch) confidence += 0.3;

    // Boost for exact name match
    const queryLower = query.toLowerCase();
    const entityName = (match.nameEn || match.genericNameEn || '').toLowerCase();
    if (entityName === queryLower) confidence += 0.2;
    else if (entityName.includes(queryLower) || queryLower.includes(entityName)) confidence += 0.1;

    // Boost for active status
    if (match.isActive) confidence += 0.1;

    // Penalty for banned/controlled substances
    if (match.bannedSubstance) confidence -= 0.2;
    if (match.controlledSubstance) confidence -= 0.1;

    return Math.min(Math.max(confidence, 0), 1);
  }

  private determineMedicineMatchReason(match: any, knowledgeContext: KnowledgeContextPack): string {
    if (match.bannedSubstance) return 'BANNED_SUBSTANCE';
    if (match.controlledSubstance) return 'CONTROLLED_SUBSTANCE';
    if (!match.isActive) return 'INACTIVE_MEDICINE';
    if (match.prescriptionRequired) return 'PRESCRIPTION_REQUIRED';
    
    const hasKnowledgeMatch = knowledgeContext.chunks.some(chunk => 
      chunk.title.toLowerCase().includes(match.nameEn?.toLowerCase() || match.genericNameEn?.toLowerCase() || '')
    );
    if (hasKnowledgeMatch) return 'KNOWLEDGE_VERIFIED';
    
    return 'REGISTRY_MATCH';
  }

  private generateSearchSuggestions(
    query: string,
    matches: any[],
    options: any
  ): string[] {
    const suggestions: string[] = [];

    if (matches.length === 0) {
      suggestions.push('Try searching by generic name instead of brand name');
      suggestions.push('Check spelling and try alternative names');
      suggestions.push('Use therapeutic category (e.g., "antibiotic", "anthelmintic")');
    } else if (matches.length > 10) {
      suggestions.push('Add species filter to narrow results');
      suggestions.push('Include indication (e.g., "mastitis", "diarrhea")');
      suggestions.push('Try more specific terms');
    }

    // Add species-specific suggestions
    if (!options.species) {
      suggestions.push('Specify target species for better results');
    }

    return suggestions.slice(0, 5); // Limit suggestions
  }
}

let service: MedicineKnowledgeRetrievalService | null = null;

export function getMedicineKnowledgeRetrievalService(): MedicineKnowledgeRetrievalService {
  if (!service) service = new MedicineKnowledgeRetrievalService();
  return service;
}

export function resetMedicineKnowledgeRetrievalServiceForTests(): void {
  service = null;
}