import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { checkRunnableScripts } from './check-runnable-scripts.mjs';

async function fixtureRoot(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'runnable-scripts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function writePackage(root, name, scripts) {
  const directory = resolve(root, name);
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, 'package.json'),
    JSON.stringify({ name, scripts }, null, 2),
  );
  return directory;
}

async function installBinary(directory, binary) {
  const bin = resolve(directory, 'node_modules', '.bin');
  await mkdir(bin, { recursive: true });
  await writeFile(resolve(bin, binary), '');
}

test('accepts a script whose binary is installed', async (t) => {
  const root = await fixtureRoot(t);
  const directory = await writePackage(root, 'good', { build: 'tsc --noEmit' });
  await installBinary(directory, 'tsc');

  const { failures, scriptCount } = await checkRunnableScripts(root);

  assert.deepEqual(failures, []);
  assert.equal(scriptCount, 1);
});

test('rejects a script whose binary is not installed anywhere', async (t) => {
  // The exact shape of the shipped `packages/webphone` defect: a lint script
  // naming a tool the package never depended on.
  const root = await fixtureRoot(t);
  await writePackage(root, 'bad', { lint: 'eslint src/' });

  const { failures } = await checkRunnableScripts(root);

  assert.equal(failures.length, 1);
  assert.match(failures[0], /"eslint" is not installed/u);
});

test('rejects a script whose node target does not exist', async (t) => {
  // The exact shape of the missing `scripts/` directory: package.json still
  // called every file in it, and two app builds were broken silently.
  const root = await fixtureRoot(t);
  await writePackage(root, 'bad-node', { check: 'node scripts/gone.mjs' });

  const { failures } = await checkRunnableScripts(root);

  assert.equal(failures.length, 1);
  assert.match(failures[0], /missing file: scripts\/gone\.mjs/u);
});

test('accepts a binary installed in an ancestor package', async (t) => {
  const root = await fixtureRoot(t);
  await installBinary(root, 'jest');
  await writePackage(root, 'nested', { test: 'jest --runInBand' });

  const { failures } = await checkRunnableScripts(root);

  assert.deepEqual(failures, []);
});

test('does not split a command inside a quoted argument', async (t) => {
  // `node -e "... || process.exit(1)"` is one command. Splitting on that `||`
  // invents a second program named after whatever follows it.
  const root = await fixtureRoot(t);
  await writePackage(root, 'quoted', {
    guard: 'node -e "if (!x) process.exit(1) || 0"',
  });

  const { failures } = await checkRunnableScripts(root);

  assert.deepEqual(failures, []);
});

test('ignores a glob target, which the shell resolves', async (t) => {
  const root = await fixtureRoot(t);
  await writePackage(root, 'globbed', { test: 'node --test dist/*.test.js' });

  const { failures } = await checkRunnableScripts(root);

  assert.deepEqual(failures, []);
});

test('ignores shell builtins and package managers', async (t) => {
  const root = await fixtureRoot(t);
  await writePackage(root, 'passthrough', {
    clean: 'rm -rf dist',
    all: 'pnpm run build && npm run test',
  });

  const { failures } = await checkRunnableScripts(root);

  assert.deepEqual(failures, []);
});
