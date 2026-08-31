import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

/**
 * Reads Core's dashboard module and fails when it authors a string the portal
 * has no Arabic for.
 *
 * The portal defaults to Arabic, so an untranslated metric, alert, chart or
 * field is not a cosmetic gap — it is English text inside an Arabic page. The
 * runtime falls back to Core's English rather than breaking, which means a
 * missing entry is invisible in manual testing. This is what notices.
 */

const CORE_DASHBOARD = join(
  process.cwd(),
  "..",
  "..",
  "backend",
  "mutakamel-apps",
  "core-app",
  "src",
  "admin",
  "admin-dashboard",
);

function coreSources(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.endsWith(".ts") && !entry.includes(".spec.")) {
        files.push(readFileSync(full, "utf8"));
      }
    }
  };
  walk(CORE_DASHBOARD);
  return files;
}

function collect(pattern: RegExp): Set<string> {
  const found = new Set<string>();
  for (const source of coreSources()) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return found;
}

// Skipped rather than failed when Core is not checked out beside the portal,
// so a portal-only clone still runs green.
let available = true;
try {
  statSync(CORE_DASHBOARD);
} catch {
  available = false;
}

describe.runIf(available)("Arabic covers every string Core authors", () => {
  it("has a title for every visual key", () => {
    const keys = collect(
      /'((?:tenants|domains|subscriptions|database|billing|payments|wallets|storage|provisioning|catalogue|notifications|security|audit)\.[A-Za-z]+)',\s*\n?\s*'/g,
    );
    expect(keys.size).toBeGreaterThan(50);
    const titles = ar.dashboard.visualTitles as Record<string, string | undefined>;
    expect([...keys].filter((key) => !titles[key]).sort()).toEqual([]);
  });

  it("has a message for every alert key", () => {
    const keys = new Set<string>();
    for (const source of coreSources()) {
      for (const match of source.matchAll(
        /key:\s*'([a-z0-9-]+)',\s*\n?\s*severity:/g,
      )) {
        keys.add(match[1]);
      }
      for (const match of source.matchAll(
        /storageAlert\('([a-z0-9-]+)'/g,
      )) {
        keys.add(match[1]);
      }
    }
    expect(keys.size).toBeGreaterThan(20);
    const messages = ar.dashboard.alertMessages as Record<string, string | undefined>;
    expect([...keys].filter((key) => !messages[key]).sort()).toEqual([]);
  });

  it("has a label for every headline metric key", () => {
    const keys = new Set<string>();
    for (const source of coreSources()) {
      for (const match of source.matchAll(/dashboardMetric\(\s*'([a-z0-9-]+)'/g)) {
        keys.add(match[1]);
      }
      for (const match of source.matchAll(/this\.card\(\s*'([a-z0-9-]+)'/g)) {
        keys.add(match[1]);
      }
    }
    expect(keys.size).toBeGreaterThan(20);
    const labels = ar.dashboard.metricLabels as Record<string, string | undefined>;
    expect([...keys].filter((key) => !labels[key]).sort()).toEqual([]);
  });

  it("has a term for every category label Core can put on a chart", () => {
    // Labels reach a slice from three places: written inline on a point, and
    // from the taxonomy's own display maps. A miss here is the defect that
    // left "Dependency Failure" sitting in an Arabic donut.
    const labels = new Set<string>();
    for (const source of coreSources()) {
      for (const match of source.matchAll(/label:\s*'([^']+)'/g)) {
        labels.add(match[1]);
      }
      for (const match of source.matchAll(/stage\('[^']+',\s*'([^']+)'/g)) {
        labels.add(match[1]);
      }
      for (const match of source.matchAll(/step\('[^']+',\s*'([^']+)'/g)) {
        labels.add(match[1]);
      }
      for (const match of source.matchAll(
        /\{\s*primary:\s*'([^']+)',\s*secondary:\s*'([^']+)'\s*\}/g,
      )) {
        labels.add(match[1]);
        labels.add(match[2]);
      }
      for (const block of source.matchAll(/_LABELS[^=]*=\s*\{([\s\S]*?)\n\};/g)) {
        for (const match of block[1].matchAll(/:\s*'([^']+)'/g)) {
          labels.add(match[1]);
        }
      }
    }

    expect(labels.size).toBeGreaterThan(40);
    const terms = ar.dashboard.visualTerms as Record<string, string | undefined>;
    // Headline metrics resolve by `card.key`, so their English text needs no
    // term entry — the Swagger example in the controller repeats a couple of
    // them as `label:`, which is documentation rather than a chart category.
    const cardLabels = new Set(Object.values(en.dashboard.metricLabels));
    const missing = [...labels]
      .filter((label) => !terms[label] && !cardLabels.has(label))
      // A formatted date range in an example is not vocabulary.
      .filter((label) => !/\d{4}/.test(label))
      .sort();

    expect(missing).toEqual([]);
  });
});
