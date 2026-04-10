import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nm = join(root, 'node_modules')

if (!existsSync(nm)) {
  console.error('verify-node-modules: node_modules directory not found.')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const deps = {
  ...pkg.dependencies,
  ...pkg.devDependencies,
  ...(pkg.optionalDependencies ?? {}),
}

for (const name of Object.keys(deps)) {
  const segments = name.split('/')
  const pkgDir =
    name.startsWith('@') && segments.length >= 2
      ? join(nm, segments[0], segments[1])
      : join(nm, name)
  if (!existsSync(pkgDir)) {
    console.error(
      `verify-node-modules: missing installed package "${name}" (expected ${pkgDir})`,
    )
    process.exit(1)
  }
}
