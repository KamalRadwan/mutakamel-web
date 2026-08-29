import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every `package.json` script must actually be runnable.
 *
 * ## Why this exists
 *
 * A gate that cannot run reports nothing, and "reports nothing" is
 * indistinguishable from "found nothing wrong" in every CI summary. That is not
 * hypothetical here — in one pass we found the repository's entire `scripts/`
 * directory missing while `package.json` still called every file in it (two app
 * builds broken, silently), a `lint` script invoking eslint in a package with
 * no eslint dependency and no config, and a `build` script that had never
 * compiled because its tsconfig excluded the file it needed.
 *
 * Each of those looked green. None of them ran.
 *
 * ## What it checks
 *
 * For every script in every workspace `package.json`:
 *
 * - `node <path>` — the file exists
 * - a bare binary (`tsc`, `jest`, `eslint`, ...) — it resolves from that
 *   package's own `node_modules/.bin`, or from an ancestor's
 *
 * It deliberately does not execute anything: the point is to catch a script
 * that cannot start, cheaply enough to run on every commit.
 */

/** Shell builtins and control flow that are not programs to resolve. */
const NOT_A_BINARY = new Set([
  'cd', 'echo', 'exit', 'set', 'true', 'false', 'if', 'then', 'else', 'fi',
  'for', 'do', 'done', 'rm', 'cp', 'mv', 'mkdir', 'test',
]);

/** Package managers and runners resolve their own targets. */
const PASSTHROUGH = new Set(['npm', 'pnpm', 'yarn', 'npx', 'pnpx', 'node']);

async function findPackageJsonFiles(directory, found = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await findPackageJsonFiles(path, found);
    } else if (entry.name === 'package.json') {
      found.push(path);
    }
  }
  return found;
}

/**
 * Splits a script into the commands it would run, ignoring separators that sit
 * inside a quoted argument.
 *
 * `node -e "if (x) process.exit(1)"` is one command, not two: splitting on the
 * `|` or `;` inside those quotes invents a second program named after whatever
 * followed.
 */
function commandsOf(script) {
  const commands = [];
  let current = '';
  let quote = null;
  for (let index = 0; index < script.length; index += 1) {
    const character = script[index];
    if (quote) {
      if (character === quote) quote = null;
      current += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    const pair = script.slice(index, index + 2);
    if (pair === '&&' || pair === '||') {
      commands.push(current);
      current = '';
      index += 1;
      continue;
    }
    if (character === ';' || character === '|') {
      commands.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  commands.push(current);
  return commands.map((part) => part.trim()).filter((part) => part.length > 0);
}

function tokensOf(command) {
  return command.split(/\s+/u).filter((token) => token.length > 0);
}

/** Strips `VAR=value` prefixes so the program itself is inspected. */
function programOf(tokens) {
  let index = 0;
  while (index < tokens.length && /^[A-Z_][A-Z0-9_]*=/u.test(tokens[index])) {
    index += 1;
  }
  return { program: tokens[index], rest: tokens.slice(index + 1) };
}

function binaryResolves(packageDirectory, binary) {
  let directory = packageDirectory;
  for (;;) {
    const candidate = resolve(directory, 'node_modules', '.bin', binary);
    if (existsSync(candidate) || existsSync(`${candidate}.CMD`)) return true;
    const parent = dirname(directory);
    if (parent === directory) return false;
    directory = parent;
  }
}

function checkNodeTarget(packageDirectory, rest) {
  // `node --test file.mjs` and `node -e "..."` both appear in this repository.
  const target = rest.find(
    (token) => !token.startsWith('-') && /\.(?:mjs|cjs|js)$/u.test(token),
  );
  // A glob is resolved by the shell, not by us; `dist/*.test.js` is a real
  // script and checking it as a literal path would fail every time.
  if (!target || target.includes('*')) return null;
  const path = resolve(packageDirectory, target);
  return existsSync(path) ? null : `missing file: ${target}`;
}

export async function checkRunnableScripts(root) {
  const failures = [];
  let scriptCount = 0;

  for (const packageJsonPath of await findPackageJsonFiles(root)) {
    const packageDirectory = dirname(packageJsonPath);
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    } catch {
      failures.push(`${packageJsonPath}: not valid JSON`);
      continue;
    }
    for (const [name, script] of Object.entries(manifest.scripts ?? {})) {
      if (typeof script !== 'string') continue;
      scriptCount += 1;
      for (const command of commandsOf(script)) {
        const { program, rest } = programOf(tokensOf(command));
        if (!program || NOT_A_BINARY.has(program) || program.startsWith('-')) {
          continue;
        }
        if (program === 'node') {
          const problem = checkNodeTarget(packageDirectory, rest);
          if (problem) {
            failures.push(`${manifest.name ?? packageJsonPath} → ${name}: ${problem}`);
          }
          continue;
        }
        if (PASSTHROUGH.has(program) || looksLikePath(program)) continue;
        if (!binaryResolves(packageDirectory, program)) {
          failures.push(
            `${manifest.name ?? packageJsonPath} → ${name}: "${program}" is not installed for this package`,
          );
        }
      }
    }
  }
  return { failures, scriptCount };
}

/** A path, not a bare binary name. Avoids a literal backslash in source. */
function looksLikePath(program) {
  return program.includes('/') || program.includes(String.fromCharCode(92));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { failures, scriptCount } = await checkRunnableScripts(REPOSITORY_ROOT);
  if (failures.length > 0) {
    const detail = failures.join('\n  ');
    process.stderr.write(
      `Unrunnable package scripts (${failures.length}):\n  ${detail}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Runnable-script check pass: ${scriptCount} scripts.\n`);
}
