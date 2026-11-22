import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const sourceRoot = join(projectRoot, 'src');
const unitSpec = /\.(?:spec|test)\.ts$/u;

export function discoverUnitSpecs() {
  const paths = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && unitSpec.test(entry.name))
    .map((entry) => relative(projectRoot, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();

  const seen = new Set();
  return paths.map((path) => {
    const key = path.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate unit spec path: ${path}`);
    seen.add(key);

    const [root, ...directories] = path.split('/').slice(1, -1);
    const depth = directories[0] === 'features' ? 3 : 2;
    const owner = root === 'app' ? directories.slice(0, depth) : [];
    return {
      module: owner.join('/') || root || 'src',
      directory: ['src', root, ...owner].filter(Boolean).join('/'),
      path,
    };
  });
}

export function selectUnitSpecs(selector) {
  const specs = discoverUnitSpecs();
  if (!selector) return specs;

  const query = selector.replaceAll('\\', '/').replace(/\/$/u, '');
  const selected = specs.filter(({ module, path }) =>
    module === query || path === query || path.startsWith(`${query}/`) || path.startsWith(`src/app/${query}/`),
  );
  if (!selected.length) throw new Error(`No unit specs match "${selector}". Run pnpm test:index to list modules.`);
  return selected;
}

function listUnitSpecs(selector) {
  const specs = selectUnitSpecs(selector);
  if (selector) {
    for (const { path } of specs) console.log(path);
    return;
  }

  const counts = new Map();
  for (const { module } of specs) counts.set(module, (counts.get(module) ?? 0) + 1);
  for (const [module, count] of counts) console.log(`${module}\t${count}`);
  console.log(`${specs.length} specs in ${counts.size} modules`);
}

function runUnitSpecs(selector) {
  const specs = selectUnitSpecs(selector);
  const includes = selector ? specs.map(({ path }) => `--include=${path}`) : [];
  const angularCli = createRequire(import.meta.url).resolve('@angular/cli/bin/ng.js');
  const buildTarget = process.env.TENANT_PORTAL_MUTATION_SELECTOR
    ? ['--build-target=tenant-portal:build:development,mutation-test']
    : [];
  const result = spawnSync(process.execPath, [angularCli, 'test', '--watch=false', ...includes, ...buildTarget], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [, , mode, selector, ...rest] = process.argv;
  try {
    if (rest.length || (mode !== 'list' && mode !== 'run')) {
      throw new Error('Usage: node tests/unit/index.mjs <list|run> [module|path]');
    }
    if (mode === 'list') listUnitSpecs(selector);
    else process.exitCode = runUnitSpecs(selector ?? process.env.TENANT_PORTAL_MUTATION_SELECTOR);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
