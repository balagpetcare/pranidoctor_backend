import { bootstrapScriptRuntime, shutdownScriptRuntime } from '../../seed-runtime.js';
import { getPrisma } from '../../../src/shared/database/prisma.js';

bootstrapScriptRuntime();
const p = getPrisma();

const runs = await p.aiKnowledgeImportRun.findMany({
  orderBy: { createdAt: 'desc' },
  take: 5,
  select: { id: true, status: true, errorSummary: true, statsJson: true },
});
console.log('import runs', JSON.stringify(runs, null, 2));

const versions = await p.vkKnowledgeVersion.groupBy({ by: ['status'], _count: true });
const published = await p.vkKnowledgeVersion.count({ where: { status: 'PUBLISHED' } });
const legacy = await p.aiKnowledgeChunk.count({ where: { stage: 'PUBLISHED' } });
console.log('versions by status', versions, 'published', published, 'legacy chunks', legacy);

await shutdownScriptRuntime();
