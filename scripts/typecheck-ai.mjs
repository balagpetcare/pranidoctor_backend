import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
  encoding: 'utf8',
  shell: true,
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const aiErrors = output
  .split(/\r?\n/)
  .filter((line) => line.includes('modules/ai') || line.includes('admin-ai-compliance'));

if (aiErrors.length > 0) {
  console.error(aiErrors.join('\n'));
  process.exit(1);
}

console.log('AI module: 0 TypeScript errors');
process.exit(0);
