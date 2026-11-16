import { canonicalJson, formatTemplateBindingValue, resolveTemplateTextDirection, type DynamicTableNodeV1 } from "@mutakamel/template-schema/browser-safe";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { beforeAll, describe, expect, it } from "vitest";
import { parseEditorDocument } from "../../template-editor-model";
import { readTemplateOwnerAdmission, type TemplateOwnerAdmission } from "../../template-owner-admission";
import ownerFixture from "../../template-owner-admission-api.fixture.json";
import { createSalesQuotationBindingCommands } from "./sales-quotation-binding-commands";
import type { SalesQuotationBindingTrust, SalesQuotationDraftAuthority } from "./sales-quotation-binding-authority";

const templateId = "01890000-0000-7000-8000-000000000001";
const draftId = "01890000-0000-7000-8000-000000000002";
const tenantId = "01890000-0000-7000-8000-000000000003";
const companyId = "01890000-0000-7000-8000-000000000004";
const bodyId = "01890000-0000-7000-8000-000000000005";
const adapterKey = "TRADE_QUOTATION_PRINT_V1";
const fixtureRow = ownerFixture.rows.find(row => row.adapterKey === adapterKey)!;
const producer = ownerFixture.producerObservations.find(row => row.adapterKey === adapterKey)!;
let owner: TemplateOwnerAdmission;

beforeAll(async () => {
  const admission = await readTemplateOwnerAdmission(fixtureRow, {
    pins: producer.pins, canonicalJson, isCurrent: () => true,
  });
  if (!admission) throw new Error("Sales Quotation owner fixture failed admission");
  owner = admission;
});

function setup(layoutMode: "FLOW_DOCUMENT" | "HYBRID_DOCUMENT" = "FLOW_DOCUMENT",
  locale = "en-US", direction: "LTR" | "RTL" = "LTR") {
  const source = {
    documentType: "QUOTATION", dataSourceKey: adapterKey, outputChannel: "PRINT",
    layoutMode, locale, direction,
  } as const;
  const document = parseEditorDocument({
    ...source, schemaVersion: 1, rootNodeIds: [bodyId],
    page: { unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
      marginMm: { top: 12, end: 12, bottom: 12, start: 12 } },
    theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 16, textColor: "#111827", lineHeight: 1.5 },
    nodes: { [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [], locked: false, hidden: false,
      layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } } },
  });
  const state = { document, generation: 3, gestureActive: false, dirty: false, canUndo: false, canRedo: false };
  let selection: readonly string[] = [bodyId];
  let authorized = true;
  const draft = { templateId, draftId, editorDocument: document, revision: 1, etag: '"1"' };
  let authority: SalesQuotationDraftAuthority = {
    key: "authenticated-draft", tenantId, companyId, generation: state.generation, draft,
    detail: { ...source, id: templateId, scope: { type: "COMPANY", companyId }, lifecycleStatus: "ACTIVE",
      systemProtected: false, currentDraft: { draftId, revision: 1, etag: '"1"', validationState: "STALE",
        contentChecksum: bytesToHex(sha256(new TextEncoder().encode(canonicalJson(document)))) } },
    isCurrent: () => authorized,
  };
  let trust: SalesQuotationBindingTrust = {
    pins: producer.pins, descriptorCanonicalSha256: fixtureRow.ownerContext.descriptorCanonicalSha256,
    isCurrent: () => true,
  };
  let observation = { admission: owner, authorityKey: authority.key, tenantId, companyId, generation: state.generation,
    isCurrent: () => authorized };
  const commands = createSalesQuotationBindingCommands({
    readOwner: () => observation, readTrust: () => trust, readDraftAuthority: () => authority,
    readDocument: () => state, readSelection: () => selection, canEdit: () => true,
  });
  return {
    commands, bodyId, state,
    replaceDraft: (draft: SalesQuotationDraftAuthority["draft"]) => { authority = { ...authority, draft }; },
    replaceTrust: (next: SalesQuotationBindingTrust) => { trust = next; },
    replaceOwner: (admission: TemplateOwnerAdmission) => { observation = { ...observation, admission }; },
    replaceOwnerCompany: (companyId: string) => { observation = { ...observation, companyId }; },
    select: (ids: readonly string[]) => { selection = ids; },
    revoke: () => { authorized = false; },
    draft, trust,
  };
}

describe("authenticated Sales Quotation binding commands", () => {
  it.each(["FLOW_DOCUMENT", "HYBRID_DOCUMENT"] as const)("prepares a field and an ordered repeating table for %s", mode => {
    const { commands, bodyId, state } = setup(mode);
    const offer = commands.readOffer()!;
    expect(offer.fields).toContain("quotation.number");
    expect(offer.fields).not.toContain("quotation.items[].name");
    const field = commands.prepareField(offer.pin, "quotation.number", "Quotation number");
    const fieldId = field?.document.nodes[bodyId].childIds.at(-1);
    expect(fieldId && field?.document.nodes[fieldId]).toMatchObject({
      type: "dataField", parentId: bodyId, binding: { path: "quotation.number", nullBehavior: "EMPTY" },
    });

    const choice = { offerPin: offer.pin, sourcePath: "quotation.items", rowKeyPath: "rowKey",
      columnPaths: ["unitPrice", "name", "quantity", "rank"] };
    const table = commands.prepareTable(choice);
    const tableId = table?.document.nodes[bodyId].childIds.at(-1);
    const tableNode = tableId ? table?.document.nodes[tableId] : undefined;
    expect(tableNode).toMatchObject({
      type: "dynamicTable", parentId: bodyId, props: { sourcePath: "quotation.items", rowKeyPath: "rowKey", columns: [
        { value: { binding: { path: "unitPrice", format: { type: "CURRENCY", currencyCodePath: "quotation.currencyCode" } } } },
        { value: { binding: { path: "name" } } },
        { value: { binding: { path: "quantity", format: { type: "NUMBER", maximumFractionDigits: 6 } } } },
        { value: { binding: { path: "rank", format: { type: "NUMBER" } } } },
      ] },
    });
    expect(tableNode?.props.columns).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: { kind: "BINDING", binding: { path: "name", nullBehavior: "EMPTY" } } }),
    ]));
    expect(state.document.nodes[bodyId].childIds).not.toContain(tableId);
    expect(commands.prepareTable({ ...choice, columnPaths: ["name", "name"] })).toBeNull();
    expect(commands.prepareTable({ ...choice, rowKeyPath: "rank" })).toBeNull();
    expect(commands.prepareTable({ ...choice, columnPaths: ["itemImage"] })).toBeNull();
  });

  it.each([
    ["FLOW_DOCUMENT", "ar-EG", "RTL", "١٢٣٬٤٥٦٬٧٨٩٬٠١٢٫٦٥٤٣٢١"],
    ["HYBRID_DOCUMENT", "ar-EG", "RTL", "١٢٣٬٤٥٦٬٧٨٩٬٠١٢٫٦٥٤٣٢١"],
    ["FLOW_DOCUMENT", "en-US", "LTR", "123,456,789,012.654321"],
    ["HYBRID_DOCUMENT", "en-US", "LTR", "123,456,789,012.654321"],
  ] as const)("formats the selected item fields in %s for %s", (mode, locale, direction, quantityText) => {
    const { commands } = setup(mode, locale, direction);
    const item = { rowKey: "persisted-line", rank: 7, name: "الخدمة", unit: "kg", quantity: "123456789012.654321",
      unitPrice: "73.125000", lineTotal: "503.456000", charge: "0.000000", discount: "5.125000", tax: "23.456000",
      taxRatePercent: "14.012345" };
    const root = { quotation: { currencyCode: "KWD", items: [item] } };
    const columnPaths = ["lineTotal", "name", "quantity", "rank", "unitPrice", "unit", "taxRatePercent", "tax", "discount", "charge"];
    const prepared = commands.prepareTable({ offerPin: commands.readOffer()!.pin,
      sourcePath: "quotation.items", rowKeyPath: "rowKey", columnPaths })!;
    const document = prepared.document;
    expect(document).toMatchObject({ locale, direction });
    const table = document.nodes[document.nodes[bodyId].childIds[0]] as unknown as DynamicTableNodeV1;
    expect(table.props).toMatchObject({ sourcePath: "quotation.items", rowKeyPath: "rowKey" });
    const context = { locale, direction: resolveTemplateTextDirection(direction, locale), timeZone: "UTC", currencyCode: "USD" };
    const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "KWD" });
    const rendered = table.props.columns.map(column => {
      if (column.value?.kind !== "BINDING") throw new Error("Expected an item binding");
      const { path, format } = column.value.binding;
      expect(Object.hasOwn(item, path)).toBe(true);
      return [path, column.align, formatTemplateBindingValue(item[path as keyof typeof item], format, context, root)];
    });
    expect(rendered).toEqual([
      ["lineTotal", "END", currency.format(503.456)],
      ["name", "START", item.name],
      ["quantity", "END", quantityText],
      ["rank", "END", new Intl.NumberFormat(locale).format(item.rank)],
      ["unitPrice", "END", currency.format(73.125)],
      ["unit", "START", item.unit],
      ["taxRatePercent", "END", new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(14.012345)],
      ["tax", "END", currency.format(23.456)],
      ["discount", "END", currency.format(5.125)],
      ["charge", "END", currency.format(0)],
    ]);
  });

  it("rejects stale selection, replaced draft and revoked edit authority", () => {
    const { commands, bodyId, draft, replaceDraft, select, revoke } = setup();
    const first = commands.readOffer()!;
    const field = commands.prepareField(first.pin, "quotation.number", "Quotation number")!;
    expect(field.isCurrent()).toBe(true);
    select([]);
    expect(field.isCurrent()).toBe(false);
    select([bodyId]);
    const second = commands.readOffer()!;
    expect(second.pin).not.toBe(first.pin);
    replaceDraft({ ...draft, revision: 2, etag: '"2"' });
    expect(commands.readOffer()).toBeNull();
    replaceDraft(draft);
    expect(commands.readOffer()).not.toBeNull();
    revoke();
    expect(commands.readOffer()).toBeNull();
  });

  it("compares independent package pins and the complete descriptor commitment", () => {
    const { commands, trust, replaceTrust, replaceOwner } = setup();
    expect(commands.readOffer()).not.toBeNull();
    replaceTrust({ ...trust, pins: { ...trust.pins, provider: { ...trust.pins.provider, entrypointSha256: "f".repeat(64) } } });
    expect(commands.readOffer()).toBeNull();
    replaceTrust(trust);
    replaceOwner({ ...owner, descriptor: { ...owner.descriptor, fixtureKeys: ["altered", "metadata"] } });
    expect(commands.readOffer()).toBeNull();
  });

  it("requires the owner observation to match the authenticated company", () => {
    const { commands, replaceOwnerCompany } = setup();
    expect(commands.readOffer()).not.toBeNull();
    replaceOwnerCompany("01890000-0000-7000-8000-000000000006");
    expect(commands.readOffer()).toBeNull();
  });

  it.each([
    ["FLOW_DOCUMENT", "body"],
    ["HYBRID_DOCUMENT", "body"],
    ["FLOW_DOCUMENT", "section"],
    ["HYBRID_DOCUMENT", "section"],
  ] as const)("changes only selected Sales table heading text in %s under the %s", (mode, placement) => {
    const { commands, bodyId, state, select, revoke } = setup(mode);
    const insert = commands.readOffer()!;
    state.document = commands.prepareTable({
      offerPin: insert.pin, sourcePath: "quotation.items", rowKeyPath: "rowKey", columnPaths: ["unitPrice", "name"],
    })!.document;
    const tableId = state.document.nodes[bodyId].childIds[0];
    if (placement === "section") {
      const sectionId = "01890000-0000-7000-8000-000000000007";
      const body = state.document.nodes[bodyId];
      const table = state.document.nodes[tableId];
      state.document = parseEditorDocument({
        ...state.document,
        nodes: {
          ...state.document.nodes,
          [bodyId]: { ...body, childIds: [sectionId] },
          [sectionId]: {
            ...body, id: sectionId, parentId: bodyId, childIds: [tableId], props: { semanticRole: "SECTION" },
          },
          [tableId]: { ...table, parentId: sectionId },
        },
      });
    }
    select([tableId]);
    const offer = commands.readOffer()!;
    const columns = offer.tableHeaders!.columns;
    expect(columns.map(column => [column.path, column.label])).toEqual([["unitPrice", "unitPrice"], ["name", "name"]]);
    expect(offer.table).toBeNull();
    expect(offer.fields).toEqual([]);
    const values = columns.map((column, index) => ({ id: column.id, label: ["Unit price", "الخدمة"][index] }));
    expect(commands.prepareTableHeaders(offer.pin, [...values].reverse())).toBeNull();
    expect(commands.prepareTableHeaders(insert.pin, values)).toBeNull();
    expect(commands.prepareTableHeaders(offer.pin, columns)).toBeNull();
    expect(commands.prepareTableHeaders(offer.pin, [{ ...values[0], label: "x".repeat(20_001) }, values[1]])).toBeNull();
    const prepared = commands.prepareTableHeaders(offer.pin, values)!;
    expect(prepared.isCurrent()).toBe(true);
    const original = state.document.nodes[tableId];
    const previous = original.props.columns as Record<string, unknown>[];
    expect(prepared.document.nodes[tableId]).toEqual({
      ...original, props: { ...original.props, columns: previous.map((column, index) => ({
        ...column, header: { kind: "TEXT", value: values[index].label },
      })) },
    });
    expect(prepared.document.nodes[bodyId]).toEqual(state.document.nodes[bodyId]);
    select([bodyId]);
    expect(prepared.isCurrent()).toBe(false);
    select([tableId]);
    const replacement = commands.readOffer()!;
    expect(replacement.pin).not.toEqual(offer.pin);
    revoke();
    expect(commands.prepareTableHeaders(replacement.pin, values)).toBeNull();
  });

  it("leaves documents that need an immutable function version unavailable", () => {
    const { commands, state, bodyId } = setup();
    expect(commands.readOffer()).not.toBeNull();
    const formulaId = "01890000-0000-7000-8000-000000000007";
    const versionId = "01890000-0000-7000-8000-000000000008";
    const body = state.document.nodes[bodyId];
    state.document = { ...state.document, nodes: { ...state.document.nodes,
      [bodyId]: { ...body, childIds: [formulaId] },
      [formulaId]: { id: formulaId, type: "formula", parentId: bodyId, childIds: [], locked: false, hidden: false,
        layout: { kind: "FLOW", order: 0 }, style: {},
        props: { formulaId, expression: { kind: "FUNCTION_CALL", functionVersionId: versionId, arguments: [] } } },
    } };
    expect(commands.readOffer()).toBeNull();
  });
});
