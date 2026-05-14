import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');

if (!existsSync(nm)) {
  console.error('verify-node-modules: node_modules directory not found.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function packagePath(name) {
  const segments = name.split('/');
  return name.startsWith('@') && segments.length >= 2
    ? join(nm, segments[0], segments[1])
    : join(nm, name);
}

function omitListFromEnv() {
  const raw = [process.env.npm_config_omit, process.env.NPM_CONFIG_OMIT]
    .filter(Boolean)
    .join(',');
  return raw
    .split(/[,+]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function inferOmitDev() {
  const prodNames = Object.keys(pkg.dependencies ?? {});
  const optNames = Object.keys(pkg.optionalDependencies ?? {});
  const prodSet = new Set([...prodNames, ...optNames]);
  const devOnly = Object.keys(pkg.devDependencies ?? {}).filter(
    (n) => !prodSet.has(n)
  );
  if (devOnly.length === 0) return false;
  const declared = [...prodNames, ...optNames];
  const someDeclaredPresent = declared.some((n) => existsSync(packagePath(n)));
  if (!someDeclaredPresent) return false;

  const missingTopLevel = devOnly.filter((n) => !existsSync(packagePath(n)));
  if (missingTopLevel.length === 0) return false;
  const ratioMissing = missingTopLevel.length / devOnly.length;
  return ratioMissing >= 0.75;
}

const omit = omitListFromEnv();
let omitDev = omit.includes('dev');
if (!omitDev) omitDev = inferOmitDev();

const deps = omitDev
  ? {
      ...pkg.dependencies,
      ...(pkg.optionalDependencies ?? {}),
    }
  : {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...(pkg.optionalDependencies ?? {}),
    };

for (const name of Object.keys(deps)) {
  const pkgDir = packagePath(name);
  if (!existsSync(pkgDir)) {
    console.error(
      `verify-node-modules: missing installed package "${name}" (expected ${pkgDir})`
    );
    process.exit(1);
  }
}
