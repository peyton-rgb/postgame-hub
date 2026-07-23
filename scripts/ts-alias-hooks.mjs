// Node module-resolution hook: maps the project's "@/..." path alias
// (defined in tsconfig for the bundler) onto files under ./src, so
// standalone scripts run with bare `node` type-stripping can import
// shared app modules that use the alias internally. Registered via
// scripts/register-alias.mjs (node --import ...).

import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve as resolvePath } from 'node:path';

const SRC_DIR = resolvePath(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];

function resolveAlias(basePath) {
  if (existsSync(basePath) && statSync(basePath).isFile()) return basePath;
  for (const ext of EXTENSIONS) {
    const withExt = basePath + ext;
    if (existsSync(withExt)) return withExt;
  }
  for (const ext of EXTENSIONS) {
    const indexFile = join(basePath, `index${ext}`);
    if (existsSync(indexFile)) return indexFile;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const target = resolveAlias(join(SRC_DIR, specifier.slice(2)));
    if (target) {
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
