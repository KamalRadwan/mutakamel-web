#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  lstat,
  readFile,
  readdir,
  readlink,
  realpath,
  stat,
  writeFile,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SKILL_DIR = path.resolve(path.dirname(SCRIPT_PATH), '..');
const TEMPLATE_PATH = path.join(SKILL_DIR, 'assets', 'APP_CHECK_RESULT.template.md');
const SCHEMA_VERSION = 1;

const EXCLUDED_DIRECTORY_REASONS = new Map([
  ['.git', 'Git internal metadata; source and Git status are reviewed instead.'],
  ['.hg', 'Mercurial internal metadata.'],
  ['.svn', 'Subversion internal metadata.'],
  ['node_modules', 'Third-party dependency tree; review manifests, lockfiles, imported usage, licenses when relevant, and package audit output instead.'],
  ['.next', 'Disposable Next.js build/cache output; review source, config, caching policy, source maps, and any committed reports instead.'],
  ['dist', 'Untracked generated distribution output; review source and build configuration instead.'],
  ['build', 'Untracked generated build output; review source and build configuration instead.'],
  ['out', 'Untracked generated export output; review source and export configuration instead.'],
  ['coverage', 'Generated coverage output; review test configuration and committed summaries instead.'],
  ['.nyc_output', 'Generated test coverage state.'],
  ['.turbo', 'Turborepo cache/output metadata.'],
  ['.cache', 'Tool cache.'],
  ['.parcel-cache', 'Parcel build cache.'],
  ['.vite', 'Vite cache/output metadata.'],
  ['.vercel', 'Local Vercel deployment metadata/output.'],
  ['.netlify', 'Local Netlify deployment metadata/output.'],
  ['storybook-static', 'Generated Storybook output; review stories/config/source instead.'],
  ['.svelte-kit', 'Generated SvelteKit output/cache.'],
  ['.nuxt', 'Generated Nuxt output/cache.'],
  ['.output', 'Generated framework output.'],
  ['.angular', 'Angular cache/output metadata.'],
  ['.pnpm-store', 'Package-manager content-addressable store.'],
]);

const TEXT_EXTENSIONS = new Set([
  '', '.ac', '.babelrc', '.bash', '.c', '.cjs', '.conf', '.config', '.cpp', '.css',
  '.csv', '.cts', '.d.ts', '.dockerfile', '.editorconfig', '.env', '.eslintignore',
  '.eslintrc', '.gitattributes', '.gitignore', '.graphql', '.gql', '.h', '.handlebars',
  '.hbs', '.html', '.htm', '.ini', '.java', '.js', '.json', '.json5', '.jsonc', '.jsx',
  '.less', '.lock', '.log', '.lua', '.md', '.mdx', '.mjs', '.mts', '.mustache', '.npmrc',
  '.php', '.plist', '.postcssrc', '.properties', '.proto', '.ps1', '.py', '.rb', '.resx',
  '.rst', '.sass', '.scss', '.sh', '.sql', '.styl', '.svelte', '.svg', '.toml', '.ts',
  '.tsx', '.txt', '.vue', '.xml', '.yaml', '.yml', '.zsh',
]);

const BINARY_EXTENSIONS = new Set([
  '.7z', '.a', '.aac', '.avi', '.avif', '.bin', '.bmp', '.bz2', '.class', '.dll', '.dmg',
  '.doc', '.docx', '.eot', '.exe', '.flac', '.gif', '.gz', '.ico', '.jar', '.jpeg', '.jpg',
  '.m4a', '.mkv', '.mov', '.mp3', '.mp4', '.mpeg', '.mpg', '.o', '.odt', '.ogg', '.otf',
  '.pdf', '.png', '.ppt', '.pptx', '.rar', '.so', '.tar', '.tif', '.tiff', '.ttf', '.wav',
  '.webm', '.webp', '.woff', '.woff2', '.xls', '.xlsx', '.xz', '.zip',
]);

const STRUCTURED_BASENAMES = new Set([
  'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock',
  'bun.lockb', 'composer.lock', 'poetry.lock', 'cargo.lock',
]);

const COMPLETE_STATES = new Set(['AUDITED', 'METADATA_AUDITED']);
const VALID_STATES = new Set(['PENDING', 'STALE', 'AUDITED', 'METADATA_AUDITED']);
const ALL_PHASES = [1, 2, 3, 4, 5, 6, 7, 8];
const REQUIRED_PHASE_HEADINGS = [
  '## Phase 1 — Duplicate Functions and Repeated Logic',
  '## Phase 2 — Unused and Dead Code',
  '## Phase 3 — Lint, Import, Module, and Type Correctness',
  '## Phase 4 — Clean-Code Refactoring',
  '## Phase 5 — Security Issues and Vulnerabilities',
  '## Phase 6 — AI Documentation Health and Rebuild Plan',
  '## Phase 7 — Documentation-to-Frontend Implementation Gaps',
  '## Phase 8 — Evidence-Based Improvement Suggestions',
];

function printHelp() {
  console.log(`Frontend Checker helper (schema ${SCHEMA_VERSION})

Usage:
  node frontend-checker.mjs inventory --root <repo> --out <inventory.json>
  node frontend-checker.mjs sync-report --inventory <inventory.json> --report <APP_CHECK_RESULT.md>
  node frontend-checker.mjs mark-batch --report <APP_CHECK_RESULT.md> --updates <updates.json>
  node frontend-checker.mjs validate --inventory <inventory.json> --report <APP_CHECK_RESULT.md>
  node frontend-checker.mjs help

Commands:
  inventory
    Recursively inventories every project-owned path, hashes files, classifies audit mode,
    records exact duplicates, and documents generated/vendor directory exclusions.

  sync-report
    Creates the report from the bundled template or synchronizes its machine-readable
    coverage ledger. Existing findings, human notes, and statuses are preserved. Changed
    files become STALE; new files become PENDING.

  mark-batch
    Applies coverage updates from a JSON array. Example:
      [
        {"path":"src/app/page.tsx","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]},
        {"path":"public/logo.png","state":"METADATA_AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]}
      ]

  validate
    Re-inventories the live repository, verifies the supplied inventory is current, checks
    all required report sections, exact per-file coverage, hashes, phases, finding schema,
    issue/location links, and unresolved placeholders. It never writes.

Safety:
  The helper writes only the explicit --out inventory path and --report path. Put inventory
  and update JSON files in an OS temporary directory outside the repository.`);
}

function parseArgs(argv) {
  const command = argv[2] ?? 'help';
  const options = {};
  for (let index = 3; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return { command, options };
}

function requireOption(options, name) {
  const value = options[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required option --${name}`);
  }
  return value;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function normalizeRelative(relativePath) {
  const normalized = toPosix(path.normalize(relativePath));
  return normalized === '.' ? '' : normalized.replace(/^\.\//, '');
}

function stableSortStrings(values) {
  return [...values].sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }) || left.localeCompare(right));
}

function runGit(root, args, { encoding = 'utf8' } = {}) {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: encoding === 'buffer' ? null : encoding,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout;
}

function getGitMetadata(root) {
  const topLevelRaw = runGit(root, ['rev-parse', '--show-toplevel']);
  if (topLevelRaw === null) {
    return {
      available: false,
      topLevel: null,
      head: 'NO_GIT',
      branch: 'NO_GIT',
      trackedFiles: new Set(),
      trackedDirectories: new Set(),
    };
  }

  const topLevel = path.resolve(topLevelRaw.trim());
  const head = (runGit(root, ['rev-parse', 'HEAD']) ?? 'UNKNOWN').trim();
  const branch = (runGit(root, ['branch', '--show-current']) ?? '').trim() || 'DETACHED';
  const trackedRaw = runGit(root, ['ls-files', '-z'], { encoding: 'buffer' });
  const trackedFiles = new Set();
  const trackedDirectories = new Set();

  if (Buffer.isBuffer(trackedRaw)) {
    const entries = trackedRaw.toString('utf8').split('\0').filter(Boolean);
    for (const entry of entries) {
      const normalized = normalizeRelative(entry);
      trackedFiles.add(normalized);
      const parts = normalized.split('/');
      parts.pop();
      let current = '';
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        trackedDirectories.add(current);
      }
    }
  }

  return {
    available: true,
    topLevel,
    head,
    branch,
    trackedFiles,
    trackedDirectories,
  };
}

function isToolOwnedPath(relativePath) {
  return relativePath === 'APP_CHECK_RESULT.md'
    || relativePath === '.agents/skills/frontend-checker'
    || relativePath.startsWith('.agents/skills/frontend-checker/');
}

function excludedDirectoryReason(relativePath, baseName, trackedDirectories) {
  if (relativePath === '.agents/skills/frontend-checker' || relativePath.startsWith('.agents/skills/frontend-checker/')) {
    return 'Frontend Checker skill implementation; excluded from auditing the application it is reviewing.';
  }

  if (baseName === '.git' || baseName === '.hg' || baseName === '.svn') {
    return EXCLUDED_DIRECTORY_REASONS.get(baseName);
  }

  // If Git intentionally tracks content under a usually-generated directory, treat it as
  // project-owned and scan it rather than silently excluding committed artifacts.
  if (trackedDirectories.has(relativePath)) {
    return null;
  }

  const directReason = EXCLUDED_DIRECTORY_REASONS.get(baseName);
  if (directReason) {
    return directReason;
  }

  const segments = relativePath.split('/');
  const yarnIndex = segments.lastIndexOf('.yarn');
  if (yarnIndex >= 0 && ['cache', 'unplugged'].includes(segments[yarnIndex + 1])) {
    return 'Untracked Yarn package cache/unplugged dependency content; review lockfile, manifests, and dependency audit instead.';
  }

  return null;
}

function extensionFor(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.d.ts')) return '.d.ts';
  return path.extname(lower);
}

function isKnownText(filePath) {
  const base = path.basename(filePath).toLowerCase();
  const extension = extensionFor(filePath);
  if (TEXT_EXTENSIONS.has(extension)) return true;
  if (base === 'dockerfile' || base.startsWith('dockerfile.')) return true;
  if (base === 'makefile' || base === 'procfile' || base === 'license' || base.startsWith('license.')) return true;
  if (base.startsWith('.env')) return true;
  if (base.startsWith('.eslintrc') || base.startsWith('.prettierrc') || base.startsWith('.stylelintrc')) return true;
  return false;
}

function isKnownBinary(filePath) {
  return BINARY_EXTENSIONS.has(extensionFor(filePath));
}

function isSensitivePath(relativePath) {
  const lower = relativePath.toLowerCase();
  const base = path.basename(lower);
  if (base === '.env.example' || base === '.env.sample' || base === '.env.template') return false;
  if (base.startsWith('.env')) return true;
  if (base === '.npmrc' || base === '.yarnrc' || base === '.yarnrc.yml' || base === '.pypirc') return true;
  if (/^(id_rsa|id_ed25519|credentials|credentials\..+|secrets?|secrets?\..+)$/.test(base)) return true;
  if (/\.(pem|key|p12|pfx|jks|keystore)$/.test(base)) return true;
  if (/(^|\/)(auth|credentials?|secrets?)(\/|\.)/.test(lower)) return true;
  return false;
}

function categoryFor(relativePath, textLike) {
  const lower = relativePath.toLowerCase();
  const base = path.basename(lower);
  const extension = extensionFor(lower);

  if (/(^|\/)(__tests__|tests?|specs?|e2e|cypress|playwright)(\/|$)/.test(lower)
      || /\.(test|spec)\.[^.]+$/.test(lower)
      || /\.stories\.[^.]+$/.test(lower)) return 'test-story';
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.vue', '.svelte'].includes(extension)) return 'source';
  if (['.css', '.scss', '.sass', '.less', '.styl'].includes(extension)) return 'style';
  if (['.md', '.mdx', '.rst'].includes(extension) || base.startsWith('readme') || base.startsWith('contributing')) return 'documentation';
  if (STRUCTURED_BASENAMES.has(base)) return 'lockfile';
  if (['package.json', 'tsconfig.json', 'jsconfig.json', 'turbo.json', 'nx.json', 'vite.config.ts', 'vite.config.js', 'next.config.js', 'next.config.mjs', 'next.config.ts'].includes(base)
      || /(^|\/)(\.github|\.circleci|config|configs|scripts)(\/|$)/.test(lower)
      || ['.yaml', '.yml', '.toml', '.ini', '.conf'].includes(extension)) return 'configuration-script';
  if (['.json', '.json5', '.jsonc', '.csv', '.graphql', '.gql', '.proto'].includes(extension)) return 'data-schema';
  if (!textLike || BINARY_EXTENSIONS.has(extension)) return 'asset-binary';
  if (extension === '.svg') return 'asset-text';
  return 'other-text';
}

function auditModeFor(relativePath, isText, category) {
  if (isToolOwnedPath(relativePath)) return 'excluded';
  if (!isText) return 'metadata';
  const base = path.basename(relativePath).toLowerCase();
  const lower = relativePath.toLowerCase();
  if (STRUCTURED_BASENAMES.has(base) || lower.endsWith('.map') || /\.min\.(js|css)$/.test(lower) || category === 'lockfile') {
    return 'structured';
  }
  return 'semantic';
}

async function streamFileFacts(absolutePath, relativePath) {
  const hash = createHash('sha256');
  let size = 0;
  let newlineCount = 0;
  let lastByte = null;
  let sample = Buffer.alloc(0);
  let hasNul = false;

  await new Promise((resolve, reject) => {
    const stream = createReadStream(absolutePath);
    stream.on('data', (chunk) => {
      hash.update(chunk);
      size += chunk.length;
      for (let index = 0; index < chunk.length; index += 1) {
        if (chunk[index] === 0x0a) newlineCount += 1;
      }
      if (chunk.includes(0x00)) hasNul = true;
      lastByte = chunk.length > 0 ? chunk[chunk.length - 1] : lastByte;
      if (sample.length < 8192) {
        const needed = 8192 - sample.length;
        sample = Buffer.concat([sample, chunk.subarray(0, needed)]);
      }
    });
    stream.on('error', reject);
    stream.on('end', resolve);
  });

  const knownText = isKnownText(relativePath);
  const knownBinary = isKnownBinary(relativePath);
  let isText;
  if (knownText) {
    isText = true;
  } else if (knownBinary) {
    isText = false;
  } else {
    isText = !hasNul;
  }

  const lineCount = isText
    ? (size === 0 ? 0 : newlineCount + (lastByte === 0x0a ? 0 : 1))
    : null;

  return {
    sha256: hash.digest('hex'),
    size,
    isText,
    lineCount,
    sampleHasNul: hasNul,
  };
}

async function analyzeRegularFile(root, relativePath, trackedFiles) {
  const absolutePath = path.join(root, ...relativePath.split('/'));
  try {
    const facts = await streamFileFacts(absolutePath, relativePath);
    const category = categoryFor(relativePath, facts.isText);
    const auditMode = auditModeFor(relativePath, facts.isText, category);
    return {
      path: relativePath,
      type: 'file',
      extension: extensionFor(relativePath),
      category,
      auditMode,
      tracked: trackedFiles.has(relativePath),
      sensitive: isSensitivePath(relativePath),
      size: facts.size,
      lineCount: facts.lineCount,
      sha256: facts.sha256,
      readError: null,
    };
  } catch (error) {
    return {
      path: relativePath,
      type: 'file',
      extension: extensionFor(relativePath),
      category: 'unreadable',
      auditMode: 'unreadable',
      tracked: trackedFiles.has(relativePath),
      sensitive: isSensitivePath(relativePath),
      size: null,
      lineCount: null,
      sha256: null,
      readError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function analyzeSymlink(root, relativePath, trackedFiles) {
  const absolutePath = path.join(root, ...relativePath.split('/'));
  try {
    const target = await readlink(absolutePath);
    const hash = createHash('sha256').update(`symlink\0${target}`).digest('hex');
    let resolvedTarget = null;
    let targetInsideRepository = null;
    let broken = false;
    try {
      resolvedTarget = await realpath(absolutePath);
      const relativeTarget = path.relative(root, resolvedTarget);
      targetInsideRepository = relativeTarget === '' || (!relativeTarget.startsWith('..') && !path.isAbsolute(relativeTarget));
    } catch {
      broken = true;
    }
    return {
      path: relativePath,
      type: 'symlink',
      extension: extensionFor(relativePath),
      category: 'symlink',
      auditMode: 'metadata',
      tracked: trackedFiles.has(relativePath),
      sensitive: false,
      size: Buffer.byteLength(target),
      lineCount: null,
      sha256: hash,
      symlinkTarget: target,
      resolvedTarget,
      targetInsideRepository,
      broken,
      readError: null,
    };
  } catch (error) {
    return {
      path: relativePath,
      type: 'symlink',
      extension: extensionFor(relativePath),
      category: 'unreadable',
      auditMode: 'unreadable',
      tracked: trackedFiles.has(relativePath),
      sensitive: false,
      size: null,
      lineCount: null,
      sha256: null,
      readError: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildCounts(items, key) {
  const result = {};
  for (const item of items) {
    const value = item[key] ?? 'unknown';
    result[value] = (result[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function calculateInventoryFingerprint(files, excludedDirectories) {
  const hash = createHash('sha256');
  for (const file of [...files].filter((entry) => entry.auditMode !== 'excluded').sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(file.sha256 ?? 'NO_HASH');
    hash.update('\0');
    hash.update(file.auditMode);
    hash.update('\0');
    hash.update(file.readError ?? '');
    hash.update('\n');
  }
  for (const excluded of [...excludedDirectories].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(`EXCLUDED\0${excluded.path}\0${excluded.reason}\n`);
  }
  return hash.digest('hex');
}

async function collectInventory(rootInput) {
  const root = await realpath(path.resolve(rootInput));
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(`Inventory root is not a directory: ${root}`);
  }

  const git = getGitMetadata(root);
  const files = [];
  const excludedDirectories = [];
  const scanErrors = [];

  async function walk(absoluteDirectory, relativeDirectory = '') {
    let entries;
    try {
      entries = await readdir(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      scanErrors.push({
        path: relativeDirectory || '.',
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }) || left.name.localeCompare(right.name));

    for (const entry of entries) {
      const relativePath = normalizeRelative(relativeDirectory ? path.join(relativeDirectory, entry.name) : entry.name);
      const absolutePath = path.join(absoluteDirectory, entry.name);

      if (entry.isSymbolicLink()) {
        files.push(await analyzeSymlink(root, relativePath, git.trackedFiles));
        continue;
      }

      if (entry.isDirectory()) {
        const reason = excludedDirectoryReason(relativePath, entry.name, git.trackedDirectories);
        if (reason) {
          excludedDirectories.push({ path: relativePath, reason });
          continue;
        }
        await walk(absolutePath, relativePath);
        continue;
      }

      if (entry.isFile()) {
        files.push(await analyzeRegularFile(root, relativePath, git.trackedFiles));
        continue;
      }

      // Sockets/devices are never executed. Record them as unreadable metadata paths.
      let size = null;
      try {
        size = (await lstat(absolutePath)).size;
      } catch {
        // Keep null.
      }
      files.push({
        path: relativePath,
        type: 'special',
        extension: extensionFor(relativePath),
        category: 'special',
        auditMode: 'unreadable',
        tracked: git.trackedFiles.has(relativePath),
        sensitive: false,
        size,
        lineCount: null,
        sha256: null,
        readError: 'Special filesystem entry cannot be safely read as a regular project file.',
      });
    }
  }

  await walk(root);
  files.sort((left, right) => left.path.localeCompare(right.path, 'en', { sensitivity: 'base' }) || left.path.localeCompare(right.path));
  excludedDirectories.sort((left, right) => left.path.localeCompare(right.path, 'en', { sensitivity: 'base' }) || left.path.localeCompare(right.path));

  const duplicateMap = new Map();
  for (const file of files) {
    if (!file.sha256 || file.size === 0 || file.auditMode === 'excluded') continue;
    const paths = duplicateMap.get(file.sha256) ?? [];
    paths.push(file.path);
    duplicateMap.set(file.sha256, paths);
  }

  const duplicateContentGroups = [...duplicateMap.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([sha256, paths]) => ({
      sha256,
      size: files.find((file) => file.sha256 === sha256)?.size ?? null,
      paths: stableSortStrings(paths),
    }))
    .sort((left, right) => (right.paths.length - left.paths.length) || left.paths[0].localeCompare(right.paths[0]));

  const auditableFiles = files.filter((file) => file.auditMode !== 'excluded');
  const inventorySha256 = calculateInventoryFingerprint(files, excludedDirectories);

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    root,
    repositoryName: path.basename(root),
    platform: `${os.platform()}-${os.arch()}`,
    git: {
      available: git.available,
      topLevel: git.topLevel,
      head: git.head,
      branch: git.branch,
    },
    inventorySha256,
    summary: {
      totalEncounteredFiles: files.length,
      auditableFiles: auditableFiles.length,
      excludedToolFiles: files.filter((file) => file.auditMode === 'excluded').length,
      excludedDirectories: excludedDirectories.length,
      unreadableFiles: files.filter((file) => file.auditMode === 'unreadable').length,
      sensitivePaths: files.filter((file) => file.sensitive).length,
      exactDuplicateGroups: duplicateContentGroups.length,
      byAuditMode: buildCounts(files, 'auditMode'),
      byCategory: buildCounts(files, 'category'),
      byExtension: buildCounts(files, 'extension'),
    },
    excludedDirectories,
    scanErrors,
    duplicateContentGroups,
    files,
  };
}

async function writeJson(filePath, value) {
  const outputPath = path.resolve(filePath);
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return outputPath;
}

async function loadJson(filePath) {
  const raw = await readFile(path.resolve(filePath), 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function mdCode(value) {
  const text = String(value);
  if (text.includes('`')) return `\`\`${text}\`\``;
  return `\`${text}\``;
}

function renderFileClassSummary(inventory) {
  const modeRows = Object.entries(inventory.summary.byAuditMode)
    .map(([mode, count]) => `| Audit mode: ${mode} | ${count} |`);
  const categoryRows = Object.entries(inventory.summary.byCategory)
    .map(([category, count]) => `| Category: ${category} | ${count} |`);
  return [
    '| Classification | Files |',
    '|---|---:|',
    ...modeRows,
    ...categoryRows,
  ].join('\n');
}

function renderDuplicateGroups(inventory) {
  if (!inventory.duplicateContentGroups.length) {
    return '_No non-empty exact-content duplicate groups were detected by hash. Semantic duplicate review is still required._';
  }
  const rows = inventory.duplicateContentGroups.map((group, index) => {
    const paths = group.paths.map(mdCode).join('<br>');
    return `| ${index + 1} | ${group.paths.length} | ${group.size ?? '—'} | ${group.sha256.slice(0, 12)}… | ${paths} |`;
  });
  return [
    '| Group | Files | Bytes each | SHA-256 | Paths |',
    '|---:|---:|---:|---|---|',
    ...rows,
  ].join('\n');
}

function renderExcludedDirectories(inventory) {
  if (!inventory.excludedDirectories.length) {
    return '_No generated/vendor directory roots were excluded._';
  }
  return [
    '| Directory | Reason / substitute control |',
    '|---|---|',
    ...inventory.excludedDirectories.map((entry) => `| ${mdCode(entry.path)} | ${entry.reason.replaceAll('|', '\\|')} |`),
  ].join('\n');
}

function auditableFilesFromInventory(inventory) {
  return inventory.files.filter((file) => file.auditMode !== 'excluded');
}

function defaultMarker(file) {
  return {
    path: file.path,
    sha256: file.sha256,
    mode: file.auditMode,
    state: 'PENDING',
    phases: [],
    issues: [],
  };
}

function markerLine(marker) {
  return `<!-- FCFILE ${JSON.stringify(marker)} -->`;
}

function parseCoverageMarkers(report) {
  const markers = [];
  const regex = /^<!-- FCFILE (\{.*\}) -->$/gm;
  let match;
  while ((match = regex.exec(report)) !== null) {
    try {
      const marker = JSON.parse(match[1]);
      markers.push({ marker, raw: match[0], index: match.index });
    } catch (error) {
      markers.push({ marker: null, raw: match[0], index: match.index, parseError: error instanceof Error ? error.message : String(error) });
    }
  }
  return markers;
}

function replaceRequiredBlock(report, startMarker, endMarker, content) {
  const startIndex = report.indexOf(startMarker);
  const endIndex = report.indexOf(endMarker);
  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    throw new Error(`Report is missing required block markers: ${startMarker} / ${endMarker}`);
  }
  const contentStart = startIndex + startMarker.length;
  return `${report.slice(0, contentStart)}\n${content}\n${report.slice(endIndex)}`;
}

function replaceOptionalBlock(report, startMarker, endMarker, content) {
  if (!report.includes(startMarker) || !report.includes(endMarker)) return report;
  return replaceRequiredBlock(report, startMarker, endMarker, content);
}

function replaceAllToken(template, token, value) {
  return template.split(token).join(String(value));
}

function renderTemplate(template, inventory, markers) {
  const auditable = auditableFilesFromInventory(inventory);
  const textCount = auditable.filter((file) => ['semantic', 'structured'].includes(file.auditMode)).length;
  const metadataCount = auditable.filter((file) => file.auditMode === 'metadata').length;
  const markerText = markers.map(markerLine).join('\n');

  const replacements = new Map([
    ['{{GENERATED_AT}}', inventory.generatedAt],
    ['{{REPOSITORY_NAME}}', inventory.repositoryName],
    ['{{GIT_HEAD}}', inventory.git.head],
    ['{{GIT_BRANCH}}', inventory.git.branch],
    ['{{INVENTORY_SHA256}}', inventory.inventorySha256],
    ['{{AUDITABLE_FILE_COUNT}}', auditable.length],
    ['{{TEXT_FILE_COUNT}}', textCount],
    ['{{METADATA_FILE_COUNT}}', metadataCount],
    ['{{FILE_CLASS_SUMMARY}}', renderFileClassSummary(inventory)],
    ['{{DUPLICATE_GROUP_SUMMARY}}', renderDuplicateGroups(inventory)],
    ['{{EXCLUDED_DIRECTORY_SUMMARY}}', renderExcludedDirectories(inventory)],
    ['{{COVERAGE_MARKERS}}', markerText],
  ]);

  let output = template;
  for (const [token, value] of replacements) {
    output = replaceAllToken(output, token, value);
  }
  return output;
}

function updateVisibleMetadata(report, inventory, markers) {
  const auditable = auditableFilesFromInventory(inventory);
  const textCount = auditable.filter((file) => ['semantic', 'structured'].includes(file.auditMode)).length;
  const metadataCount = auditable.filter((file) => file.auditMode === 'metadata').length;
  const pendingCount = markers.filter((marker) => !COMPLETE_STATES.has(marker.state)).length;

  report = report.replace(/^- \*\*Last inventory:\*\* .*$/m, `- **Last inventory:** ${inventory.generatedAt}`);
  report = report.replace(/^- \*\*Repository:\*\* .*$/m, `- **Repository:** ${mdCode(inventory.repositoryName)}`);
  report = report.replace(/^- \*\*Git branch \/ commit:\*\* .*$/m, `- **Git branch / commit:** ${mdCode(inventory.git.branch)} / ${mdCode(inventory.git.head)}`);
  report = report.replace(/^- \*\*Inventory fingerprint:\*\* .*$/m, `- **Inventory fingerprint:** ${mdCode(inventory.inventorySha256)}`);
  report = report.replace(/^\| Inventoried project-owned files \| .* \|$/m, `| Inventoried project-owned files | ${auditable.length} |`);
  report = report.replace(/^\| Semantic\/structured text files \| .* \|$/m, `| Semantic/structured text files | ${textCount} |`);
  report = report.replace(/^\| Metadata-audited assets\/symlinks \| .* \|$/m, `| Metadata-audited assets/symlinks | ${metadataCount} |`);
  report = report.replace(/^\| Pending or stale files \| .* \|$/m, `| Pending or stale files | ${pendingCount} |`);

  const completedCount = markers.length - pendingCount;
  report = report.replace(/^- \*\*Scope reviewed:\*\* \d+ \/ \d+ files$/gm, `- **Scope reviewed:** ${completedCount} / ${markers.length} files`);
  return report;
}

function updateMetaComment(report, inventory, markers) {
  const existingMatch = report.match(/<!-- FC-META (\{.*\}) -->/);
  let existing = {};
  if (existingMatch) {
    try {
      existing = JSON.parse(existingMatch[1]);
    } catch {
      existing = {};
    }
  }
  const hasPending = markers.some((marker) => !COMPLETE_STATES.has(marker.state));
  const meta = {
    ...existing,
    schemaVersion: SCHEMA_VERSION,
    auditState: hasPending ? 'IN PROGRESS' : (existing.auditState ?? 'IN PROGRESS'),
    generatedAt: inventory.generatedAt,
    repository: inventory.repositoryName,
    gitHead: inventory.git.head,
    gitBranch: inventory.git.branch,
    inventorySha256: inventory.inventorySha256,
  };
  const line = `<!-- FC-META ${JSON.stringify(meta)} -->`;
  if (existingMatch) {
    return report.replace(existingMatch[0], line);
  }
  return report.replace('# Frontend Application Check Result', `# Frontend Application Check Result\n\n${line}`);
}

async function syncReport(inventoryPath, reportPath) {
  const inventory = await loadJson(inventoryPath);
  if (inventory.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported inventory schema ${inventory.schemaVersion}; expected ${SCHEMA_VERSION}.`);
  }

  const reportAbsolute = path.resolve(reportPath);
  const expectedFiles = auditableFilesFromInventory(inventory);
  let existingReport = null;
  try {
    existingReport = await readFile(reportAbsolute, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  let markers;
  let report;
  if (existingReport === null) {
    const template = await readFile(TEMPLATE_PATH, 'utf8');
    markers = expectedFiles.map(defaultMarker);
    report = renderTemplate(template, inventory, markers);
  } else {
    const parsed = parseCoverageMarkers(existingReport);
    const malformed = parsed.filter((entry) => entry.marker === null);
    if (malformed.length) {
      throw new Error(`Existing report contains ${malformed.length} malformed FCFILE marker(s). Repair them before synchronization.`);
    }
    const oldMap = new Map(parsed.map((entry) => [entry.marker.path, entry.marker]));
    markers = expectedFiles.map((file) => {
      const old = oldMap.get(file.path);
      if (!old) return defaultMarker(file);
      if (old.sha256 === file.sha256 && old.mode === file.auditMode) {
        return {
          ...defaultMarker(file),
          ...old,
          path: file.path,
          sha256: file.sha256,
          mode: file.auditMode,
          phases: Array.isArray(old.phases) ? old.phases : [],
          issues: Array.isArray(old.issues) ? [...new Set(old.issues)] : [],
        };
      }
      return {
        ...defaultMarker(file),
        state: COMPLETE_STATES.has(old.state) ? 'STALE' : 'PENDING',
        issues: Array.isArray(old.issues) ? [...new Set(old.issues)] : [],
        previousSha256: old.sha256 ?? null,
      };
    });

    report = replaceRequiredBlock(
      existingReport,
      '<!-- FC-COVERAGE-START -->',
      '<!-- FC-COVERAGE-END -->',
      markers.map(markerLine).join('\n'),
    );
    report = replaceOptionalBlock(report, '<!-- FC-FILE-CLASS-SUMMARY-START -->', '<!-- FC-FILE-CLASS-SUMMARY-END -->', renderFileClassSummary(inventory));
    report = replaceOptionalBlock(report, '<!-- FC-DUPLICATE-GROUPS-START -->', '<!-- FC-DUPLICATE-GROUPS-END -->', renderDuplicateGroups(inventory));
    report = replaceOptionalBlock(report, '<!-- FC-EXCLUDED-DIRECTORIES-START -->', '<!-- FC-EXCLUDED-DIRECTORIES-END -->', renderExcludedDirectories(inventory));
  }

  report = updateMetaComment(report, inventory, markers);
  report = updateVisibleMetadata(report, inventory, markers);
  await writeFile(reportAbsolute, report.endsWith('\n') ? report : `${report}\n`, 'utf8');
  return { reportAbsolute, markerCount: markers.length };
}

async function markBatch(reportPath, updatesPath) {
  const reportAbsolute = path.resolve(reportPath);
  const updates = await loadJson(updatesPath);
  if (!Array.isArray(updates)) {
    throw new Error('Coverage updates must be a JSON array.');
  }

  let report = await readFile(reportAbsolute, 'utf8');
  const parsed = parseCoverageMarkers(report);
  const malformed = parsed.filter((entry) => entry.marker === null);
  if (malformed.length) {
    throw new Error('Cannot update a report with malformed FCFILE markers.');
  }
  const markerMap = new Map(parsed.map((entry) => [entry.marker.path, entry.marker]));

  for (const update of updates) {
    if (!update || typeof update !== 'object' || typeof update.path !== 'string') {
      throw new Error('Each coverage update must be an object with a string path.');
    }
    const current = markerMap.get(update.path);
    if (!current) {
      throw new Error(`Coverage update path does not exist in the report inventory: ${update.path}`);
    }
    const state = update.state ?? 'AUDITED';
    if (!VALID_STATES.has(state)) {
      throw new Error(`Invalid coverage state for ${update.path}: ${state}`);
    }
    const phases = update.phases ?? ALL_PHASES;
    if (!Array.isArray(phases) || phases.some((phase) => !Number.isInteger(phase) || phase < 1 || phase > 8)) {
      throw new Error(`Invalid phases for ${update.path}.`);
    }
    const normalizedPhases = [...new Set(phases)].sort((left, right) => left - right);
    const issues = update.issues ?? [];
    if (!Array.isArray(issues) || issues.some((issue) => typeof issue !== 'string' || !/^FC-P[1-8]-\d{4}$/.test(issue))) {
      throw new Error(`Invalid issue ID list for ${update.path}.`);
    }
    if (['semantic', 'structured'].includes(current.mode) && state === 'METADATA_AUDITED') {
      throw new Error(`Text file ${update.path} must use AUDITED, not METADATA_AUDITED.`);
    }
    if (current.mode === 'metadata' && state === 'AUDITED') {
      throw new Error(`Non-text asset ${update.path} must use METADATA_AUDITED.`);
    }

    markerMap.set(update.path, {
      ...current,
      state,
      phases: normalizedPhases,
      issues: [...new Set(issues)].sort(),
    });
  }

  report = report.replace(/^<!-- FCFILE (\{.*\}) -->$/gm, (raw, json) => {
    let existing;
    try {
      existing = JSON.parse(json);
    } catch {
      return raw;
    }
    const updated = markerMap.get(existing.path);
    return updated ? markerLine(updated) : raw;
  });

  const markers = [...markerMap.values()];
  const pendingCount = markers.filter((marker) => !COMPLETE_STATES.has(marker.state)).length;
  const completedCount = markers.length - pendingCount;
  report = report.replace(/^\| Pending or stale files \| .* \|$/m, `| Pending or stale files | ${pendingCount} |`);
  report = report.replace(/^- \*\*Scope reviewed:\*\* \d+ \/ \d+ files$/gm, `- **Scope reviewed:** ${completedCount} / ${markers.length} files`);

  await writeFile(reportAbsolute, report.endsWith('\n') ? report : `${report}\n`, 'utf8');
  return { reportAbsolute, updated: updates.length, pending: pendingCount };
}

function arraysEqual(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function parseIssueBlocks(report) {
  const headingRegex = /^### (FC-P([1-8])-\d{4})\s+(?:—|-|:)\s+(.+)$/gm;
  const matches = [];
  let match;
  while ((match = headingRegex.exec(report)) !== null) {
    matches.push({ id: match[1], phase: Number(match[2]), title: match[3], index: match.index, headingEnd: headingRegex.lastIndex });
  }
  return matches.map((item, index) => {
    const nextIndex = matches[index + 1]?.index ?? report.length;
    const nextPhaseIndex = report.indexOf('\n## ', item.headingEnd);
    const end = nextPhaseIndex >= 0 && nextPhaseIndex < nextIndex ? nextPhaseIndex : nextIndex;
    return { ...item, block: report.slice(item.index, end) };
  });
}

function phaseRanges(report) {
  const ranges = new Map();
  for (let phase = 1; phase <= 8; phase += 1) {
    const heading = REQUIRED_PHASE_HEADINGS[phase - 1];
    const start = report.indexOf(heading);
    const next = phase < 8 ? report.indexOf(REQUIRED_PHASE_HEADINGS[phase], start + heading.length) : report.indexOf('\n## Limitations and Unverified Areas', start + heading.length);
    ranges.set(phase, { start, end: next >= 0 ? next : report.length });
  }
  return ranges;
}

function lineNumberAt(text, index) {
  let count = 1;
  for (let position = 0; position < index; position += 1) {
    if (text.charCodeAt(position) === 10) count += 1;
  }
  return count;
}

function extractLocationTokens(block) {
  const line = block.split('\n').find((entry) => entry.startsWith('- **Locations:**'));
  if (!line) return { line: null, tokens: [] };
  const tokens = [];
  const regex = /`([^`]+)`/g;
  let match;
  while ((match = regex.exec(line)) !== null) tokens.push(match[1]);
  return { line, tokens };
}

function validateLocationToken(token, inventoryMap) {
  if (token.startsWith('MISSING: ')) {
    return { ok: true, path: null };
  }

  const fileLevel = token.match(/^(.+) \(file-level; line N\/A\)$/);
  if (fileLevel) {
    const file = inventoryMap.get(fileLevel[1]);
    if (!file) return { ok: false, error: `unknown file-level path ${fileLevel[1]}` };
    return { ok: true, path: fileLevel[1] };
  }

  const lineLocation = token.match(/^(.+):(\d+)(?:-(\d+))?$/);
  if (!lineLocation) {
    return { ok: false, error: `location must be path:line[-line], MISSING: path, or file-level N/A (${token})` };
  }

  const [, filePath, startRaw, endRaw] = lineLocation;
  const file = inventoryMap.get(filePath);
  if (!file) return { ok: false, error: `unknown path ${filePath}` };
  const start = Number(startRaw);
  const end = endRaw ? Number(endRaw) : start;
  if (start < 1 || end < start) return { ok: false, error: `invalid line range ${token}` };
  if (Number.isInteger(file.lineCount) && file.lineCount > 0 && end > file.lineCount) {
    return { ok: false, error: `line ${end} exceeds ${filePath} line count ${file.lineCount}` };
  }
  return { ok: true, path: filePath };
}

function detectSecretWarnings(report) {
  const warnings = [];
  const patterns = [
    { label: 'private key material', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { label: 'AWS access key-like value', regex: /\bAKIA[0-9A-Z]{16}\b/ },
    { label: 'OpenAI key-like value', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
    { label: 'GitHub token-like value', regex: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  ];
  for (const pattern of patterns) {
    if (pattern.regex.test(report)) warnings.push(pattern.label);
  }
  return warnings;
}

async function validateReport(inventoryPath, reportPath) {
  const inventory = await loadJson(inventoryPath);
  const reportAbsolute = path.resolve(reportPath);
  const report = await readFile(reportAbsolute, 'utf8');
  const errors = [];
  const warnings = [];

  if (inventory.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`Inventory schema ${inventory.schemaVersion} does not match helper schema ${SCHEMA_VERSION}.`);
  }
  if (inventory.scanErrors?.length) {
    errors.push(`Inventory contains ${inventory.scanErrors.length} directory scan error(s).`);
  }
  const unreadable = inventory.files.filter((file) => file.auditMode === 'unreadable');
  if (unreadable.length) {
    errors.push(`Inventory contains ${unreadable.length} unreadable/special file(s): ${unreadable.slice(0, 10).map((file) => file.path).join(', ')}${unreadable.length > 10 ? '…' : ''}`);
  }

  // Verify that the inventory still matches the live repository.
  try {
    const liveInventory = await collectInventory(inventory.root);
    if (liveInventory.inventorySha256 !== inventory.inventorySha256) {
      errors.push(`Live repository fingerprint ${liveInventory.inventorySha256} differs from supplied inventory ${inventory.inventorySha256}. Re-run inventory and sync-report.`);
    }
  } catch (error) {
    errors.push(`Could not re-inventory live repository: ${error instanceof Error ? error.message : String(error)}`);
  }

  const requiredSections = [
    '# Frontend Application Check Result',
    '## Executive Summary',
    '## Repository Profile',
    '## Scope, Inventory, and Exclusions',
    '## Tool-Assisted Checks',
    '## Prioritized Remediation Queue',
    ...REQUIRED_PHASE_HEADINGS,
    '## Limitations and Unverified Areas',
    '## Exact File Coverage Ledger',
  ];
  for (const heading of requiredSections) {
    if (!report.includes(heading)) errors.push(`Missing required heading: ${heading}`);
  }

  if (!report.includes('<!-- FC-COVERAGE-START -->') || !report.includes('<!-- FC-COVERAGE-END -->')) {
    errors.push('Missing FC coverage block markers.');
  }

  const parsedMarkers = parseCoverageMarkers(report);
  for (const entry of parsedMarkers.filter((item) => item.marker === null)) {
    errors.push(`Malformed FCFILE marker near report line ${lineNumberAt(report, entry.index)}: ${entry.parseError}`);
  }
  const markers = parsedMarkers.filter((entry) => entry.marker !== null).map((entry) => entry.marker);
  const markerMap = new Map();
  for (const marker of markers) {
    if (markerMap.has(marker.path)) errors.push(`Duplicate coverage marker for ${marker.path}.`);
    markerMap.set(marker.path, marker);
  }

  const expectedFiles = auditableFilesFromInventory(inventory);
  const inventoryMap = new Map(expectedFiles.map((file) => [file.path, file]));
  for (const file of expectedFiles) {
    const marker = markerMap.get(file.path);
    if (!marker) {
      errors.push(`Missing coverage marker for ${file.path}.`);
      continue;
    }
    if (marker.sha256 !== file.sha256) errors.push(`Stale hash for ${file.path}.`);
    if (marker.mode !== file.auditMode) errors.push(`Audit mode mismatch for ${file.path}: report=${marker.mode}, inventory=${file.auditMode}.`);
    if (!COMPLETE_STATES.has(marker.state)) errors.push(`Incomplete coverage state for ${file.path}: ${marker.state}.`);
    if (!arraysEqual(marker.phases, ALL_PHASES)) errors.push(`Incomplete phase coverage for ${file.path}: ${JSON.stringify(marker.phases)}.`);
    if (!Array.isArray(marker.issues)) errors.push(`Issues field is not an array for ${file.path}.`);
    if (file.auditMode === 'metadata' && marker.state !== 'METADATA_AUDITED') errors.push(`Metadata file ${file.path} must be METADATA_AUDITED.`);
    if (['semantic', 'structured'].includes(file.auditMode) && marker.state !== 'AUDITED') errors.push(`Text file ${file.path} must be AUDITED.`);
  }
  for (const marker of markers) {
    if (!inventoryMap.has(marker.path)) warnings.push(`Coverage marker exists for a file no longer in inventory: ${marker.path}.`);
  }

  const issueBlocks = parseIssueBlocks(report);
  const issueMap = new Map();
  const ranges = phaseRanges(report);
  const requiredFields = ['Status', 'Priority', 'Severity', 'Confidence', 'Effort', 'Category/Rule', 'Locations'];
  const requiredSubsections = ['Finding', 'Evidence', 'Why it matters', 'Recommended decision', 'Remediation plan', 'Verification', 'Dependencies and notes'];

  for (const issue of issueBlocks) {
    if (issueMap.has(issue.id)) {
      errors.push(`Duplicate finding ID ${issue.id}.`);
      continue;
    }
    issueMap.set(issue.id, issue);
    const range = ranges.get(issue.phase);
    if (!range || issue.index < range.start || issue.index >= range.end) {
      errors.push(`${issue.id} is outside its Phase ${issue.phase} section.`);
    }
    for (const field of requiredFields) {
      if (!issue.block.includes(`- **${field}:**`)) errors.push(`${issue.id} is missing field ${field}.`);
    }
    for (const subsection of requiredSubsections) {
      if (!issue.block.includes(`**${subsection}**`)) errors.push(`${issue.id} is missing subsection ${subsection}.`);
    }

    const locations = extractLocationTokens(issue.block);
    if (!locations.line || locations.tokens.length === 0) {
      errors.push(`${issue.id} has no machine-checkable backticked location.`);
      continue;
    }
    for (const token of locations.tokens) {
      const result = validateLocationToken(token, inventoryMap);
      if (!result.ok) {
        errors.push(`${issue.id} has invalid location: ${result.error}.`);
        continue;
      }
      if (result.path) {
        const marker = markerMap.get(result.path);
        if (marker && Array.isArray(marker.issues) && !marker.issues.includes(issue.id)) {
          errors.push(`${issue.id} is not linked from coverage marker ${result.path}.`);
        }
      }
    }
  }

  for (const marker of markers) {
    if (!Array.isArray(marker.issues)) continue;
    const duplicates = marker.issues.filter((issue, index, all) => all.indexOf(issue) !== index);
    if (duplicates.length) errors.push(`Duplicate issue IDs in coverage marker ${marker.path}: ${[...new Set(duplicates)].join(', ')}.`);
    for (const issueId of marker.issues) {
      if (!/^FC-P[1-8]-\d{4}$/.test(issueId)) {
        errors.push(`Invalid issue ID ${issueId} in coverage marker ${marker.path}.`);
      } else if (!issueMap.has(issueId)) {
        errors.push(`Coverage marker ${marker.path} references missing finding ${issueId}.`);
      }
    }
  }

  if (/^- \*\*Audit state:\*\* (?:IN PROGRESS|NOT STARTED)$/m.test(report)) {
    errors.push('Audit state is still IN PROGRESS or NOT STARTED.');
  }
  if (/^- \*\*Phase status:\*\* NOT STARTED$/m.test(report)) {
    errors.push('At least one phase is still NOT STARTED.');
  }
  if (/\b_Pending(?: review)?\.?_/i.test(report) || /_None recorded_/i.test(report) || /_No findings recorded yet\._/i.test(report)) {
    errors.push('Report still contains template placeholders such as Pending/None recorded/No findings recorded yet. Replace them with substantive results, including explicit zero-finding statements when applicable.');
  }
  if (report.includes('{{')) errors.push('Report contains unresolved template tokens.');

  const secretWarnings = detectSecretWarnings(report);
  for (const warning of secretWarnings) warnings.push(`Report may contain ${warning}; verify redaction immediately.`);

  if (errors.length) {
    console.error(`Frontend Checker validation FAILED with ${errors.length} error(s):`);
    errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
    if (warnings.length) {
      console.error(`\nWarnings (${warnings.length}):`);
      warnings.forEach((warning, index) => console.error(`${index + 1}. ${warning}`));
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Frontend Checker validation passed.
Files covered: ${expectedFiles.length}
Findings validated: ${issueBlocks.length}
Inventory: ${inventory.inventorySha256}`);
  if (warnings.length) {
    console.warn(`Warnings (${warnings.length}):`);
    warnings.forEach((warning, index) => console.warn(`${index + 1}. ${warning}`));
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv);
  if (options.help || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'inventory') {
    const root = requireOption(options, 'root');
    const out = requireOption(options, 'out');
    const inventory = await collectInventory(root);
    const outputPath = await writeJson(out, inventory);
    console.log(`Inventory written: ${outputPath}
Auditable files: ${inventory.summary.auditableFiles}
Excluded directory roots: ${inventory.summary.excludedDirectories}
Exact duplicate groups: ${inventory.summary.exactDuplicateGroups}
Fingerprint: ${inventory.inventorySha256}`);
    return;
  }

  if (command === 'sync-report') {
    const inventory = requireOption(options, 'inventory');
    const report = requireOption(options, 'report');
    const result = await syncReport(inventory, report);
    console.log(`Report synchronized: ${result.reportAbsolute}\nCoverage markers: ${result.markerCount}`);
    return;
  }

  if (command === 'mark-batch') {
    const report = requireOption(options, 'report');
    const updates = requireOption(options, 'updates');
    const result = await markBatch(report, updates);
    console.log(`Coverage updated: ${result.reportAbsolute}\nEntries updated: ${result.updated}\nPending/stale: ${result.pending}`);
    return;
  }

  if (command === 'validate') {
    const inventory = requireOption(options, 'inventory');
    const report = requireOption(options, 'report');
    await validateReport(inventory, report);
    return;
  }

  throw new Error(`Unknown command: ${command}. Run "help" for usage.`);
}

main().catch((error) => {
  console.error(`Frontend Checker helper error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
