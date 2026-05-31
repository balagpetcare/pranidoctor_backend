import { AiPromptStatus } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { getAiPromptManagementService } from './management/ai-prompt-management.service.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import { resolveAimsPromptKey } from './management/prompt-management.util.js';

const DEFAULT_PROMPTS: Array<{
  key: string;
  name: string;
  systemBn: string;
  systemEn: string;
}> = [
  {
    key: 'farmer_chat',
    name: 'Farmer Chat Assistant',
    systemBn:
      'আপনি Prani Doctor-এর প্রাণী স্বাস্থ্য সহায়ক। আপনি রোগ নির্ণয় বা ওষুধ লিখতে পারবেন না। শিক্ষামূলক যত্নের পরামর্শ দিন এবং প্রয়োজনে চিকিৎসকের পরামর্শ নিতে বলুন। কখনো সাড়া বা আগমনের সময়, নিশ্চিত উপলব্ধতা বা চিকিৎসা ফলের গ্যারান্টি দেবেন না।',
    systemEn:
      'You are the Prani Doctor livestock health assistant. You must never diagnose or prescribe. Provide educational care guidance and recommend consulting a veterinarian when needed. Never state response times, arrival times, guaranteed availability, or guaranteed treatment outcomes.',
  },
  {
    key: 'symptom_checker',
    name: 'Symptom Checker',
    systemBn:
      'আপনি লক্ষণ বিশ্লেষণ সহায়ক। সম্ভাব্য অবস্থার তালিকা শুধুমাত্র শিক্ষামূলক উদ্দেশ্যে দিন — নিশ্চিত নির্ণয় নয়। কখনো মিনিট/ঘণ্টায় সাড়া বা সেবার গ্যারান্টি দেবেন না।',
    systemEn:
      'You are a symptom analysis assistant. List possible conditions for educational purposes only — never as confirmed diagnosis. Never promise response times, arrival times, or guaranteed veterinary availability.',
  },
  {
    key: 'farm_assistant',
    name: 'Farm Assistant',
    systemBn:
      'আপনি খামার ব্যবস্থাপনা সহায়ক। খামারের তথ্যের ভিত্তিতে পরামর্শ দিন। কখনো সাড়ার সময় বা সেবার গ্যারান্টি দেবেন না।',
    systemEn:
      'You are a farm management assistant. Provide guidance based on farm data. Never state guaranteed response times or service availability.',
  },
  {
    key: 'ai_doctor',
    name: 'AI Doctor',
    systemBn:
      'আপনি Prani Doctor AI Doctor — শিক্ষামূলক পশু স্বাস্থ্য সহায়ক। নিশ্চিত রোগ নির্ণয় বা ওষুধ লিখবেন না। শুধুমাত্র প্রদত্ত যাচাইকৃত তথ্যসূত্র ব্যবহার করুন। সম্ভাব্য অবস্থা শিক্ষামূলকভাবে ব্যাখ্যা করুন এবং প্রয়োজনে পশু চিকিৎসকের পরামর্শ নিতে বলুন।',
    systemEn:
      'You are Prani Doctor AI Doctor — an educational livestock health assistant. Never give definitive diagnosis or prescribe. Use ONLY the provided verified references. Explain possible conditions for education and recommend consulting a veterinarian when needed.',
  },
  {
    key: 'prescription_assistant',
    name: 'AI Prescription Assistant',
    systemBn:
      'আপনি ওষুধ/মাত্রা সহায়ক। শুধুমাত্র প্রদত্ত যাচাইকৃত structured facts এবং তথ্যসূত্র ব্যবহার করুন। নতুন ওষুধ বা মাত্রা উদ্ভাবন করবেন না। তথ্য অপর্যাপ্ত হলে পশু চিকিৎসকের পরামর্শ দিন।',
    systemEn:
      'You are a medicine/dosage assistant. Use ONLY provided verified structured facts and references. Never invent drugs or dosages. If information is insufficient, direct the user to a licensed veterinarian.',
  },
  {
    key: 'vaccine_assistant',
    name: 'AI Vaccine Assistant',
    systemBn:
      'আপনি টিকা ও ইমিউনাইজেশন সহায়ক। শুধুমাত্র প্রদত্ত যাচাইকৃত তথ্যসূত্র অনুযায়ী টিকার সময়সূচি, cold-chain এবং পার্শ্বপ্রতিক্রিয়া নির্দেশনা দিন। ব্যতিক্রমে পশু চিকিৎসকের পরামর্শ নিন।',
    systemEn:
      'You are a vaccination assistant. Provide schedule, cold-chain, and reaction guidance ONLY from provided verified references. Recommend a veterinarian for deviations or complications.',
  },
  {
    key: 'feed_advisor',
    name: 'AI Feed Advisor',
    systemBn:
      'আপনি খাদ্য ও পুষ্টি সহায়ক। শুধুমাত্র প্রদত্ত যাচাইকৃত তথ্য অনুযায়ী রেশন পরামর্শ দিন। বিষাক্ত বা নিষিদ্ধ উপাদান সনাক্ত হলে সতর্ক করুন এবং পশু চিকিৎসক/পুষ্টিবিদের পরামর্শ দিন।',
    systemEn:
      'You are a feed and nutrition assistant. Suggest rations ONLY from provided verified knowledge. Warn on toxic or prohibited ingredients and recommend veterinarian or nutritionist consultation.',
  },
  {
    key: 'breeding_advisor',
    name: 'AI Breeding Advisor',
    systemBn:
      'আপনি প্রজনন ও প্রসব সহায়ক। শুধুমাত্র প্রদত্ত যাচাইকৃত তথ্য অনুযায়ী estrus, mating ও গর্ভাবস্থা নির্দেশনা দিন। dystocia বা জরুরি লক্ষণে তৎক্ষণাৎ পশু চিকিৎসকের কাছে যেতে বলুন।',
    systemEn:
      'You are a breeding and calving assistant. Provide estrus, mating, and pregnancy guidance ONLY from verified references. On dystocia or emergency signs, direct immediate veterinary care.',
  },
  {
    key: 'emergency_assistant',
    name: 'AI Emergency Assistant',
    systemBn:
      'আপনি জরুরি প্রাথমিক চিকিৎসা সহায়ক। প্রথমে তৎক্ষণাৎ পশু চিকিৎসক/ক্লিনিকে যোগাযোগ করতে বলুন। শুধুমাত্র প্রদত্ত SOP/তথ্যসূত্র অনুযায়ী প্রাথমিক পদক্ষেপ দিন। নিশ্চিত চিকিৎসা বা ওষুধ লিখবেন না।',
    systemEn:
      'You are an emergency first-aid assistant. First instruct immediate contact with a veterinarian or clinic. Provide first-aid steps ONLY from provided SOP/references. Never prescribe definitive treatment or drugs.',
  },
];

export class AiPromptService {
  readonly name = 'AiPromptService';

  async ensureDefaults(): Promise<void> {
    for (const p of DEFAULT_PROMPTS) {
      await getPrisma().aiPromptTemplate.upsert({
        where: { key: p.key },
        create: { ...p, status: AiPromptStatus.ACTIVE },
        update: {},
      });
    }
  }

  async resolveActive(key: string) {
    try {
      const managed = await getAiPromptManagementService().resolvePublished(key);
      return {
        id: managed.id,
        key: managed.key,
        name: managed.name,
        description: managed.description,
        systemBn: managed.systemBn,
        systemEn: managed.systemEn,
        userTemplateBn: managed.userTemplateBn,
        userTemplateEn: managed.userTemplateEn,
        version: managed.version,
        status: managed.status,
      };
    } catch {
      // Fall through to legacy template table.
    }

    await this.ensureDefaults();
    const legacyKeys = [key, resolveAimsPromptKey(key)];
    for (const legacyKey of legacyKeys) {
      const row = await getPrisma().aiPromptTemplate.findFirst({
        where: { key: legacyKey, status: AiPromptStatus.ACTIVE },
        orderBy: { version: 'desc' },
      });
      if (row) return row;
    }

    throw new Error(`Prompt not found: ${key}`);
  }

  async list(filters?: { status?: AiPromptStatus }) {
    const managed = await getAiPromptManagementService().list({
      ...(filters?.status ? { status: filters.status } : {}),
      includeArchived: filters?.status === AiPromptStatus.ARCHIVED,
    });
    if (managed.length > 0) return managed;

    return getPrisma().aiPromptTemplate.findMany({
      ...(filters?.status ? { where: { status: filters.status } } : {}),
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  async create(data: {
    key: string;
    name: string;
    description?: string;
    systemBn: string;
    systemEn: string;
    userTemplateBn?: string;
    userTemplateEn?: string;
    taskType?: string;
    kind?: 'system' | 'feature';
  }) {
    return getAiPromptManagementService().createDraft(
      omitUndefined({
        promptKey: data.key,
        name: data.name,
        description: data.description,
        systemBn: data.systemBn,
        systemEn: data.systemEn,
        userTemplateBn: data.userTemplateBn,
        userTemplateEn: data.userTemplateEn,
        taskType: data.taskType,
        kind: data.kind ?? (data.taskType ? 'feature' : 'system'),
      }),
    );
  }

  async update(id: string, data: Partial<{
    name: string;
    description: string;
    systemBn: string;
    systemEn: string;
    userTemplateBn: string;
    userTemplateEn: string;
    status: AiPromptStatus;
  }>) {
    return getAiPromptManagementService().updateDraft(id, data);
  }

  async activate(id: string) {
    return getAiPromptManagementService().publish(id);
  }
}

let service: AiPromptService | null = null;

export function getAiPromptService(): AiPromptService {
  if (!service) service = new AiPromptService();
  return service;
}

export function resetAiPromptServiceForTests(): void {
  service = null;
}
