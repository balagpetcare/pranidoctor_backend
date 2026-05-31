#!/usr/bin/env tsx
/**
 * Knowledge population CLI (Phase 6E).
 * Validates and imports VKF bundles via the production KIP pipeline.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { bootstrapScriptRuntime, shutdownScriptRuntime } from '../seed-runtime.js';
import {
  getKnowledgeSeederService,
  listDomainTemplates,
  KNOWLEDGE_IMPORT_CSV_HEADERS,
} from '../../src/modules/ai/knowledge-seeder/index.js';
import type { SeederDomain } from '../../src/modules/ai/knowledge-seeder/index.js';

type Command = 'validate' | 'import' | 'batch' | 'approval' | 'audit' | 'templates' | 'headers';

function usage(): void {
  console.log(`Knowledge Seeder CLI (Phase 6E)

Usage:
  tsx scripts/knowledge/knowledge-seed.ts validate --file <path> [--domain DISEASE]
  tsx scripts/knowledge/knowledge-seed.ts import --file <path> --source-id <uuid> [--document-id <uuid>] [--domain DISEASE] [--dry-run] [--actor-id <id>]
  tsx scripts/knowledge/knowledge-seed.ts batch --manifest <path> [--dry-run] [--actor-id <id>]
  tsx scripts/knowledge/knowledge-seed.ts approval submit --import-run-id <id> [--actor-id <id>]
  tsx scripts/knowledge/knowledge-seed.ts approval status --version-id <id> [--version-id <id>...]
  tsx scripts/knowledge/knowledge-seed.ts audit [--import-run-id <id>] [--out <path>]
  tsx scripts/knowledge/knowledge-seed.ts templates [--domain DISEASE]
  tsx scripts/knowledge/knowledge-seed.ts headers
`);
}

function parseArgs(argv: string[]): {
  command: Command;
  subcommand?: string;
  flags: Record<string, string | boolean>;
  positionals: string[];
} {
  const args = [...argv];
  const command = (args.shift() ?? '') as Command;
  let subcommand: string | undefined;
  if (command === 'approval' && args[0] && !args[0].startsWith('--')) {
    subcommand = args.shift();
  }

  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[0];
      if (next && !next.startsWith('--')) {
        flags[key] = args.shift()!;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { command, ...(subcommand ? { subcommand } : {}), flags, positionals };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const seeder = getKnowledgeSeederService();

  if (parsed.command === 'headers') {
    console.log(KNOWLEDGE_IMPORT_CSV_HEADERS);
    return;
  }

  if (parsed.command === 'templates') {
    const domain = parsed.flags.domain as string | undefined;
    const templates = listDomainTemplates().filter((t) => !domain || t.domain === domain);
    console.log(JSON.stringify(templates, null, 2));
    return;
  }

  if (parsed.command === 'validate') {
    const file = String(parsed.flags.file ?? parsed.positionals[0] ?? '');
    if (!file) {
      usage();
      process.exit(1);
    }
    const domain = parsed.flags.domain as SeederDomain | undefined;
    const report = seeder.validateBundle(resolve(file), domain);
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.passed ? 0 : 1);
  }

  bootstrapScriptRuntime();
  try {
    if (parsed.command === 'import') {
      const file = String(parsed.flags.file ?? parsed.positionals[0] ?? '');
      const sourceId = String(parsed.flags['source-id'] ?? '');
      if (!file || !sourceId) {
        usage();
        process.exit(1);
      }

      const result = await seeder.importBundle({
        filePath: resolve(file),
        sourceId,
        ...(parsed.flags['document-id'] ? { documentId: String(parsed.flags['document-id']) } : {}),
        ...(parsed.flags.domain ? { domain: parsed.flags.domain as SeederDomain } : {}),
        dryRun: parsed.flags['dry-run'] === true,
        ...(parsed.flags['actor-id'] ? { actorId: String(parsed.flags['actor-id']) } : {}),
      });

      await seeder.recordRunSummary({
        importRunId: result.importRunId,
        filePath: resolve(file),
        dryRun: parsed.flags['dry-run'] === true,
        ...(parsed.flags['actor-id'] ? { actorId: String(parsed.flags['actor-id']) } : {}),
      });

      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (parsed.command === 'batch') {
      const manifest = String(parsed.flags.manifest ?? parsed.positionals[0] ?? '');
      if (!manifest) {
        usage();
        process.exit(1);
      }

      const result = await seeder.importBatchManifest(resolve(manifest), {
        dryRun: parsed.flags['dry-run'] === true,
        ...(parsed.flags['actor-id'] ? { actorId: String(parsed.flags['actor-id']) } : {}),
      });
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.failed > 0 ? 1 : 0);
      return;
    }

    if (parsed.command === 'approval') {
      if (parsed.subcommand === 'submit') {
        const importRunId = parsed.flags['import-run-id']
          ? String(parsed.flags['import-run-id'])
          : undefined;
        const versionIds = parsed.flags['version-id']
          ? [String(parsed.flags['version-id'])]
          : undefined;
        const actorId = String(parsed.flags['actor-id'] ?? 'knowledge-seeder-cli');

        const result = await seeder.submitForReview({
          ...(importRunId ? { importRunId } : {}),
          ...(versionIds ? { versionIds } : {}),
          actorId,
        });
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.skipped.length > 0 && result.submitted.length === 0 ? 1 : 0);
        return;
      }

      if (parsed.subcommand === 'status') {
        const versionIds = parsed.flags['version-id']
          ? [String(parsed.flags['version-id'])]
          : parsed.positionals;
        if (!versionIds.length) {
          usage();
          process.exit(1);
        }
        const status = await seeder.getApprovalStatus(versionIds);
        console.log(JSON.stringify(status, null, 2));
        return;
      }

      usage();
      process.exit(1);
    }

    if (parsed.command === 'audit') {
      const report = await seeder.exportAudit({
        ...(parsed.flags['import-run-id']
          ? { importRunId: String(parsed.flags['import-run-id']) }
          : {}),
      });

      if (parsed.flags.out) {
        writeFileSync(String(parsed.flags.out), JSON.stringify(report, null, 2), 'utf8');
        console.log(`Audit written to ${parsed.flags.out}`);
      } else {
        console.log(JSON.stringify(report, null, 2));
      }
      return;
    }

    usage();
    process.exit(1);
  } finally {
    await shutdownScriptRuntime();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
