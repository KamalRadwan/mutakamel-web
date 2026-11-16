import { TEMPLATE_LIMITS } from "@mutakamel/template-schema/browser-safe";
import { isUUIDv7 } from "@/lib/uuid";
import { flowBodyDestination } from "../../pages/zone-flow-commands";
import type { EditorDocument } from "../../template-editor-model";
import { dataFields, readDataDescriptor } from "./binding-catalogue";
import type { InspectorDataPortHost } from "./inspector-data-contract";

const sha256 = /^[0-9a-f]{64}$/u;
const draftFields = ["templateId", "draftId", "revision", "etag", "contentChecksum"] as const;
const quotationLineSource = { sourcePath: "quotation.items", rowKeyPath: "rowKey" } as const;
const offerIdentities = new WeakMap<EditorDocument | InspectorDataPortHost, number>();
let nextOfferIdentity = 0;

function offerIdentity(value: EditorDocument | InspectorDataPortHost): number {
  const identity = offerIdentities.get(value);
  if (identity !== undefined) return identity;
  const next = ++nextOfferIdentity;
  offerIdentities.set(value, next);
  return next;
}

interface TableDraftIdentity {
  readonly templateId: string;
  readonly draftId: string;
  readonly revision: number;
  readonly etag: string;
  readonly contentChecksum: string;
}

interface TableOwnerScope {
  readonly authorityKey: string;
  readonly tenantId: string;
  readonly companyId: string | null;
}

export interface ScopedTableRowUniquenessClaim extends TableOwnerScope {
  readonly draft: TableDraftIdentity;
  readonly dataSourceKey: string;
  readonly descriptorChecksum: string;
  /** Qualified owner admission fingerprint covering the descriptor and package pins. */
  readonly sourceFingerprint: string;
  readonly sourcePath: string;
  readonly rowKeyPath: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

/** Private extension. Only a qualified owner reader may supply the current authenticated claim. */
export interface ScopedTableRowUniquenessReader {
  /** Current persisted draft identity from the authenticated editor, separate from the claim. */
  readCurrentDraft(): (TableDraftIdentity & TableOwnerScope & { readonly generation: number }) | null;
  /** Return null on absent, superseded or retired evidence. Times are Unix milliseconds. */
  readCurrentRowUniqueness(): ScopedTableRowUniquenessClaim | null;
}

type ScopedTableHost = InspectorDataPortHost & { readonly rowUniqueness?: ScopedTableRowUniquenessReader };

interface ScopedTableSource {
  sourcePath: string;
  rowKeyPath: string;
  columnPaths: readonly string[];
}

export interface ScopedTableOffer {
  pin: string;
  sources: readonly ScopedTableSource[];
}

export interface ScopedTableChoice {
  offerPin: string;
  sourcePath: string;
  rowKeyPath: string;
  columnPaths: readonly string[];
}

export function readScopedTableOffer(host: ScopedTableHost | undefined, document: EditorDocument, bodyId: string): ScopedTableOffer | null {
  if (!host || document.outputChannel !== "PRINT") return null;
  try {
    const { bridge } = host;
    const state = bridge.read();
    const authority = bridge.context();
    const selection = bridge.selection();
    if (!authority.canRead || authority.readOnly || !bridge.canEdit() || state.gestureActive ||
        state.document !== document || selection.length !== 1 || selection[0] !== bodyId ||
        !flowBodyDestination(document, bodyId)) return null;
    const fingerprint = host.readSourceFingerprint();
    const descriptor = readDataDescriptor(host.readNative(), host.readCatalogue(), authority, document);
    if (!descriptor || !fingerprint || !sha256.test(fingerprint) || !sha256.test(descriptor.checksum) ||
        !authority.key || !isUUIDv7(authority.tenantId) || (authority.companyId !== null && !isUUIDv7(authority.companyId)) ||
        new Set(descriptor.fields.map(field => field.path)).size !== descriptor.fields.length) return null;

    const salesQuotation = descriptor.key === "TRADE_QUOTATION_PRINT_V1" && descriptor.version === 1;
    const reader = host.rowUniqueness;
    let sourcePath: string, rowKeyPath: string;
    let draftPin: readonly (string | number)[] = [];
    if (reader) {
      const draft = reader.readCurrentDraft();
      const claim = reader.readCurrentRowUniqueness();
      const now = Date.now();
      if (!draft || !claim ||
          ![draft, claim].every(value => value.authorityKey === authority.key && value.tenantId === authority.tenantId &&
            value.companyId === authority.companyId) ||
          !isUUIDv7(draft.templateId) || !isUUIDv7(draft.draftId) || draft.generation !== state.generation ||
          !Number.isSafeInteger(draft.revision) || draft.revision < 1 || draft.etag !== '"' + draft.revision + '"' ||
          typeof draft.contentChecksum !== "string" || !sha256.test(draft.contentChecksum) ||
          !draftFields.every(key => claim.draft[key] === draft[key]) ||
          claim.dataSourceKey !== descriptor.key || claim.descriptorChecksum !== descriptor.checksum ||
          claim.sourceFingerprint !== fingerprint || !Number.isSafeInteger(claim.issuedAt) ||
          !Number.isSafeInteger(claim.expiresAt) || claim.issuedAt > now || claim.expiresAt <= now ||
          typeof claim.sourcePath !== "string" || !claim.sourcePath || claim.sourcePath.includes("[]")) return null;
      ({ sourcePath, rowKeyPath } = claim);
      draftPin = [...draftFields.map(key => draft[key]), claim.issuedAt, claim.expiresAt];
    } else {
      if (!salesQuotation) return null;
      // Trade's quotation print adapter uses persisted line IDs, and its V1 parser rejects duplicate row keys.
      ({ sourcePath, rowKeyPath } = quotationLineSource);
    }
    if (!descriptor.fields.some(field => field.path === sourcePath && field.dataType === "ARRAY")) return null;
    const columns = dataFields(descriptor, sourcePath);
    const key = columns.find(column => column.path === rowKeyPath)?.field;
    if (!key || key.nullable || key.parentNullable) return null;
    if (salesQuotation && (sourcePath !== quotationLineSource.sourcePath || rowKeyPath !== quotationLineSource.rowKeyPath ||
        key.dataType !== "STRING" || key.valueEncoding !== "UTF8_NFC")) return null;
    const columnPaths = columns.map(column => column.path);
    const source = { sourcePath, rowKeyPath, columnPaths };
    return {
      // A new qualified session can use the same descriptor and package fingerprint.
      pin: JSON.stringify([authority.key, authority.tenantId, authority.companyId, state.generation,
        offerIdentity(host), offerIdentity(document), draftPin,
        fingerprint, descriptor.key, descriptor.checksum, bodyId, source]),
      sources: [source],
    };
  } catch { return null; }
}

export function admitTableChoice(offer: ScopedTableOffer | null, choice: ScopedTableChoice): ScopedTableSource | null {
  if (!offer || !choice || choice.offerPin !== offer.pin || !Array.isArray(choice.columnPaths) ||
    !choice.columnPaths.length || choice.columnPaths.length > TEMPLATE_LIMITS.maxTableColumns) return null;
  const source = offer.sources.find(item => item.sourcePath === choice.sourcePath && item.rowKeyPath === choice.rowKeyPath);
  if (!source) return null;
  const columnPaths = [...choice.columnPaths];
  if (new Set(columnPaths).size !== columnPaths.length || !columnPaths.every(path => source.columnPaths.includes(path))) return null;
  return { sourcePath: source.sourcePath, rowKeyPath: source.rowKeyPath, columnPaths };
}
