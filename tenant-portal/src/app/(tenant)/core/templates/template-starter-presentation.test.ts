import { describe, expect, it } from "vitest";
import { STARTER_CATALOGUE_DATA } from "./starter-catalogue.data";
import type { StarterCatalogueTuple, StarterDiscoveryPins } from "./starter-catalogue";
import { parseTemplateStarters } from "./template-discovery-contract";
import { selectStarterPresentation } from "./template-starter-presentation";

const originalQuotationRegistry = "58a164867c99b89a854edc010e908f8fad62b3e0bc886c3c6a6764fc8fa7a6ef";
const originalCrmRegistry = "2f1331726d4f3067325992c804cb59c3e8115e9d709e0f00acbac2fab32aeae4";
const liveRegistry = "c162cadbe8adeefedb00124af638b92f3cdcd550ac90ffc09f84d8874364eef3";
const successorRegistry = "46cb6ab94cfc2370d530f3945f705c1d479acf590b5d064fa80ac926512eb76d";
const successorRevisions = new Map<string, Partial<StarterDiscoveryPins>>([
  ["crm.email.opportunity.structured-opportunity.ar-EG.v1", {
    starterKey: "crm.email.opportunity.structured-opportunity.ar-EG.v2",
    templateContentChecksum: "632329210505e1452f6e5fd8e937d7cecd5e491bc6c2b39b2ec856974dc3b762",
    descriptorChecksum: "28d39a20ef4fef51fd3efb91306210e130bc12c426972b6a21ac5dc658ed09e5",
  }],
  ["crm.email.opportunity.structured-opportunity.en-US.v1", {
    starterKey: "crm.email.opportunity.structured-opportunity.en-US.v2",
    templateContentChecksum: "85916b47b922a06c48ecf20cd1294541a8b9ac119104d06d71b5426dfe8f3f6c",
    descriptorChecksum: "cfcc0a642de7bebc591239884608ed31c17f3e700c97be5b71261cfbca6dd6f2",
  }],
]);

function discovery(rows: readonly StarterDiscoveryPins[], registryFingerprint?: string) {
  return parseTemplateStarters({
    items: rows, count: rows.length, registryVersion: "template-platform.mvp.v1", registryFingerprint,
  });
}

function tuple(descriptor: StarterDiscoveryPins): StarterCatalogueTuple {
  return {
    ...descriptor,
    locale: descriptor.locale as StarterCatalogueTuple["locale"],
    direction: "AUTO",
  };
}

const crmEntries = STARTER_CATALOGUE_DATA.filter(({ descriptor }) => descriptor.documentType === "CRM_OUTBOUND_EMAIL");
const crmGroups = [
  "CRM_LEAD_OUTBOUND_EMAIL_V1", "CRM_CUSTOMER_OUTBOUND_EMAIL_V1", "CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1",
].flatMap(adapter => ["ar-EG", "en-US"].map(locale => ({ adapter, locale })));

function source(adapter: string, locale: string) {
  return crmEntries
    .filter(({ descriptor }) => descriptor.dataSourceKey === adapter && descriptor.locale === locale)
    .map(({ descriptor }) => descriptor);
}

function successor(rows: readonly StarterDiscoveryPins[]) {
  return rows.map(row => ({ ...row, ...successorRevisions.get(row.starterKey) }));
}

describe("starter presentation registry authority", () => {
  it("keeps Sales Quotation presentation on the two admitted quotation graphs", () => {
    const entry = STARTER_CATALOGUE_DATA.find(
      ({ descriptor }) => descriptor.starterKey === "trade.quotation.classic-hybrid.en-US.v1",
    )!;
    const row = entry.descriptor;
    const args = [row.starterKey, tuple(row), row.dataSourceSchemaChecksum] as const;
    expect(selectStarterPresentation(discovery([row], originalQuotationRegistry), ...args))
      .toEqual(entry.metadata.thumbnailSource);
    expect(selectStarterPresentation(discovery([row], originalCrmRegistry), ...args))
      .toEqual(entry.metadata.thumbnailSource);
    expect(selectStarterPresentation(discovery([row], successorRegistry), ...args)).toBeNull();
  });

  it.each(crmGroups)("admits each exact successor source for $adapter $locale", ({ adapter, locale }) => {
    const prior = source(adapter, locale);
    const rows = successor(prior);
    const items = discovery(rows, successorRegistry);
    expect(items).toHaveLength(3);
    for (const [index, row] of rows.entries()) {
      const metadata = crmEntries.find(({ descriptor }) => descriptor.starterKey === prior[index].starterKey)?.metadata;
      expect(metadata?.thumbnailSource).toMatchObject({ kind: "RESPONSIVE_EMAIL", maxWidthPx: 600 });
      expect(selectStarterPresentation(items, row.starterKey, tuple(row), row.dataSourceSchemaChecksum))
        .toEqual(metadata?.thumbnailSource);
    }
  });

  it.each([
    ["the current live fingerprint", liveRegistry],
    ["a one-character change", successorRegistry.slice(0, -1) + "e"],
    ["an unknown fingerprint", "0".repeat(64)],
    ["a missing fingerprint", undefined],
  ])("withholds presentation for %s", (_name, fingerprint) => {
    const rows = successor(source("CRM_LEAD_OUTBOUND_EMAIL_V1", "en-US"));
    const [row] = rows;
    const items = discovery(rows, fingerprint);
    expect(items.map(({ starterKey }) => starterKey)).toContain(row.starterKey);
    expect(selectStarterPresentation(items, row.starterKey, tuple(row), row.dataSourceSchemaChecksum)).toBeNull();
  });

  it("requires the selected row to belong to a current discovery response and schema", () => {
    const rows = successor(source("CRM_CUSTOMER_OUTBOUND_EMAIL_V1", "ar-EG"));
    const [row] = rows;
    const items = discovery(rows, successorRegistry);
    const args = [row.starterKey, tuple(row), row.dataSourceSchemaChecksum] as const;
    expect(selectStarterPresentation([...items], ...args)).toBeNull();
    expect(selectStarterPresentation(items, "", tuple(row), row.dataSourceSchemaChecksum)).toBeNull();
    expect(selectStarterPresentation(items, row.starterKey, tuple(row), "0".repeat(64))).toBeNull();
    expect(selectStarterPresentation(items, row.starterKey, { ...tuple(row), direction: "LTR" }, row.dataSourceSchemaChecksum)).toBeNull();
    const mixed = discovery([...rows, source("CRM_LEAD_OUTBOUND_EMAIL_V1", "ar-EG")[0]], successorRegistry);
    expect(selectStarterPresentation(mixed, ...args)).toBeNull();
    expect(selectStarterPresentation(discovery([...rows, row], successorRegistry), ...args)).toBeNull();
  });

  it("rejects stale opportunity revisions and stale companion pins", () => {
    const prior = source("CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1", "en-US");
    const rows = successor(prior);
    const oldRevision = prior.find(row => successorRevisions.has(row.starterKey))!;
    const revised = rows.find(row => row.starterKey === "crm.email.opportunity.structured-opportunity.en-US.v2")!;
    const [row] = rows;
    const args = [row.starterKey, tuple(row), row.dataSourceSchemaChecksum] as const;
    expect(selectStarterPresentation(discovery(prior, originalCrmRegistry),
      oldRevision.starterKey, tuple(oldRevision), oldRevision.dataSourceSchemaChecksum)).toMatchObject({ kind: "RESPONSIVE_EMAIL" });
    expect(selectStarterPresentation(discovery(rows, originalCrmRegistry),
      revised.starterKey, tuple(revised), revised.dataSourceSchemaChecksum)).toBeNull();
    expect(selectStarterPresentation(discovery(prior, successorRegistry), ...args)).toBeNull();
    const malformed = rows.map(item => item === revised ? {
      ...item, templateContentChecksum: oldRevision.templateContentChecksum, descriptorChecksum: oldRevision.descriptorChecksum,
    } : item);
    expect(selectStarterPresentation(discovery(malformed, successorRegistry), ...args)).toBeNull();
  });
});
