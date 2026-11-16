// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { canonicalJson, validateDescriptorModel } from "@mutakamel/template-schema/browser-safe";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { EditorDocument } from "../../template-editor-model";
import { readTemplateOwnerAdmission, type TemplateOwnerAdmission } from "../../template-owner-admission";
import ownerFixture from "../../template-owner-admission-api.fixture.json";
import { useDesignerNodeCommands } from "../hooks/useDesignerNodeCommands";
import { admitTableChoice, readScopedTableOffer, type ScopedTableChoice } from "./scoped-table-source";
import type { InspectorDataPortHost } from "./inspector-data-contract";

const sourceKey = "TRADE_QUOTATION_PRINT_V1";
const ownerRow = ownerFixture.rows.find(row => row.adapterKey === sourceKey)!;
const producer = ownerFixture.producerObservations.find(row => row.adapterKey === sourceKey)!;
const bodyId = "01890000-0000-7000-8000-000000000001";
let owner: TemplateOwnerAdmission;

beforeAll(async () => {
  const admission = await readTemplateOwnerAdmission(ownerRow, {
    canonicalJson, pins: producer.pins, isCurrent: () => true,
  });
  if (!admission) throw new Error("Sales Quotation owner fixture failed admission");
  owner = admission;
});

function setup(layoutMode = "FLOW_DOCUMENT") {
  const document: EditorDocument = {
    schemaVersion: 1, documentType: "QUOTATION", dataSourceKey: sourceKey, outputChannel: "PRINT",
    layoutMode, locale: "en-US", direction: "LTR", theme: {}, rootNodeIds: [bodyId],
    nodes: { [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [], locked: false, hidden: false,
      layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } } },
  };
  const authority = {
    key: "quote editor", tenantId: "01890000-0000-7000-8000-000000000002", companyId: null,
    canRead: true, readOnly: false,
  };
  const state = { document, generation: 2, dirty: true, gestureActive: false, canUndo: true, canRedo: false };
  const native = {
    validateDescriptorModel: (value: unknown) => validateDescriptorModel(value as Parameters<typeof validateDescriptorModel>[0]),
    parseTemplateFormulaExpression: vi.fn(), inferTemplateFormulaType: vi.fn(), validateTemplateDocumentModel: vi.fn(),
  };
  const host = {
    bridge: {
      read: () => state, context: () => authority, selection: vi.fn((): readonly string[] => [bodyId]),
      canEdit: vi.fn(() => true), execute: vi.fn(() => false), subscribe: vi.fn(() => () => {}),
    },
    readNative: () => native,
    readCatalogue: vi.fn<InspectorDataPortHost["readCatalogue"]>(() => ({
      authorityKey: authority.key, tenantId: authority.tenantId, companyId: authority.companyId,
      descriptor: owner.descriptor, versions: [],
    })),
    readSourceFingerprint: vi.fn<InspectorDataPortHost["readSourceFingerprint"]>(() => owner.fingerprint),
  } satisfies InspectorDataPortHost;
  return { host, state, authority, read: () => readScopedTableOffer(host, state.document, bodyId) };
}

describe("Sales Quotation scoped table binding", () => {
  it.each(["FLOW_DOCUMENT", "HYBRID_DOCUMENT"])("admits the authored columns in order for %s", layoutMode => {
    const { read } = setup(layoutMode);
    const offer = read();
    expect(offer?.sources).toHaveLength(1);
    expect(offer?.sources[0]).toMatchObject({ sourcePath: "quotation.items", rowKeyPath: "rowKey" });
    expect(offer?.sources[0].columnPaths).toEqual(expect.arrayContaining(["name", "quantity", "unitPrice"]));
    expect(offer?.sources[0].columnPaths).not.toContain("itemImage");

    const columns = ["unitPrice", "name"];
    const choice: ScopedTableChoice = {
      offerPin: offer!.pin, sourcePath: "quotation.items", rowKeyPath: "rowKey", columnPaths: columns,
    };
    const admitted = admitTableChoice(offer, choice);
    expect(admitted).toEqual({ sourcePath: "quotation.items", rowKeyPath: "rowKey", columnPaths: columns });
    columns.reverse();
    expect(admitted?.columnPaths).toEqual(["unitPrice", "name"]);
    expect(admitTableChoice(offer, { ...choice, columnPaths: ["name", "name"] })).toBeNull();
    expect(admitTableChoice(offer, { ...choice, columnPaths: ["quotation.items[].name"] })).toBeNull();
    expect(admitTableChoice(offer, { ...choice, columnPaths: ["itemImage"] })).toBeNull();
    expect(admitTableChoice(offer, { ...choice, rowKeyPath: "rank" })).toBeNull();
  });

  it("applies Sales formats when inserting from the native designer offer", () => {
    const { host, state } = setup("HYBRID_DOCUMENT");
    state.document = { ...state.document, direction: "RTL", locale: "ar-EG" };
    const readDocument = () => state.document;
    const { result } = renderHook(() => useDesignerNodeCommands(state.document, bodyId, null, [], { text: "" },
      readDocument, vi.fn(), vi.fn(), (prepare, scope) => {
        const next = prepare(state.document, [bodyId]);
        if (!next || typeof scope !== "function" || !scope()) return false;
        state.document = next;
        return true;
      }, readDocument, host));
    const offer = result.current.tableOffer!;
    expect(result.current.insertTable({ offerPin: offer.pin, sourcePath: "quotation.items", rowKeyPath: "rowKey",
      columnPaths: ["quantity", "unit", "lineTotal"] })).toBe(true);
    expect(state.document.direction).toBe("RTL");
    const table = state.document.nodes[state.document.nodes[bodyId].childIds[0]];
    expect(table.props).toMatchObject({ sourcePath: "quotation.items", rowKeyPath: "rowKey", columns: [
      { align: "END", value: { binding: { path: "quantity", format: { type: "NUMBER", maximumFractionDigits: 6 } } } },
      { align: "START", value: { binding: { path: "unit" } } },
      { align: "END", value: { binding: { path: "lineTotal", format: { type: "CURRENCY", currencyCodePath: "quotation.currencyCode" } } } },
    ] });
  });

  it("invalidates a choice when the authored document changes in the same generation", () => {
    const { state, read } = setup();
    const offer = read()!;
    const choice = { offerPin: offer.pin, sourcePath: "quotation.items", rowKeyPath: "rowKey", columnPaths: ["name"] };
    expect(read()?.pin).toBe(offer.pin);
    state.document = { ...state.document, theme: { changed: true } };
    expect(admitTableChoice(read(), choice)).toBeNull();
  });

  it("invalidates an offer when the qualified host is replaced with the same owner fingerprint", () => {
    const { host, state, read } = setup();
    const offer = read()!;
    const replacement = { ...host };
    const nextOffer = readScopedTableOffer(replacement, state.document, bodyId);
    expect(nextOffer?.sources).toEqual(offer.sources);
    expect(admitTableChoice(nextOffer, {
      offerPin: offer.pin, sourcePath: "quotation.items", rowKeyPath: "rowKey", columnPaths: ["name"],
    })).toBeNull();
  });

  it("does not offer a Flow body insertion on a Fixed canvas", () => {
    expect(setup("FIXED_CANVAS").read()).toBeNull();
  });

  it("requires the full current owner descriptor and its registered non-null line key", () => {
    const { host, read } = setup();
    const catalogue = host.readCatalogue()!;
    host.readCatalogue.mockReturnValueOnce(null);
    expect(read()).toBeNull();
    host.readCatalogue.mockReturnValueOnce({ ...catalogue, descriptor: { fields: owner.descriptor.fields } });
    expect(read()).toBeNull();
    const descriptor = structuredClone(ownerRow.ownerContext.descriptor);
    descriptor.fields.find(field => field.path === "quotation.items[].rowKey")!.nullable = true;
    host.readCatalogue.mockReturnValueOnce({ ...catalogue, descriptor });
    expect(read()).toBeNull();
    host.readSourceFingerprint.mockReturnValueOnce(null);
    expect(read()).toBeNull();
  });

  it("requires edit permission and an unlocked selected body", () => {
    const { host, state, authority, read } = setup();
    host.bridge.selection.mockReturnValueOnce([bodyId, "another"]);
    expect(read()).toBeNull();
    host.bridge.canEdit.mockReturnValueOnce(false);
    expect(read()).toBeNull();
    authority.readOnly = true;
    expect(read()).toBeNull();
    authority.readOnly = false;
    state.document.nodes[bodyId].locked = true;
    expect(read()).toBeNull();
  });
});
