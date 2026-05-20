import { writeFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

if (!existsSync(join(root, '.git'))) {
  process.exit(0);
}

try {
  const customPath = execSync('git config core.hooksPath', { cwd: root })
    .toString()
    .trim();
  if (customPath) process.exit(0);
} catch {
  // git config exits non-zero when the key is unset
}

const hooksDir = join(root, '.git', 'hooks');
mkdirSync(hooksDir, { recursive: true });
const hookScript =
  '#!/bin/sh\nnode -e "require(\'child_process\').execSync(\'npm run precommit\', {stdio:\'inherit\', shell:true})"\n';
writeFileSync(join(hooksDir, 'pre-commit'), hookScript);
chmodSync(join(hooksDir, 'pre-commit'), '755');
console.log('[hooks] pre-commit installed');
