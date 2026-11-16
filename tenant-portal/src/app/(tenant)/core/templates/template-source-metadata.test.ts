import { describe, expect, it } from "vitest";
import owners from "./template-owner-metadata.fixture.json";
import letter from "./letter-authoring.fixture.json";
import { parseTemplateSourceMetadata, parseTemplateSourceTuple, TEMPLATE_ADAPTER_KEYS, TEMPLATE_DOCUMENT_TYPES } from "./template-source-metadata";
import { parseTemplateStarters } from "./template-discovery-contract";
import { STARTER_CATALOGUE_DATA } from "./starter-catalogue.data";

describe("finite owner metadata", () => {
  it("parses the exact Core-local Letter projection and sealed Print starter identities", () => {
    expect(parseTemplateSourceMetadata(letter.owner)).toEqual(letter.owner);
    expect(parseTemplateStarters({ items: letter.starters })).toEqual(letter.starters);
    expect(letter.starters).toHaveLength(6);
    expect(TEMPLATE_ADAPTER_KEYS).not.toContain(letter.owner.adapterKey);
    expect(TEMPLATE_DOCUMENT_TYPES).not.toContain(letter.owner.documentType);
    expect(() => parseTemplateSourceMetadata({ ...letter.owner, allowedOutputChannels: ["EMAIL"] })).toThrow();
    expect(() => parseTemplateStarters({ items: [{ ...letter.starters[0], dataSourceKey: owners[0].adapterKey }] })).toThrow();
  });
  it("admits each of the nine pinned installed registrations and retains its actual layout modes", () => {
    expect(owners).toHaveLength(9);
    for (const descriptor of owners) expect(parseTemplateSourceMetadata(descriptor)).toEqual(descriptor);
  });
  it("honors an actual server subset instead of reintroducing globally known layouts", () => {
    const narrowed = { ...owners[0], allowedLayoutModes: ["FIXED_CANVAS"] };
    expect(parseTemplateSourceMetadata(narrowed).allowedLayoutModes).toEqual(["FIXED_CANVAS"]);
  });
  it.each([
    { ...owners[0], adapterKey: "LETTER_PRINT_V1" },
    { ...owners[0], documentType: "LETTER" },
    { ...owners[0], schemaVersion: 2 },
    { ...owners[0], allowedLayoutModes: ["UNKNOWN"] },
    { ...owners[0], allowedLayoutModes: ["HYBRID_DOCUMENT", "HYBRID_DOCUMENT"] },
    { ...owners[0], allowedLayoutModes: [] },
    { ...owners[0], allowedOutputChannels: ["EMAIL"] },
    { ...owners[6], allowedLayoutModes: ["FIXED_CANVAS"] },
    { ...owners[0], schemaChecksum: "not-a-checksum" },
  ])("rejects unregistered, malformed and cross-family metadata", input => {
    expect(() => parseTemplateSourceMetadata(input)).toThrow();
  });
  it("admits real owner starter tuples for every registered layout and rejects a known adapter under the wrong family", () => {
    for (const owner of owners) for (const layoutMode of owner.allowedLayoutModes) {
      const row = { documentType: owner.documentType, outputChannel: owner.allowedOutputChannels[0],
        layoutMode, dataSourceKey: owner.adapterKey, locale: "ar-EG" };
      expect(parseTemplateSourceTuple(row)).toMatchObject(rowIdentity(row));
      const starter = STARTER_CATALOGUE_DATA.find(({ descriptor }) => descriptor.dataSourceKey === row.dataSourceKey &&
        descriptor.layoutMode === row.layoutMode && descriptor.locale === row.locale)?.descriptor;
      expect(starter).toMatchObject(rowIdentity(row));
      expect(parseTemplateStarters({ items: [starter] })).toEqual([starter]);
    }
    expect(() => parseTemplateSourceTuple({ documentType: "INVOICE", outputChannel: "PRINT", layoutMode: "FLOW_DOCUMENT", dataSourceKey: owners[0].adapterKey })).toThrow();
    expect(() => parseTemplateSourceTuple({ documentType: "CRM_OUTBOUND_EMAIL", outputChannel: "PRINT", layoutMode: "EMAIL_FLOW", dataSourceKey: owners[6].adapterKey })).toThrow();
  });
  it.each(STARTER_CATALOGUE_DATA.filter(({ descriptor }) => descriptor.outputChannel === "PRINT"))(
    "preserves the server page for $descriptor.starterKey",
    ({ descriptor: starter }) => {
      const defaultPage = { preset: "A4", orientation: "PORTRAIT", marginMm: { top: 12, end: 12, bottom: 12, start: 12 } };
      expect(parseTemplateStarters({ items: [{ ...starter, defaultPage }] })).toEqual([{ ...starter, defaultPage }]);
    },
  );

  it("rejects invalid page settings and page settings on an email starter", () => {
    const starter = STARTER_CATALOGUE_DATA[0].descriptor;
    const defaultPage = { preset: "A4", orientation: "PORTRAIT", marginMm: { top: 12, end: 12, bottom: 12, start: 12 } };
    expect(() => parseTemplateStarters({ items: [{ ...starter, defaultPage: { ...defaultPage,
      marginMm: { ...defaultPage.marginMm, top: "12" } } }] })).toThrow();
    expect(() => parseTemplateStarters({ items: [{ ...starter, defaultPage: { ...defaultPage, widthMm: 210 } }] })).toThrow();
    const email = STARTER_CATALOGUE_DATA.find(({ descriptor }) => descriptor.outputChannel === "EMAIL")!.descriptor;
    expect(() => parseTemplateStarters({ items: [{ ...email, defaultPage }] })).toThrow();
  });
});

function rowIdentity(row: Record<string, unknown>) {
  return { documentType: row.documentType, outputChannel: row.outputChannel, layoutMode: row.layoutMode, dataSourceKey: row.dataSourceKey };
}
