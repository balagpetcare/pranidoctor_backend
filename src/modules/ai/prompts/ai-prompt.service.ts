import { AiPromptStatus } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
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
    await this.ensureDefaults();
    const row = await getPrisma().aiPromptTemplate.findFirst({
      where: { key, status: AiPromptStatus.ACTIVE },
      orderBy: { version: 'desc' },
    });
    if (!row) {
      throw new Error(`Prompt not found: ${key}`);
    }
    return row;
  }

  async list(filters?: { status?: AiPromptStatus }) {
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
  }) {
    return getPrisma().aiPromptTemplate.create({
      data: { ...data, status: AiPromptStatus.DRAFT },
    });
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
    return getPrisma().aiPromptTemplate.update({ where: { id }, data });
  }

  async activate(id: string) {
    const row = await getPrisma().aiPromptTemplate.findUnique({ where: { id } });
    if (!row) throw new Error('Prompt not found');
    await getPrisma().aiPromptTemplate.updateMany({
      where: { key: row.key, status: AiPromptStatus.ACTIVE },
      data: { status: AiPromptStatus.ARCHIVED },
    });
    return getPrisma().aiPromptTemplate.update({
      where: { id },
      data: { status: AiPromptStatus.ACTIVE },
    });
  }
}

let service: AiPromptService | null = null;

export function getAiPromptService(): AiPromptService {
  if (!service) service = new AiPromptService();
  return service;
}
