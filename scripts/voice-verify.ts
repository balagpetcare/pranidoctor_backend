/**
 * Phase 7 Bangla voice assistant verification.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');

interface Check {
  area: string;
  name: string;
  ok: boolean;
  detail?: string;
}

const checks: Check[] = [];

function push(area: string, name: string, ok: boolean, detail?: string): void {
  checks.push({ area, name, ok, detail });
}

function fileExists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

function fileContains(rel: string, needle: string): boolean {
  const path = join(ROOT, rel);
  if (!existsSync(path)) return false;
  return readFileSync(path, 'utf8').includes(needle);
}

function verifyStructure(): void {
  const required = [
    'src/modules/voice-assistant/voice-assistant.module.ts',
    'src/modules/voice-assistant/stt/stt.adapter.ts',
    'src/modules/voice-assistant/navigation/voice-navigation.engine.ts',
    'prisma/migrations/20260521220000_phase7_voice_assistant/migration.sql',
  ];
  for (const rel of required) {
    push('structure', rel, fileExists(rel));
  }
}

function verifyFreeze(): void {
  push(
    'freeze',
    'mount at /api/voice',
    fileContains('src/modules/voice-assistant/voice-assistant.module.ts', "name: 'voice'"),
  );
  push(
    'freeze',
    'STT independent of AI provider',
    fileContains('src/modules/voice-assistant/stt/stt.adapter.ts', 'BanglaSttAdapter'),
  );
  push(
    'freeze',
    'voice chat delegates to AI core not provider',
    fileContains(
      'src/modules/voice-assistant/voice-assistant.service.ts',
      'getAiVeterinaryCoreService',
    ),
  );
  push(
    'privacy',
    'no raw audio storage default',
    fileContains('src/modules/voice-assistant/repository/voice.repository.ts', 'retainAudio: false'),
  );
}

function runTests(): void {
  const result = spawnSync(
    'npm',
    ['run', 'test', '--', '--run', 'src/modules/voice-assistant'],
    { cwd: ROOT, shell: true, stdio: 'pipe', encoding: 'utf8' },
  );
  push(
    'tests',
    'voice-assistant unit tests',
    result.status === 0,
    result.status === 0 ? undefined : `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-600),
  );
}

function main(): void {
  verifyStructure();
  verifyFreeze();
  runTests();

  const failed = checks.filter((c) => !c.ok);
  console.log('\n=== Voice Assistant Verify ===\n');
  for (const c of checks) {
    console.log(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.area} :: ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log(`\nTotal: ${checks.length - failed.length}/${checks.length}`);
  if (failed.length > 0) process.exit(1);
  console.log('\nVOICE_ASSISTANT_VERIFY=PASS\n');
}

main();
