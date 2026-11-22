import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Stryker } from '@stryker-mutator/core';
import { discoverUnitSpecs, projectRoot } from '../unit/index.mjs';

const usage = 'Usage: pnpm test:mutation <module> [--spec <indexed-spec-path>] [--mutate <source.ts[:range]>] [--trace]';

function mutationTargets(directory, target) {
  if (!target) {
    const files = directory === 'src' || directory === 'src/app' ? '*' : '**/*';
    return [
      `${directory}/${files}.ts`,
      ...['.spec.ts', '.test.ts', '.d.ts'].map((suffix) => `!${directory}/${files}${suffix}`),
    ];
  }

  const normalized = target.replaceAll('\\', '/');
  const file = normalized.split(':', 1)[0];
  if (
    !/^[\w/-]+(?:\.[\w-]+)*\.ts(?::\d+(?::\d+)?-\d+(?::\d+)?)?$/u.test(normalized) ||
    !file.startsWith(`${directory}/`) ||
    /\.(?:spec|test|d)\.ts$/u.test(file) ||
    !statSync(resolve(projectRoot, file), { throwIfNoEntry: false })?.isFile()
  ) {
    throw new Error(`Choose a TypeScript source file inside ${directory}: ${target}`);
  }
  return [normalized];
}

try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { spec: { type: 'string' }, mutate: { type: 'string' }, trace: { type: 'boolean' } },
  });
  if (positionals.length !== 1) throw new Error(usage);

  const [module] = positionals;
  const specs = discoverUnitSpecs().filter((entry) => entry.module === module);
  if (!specs.length) throw new Error(`Unknown module "${module}". Run pnpm test:index to list modules.`);

  const specPath = values.spec?.replaceAll('\\', '/');
  const selected = specPath ? specs.filter(({ path }) => path === specPath) : specs;
  if (!selected.length) throw new Error(`Spec "${specPath}" is not indexed under ${module}.`);

  const mutate = mutationTargets(specs[0].directory, values.mutate);
  process.chdir(projectRoot);
  process.env.TENANT_PORTAL_MUTATION_SELECTOR = specPath ?? module;
  console.log(`Angular unit specs for mutation testing:\n${selected.map(({ path }) => path).join('\n')}`);

  await new Stryker({
    mutate,
    testRunner: 'command',
    commandRunner: { command: 'node tests/unit/index.mjs run' },
    coverageAnalysis: 'off',
    concurrency: 2,
    logLevel: values.trace ? 'trace' : 'info',
    reporters: ['progress', 'clear-text'],
    cleanTempDir: 'always',
  }).runMutationTest();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
