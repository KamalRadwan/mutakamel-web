import { FAKE_COMPANIES } from '../../../core/scope/scope.fake';
import { toJsonPointer } from './shared/json-pointer';
import type {
  CreateTemplateAssignmentDto,
  CreateTemplateDto,
  CreateTemplateResponse,
  DuplicateTemplateDto,
  PatchTemplateDefinitionDto,
  PatchTemplateDefinitionResponse,
  PatchTemplateDraftDto,
  PatchTemplateDraftResponse,
  PatchTemplateAssignmentDto,
  PublishTemplateRequestDto,
  PublishTemplateResponseDto,
  ResolveTemplateAssignmentRequestDto,
  ResolveTemplateAssignmentResponseDto,
  RestoreRecoverySnapshotDto,
  RestoreRecoverySnapshotResponse,
  RestoreTemplateVersionDto,
  RestoreTemplateVersionResponse,
  RetireTemplateVersionResponse,
  TemplateAssetDetailResponse,
  TemplateAssetDto,
  TemplateAssetsListQuery,
  TemplateAssignmentDto,
  TemplateAssignmentImpact,
  TemplateAssignmentsListQuery,
  TemplateAssignmentWriteResponse,
  TemplateAuthor,
  TemplateCreationScope,
  TemplateCreationScopesResponse,
  TemplateCursorPage,
  TemplateDataSourceItem,
  TemplateDataSourceKey,
  TemplateDataSourceSchemaDto,
  TemplateDataSourceSchemaQuery,
  TemplateDataSourcesQuery,
  TemplateDataSourcesResponse,
  TemplateDefinitionDetail,
  TemplateDefinitionScope,
  TemplateDetailCapabilities,
  TemplateDocumentType,
  TemplateDocumentV1,
  TemplateDraftDto,
  TemplateEmailPreviewResponseDto,
  TemplateHtmlOrEmailPreviewRequestDto,
  TemplateHtmlPreviewResponseDto,
  TemplateLayoutMode,
  TemplateLayoutReceiptV1,
  TemplateLifecycleStatus,
  TemplateListActions,
  TemplateListRequestDto,
  TemplateListResponse,
  TemplateListRow,
  TemplateListSortBy,
  TemplateLocale,
  TemplateNode,
  TemplateOutputChannel,
  TemplatePageConfig,
  TemplatePdfJobDto,
  TemplatePdfPreviewAcceptedDto,
  TemplatePdfPreviewRequestDto,
  TemplateRecoverySnapshotItem,
  TemplateRecoverySnapshotsQuery,
  TemplateResolvedDirection,
  TemplateRowAssignmentSummary,
  TemplateSchemaField,
  TemplateScopeRef,
  TemplateSortDirection,
  TemplateStarterOption,
  TemplateStartersQuery,
  TemplateStartersResponse,
  TemplateSyntheticFixture,
  TemplateThumbnail,
  TemplateDataSourceAdmission,
  TemplateOwnerContext,
  TemplateOwnerContextPins,
  TemplateOwnerDescriptor,
  TemplateProducerPackageName,
  TemplateProducerPackagePin,
  TemplateThumbnailQuery,
  TemplateThumbnailRetryRequest,
  TemplateThumbnailRetryResponse,
  TemplateValidationIssue,
  TemplateValidationRunDto,
  TemplateVersionDetail,
  TemplateVersionItem,
  TemplateVersionRef,
  TemplateVersionsListQuery,
  UploadTemplateAssetRequest,
  UploadTemplateAssetResponse,
  ValidateTemplateDraftDto,
} from './templates.model';

/** Structured API error thrown by fake and real template transport layers. */
export class TemplateApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly correlationId = 'corr-01948100-0000-7000-8000-000000000001',
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'TemplateApiError';
  }
}

export function fakeDelay(ms = 180): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uuidv7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const now = Date.now();
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(now / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(now / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newTemplateIdempotencyKey(): string {
  return uuidv7();
}

function pseudoSha256(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  const part = h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  return part.repeat(4).slice(0, 64);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Canonical scope identifiers aligned with portal ScopeState (legacy fixture UUIDs accepted via alias). */
const LEGACY_COMPANY_NILE_UUID = '01948100-0000-7000-8000-00000000c001';
const LEGACY_COMPANY_MTG_UUID = '01948100-0000-7000-8000-00000000c002';
const LEGACY_BRANCH_CAIRO_UUID = '01948100-0000-7000-8000-00000000b001';
const LEGACY_BRANCH_ALEX_UUID = '01948100-0000-7000-8000-00000000b002';

const COMPANY_NILE_ID = FAKE_COMPANIES[0]?.id ?? LEGACY_COMPANY_NILE_UUID;
const COMPANY_MTG_ID = FAKE_COMPANIES[1]?.id ?? LEGACY_COMPANY_MTG_UUID;
const BRANCH_CAIRO_ID = FAKE_COMPANIES[0]?.branches[0]?.id ?? LEGACY_BRANCH_CAIRO_UUID;
const BRANCH_ALEX_ID = FAKE_COMPANIES[0]?.branches[1]?.id ?? LEGACY_BRANCH_ALEX_UUID;

const AUTHOR_USER: TemplateAuthor = {
  kind: 'USER',
  actorId: '01948100-0000-7000-8000-00000000a001',
  displayName: 'User',
};

const TPL_IDS = {
  qtCorp: '01948100-0000-7000-8000-000000001001',
  qtClassic: '01948100-0000-7000-8000-000000001002',
  pqSupplier: '01948100-0000-7000-8000-000000001003',
  soConfirm: '01948100-0000-7000-8000-000000001004',
  poStandard: '01948100-0000-7000-8000-000000001005',
  invClean: '01948100-0000-7000-8000-000000001006',
  conService: '01948100-0000-7000-8000-000000001007',
  ltrOfficial: '01948100-0000-7000-8000-000000001008',
  emLeadWelcome: '01948100-0000-7000-8000-000000001009',
  qt2025: '01948100-0000-7000-8000-000000001010',
} as const;

const ASSET_IDS = {
  logoMain: '01948100-0000-7000-8000-000000003001',
  logoEmail: '01948100-0000-7000-8000-000000003002',
  letterheadBg: '01948100-0000-7000-8000-000000003003',
  showroomBanner: '01948100-0000-7000-8000-000000003004',
  companyStamp: '01948100-0000-7000-8000-000000003005',
  legacyLogo: '01948100-0000-7000-8000-000000003006',
} as const;

const CORP_NODE_IDS = {
  topBand: '01948100-0000-7000-8000-000000004001',
  logo: '01948100-0000-7000-8000-000000004002',
  companyInfo: '01948100-0000-7000-8000-000000004003',
  title: '01948100-0000-7000-8000-000000004004',
  number: '01948100-0000-7000-8000-000000004005',
  dates: '01948100-0000-7000-8000-000000004006',
  preparedFor: '01948100-0000-7000-8000-000000004007',
  customerDetails: '01948100-0000-7000-8000-000000004008',
  currencyBranch: '01948100-0000-7000-8000-000000004009',
  itemsTable: '01948100-0000-7000-8000-000000004010',
  totalsTable: '01948100-0000-7000-8000-000000004011',
  terms: '01948100-0000-7000-8000-000000004012',
  signatory: '01948100-0000-7000-8000-000000004013',
  bottomBand: '01948100-0000-7000-8000-000000004014',
} as const;

const CORP_PAGE_ID = '01948100-0000-7000-8000-000000005001';
const CORP_VALIDATION_RUN_ID = '01948100-0000-7000-8000-000000006001';
const CORP_PDF_JOB_ID = '01948100-0000-7000-8000-000000007001';
const CORP_SNAPSHOT_ID = '01948100-0000-7000-8000-000000008001';

const A4_MARGINS_12 = { top: 12, end: 12, bottom: 12, start: 12 };

function makeA4PageConfig(): TemplatePageConfig {
  return {
    unit: 'MM',
    preset: 'A4',
    widthMm: 210,
    heightMm: 297,
    orientation: 'PORTRAIT',
    marginMm: { ...A4_MARGINS_12 },
    bleedMm: 0,
  };
}

/** Corporate quotation FIXED_CANVAS document with 14 ABSOLUTE nodes matching mockup 04-designer-fixed. */
function createCorporateQuotationDocument(): TemplateDocumentV1 {
  const pageConfig = makeA4PageConfig();
  const rootNodeIds = Object.values(CORP_NODE_IDS);

  const nodes: Record<string, TemplateNode> = {
    [CORP_NODE_IDS.topBand]: {
      id: CORP_NODE_IDS.topBand,
      type: 'container',
      parentId: null,
      childIds: [],
      name: 'Top accent band',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 12, y: 12, width: 186, height: 1.5, rotationDeg: 0, zIndex: 1 },
      style: { backgroundColor: '#0B7A85' },
      props: { semanticRole: 'SECTION' },
    },
    [CORP_NODE_IDS.logo]: {
      id: CORP_NODE_IDS.logo,
      type: 'image',
      parentId: null,
      childIds: [],
      name: 'Company logo',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 18, y: 13, width: 38, height: 18, rotationDeg: 0, zIndex: 2 },
      style: { objectFit: 'CONTAIN' },
      props: {
        assetId: ASSET_IDS.logoMain,
        alt: 'Nile Office Furnishings logo',
        decorative: false,
      },
    },
    [CORP_NODE_IDS.companyInfo]: {
      id: CORP_NODE_IDS.companyInfo,
      type: 'text',
      parentId: null,
      childIds: [],
      name: 'Company details',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 18, y: 34, width: 88, height: 16, rotationDeg: 0, zIndex: 3 },
      style: { fontSizePx: 10, color: '#12141C', lineHeight: 1.45 },
      props: {
        text: 'Nile Office Furnishings\n14 El Tahrir Street, Dokki, Giza, Egypt\n+20 2 5550 0148 · sales@nileoffice.example.invalid',
      },
    },
    [CORP_NODE_IDS.title]: {
      id: CORP_NODE_IDS.title,
      type: 'text',
      parentId: null,
      childIds: [],
      name: 'Document title',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 120, y: 16, width: 70, height: 10, rotationDeg: 0, zIndex: 4 },
      style: { fontSizePx: 20, fontWeight: 'BOLD', color: '#0B7A85', textAlign: 'END' },
      props: { text: 'QUOTATION' },
    },
    [CORP_NODE_IDS.number]: {
      id: CORP_NODE_IDS.number,
      type: 'dataField',
      parentId: null,
      childIds: [],
      name: 'Quotation number',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 145, y: 27, width: 45, height: 7, rotationDeg: 0, zIndex: 5 },
      style: {
        fontSizePx: 11,
        fontWeight: 'SEMIBOLD',
        color: '#0F2F78',
        backgroundColor: '#E6F4F5',
        textAlign: 'CENTER',
        borderRadiusPx: 4,
      },
      binding: { path: 'quotation.number', nullBehavior: 'EMPTY' },
      props: {},
    },
    [CORP_NODE_IDS.dates]: {
      id: CORP_NODE_IDS.dates,
      type: 'richText',
      parentId: null,
      childIds: [],
      name: 'Quotation dates',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 116, y: 36, width: 74, height: 7, rotationDeg: 0, zIndex: 6 },
      style: { fontSizePx: 9, color: '#5B6072', textAlign: 'END' },
      props: {
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              attrs: { textAlign: 'END' },
              content: [
                { type: 'text', text: 'Date: ' },
                {
                  type: 'variable',
                  attrs: {
                    binding: {
                      path: 'quotation.issueDate',
                      nullBehavior: 'EMPTY',
                      format: { kind: 'DATE', dateStyle: 'MEDIUM' },
                    },
                  },
                },
                { type: 'text', text: ' · Valid until: ' },
                {
                  type: 'variable',
                  attrs: {
                    binding: {
                      path: 'quotation.validUntil',
                      nullBehavior: 'FALLBACK',
                      fallback: '—',
                      format: { kind: 'DATE', dateStyle: 'MEDIUM' },
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    },
    [CORP_NODE_IDS.preparedFor]: {
      id: CORP_NODE_IDS.preparedFor,
      type: 'text',
      parentId: null,
      childIds: [],
      name: 'Prepared for band',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 18, y: 56, width: 172, height: 6.5, rotationDeg: 0, zIndex: 7 },
      style: {
        fontSizePx: 10,
        fontWeight: 'SEMIBOLD',
        color: '#FFFFFF',
        backgroundColor: '#0B7A85',
        padding: { unit: 'MM', blockStart: 1.5, inlineEnd: 3, blockEnd: 1.5, inlineStart: 3 },
      },
      props: { text: 'Prepared for' },
    },
    [CORP_NODE_IDS.customerDetails]: {
      id: CORP_NODE_IDS.customerDetails,
      type: 'richText',
      parentId: null,
      childIds: [],
      name: 'Customer details',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 18, y: 65, width: 96, height: 13, rotationDeg: 0, zIndex: 8 },
      style: { fontSizePx: 10, color: '#12141C', lineHeight: 1.45 },
      props: {
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'variable',
                  attrs: { binding: { path: 'customer.name', nullBehavior: 'EMPTY' } },
                },
                { type: 'hardBreak' },
                { type: 'text', text: 'Contact: ' },
                {
                  type: 'variable',
                  attrs: { binding: { path: 'customer.contactName', nullBehavior: 'FALLBACK', fallback: '—' } },
                },
                { type: 'text', text: ' · ' },
                {
                  type: 'variable',
                  attrs: { binding: { path: 'customer.code', nullBehavior: 'EMPTY' } },
                },
              ],
            },
          ],
        },
      },
    },
    [CORP_NODE_IDS.currencyBranch]: {
      id: CORP_NODE_IDS.currencyBranch,
      type: 'richText',
      parentId: null,
      childIds: [],
      name: 'Currency and branch',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 120, y: 65, width: 70, height: 13, rotationDeg: 0, zIndex: 9 },
      style: { fontSizePx: 10, color: '#5B6072', textAlign: 'END', lineHeight: 1.45 },
      props: {
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              attrs: { textAlign: 'END' },
              content: [
                { type: 'text', text: 'Currency: ' },
                {
                  type: 'variable',
                  attrs: { binding: { path: 'quotation.currencyCode', nullBehavior: 'EMPTY' } },
                },
                { type: 'hardBreak' },
                { type: 'text', text: 'Branch: ' },
                {
                  type: 'variable',
                  attrs: { binding: { path: 'branch.name', nullBehavior: 'EMPTY' } },
                },
              ],
            },
          ],
        },
      },
    },
    [CORP_NODE_IDS.itemsTable]: {
      id: CORP_NODE_IDS.itemsTable,
      type: 'dynamicTable',
      parentId: null,
      childIds: [],
      name: 'Sales line items table',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 12, y: 84, width: 186, height: 52, rotationDeg: 0, zIndex: 10 },
      style: { fontSizePx: 9, color: '#12141C' },
      props: {
        sourcePath: 'items',
        rowKeyPath: 'rank',
        repeatHeader: 'EVERY_PAGE',
        keepRowsTogether: true,
        rowSplit: 'AVOID',
        minimumEmptyRows: 0,
        emptyBehavior: 'MESSAGE',
        emptyMessage: 'No items to display',
        stripedRows: false,
        fixedCanvas: { maxRenderedRows: 12, overflow: 'REJECT' },
        columns: [
          {
            id: 'col-item',
            width: { value: 54, unit: 'MM' },
            align: 'START',
            verticalAlign: 'MIDDLE',
            wrap: true,
            visible: true,
            headerStyle: { backgroundColor: '#0B7A85', color: '#FFFFFF', fontWeight: 'SEMIBOLD' },
            header: { kind: 'TEXT', value: 'Item' },
            value: { kind: 'BINDING', binding: { path: 'items[].itemName', nullBehavior: 'EMPTY' } },
          },
          {
            id: 'col-qty',
            width: { value: 14, unit: 'MM' },
            align: 'END',
            verticalAlign: 'MIDDLE',
            wrap: false,
            visible: true,
            headerStyle: { backgroundColor: '#0B7A85', color: '#FFFFFF', fontWeight: 'SEMIBOLD' },
            header: { kind: 'TEXT', value: 'Qty' },
            value: {
              kind: 'BINDING',
              binding: {
                path: 'items[].quantity',
                nullBehavior: 'EMPTY',
                format: { kind: 'NUMBER', minFractionDigits: 0, maxFractionDigits: 0, useGrouping: true },
              },
            },
          },
          {
            id: 'col-unit',
            width: { value: 14, unit: 'MM' },
            align: 'CENTER',
            verticalAlign: 'MIDDLE',
            wrap: false,
            visible: true,
            headerStyle: { backgroundColor: '#0B7A85', color: '#FFFFFF', fontWeight: 'SEMIBOLD' },
            header: { kind: 'TEXT', value: 'Unit' },
            value: { kind: 'BINDING', binding: { path: 'items[].unitName', nullBehavior: 'EMPTY' } },
          },
          {
            id: 'col-price',
            width: { value: 22, unit: 'MM' },
            align: 'END',
            verticalAlign: 'MIDDLE',
            wrap: false,
            visible: true,
            headerStyle: { backgroundColor: '#0B7A85', color: '#FFFFFF', fontWeight: 'SEMIBOLD' },
            header: { kind: 'TEXT', value: 'Unit price' },
            value: {
              kind: 'BINDING',
              binding: {
                path: 'items[].unitPrice',
                nullBehavior: 'EMPTY',
                format: { kind: 'NUMBER', minFractionDigits: 2, maxFractionDigits: 2, useGrouping: true },
              },
            },
          },
          {
            id: 'col-discount',
            width: { value: 20, unit: 'MM' },
            align: 'END',
            verticalAlign: 'MIDDLE',
            wrap: false,
            visible: true,
            headerStyle: { backgroundColor: '#0B7A85', color: '#FFFFFF', fontWeight: 'SEMIBOLD' },
            header: { kind: 'TEXT', value: 'Discount' },
            value: {
              kind: 'BINDING',
              binding: {
                path: 'items[].discountAmount',
                nullBehavior: 'EMPTY',
                format: { kind: 'NUMBER', minFractionDigits: 2, maxFractionDigits: 2, useGrouping: true },
              },
            },
          },
          {
            id: 'col-net',
            width: { value: 22, unit: 'MM' },
            align: 'END',
            verticalAlign: 'MIDDLE',
            wrap: false,
            visible: true,
            headerStyle: { backgroundColor: '#0B7A85', color: '#FFFFFF', fontWeight: 'SEMIBOLD' },
            header: { kind: 'TEXT', value: 'Net' },
            value: {
              kind: 'BINDING',
              binding: {
                path: 'items[].netAmount',
                nullBehavior: 'EMPTY',
                format: { kind: 'NUMBER', minFractionDigits: 2, maxFractionDigits: 2, useGrouping: true },
              },
            },
          },
          {
            id: 'col-vat',
            width: { value: 18, unit: 'MM' },
            align: 'END',
            verticalAlign: 'MIDDLE',
            wrap: false,
            visible: true,
            headerStyle: { backgroundColor: '#0B7A85', color: '#FFFFFF', fontWeight: 'SEMIBOLD' },
            header: { kind: 'TEXT', value: 'VAT 14%' },
            value: {
              kind: 'BINDING',
              binding: {
                path: 'items[].taxAmount',
                nullBehavior: 'EMPTY',
                format: { kind: 'NUMBER', minFractionDigits: 2, maxFractionDigits: 2, useGrouping: true },
              },
            },
          },
          {
            id: 'col-total',
            width: { value: 22, unit: 'MM' },
            align: 'END',
            verticalAlign: 'MIDDLE',
            wrap: false,
            visible: true,
            headerStyle: { backgroundColor: '#0B7A85', color: '#FFFFFF', fontWeight: 'SEMIBOLD' },
            header: { kind: 'TEXT', value: 'Line total' },
            value: {
              kind: 'BINDING',
              binding: {
                path: 'items[].lineTotal',
                nullBehavior: 'EMPTY',
                format: { kind: 'NUMBER', minFractionDigits: 2, maxFractionDigits: 2, useGrouping: true },
              },
            },
          },
        ],
      },
    },
    [CORP_NODE_IDS.totalsTable]: {
      id: CORP_NODE_IDS.totalsTable,
      type: 'staticTable',
      parentId: null,
      childIds: [],
      name: 'Totals summary',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 116, y: 144, width: 74, height: 34, rotationDeg: 0, zIndex: 11 },
      style: { fontSizePx: 10, color: '#12141C' },
      props: {
        repeatHeader: 'FIRST_PAGE_ONLY',
        keepRowsTogether: true,
        rowSplit: 'AVOID',
        stripedRows: false,
        fixedCanvas: { rowHeightsMm: [6, 6, 6, 6, 8], overflow: 'REJECT', wrapCells: false },
        columns: [
          { id: 'tot-label', width: { value: 38, unit: 'MM' }, align: 'START', verticalAlign: 'MIDDLE', visible: true },
          { id: 'tot-value', width: { value: 36, unit: 'MM' }, align: 'END', verticalAlign: 'MIDDLE', visible: true },
        ],
        rows: [
          {
            id: 'tot-gross',
            cells: [
              { id: 'tot-gross-l', columnId: 'tot-label', value: { kind: 'TEXT', value: 'Gross' } },
              {
                id: 'tot-gross-v',
                columnId: 'tot-value',
                value: {
                  kind: 'BINDING',
                  binding: {
                    path: 'totals.grossSubtotal',
                    nullBehavior: 'EMPTY',
                    format: { kind: 'NUMBER', minFractionDigits: 2, maxFractionDigits: 2, useGrouping: true },
                  },
                },
              },
            ],
          },
          {
            id: 'tot-discount',
            cells: [
              { id: 'tot-discount-l', columnId: 'tot-label', value: { kind: 'TEXT', value: 'Discount' } },
              {
                id: 'tot-discount-v',
                columnId: 'tot-value',
                value: {
                  kind: 'BINDING',
                  binding: {
                    path: 'totals.discountTotal',
                    nullBehavior: 'EMPTY',
                    format: { kind: 'NUMBER', minFractionDigits: 2, maxFractionDigits: 2, useGrouping: true },
                  },
                },
              },
            ],
          },
          {
            id: 'tot-net',
            cells: [
              { id: 'tot-net-l', columnId: 'tot-label', value: { kind: 'TEXT', value: 'Net' } },
              {
                id: 'tot-net-v',
                columnId: 'tot-value',
                value: {
                  kind: 'BINDING',
                  binding: {
                    path: 'totals.netSubtotal',
                    nullBehavior: 'EMPTY',
                    format: { kind: 'NUMBER', minFractionDigits: 2, maxFractionDigits: 2, useGrouping: true },
                  },
                },
              },
            ],
          },
          {
            id: 'tot-vat',
            cells: [
              { id: 'tot-vat-l', columnId: 'tot-label', value: { kind: 'TEXT', value: 'VAT 14%' } },
              {
                id: 'tot-vat-v',
                columnId: 'tot-value',
                value: {
                  kind: 'BINDING',
                  binding: {
                    path: 'totals.taxTotal',
                    nullBehavior: 'EMPTY',
                    format: { kind: 'NUMBER', minFractionDigits: 2, maxFractionDigits: 2, useGrouping: true },
                  },
                },
              },
            ],
          },
          {
            id: 'tot-grand',
            cells: [
              {
                id: 'tot-grand-l',
                columnId: 'tot-label',
                value: { kind: 'TEXT', value: 'Grand total' },
                style: { backgroundColor: '#0B7A85', color: '#FFFFFF', fontWeight: 'BOLD' },
              },
              {
                id: 'tot-grand-v',
                columnId: 'tot-value',
                value: {
                  kind: 'BINDING',
                  binding: {
                    path: 'totals.grandTotal',
                    nullBehavior: 'EMPTY',
                    format: {
                      kind: 'CURRENCY',
                      currencyCodePath: 'quotation.currencyCode',
                      minFractionDigits: 2,
                      maxFractionDigits: 2,
                      useGrouping: true,
                    },
                  },
                },
                style: { backgroundColor: '#0B7A85', color: '#FFFFFF', fontWeight: 'BOLD' },
              },
            ],
          },
        ],
      },
    },
    [CORP_NODE_IDS.terms]: {
      id: CORP_NODE_IDS.terms,
      type: 'text',
      parentId: null,
      childIds: [],
      name: 'Terms and conditions',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 18, y: 146, width: 88, height: 18, rotationDeg: 0, zIndex: 12 },
      style: { fontSizePx: 9, color: '#5B6072', lineHeight: 1.45 },
      props: {
        text: 'Terms\nPrices in EGP. Delivery within 10 business days after confirmation. Payment due within 30 days.',
      },
    },
    [CORP_NODE_IDS.signatory]: {
      id: CORP_NODE_IDS.signatory,
      type: 'text',
      parentId: null,
      childIds: [],
      name: 'Authorized signatory',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 18, y: 248, width: 72, height: 16, rotationDeg: 0, zIndex: 13 },
      style: { fontSizePx: 9, color: '#12141C', lineHeight: 1.45 },
      props: {
        text: 'Prepared by\nSara Ahmed — Account Manager',
      },
    },
    [CORP_NODE_IDS.bottomBand]: {
      id: CORP_NODE_IDS.bottomBand,
      type: 'container',
      parentId: null,
      childIds: [],
      name: 'Bottom accent band',
      locked: false,
      hidden: false,
      layout: { kind: 'ABSOLUTE', unit: 'MM', x: 12, y: 280, width: 186, height: 2, rotationDeg: 0, zIndex: 14 },
      style: { backgroundColor: '#0B7A85' },
      props: { semanticRole: 'SECTION' },
    },
  };

  return {
    schemaVersion: 1,
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'FIXED_CANVAS',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    locale: 'en-US',
    direction: 'AUTO',
    page: clone(pageConfig),
    canvasPages: [
      {
        id: CORP_PAGE_ID,
        name: 'Page 1',
        page: clone(pageConfig),
        rootNodeIds: [...rootNodeIds],
      },
    ],
    theme: {
      fontFamilyToken: 'SYSTEM_SANS',
      baseFontSizePx: 10,
      textColor: '#12141C',
      accentColor: '#0B7A85',
      surfaceColor: '#FFFFFF',
      lineHeight: 1.4,
    },
    rootNodeIds: [...rootNodeIds],
    nodes,
  };
}

function createSimpleFlowDocument(params: {
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  layoutMode: TemplateLayoutMode;
  dataSourceKey: TemplateDataSourceKey;
  locale: TemplateLocale;
  title: string;
  bodyText: string;
  subject?: string;
  preheader?: string;
}): TemplateDocumentV1 {
  const isEmail = params.outputChannel === 'EMAIL';
  const bodyId = uuidv7();
  const titleId = uuidv7();
  const textId = uuidv7();

  if (isEmail) {
    return {
      schemaVersion: 1,
      documentType: params.documentType,
      outputChannel: 'EMAIL',
      layoutMode: 'EMAIL_FLOW',
      dataSourceKey: params.dataSourceKey,
      locale: params.locale,
      direction: 'AUTO',
      email: {
        maxWidthPx: 600,
        subject: { segments: [{ kind: 'TEXT', value: params.subject ?? params.title }] },
        preheader: params.preheader ? { segments: [{ kind: 'TEXT', value: params.preheader }] } : undefined,
        backgroundColor: '#F7F8FA',
      },
      theme: {
        fontFamilyToken: params.locale === 'ar-EG' ? 'ARABIC_SANS' : 'SYSTEM_SANS',
        baseFontSizePx: 14,
        textColor: '#12141C',
        accentColor: '#1D56C9',
        surfaceColor: '#FFFFFF',
        lineHeight: 1.5,
      },
      rootNodeIds: [bodyId],
      nodes: {
        [bodyId]: {
          id: bodyId,
          type: 'container',
          parentId: null,
          childIds: [titleId, textId],
          name: 'Email body',
          locked: false,
          hidden: false,
          layout: { kind: 'FLOW', order: 0 },
          style: { padding: { unit: 'PX', blockStart: 24, inlineEnd: 24, blockEnd: 24, inlineStart: 24 }, gapPx: 12 },
          props: { semanticRole: 'BODY' },
        },
        [titleId]: {
          id: titleId,
          type: 'text',
          parentId: bodyId,
          childIds: [],
          name: 'Headline',
          locked: false,
          hidden: false,
          layout: { kind: 'FLOW', order: 0 },
          style: { fontSizePx: 18, fontWeight: 'BOLD', color: '#12141C' },
          props: { text: params.title },
        },
        [textId]: {
          id: textId,
          type: 'text',
          parentId: bodyId,
          childIds: [],
          name: 'Message body',
          locked: false,
          hidden: false,
          layout: { kind: 'FLOW', order: 1 },
          style: { fontSizePx: 14, color: '#12141C', lineHeight: 1.6 },
          props: { text: params.bodyText },
        },
      },
    };
  }

  return {
    schemaVersion: 1,
    documentType: params.documentType,
    outputChannel: 'PRINT',
    layoutMode: params.layoutMode,
    dataSourceKey: params.dataSourceKey,
    locale: params.locale,
    direction: 'AUTO',
    page: makeA4PageConfig(),
    theme: {
      fontFamilyToken: params.locale === 'ar-EG' ? 'ARABIC_SANS' : 'SYSTEM_SANS',
      baseFontSizePx: 11,
      textColor: '#12141C',
      accentColor: '#0F2F78',
      surfaceColor: '#FFFFFF',
      lineHeight: 1.4,
    },
    rootNodeIds: [bodyId],
    nodes: {
      [bodyId]: {
        id: bodyId,
        type: 'container',
        parentId: null,
        childIds: [titleId, textId],
        name: 'Document body',
        locked: false,
        hidden: false,
        layout: { kind: 'FLOW', order: 0 },
        style: { gapPx: 12 },
        props: { semanticRole: 'BODY' },
      },
      [titleId]: {
        id: titleId,
        type: 'text',
        parentId: bodyId,
        childIds: [],
        name: 'Title',
        locked: false,
        hidden: false,
        layout: { kind: 'FLOW', order: 0 },
        style: { fontSizePx: 18, fontWeight: 'BOLD', color: '#0F2F78' },
        props: { text: params.title },
      },
      [textId]: {
        id: textId,
        type: 'text',
        parentId: bodyId,
        childIds: [],
        name: 'Body content',
        locked: false,
        hidden: false,
        layout: { kind: 'FLOW', order: 1 },
        style: { fontSizePx: 11, color: '#12141C' },
        props: { text: params.bodyText },
      },
    },
  };
}

function buildCapability(state: 'ENABLED' | 'DISABLED' | 'HIDDEN', reason: string | null = null) {
  return { state, reason };
}

function computeListActions(def: StoredTemplateDefinition, draft: TemplateDraftDto): TemplateListActions {
  const archived = def.lifecycleStatus === 'ARCHIVED';
  const hasPublished = def.currentPublishedVersion !== null;
  const canPublish = !archived && draft.validation.state === 'PASSED';

  return {
    open: buildCapability('ENABLED'),
    design: archived ? buildCapability('DISABLED', 'ARCHIVED') : buildCapability('ENABLED'),
    validate: archived ? buildCapability('DISABLED', 'ARCHIVED') : buildCapability('ENABLED'),
    duplicateFromDraft: buildCapability('ENABLED'),
    duplicateFromVersion: hasPublished
      ? buildCapability('ENABLED')
      : buildCapability('DISABLED', 'NO_PUBLISHED_VERSION'),
    preview: archived ? buildCapability('DISABLED', 'ARCHIVED') : buildCapability('ENABLED'),
    publish: canPublish
      ? buildCapability('ENABLED')
      : buildCapability('DISABLED', archived ? 'ARCHIVED' : 'VALIDATION_REQUIRED'),
    manageAssignments:
      !archived && hasPublished && (def.documentType === 'QUOTATION' || def.documentType === 'CRM_OUTBOUND_EMAIL')
        ? buildCapability('ENABLED')
        : buildCapability('DISABLED', archived ? 'ARCHIVED' : hasPublished ? 'NOT_ELIGIBLE' : 'NO_PUBLISHED_VERSION'),
    restoreVersion:
      !archived && hasPublished
        ? buildCapability('ENABLED')
        : buildCapability('DISABLED', archived ? 'ARCHIVED' : 'NO_PUBLISHED_VERSION'),
    archive: archived ? buildCapability('HIDDEN') : buildCapability('ENABLED'),
    restore: archived ? buildCapability('ENABLED') : buildCapability('HIDDEN'),
    delete:
      hasPublished || def.systemProtected
        ? buildCapability('DISABLED', hasPublished ? 'REFERENCED' : 'NOT_ELIGIBLE')
        : buildCapability('ENABLED'),
  };
}

function computeDetailCapabilities(
  def: StoredTemplateDefinition,
  draft: TemplateDraftDto,
  hasPublishedOrAssigned: boolean,
): TemplateDetailCapabilities {
  const archived = def.lifecycleStatus === 'ARCHIVED';
  const hasPublished = def.currentPublishedVersion !== null;
  const canPublish = !archived && draft.validation.state === 'PASSED';

  return {
    update: archived ? buildCapability('DISABLED', 'ARCHIVED') : buildCapability('ENABLED'),
    validate: archived ? buildCapability('DISABLED', 'ARCHIVED') : buildCapability('ENABLED'),
    publish: canPublish
      ? buildCapability('ENABLED')
      : buildCapability('DISABLED', archived ? 'ARCHIVED' : 'VALIDATION_REQUIRED'),
    preview: archived ? buildCapability('DISABLED', 'ARCHIVED') : buildCapability('ENABLED'),
    previewPdf: archived ? buildCapability('DISABLED', 'ARCHIVED') : buildCapability('ENABLED'),
    restoreVersion:
      !archived && hasPublished
        ? buildCapability('ENABLED')
        : buildCapability('DISABLED', archived ? 'ARCHIVED' : 'NO_PUBLISHED_VERSION'),
    manageRecovery: archived ? buildCapability('DISABLED', 'ARCHIVED') : buildCapability('ENABLED'),
    restoreRecovery: archived ? buildCapability('DISABLED', 'ARCHIVED') : buildCapability('ENABLED'),
    manageAssets: archived ? buildCapability('DISABLED', 'ARCHIVED') : buildCapability('ENABLED'),
    retireVersion: hasPublished
      ? buildCapability('ENABLED')
      : buildCapability('DISABLED', 'NO_PUBLISHED_VERSION'),
    archive: archived ? buildCapability('HIDDEN') : buildCapability('ENABLED'),
    restore: archived ? buildCapability('ENABLED') : buildCapability('HIDDEN'),
    delete: hasPublishedOrAssigned
      ? buildCapability('DISABLED', 'REFERENCED')
      : buildCapability('ENABLED'),
    manageAssignments:
      !archived && hasPublished && (def.documentType === 'QUOTATION' || def.documentType === 'CRM_OUTBOUND_EMAIL')
        ? buildCapability('ENABLED')
        : buildCapability('DISABLED', archived ? 'ARCHIVED' : hasPublished ? 'NOT_ELIGIBLE' : 'NO_PUBLISHED_VERSION'),
  };
}

interface StoredTemplateDefinition extends Omit<TemplateDefinitionDetail, 'capabilities'> {
  sortOrder: number;
}

interface StoredRecoveryRecord {
  item: TemplateRecoverySnapshotItem;
  document: TemplateDocumentV1;
}

interface TemplateFakeStore {
  definitions: StoredTemplateDefinition[];
  drafts: Map<string, TemplateDraftDto>;
  versions: Map<string, TemplateVersionDetail[]>;
  validationRuns: Map<string, TemplateValidationRunDto>;
  recoverySnapshots: Map<string, StoredRecoveryRecord[]>;
  assets: TemplateAssetDto[];
  assignments: TemplateAssignmentDto[];
  pdfJobs: Map<string, TemplatePdfJobDto>;
  idempotency: Map<string, unknown>;
}

const DATA_SOURCE_ADAPTERS: readonly Omit<TemplateDataSourceItem, 'productionAssignmentEnabled' | 'productionDisabledReason'>[] = [
  {
    adapterKey: 'TRADE_QUOTATION_PRINT_V1',
    schemaVersion: 2,
    schemaChecksum: pseudoSha256('TRADE_QUOTATION_PRINT_V1:2'),
    documentType: 'QUOTATION',
    allowedOutputChannels: ['PRINT'],
    allowedLayoutModes: ['HYBRID_DOCUMENT', 'FLOW_DOCUMENT', 'FIXED_CANVAS'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 101,
  },
  {
    adapterKey: 'TRADE_PURCHASE_QUOTATION_PRINT_V1',
    schemaVersion: 2,
    schemaChecksum: pseudoSha256('TRADE_PURCHASE_QUOTATION_PRINT_V1:2'),
    documentType: 'PURCHASE_QUOTATION',
    allowedOutputChannels: ['PRINT'],
    allowedLayoutModes: ['HYBRID_DOCUMENT', 'FLOW_DOCUMENT', 'FIXED_CANVAS'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 74,
  },
  {
    adapterKey: 'TRADE_SALES_ORDER_PRINT_V1',
    schemaVersion: 2,
    schemaChecksum: pseudoSha256('TRADE_SALES_ORDER_PRINT_V1:2'),
    documentType: 'SALES_ORDER',
    allowedOutputChannels: ['PRINT'],
    allowedLayoutModes: ['HYBRID_DOCUMENT', 'FLOW_DOCUMENT', 'FIXED_CANVAS'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 92,
  },
  {
    adapterKey: 'TRADE_PURCHASE_ORDER_PRINT_V1',
    schemaVersion: 2,
    schemaChecksum: pseudoSha256('TRADE_PURCHASE_ORDER_PRINT_V1:2'),
    documentType: 'PURCHASE_ORDER',
    allowedOutputChannels: ['PRINT'],
    allowedLayoutModes: ['HYBRID_DOCUMENT', 'FLOW_DOCUMENT', 'FIXED_CANVAS'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 86,
  },
  {
    adapterKey: 'TRADE_INVOICE_PRINT_V1',
    schemaVersion: 2,
    schemaChecksum: pseudoSha256('TRADE_INVOICE_PRINT_V1:2'),
    documentType: 'INVOICE',
    allowedOutputChannels: ['PRINT'],
    allowedLayoutModes: ['HYBRID_DOCUMENT', 'FLOW_DOCUMENT', 'FIXED_CANVAS'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 96,
  },
  {
    adapterKey: 'TRADE_CONTRACT_PRINT_V1',
    schemaVersion: 2,
    schemaChecksum: pseudoSha256('TRADE_CONTRACT_PRINT_V1:2'),
    documentType: 'CONTRACT',
    allowedOutputChannels: ['PRINT'],
    allowedLayoutModes: ['HYBRID_DOCUMENT', 'FLOW_DOCUMENT', 'FIXED_CANVAS'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 64,
  },
  {
    adapterKey: 'CORE_BUSINESS_LETTER_PRINT_V1',
    schemaVersion: 1,
    schemaChecksum: pseudoSha256('CORE_BUSINESS_LETTER_PRINT_V1:1'),
    documentType: 'LETTER',
    allowedOutputChannels: ['PRINT'],
    allowedLayoutModes: ['HYBRID_DOCUMENT', 'FLOW_DOCUMENT', 'FIXED_CANVAS'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 28,
  },
  {
    adapterKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
    schemaVersion: 1,
    schemaChecksum: pseudoSha256('CRM_LEAD_OUTBOUND_EMAIL_V1:1'),
    documentType: 'CRM_OUTBOUND_EMAIL',
    allowedOutputChannels: ['EMAIL'],
    allowedLayoutModes: ['EMAIL_FLOW'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 24,
  },
  {
    adapterKey: 'CRM_CUSTOMER_OUTBOUND_EMAIL_V1',
    schemaVersion: 1,
    schemaChecksum: pseudoSha256('CRM_CUSTOMER_OUTBOUND_EMAIL_V1:1'),
    documentType: 'CRM_OUTBOUND_EMAIL',
    allowedOutputChannels: ['EMAIL'],
    allowedLayoutModes: ['EMAIL_FLOW'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 26,
  },
  {
    adapterKey: 'CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1',
    schemaVersion: 1,
    schemaChecksum: pseudoSha256('CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1:1'),
    documentType: 'CRM_OUTBOUND_EMAIL',
    allowedOutputChannels: ['EMAIL'],
    allowedLayoutModes: ['EMAIL_FLOW'],
    supportedLocales: ['ar-EG', 'en-US'],
    fieldCount: 31,
  },
];

const QUOTATION_SCHEMA_FIELDS: readonly TemplateSchemaField[] = [
  { path: 'quotation.number', labelKey: 'templates.schema.quotation.number', dataType: 'STRING', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 64, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'quotation.issueDate', labelKey: 'templates.schema.quotation.issueDate', dataType: 'DATE', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['DATE'], valueEncoding: 'ISO_DATE', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'quotation.validUntil', labelKey: 'templates.schema.quotation.validUntil', dataType: 'DATE', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['DATE'], valueEncoding: 'ISO_DATE', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'quotation.status', labelKey: 'templates.schema.quotation.status', dataType: 'STRING', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 40, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'quotation.currencyCode', labelKey: 'templates.schema.quotation.currencyCode', dataType: 'STRING', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 3, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'quotation.referenceCode', labelKey: 'templates.schema.quotation.referenceCode', dataType: 'STRING', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 64, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'quotation.notes', labelKey: 'templates.schema.quotation.notes', dataType: 'STRING', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 2000, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'quotation.terms', labelKey: 'templates.schema.quotation.terms', dataType: 'STRING', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 2000, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'customer.code', labelKey: 'templates.schema.customer.code', dataType: 'STRING', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 40, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'customer.name', labelKey: 'templates.schema.customer.name', dataType: 'STRING', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 200, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'customer.contactName', labelKey: 'templates.schema.customer.contactName', dataType: 'STRING', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 160, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'customer.contactEmail', labelKey: 'templates.schema.customer.contactEmail', dataType: 'STRING', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 254, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'customer.contactPhone', labelKey: 'templates.schema.customer.contactPhone', dataType: 'STRING', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 40, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'customer.taxNumber', labelKey: 'templates.schema.customer.taxNumber', dataType: 'STRING', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 60, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'customer.billingAddress', labelKey: 'templates.schema.customer.billingAddress', dataType: 'OBJECT', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: [], valueEncoding: 'OBJECT', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'customer.billingAddress.formatted', labelKey: 'templates.schema.customer.billingAddressFormatted', dataType: 'STRING', nullable: true, parentNullable: true, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 400, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'company.name', labelKey: 'templates.schema.company.name', dataType: 'STRING', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 200, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'company.address', labelKey: 'templates.schema.company.address', dataType: 'STRING', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 400, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'company.phone', labelKey: 'templates.schema.company.phone', dataType: 'STRING', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 40, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'company.email', labelKey: 'templates.schema.company.email', dataType: 'STRING', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 254, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'branch.name', labelKey: 'templates.schema.branch.name', dataType: 'STRING', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 160, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'branch.code', labelKey: 'templates.schema.branch.code', dataType: 'STRING', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 40, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'totals.quantity', labelKey: 'templates.schema.totals.quantity', dataType: 'DECIMAL', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'totals.grossSubtotal', labelKey: 'templates.schema.totals.grossSubtotal', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'totals.discountTotal', labelKey: 'templates.schema.totals.discountTotal', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'totals.netSubtotal', labelKey: 'templates.schema.totals.netSubtotal', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'totals.chargeTotal', labelKey: 'templates.schema.totals.chargeTotal', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'totals.taxTotal', labelKey: 'templates.schema.totals.taxTotal', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'totals.roundingTotal', labelKey: 'templates.schema.totals.roundingTotal', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'totals.grandTotal', labelKey: 'templates.schema.totals.grandTotal', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items', labelKey: 'templates.schema.items.list', dataType: 'ARRAY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: [], valueEncoding: 'ARRAY', maxLength: null, minItems: 0, maxItems: 2000, itemPathPrefix: 'items[]' },
  { path: 'items[].rank', labelKey: 'templates.schema.items.rank', dataType: 'NUMBER', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['NUMBER'], valueEncoding: 'INTEGER_STRING', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].itemCode', labelKey: 'templates.schema.items.itemCode', dataType: 'STRING', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 64, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].itemName', labelKey: 'templates.schema.items.itemName', dataType: 'STRING', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 240, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].quantity', labelKey: 'templates.schema.items.quantity', dataType: 'DECIMAL', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].unitName', labelKey: 'templates.schema.items.unitName', dataType: 'STRING', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['TEXT'], valueEncoding: 'UTF8_NFC', maxLength: 40, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].unitPrice', labelKey: 'templates.schema.items.unitPrice', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].discountRatePercent', labelKey: 'templates.schema.items.discountRatePercent', dataType: 'PERCENTAGE', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['PERCENTAGE', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].discountAmount', labelKey: 'templates.schema.items.discountAmount', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].netAmount', labelKey: 'templates.schema.items.netAmount', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].taxRatePercent', labelKey: 'templates.schema.items.taxRatePercent', dataType: 'PERCENTAGE', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['PERCENTAGE', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].taxAmount', labelKey: 'templates.schema.items.taxAmount', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].lineTotal', labelKey: 'templates.schema.items.lineTotal', dataType: 'CURRENCY', nullable: false, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: ['CURRENCY', 'NUMBER'], valueEncoding: 'DECIMAL_STRING_18_6', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
  { path: 'items[].itemImage', labelKey: 'templates.schema.items.itemImage', dataType: 'IMAGE', nullable: true, parentNullable: false, sensitive: false, previewAllowed: true, allowedFormats: [], valueEncoding: 'ASSET_UUIDV7', maxLength: null, minItems: null, maxItems: null, itemPathPrefix: null },
];

const QUOTATION_SYNTHETIC_FIXTURES: readonly TemplateSyntheticFixture[] = [
  {
    fixtureKey: 'sales-standard-en',
    locale: 'en-US',
    labelKey: 'templates.fixtures.salesStandardEn',
    fixtureChecksum: pseudoSha256('fixture:sales-standard-en'),
  },
  {
    fixtureKey: 'sales-standard-ar',
    locale: 'ar-EG',
    labelKey: 'templates.fixtures.salesStandardAr',
    fixtureChecksum: pseudoSha256('fixture:sales-standard-ar'),
  },
  {
    fixtureKey: 'sales-long-48-en',
    locale: 'en-US',
    labelKey: 'templates.fixtures.salesLong48En',
    fixtureChecksum: pseudoSha256('fixture:sales-long-48-en'),
  },
];

const STARTER_REGISTRY: readonly TemplateStarterOption[] = [
  {
    starterKey: 'quotation.hybrid.rich.en-US.v1',
    displayName: 'Modern sales quotation (English)',
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 2,
    dataSourceSchemaChecksum: pseudoSha256('TRADE_QUOTATION_PRINT_V1:2'),
    locale: 'en-US',
    resolvedDirection: 'LTR',
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    templateContentChecksum: pseudoSha256('starter:quotation.hybrid.rich.en-US.v1'),
    descriptorChecksum: pseudoSha256('descriptor:quotation.hybrid.rich.en-US.v1'),
    thumbnail: {
      state: 'READY',
      sourceChecksum: pseudoSha256('starter-thumb:quotation-en'),
      contentChecksum: pseudoSha256('starter-thumb-content:quotation-en'),
      widthPx: 420,
      heightPx: 594,
      expiresAt: '2026-12-21T00:00:00.000Z',
      downloadPath: '/api/tenant/core/v1/templates/starters/quotation.hybrid.rich.en-US.v1/thumbnail',
    },
    defaultPage: { preset: 'A4', orientation: 'PORTRAIT', marginMm: { ...A4_MARGINS_12 } },
  },
  {
    starterKey: 'quotation.hybrid.rich.ar-EG.v1',
    displayName: 'عرض سعر مبيعات حديث (العربية)',
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 2,
    dataSourceSchemaChecksum: pseudoSha256('TRADE_QUOTATION_PRINT_V1:2'),
    locale: 'ar-EG',
    resolvedDirection: 'RTL',
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    templateContentChecksum: pseudoSha256('starter:quotation.hybrid.rich.ar-EG.v1'),
    descriptorChecksum: pseudoSha256('descriptor:quotation.hybrid.rich.ar-EG.v1'),
    thumbnail: {
      state: 'READY',
      sourceChecksum: pseudoSha256('starter-thumb:quotation-ar'),
      contentChecksum: pseudoSha256('starter-thumb-content:quotation-ar'),
      widthPx: 420,
      heightPx: 594,
      expiresAt: '2026-12-21T00:00:00.000Z',
      downloadPath: '/api/tenant/core/v1/templates/starters/quotation.hybrid.rich.ar-EG.v1/thumbnail',
    },
    defaultPage: { preset: 'A4', orientation: 'PORTRAIT', marginMm: { ...A4_MARGINS_12 } },
  },
  {
    starterKey: 'crm.email.lead.simple.en-US.v1',
    displayName: 'Lead welcome email (English)',
    documentType: 'CRM_OUTBOUND_EMAIL',
    outputChannel: 'EMAIL',
    layoutMode: 'EMAIL_FLOW',
    dataSourceKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: pseudoSha256('CRM_LEAD_OUTBOUND_EMAIL_V1:1'),
    locale: 'en-US',
    resolvedDirection: 'LTR',
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    templateContentChecksum: pseudoSha256('starter:crm.email.lead.simple.en-US.v1'),
    descriptorChecksum: pseudoSha256('descriptor:crm.email.lead.simple.en-US.v1'),
    thumbnail: {
      state: 'READY',
      sourceChecksum: pseudoSha256('starter-thumb:lead-en'),
      contentChecksum: pseudoSha256('starter-thumb-content:lead-en'),
      widthPx: 400,
      heightPx: 520,
      expiresAt: '2026-12-21T00:00:00.000Z',
      downloadPath: '/api/tenant/core/v1/templates/starters/crm.email.lead.simple.en-US.v1/thumbnail',
    },
  },
  {
    starterKey: 'crm.email.lead.simple.ar-EG.v1',
    displayName: 'رسالة ترحيب بالعميل المحتمل (العربية)',
    documentType: 'CRM_OUTBOUND_EMAIL',
    outputChannel: 'EMAIL',
    layoutMode: 'EMAIL_FLOW',
    dataSourceKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: pseudoSha256('CRM_LEAD_OUTBOUND_EMAIL_V1:1'),
    locale: 'ar-EG',
    resolvedDirection: 'RTL',
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    templateContentChecksum: pseudoSha256('starter:crm.email.lead.simple.ar-EG.v1'),
    descriptorChecksum: pseudoSha256('descriptor:crm.email.lead.simple.ar-EG.v1'),
    thumbnail: {
      state: 'READY',
      sourceChecksum: pseudoSha256('starter-thumb:lead-ar'),
      contentChecksum: pseudoSha256('starter-thumb-content:lead-ar'),
      widthPx: 400,
      heightPx: 520,
      expiresAt: '2026-12-21T00:00:00.000Z',
      downloadPath: '/api/tenant/core/v1/templates/starters/crm.email.lead.simple.ar-EG.v1/thumbnail',
    },
  },
  {
    starterKey: 'crm.email.customer-profile.simple.en-US.v1',
    displayName: 'Customer account update (English)',
    documentType: 'CRM_OUTBOUND_EMAIL',
    outputChannel: 'EMAIL',
    layoutMode: 'EMAIL_FLOW',
    dataSourceKey: 'CRM_CUSTOMER_OUTBOUND_EMAIL_V1',
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: pseudoSha256('CRM_CUSTOMER_OUTBOUND_EMAIL_V1:1'),
    locale: 'en-US',
    resolvedDirection: 'LTR',
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    templateContentChecksum: pseudoSha256('starter:crm.email.customer-profile.simple.en-US.v1'),
    descriptorChecksum: pseudoSha256('descriptor:crm.email.customer-profile.simple.en-US.v1'),
    thumbnail: {
      state: 'READY',
      sourceChecksum: pseudoSha256('starter-thumb:customer-en'),
      contentChecksum: pseudoSha256('starter-thumb-content:customer-en'),
      widthPx: 400,
      heightPx: 520,
      expiresAt: '2026-12-21T00:00:00.000Z',
      downloadPath: '/api/tenant/core/v1/templates/starters/crm.email.customer-profile.simple.en-US.v1/thumbnail',
    },
  },
  {
    starterKey: 'crm.email.customer-profile.simple.ar-EG.v1',
    displayName: 'تحديث حساب العميل (العربية)',
    documentType: 'CRM_OUTBOUND_EMAIL',
    outputChannel: 'EMAIL',
    layoutMode: 'EMAIL_FLOW',
    dataSourceKey: 'CRM_CUSTOMER_OUTBOUND_EMAIL_V1',
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: pseudoSha256('CRM_CUSTOMER_OUTBOUND_EMAIL_V1:1'),
    locale: 'ar-EG',
    resolvedDirection: 'RTL',
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    templateContentChecksum: pseudoSha256('starter:crm.email.customer-profile.simple.ar-EG.v1'),
    descriptorChecksum: pseudoSha256('descriptor:crm.email.customer-profile.simple.ar-EG.v1'),
    thumbnail: {
      state: 'READY',
      sourceChecksum: pseudoSha256('starter-thumb:customer-ar'),
      contentChecksum: pseudoSha256('starter-thumb-content:customer-ar'),
      widthPx: 400,
      heightPx: 520,
      expiresAt: '2026-12-21T00:00:00.000Z',
      downloadPath: '/api/tenant/core/v1/templates/starters/crm.email.customer-profile.simple.ar-EG.v1/thumbnail',
    },
  },
  {
    starterKey: 'crm.email.opportunity.simple.en-US.v1',
    displayName: 'Opportunity follow-up (English)',
    documentType: 'CRM_OUTBOUND_EMAIL',
    outputChannel: 'EMAIL',
    layoutMode: 'EMAIL_FLOW',
    dataSourceKey: 'CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1',
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: pseudoSha256('CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1:1'),
    locale: 'en-US',
    resolvedDirection: 'LTR',
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    templateContentChecksum: pseudoSha256('starter:crm.email.opportunity.simple.en-US.v1'),
    descriptorChecksum: pseudoSha256('descriptor:crm.email.opportunity.simple.en-US.v1'),
    thumbnail: {
      state: 'READY',
      sourceChecksum: pseudoSha256('starter-thumb:opportunity-en'),
      contentChecksum: pseudoSha256('starter-thumb-content:opportunity-en'),
      widthPx: 400,
      heightPx: 520,
      expiresAt: '2026-12-21T00:00:00.000Z',
      downloadPath: '/api/tenant/core/v1/templates/starters/crm.email.opportunity.simple.en-US.v1/thumbnail',
    },
  },
  {
    starterKey: 'core.business-letter.en-US.flow.v1',
    displayName: 'Official business letter (English)',
    documentType: 'LETTER',
    outputChannel: 'PRINT',
    layoutMode: 'FLOW_DOCUMENT',
    dataSourceKey: 'CORE_BUSINESS_LETTER_PRINT_V1',
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: pseudoSha256('CORE_BUSINESS_LETTER_PRINT_V1:1'),
    locale: 'en-US',
    resolvedDirection: 'LTR',
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    templateContentChecksum: pseudoSha256('starter:core.business-letter.en-US.flow.v1'),
    descriptorChecksum: pseudoSha256('descriptor:core.business-letter.en-US.flow.v1'),
    thumbnail: {
      state: 'READY',
      sourceChecksum: pseudoSha256('starter-thumb:letter-en'),
      contentChecksum: pseudoSha256('starter-thumb-content:letter-en'),
      widthPx: 420,
      heightPx: 594,
      expiresAt: '2026-12-21T00:00:00.000Z',
      downloadPath: '/api/tenant/core/v1/templates/starters/core.business-letter.en-US.flow.v1/thumbnail',
    },
    defaultPage: { preset: 'A4', orientation: 'PORTRAIT', marginMm: { ...A4_MARGINS_12 } },
  },
];

function createSeedStore(): TemplateFakeStore {
  const definitions: StoredTemplateDefinition[] = [];
  const drafts = new Map<string, TemplateDraftDto>();
  const versions = new Map<string, TemplateVersionDetail[]>();
  const validationRuns = new Map<string, TemplateValidationRunDto>();
  const recoverySnapshots = new Map<string, StoredRecoveryRecord[]>();

  const makeThumb = (
    templateId: string,
    sourceKind: 'DRAFT' | 'PUBLISHED',
    revOrVer: number | string,
    state: 'READY' | 'PENDING' | 'UNAVAILABLE' = 'READY',
  ): TemplateThumbnail => {
    const srcSum = pseudoSha256(`thumb:${templateId}:${sourceKind}:${revOrVer}`);
    if (state !== 'READY') {
      return { state, sourceChecksum: srcSum };
    }
    const query =
      sourceKind === 'DRAFT'
        ? `sourceKind=DRAFT&draftRevision=${revOrVer}&sourceChecksum=${srcSum}`
        : `sourceKind=PUBLISHED&versionId=${revOrVer}&sourceChecksum=${srcSum}`;
    return {
      state: 'READY',
      sourceChecksum: srcSum,
      contentChecksum: pseudoSha256(`thumb-png:${srcSum}`),
      widthPx: 420,
      heightPx: 594,
      expiresAt: '2026-12-04T14:28:00.000Z',
      downloadPath: `/api/tenant/core/v1/templates/${templateId}/thumbnail?${query}`,
    };
  };

  const makeVersionDetail = (params: {
    templateId: string;
    versionId: string;
    versionNumber: number;
    documentType: TemplateDocumentType;
    outputChannel: TemplateOutputChannel;
    layoutMode: TemplateLayoutMode;
    locale: TemplateLocale;
    dataSourceKey: TemplateDataSourceKey;
    schemaVersion: number;
    publishedAt: string;
    status: 'PUBLISHED' | 'RETIRED';
    changeNote: string | null;
    restoredFromVersionId?: string | null;
    doc: TemplateDocumentV1;
    validationRunId: string;
  }): TemplateVersionDetail => {
    const contentChecksum = pseudoSha256(`ver-doc:${params.versionId}`);
    const compiledChecksum = pseudoSha256(`ver-compiled:${params.versionId}`);
    return {
      templateDefinitionId: params.templateId,
      templateVersionId: params.versionId,
      versionNumber: params.versionNumber,
      documentType: params.documentType,
      outputChannel: params.outputChannel,
      layoutMode: params.layoutMode,
      locale: params.locale,
      direction: params.locale === 'ar-EG' ? 'RTL' : 'LTR',
      dataSourceKey: params.dataSourceKey,
      dataSourceSchemaVersion: params.schemaVersion,
      dataSourceSchemaChecksum: pseudoSha256(`${params.dataSourceKey}:${params.schemaVersion}`),
      templateContentChecksum: contentChecksum,
      compiledChecksum,
      compilerFingerprint: 'compiler-mvp-v1-sha256',
      lifecycleStatus: params.status,
      publishedAt: params.publishedAt,
      restoredFromVersionId: params.restoredFromVersionId ?? null,
      changeNote: params.changeNote,
      publishedBy: AUTHOR_USER,
      retiredAt: params.status === 'RETIRED' ? '2026-10-20T09:00:00.000Z' : null,
      retiredBy: params.status === 'RETIRED' ? AUTHOR_USER : null,
      editorDocument: clone(params.doc),
      editorSchemaVersion: 1,
      nodeRegistryVersion: 'mvp-v1',
      compilerVersion: '1.4.0',
      validationRunId: params.validationRunId,
      rendererTargets: params.outputChannel === 'PRINT' ? ['HTML', 'PDF'] : ['EMAIL_HTML', 'EMAIL_TEXT'],
      bindingManifest: [{ path: 'quotation.number', nodeId: CORP_NODE_IDS.number }],
      assetManifest: [{ assetId: ASSET_IDS.logoMain, nodeId: CORP_NODE_IDS.logo }],
    };
  };

  const toVersionRef = (v: TemplateVersionDetail): TemplateVersionRef => ({
    templateDefinitionId: v.templateDefinitionId,
    templateVersionId: v.templateVersionId,
    versionNumber: v.versionNumber,
    documentType: v.documentType,
    outputChannel: v.outputChannel,
    layoutMode: v.layoutMode,
    locale: v.locale,
    direction: v.direction,
    dataSourceKey: v.dataSourceKey,
    dataSourceSchemaVersion: v.dataSourceSchemaVersion,
    dataSourceSchemaChecksum: v.dataSourceSchemaChecksum,
    templateContentChecksum: v.templateContentChecksum,
    compiledChecksum: v.compiledChecksum,
    compilerFingerprint: v.compilerFingerprint,
    lifecycleStatus: v.lifecycleStatus,
    publishedAt: v.publishedAt,
  });

  // 1. Corporate quotation (TPL-QT-CORP) — full fixture definition, 4 versions, 1 PASSED run (no issues), 1 snapshot
  const corpDoc = createCorporateQuotationDocument();
  const corpContentSum = pseudoSha256(`draft:${TPL_IDS.qtCorp}:24`);
  const corpV1Id = '01948100-0000-7000-8000-000000002101';
  const corpV2Id = '01948100-0000-7000-8000-000000002102';
  const corpV3Id = '01948100-0000-7000-8000-000000002103';
  const corpV4Id = '01948100-0000-7000-8000-000000002104';

  const corpVersions: TemplateVersionDetail[] = [
    makeVersionDetail({
      templateId: TPL_IDS.qtCorp,
      versionId: corpV4Id,
      versionNumber: 4,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'FIXED_CANVAS',
      locale: 'en-US',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      schemaVersion: 2,
      publishedAt: '2026-11-01T10:15:00.000Z',
      status: 'PUBLISHED',
      changeNote: 'Added the VAT summary under the totals.',
      doc: corpDoc,
      validationRunId: CORP_VALIDATION_RUN_ID,
    }),
    makeVersionDetail({
      templateId: TPL_IDS.qtCorp,
      versionId: corpV3Id,
      versionNumber: 3,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'FIXED_CANVAS',
      locale: 'en-US',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      schemaVersion: 2,
      publishedAt: '2026-10-22T16:40:00.000Z',
      status: 'PUBLISHED',
      changeNote: 'Aligned customer details block and branch summary.',
      doc: corpDoc,
      validationRunId: CORP_VALIDATION_RUN_ID,
    }),
    makeVersionDetail({
      templateId: TPL_IDS.qtCorp,
      versionId: corpV2Id,
      versionNumber: 2,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'FIXED_CANVAS',
      locale: 'en-US',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      schemaVersion: 2,
      publishedAt: '2026-10-14T11:20:00.000Z',
      status: 'PUBLISHED',
      changeNote: 'Updated line item columns to include Net and Discount.',
      doc: corpDoc,
      validationRunId: CORP_VALIDATION_RUN_ID,
    }),
    makeVersionDetail({
      templateId: TPL_IDS.qtCorp,
      versionId: corpV1Id,
      versionNumber: 1,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'FIXED_CANVAS',
      locale: 'en-US',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      schemaVersion: 2,
      publishedAt: '2026-10-01T09:00:00.000Z',
      status: 'RETIRED',
      changeNote: 'Initial corporate quotation release.',
      doc: corpDoc,
      validationRunId: CORP_VALIDATION_RUN_ID,
    }),
  ];
  versions.set(TPL_IDS.qtCorp, corpVersions);

  const corpDraftId = '01948100-0000-7000-8000-000000002001';
  drafts.set(TPL_IDS.qtCorp, {
    draftId: corpDraftId,
    templateId: TPL_IDS.qtCorp,
    editorDocument: clone(corpDoc),
    schemaVersion: 1,
    contentChecksum: corpContentSum,
    baseVersionId: corpV4Id,
    restoreSourceVersionId: null,
    validation: {
      state: 'PASSED',
      lastValidationRunId: CORP_VALIDATION_RUN_ID,
      validatedDraftRevision: 24,
      errorCount: 0,
      warningCount: 0,
    },
    revision: 24,
    etag: '"24"',
    updatedAt: '2026-11-04T14:28:00.000Z',
    updatedBy: AUTHOR_USER,
  });

  // The backend only returns ERROR issues (INFO maps to WARNING but no rule emits INFO), and a run with an
  // ERROR fails, so the PASSED corporate run carries no issues. Geometry errors come from fakeValidateDraft.
  validationRuns.set(CORP_VALIDATION_RUN_ID, {
    validationRunId: CORP_VALIDATION_RUN_ID,
    templateId: TPL_IDS.qtCorp,
    draftId: corpDraftId,
    draftRevision: 24,
    candidateChecksum: corpContentSum,
    editorSchemaVersion: 1,
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 2,
    dataSourceSchemaChecksum: pseudoSha256('TRADE_QUOTATION_PRINT_V1:2'),
    nodeRegistryVersion: 'mvp-v1',
    compilerVersion: '1.4.0',
    compilerFingerprint: 'compiler-mvp-v1-sha256',
    rendererTargets: ['HTML', 'PDF'],
    assetResolutionFingerprint: pseudoSha256(`assets:${ASSET_IDS.logoMain}`),
    fixtureChecksum: pseudoSha256('fixture:sales-standard-en'),
    issues: [],
    startedAt: '2026-11-04T14:29:00.000Z',
    completedAt: '2026-11-04T14:29:01.000Z',
    status: 'PASSED',
    compiledChecksum: pseudoSha256(`compiled:${corpContentSum}`),
  });

  recoverySnapshots.set(TPL_IDS.qtCorp, [
    {
      item: {
        snapshotId: CORP_SNAPSHOT_ID,
        sourceDraftRevision: 20,
        sourceSchemaVersion: 1,
        targetSchemaVersion: 1,
        sourceContentChecksum: pseudoSha256(`snapshot-src:${TPL_IDS.qtCorp}:20`),
        snapshotChecksum: pseudoSha256(`snapshot:${CORP_SNAPSHOT_ID}`),
        captureReason: 'MATERIALIZE_FIXED_PAGES',
        captureAuditId: '01948100-0000-7000-8000-000000008101',
        createdAt: '2026-10-25T09:00:00.000Z',
        createdBy: AUTHOR_USER,
        expiresAt: '2026-11-24T09:00:00.000Z',
        integrityStatus: 'AVAILABLE',
        quarantinedAt: null,
        quarantineReason: null,
        cleanupRequestedAt: null,
        restoredAt: null,
        restoredBy: null,
        restoredToDraftRevision: null,
        objectDeletedAt: null,
      },
      document: clone(corpDoc),
    },
  ]);

  definitions.push({
    sortOrder: 1,
    templateId: TPL_IDS.qtCorp,
    thumbnail: makeThumb(TPL_IDS.qtCorp, 'DRAFT', 24, 'READY'),
    code: 'TPL-QT-CORP',
    name: 'Corporate quotation',
    description: 'Branded quotation for corporate customers, one page, fixed layout.',
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'FIXED_CANVAS',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    dataSourceSchemaVersion: 2,
    dataSourceSchemaChecksum: pseudoSha256('TRADE_QUOTATION_PRINT_V1:2'),
    locale: 'en-US',
    direction: 'AUTO',
    resolvedDirection: 'LTR',
    scope: { type: 'COMPANY', companyId: COMPANY_NILE_ID },
    lifecycleStatus: 'ACTIVE',
    systemProtected: false,
    revision: 12,
    etag: '"12"',
    currentDraft: {
      draftId: corpDraftId,
      revision: 24,
      contentChecksum: corpContentSum,
      validationState: 'PASSED',
      etag: '"24"',
    },
    currentPublishedVersion: toVersionRef(corpVersions[0]),
    createdAt: '2026-09-10T08:00:00.000Z',
    createdBy: AUTHOR_USER,
    updatedAt: '2026-11-04T14:28:00.000Z',
    updatedBy: AUTHOR_USER,
    archivedAt: null,
  });

  // Helper to seed rows 2-24 cleanly
  interface SeedTemplateConfig {
    sortOrder: number;
    templateId: string;
    code: string;
    name: string;
    description: string;
    documentType: TemplateDocumentType;
    outputChannel: TemplateOutputChannel;
    layoutMode: TemplateLayoutMode;
    dataSourceKey: TemplateDataSourceKey;
    schemaVersion: number;
    locale: TemplateLocale;
    scope: TemplateDefinitionScope;
    lifecycleStatus: TemplateLifecycleStatus;
    validationState: 'NOT_VALIDATED' | 'PASSED' | 'FAILED' | 'STALE';
    thumbnailState?: 'READY' | 'PENDING' | 'UNAVAILABLE';
    publishedVersionNumber: number | null;
    draftRevision: number;
    updatedAt: string;
    publishedAt?: string;
    subject?: string;
    preheader?: string;
    bodyText: string;
  }

  const seedRest: SeedTemplateConfig[] = [
    {
      sortOrder: 2,
      templateId: TPL_IDS.qtClassic,
      code: 'TPL-QT-CLASSIC',
      name: 'عرض سعر كلاسيكي',
      description: 'عرض سعر كلاسيكي للعملاء في مصر.',
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      schemaVersion: 2,
      locale: 'ar-EG',
      scope: { type: 'COMPANY', companyId: COMPANY_NILE_ID },
      lifecycleStatus: 'ACTIVE',
      validationState: 'FAILED',
      publishedVersionNumber: 3,
      draftRevision: 9,
      updatedAt: '2026-11-04T13:10:00.000Z',
      publishedAt: '2026-10-15T10:00:00.000Z',
      bodyText: 'عرض سعر رسمي معتمد من نايل لتجهيزات المكاتب.',
    },
    {
      sortOrder: 3,
      templateId: TPL_IDS.pqSupplier,
      code: 'TPL-PQ-SUPPLIER',
      name: 'عرض سعر المورد',
      description: 'طلب عرض سعر للموردين.',
      documentType: 'PURCHASE_QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'FLOW_DOCUMENT',
      dataSourceKey: 'TRADE_PURCHASE_QUOTATION_PRINT_V1',
      schemaVersion: 2,
      locale: 'ar-EG',
      scope: { type: 'COMPANY', companyId: COMPANY_NILE_ID },
      lifecycleStatus: 'ACTIVE',
      validationState: 'PASSED',
      publishedVersionNumber: 2,
      draftRevision: 5,
      updatedAt: '2026-11-03T16:45:00.000Z',
      publishedAt: '2026-10-28T09:30:00.000Z',
      bodyText: 'طلب عرض سعر للتوريدات.',
    },
    {
      sortOrder: 4,
      templateId: TPL_IDS.soConfirm,
      code: 'TPL-SO-CONFIRM',
      name: 'Sales order confirmation',
      description: 'Standard sales order confirmation sheet.',
      documentType: 'SALES_ORDER',
      outputChannel: 'PRINT',
      layoutMode: 'FIXED_CANVAS',
      dataSourceKey: 'TRADE_SALES_ORDER_PRINT_V1',
      schemaVersion: 2,
      locale: 'en-US',
      scope: { type: 'TENANT' },
      lifecycleStatus: 'ACTIVE',
      validationState: 'NOT_VALIDATED',
      thumbnailState: 'PENDING',
      publishedVersionNumber: null,
      draftRevision: 2,
      updatedAt: '2026-11-04T11:20:00.000Z',
      bodyText: 'Confirmed sales order summary and delivery schedule.',
    },
    {
      sortOrder: 5,
      templateId: TPL_IDS.poStandard,
      code: 'TPL-PO-STANDARD',
      name: 'أمر شراء قياسي',
      description: 'نموذج أمر الشراء القياسي للموردين.',
      documentType: 'PURCHASE_ORDER',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      dataSourceKey: 'TRADE_PURCHASE_ORDER_PRINT_V1',
      schemaVersion: 2,
      locale: 'ar-EG',
      scope: { type: 'COMPANY', companyId: COMPANY_NILE_ID },
      lifecycleStatus: 'ACTIVE',
      validationState: 'PASSED',
      publishedVersionNumber: 4,
      draftRevision: 7,
      updatedAt: '2026-11-02T15:00:00.000Z',
      publishedAt: '2026-10-29T12:00:00.000Z',
      bodyText: 'التسليم إلى المقر الرئيسي بالقاهرة.',
    },
    {
      sortOrder: 6,
      templateId: TPL_IDS.invClean,
      code: 'TPL-INV-CLEAN',
      name: 'Clean invoice',
      description: 'Minimal tax invoice with itemized VAT breakdown.',
      documentType: 'INVOICE',
      outputChannel: 'PRINT',
      layoutMode: 'FIXED_CANVAS',
      dataSourceKey: 'TRADE_INVOICE_PRINT_V1',
      schemaVersion: 2,
      locale: 'en-US',
      scope: { type: 'TENANT' },
      lifecycleStatus: 'ACTIVE',
      validationState: 'STALE',
      publishedVersionNumber: 5,
      draftRevision: 14,
      updatedAt: '2026-11-04T09:40:00.000Z',
      publishedAt: '2026-10-25T14:00:00.000Z',
      bodyText: 'Trade tax invoice INV-2026-0214.',
    },
    {
      sortOrder: 7,
      templateId: TPL_IDS.conService,
      code: 'TPL-CON-SERVICE',
      name: 'Service agreement',
      description: 'Standard multi-milestone implementation and training contract.',
      documentType: 'CONTRACT',
      outputChannel: 'PRINT',
      layoutMode: 'FLOW_DOCUMENT',
      dataSourceKey: 'TRADE_CONTRACT_PRINT_V1',
      schemaVersion: 2,
      locale: 'en-US',
      scope: { type: 'TENANT' },
      lifecycleStatus: 'ACTIVE',
      validationState: 'PASSED',
      publishedVersionNumber: 2,
      draftRevision: 4,
      updatedAt: '2026-11-03T12:15:00.000Z',
      publishedAt: '2026-10-20T11:00:00.000Z',
      bodyText: 'Scope of services, delivery milestones and payment schedule.',
    },
    {
      sortOrder: 8,
      templateId: TPL_IDS.ltrOfficial,
      code: 'TPL-LTR-OFFICIAL',
      name: 'الخطاب الرسمي',
      description: 'خطاب رسمي على ورق الشركة المعتمد.',
      documentType: 'LETTER',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      dataSourceKey: 'CORE_BUSINESS_LETTER_PRINT_V1',
      schemaVersion: 1,
      locale: 'ar-EG',
      scope: { type: 'COMPANY', companyId: COMPANY_NILE_ID },
      lifecycleStatus: 'ACTIVE',
      validationState: 'FAILED',
      thumbnailState: 'UNAVAILABLE',
      publishedVersionNumber: null,
      draftRevision: 3,
      updatedAt: '2026-11-04T08:30:00.000Z',
      bodyText: 'نؤكد اتفاق توريد تجهيزات المكاتب المشار إليه بأمر البيع SO-2026-0096.',
    },
    {
      sortOrder: 9,
      templateId: TPL_IDS.emLeadWelcome,
      code: 'TPL-EM-LEAD-WELCOME',
      name: 'رسالة ترحيب بالعميل المحتمل',
      description: 'رسالة بريد إلكتروني للترحيب بالعميل المحتمل.',
      documentType: 'CRM_OUTBOUND_EMAIL',
      outputChannel: 'EMAIL',
      layoutMode: 'EMAIL_FLOW',
      dataSourceKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
      schemaVersion: 1,
      locale: 'ar-EG',
      scope: { type: 'TENANT' },
      lifecycleStatus: 'ACTIVE',
      validationState: 'PASSED',
      publishedVersionNumber: 2,
      draftRevision: 6,
      updatedAt: '2026-11-01T17:00:00.000Z',
      publishedAt: '2026-10-01T09:00:00.000Z',
      subject: 'استفسارك عن تجهيز مساحة العمل',
      preheader: 'متابعة سريعة من فريق متكامل.',
      bodyText: 'شكراً لاهتمامك بحلولنا لمساحات العمل. ستساعدك سارة في اختيار تجهيزات المكتب المناسبة لفريقك.',
    },
    {
      sortOrder: 10,
      templateId: TPL_IDS.qt2025,
      code: 'TPL-QT-2025',
      name: 'Quotation 2025',
      description: 'Previous fiscal year quotation format (archived).',
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      layoutMode: 'HYBRID_DOCUMENT',
      dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
      schemaVersion: 2,
      locale: 'en-US',
      scope: { type: 'COMPANY', companyId: COMPANY_NILE_ID },
      lifecycleStatus: 'ARCHIVED',
      validationState: 'PASSED',
      publishedVersionNumber: 7,
      draftRevision: 18,
      updatedAt: '2026-10-12T10:00:00.000Z',
      publishedAt: '2026-01-01T08:00:00.000Z',
      bodyText: 'Archived 2025 quotation template.',
    },
  ];

  // Add 14 more templates (items 11-24) so totalCount = 24 and page 1 (limit 10) has a real next cursor
  const extraFamilies: {
    code: string;
    name: string;
    documentType: TemplateDocumentType;
    outputChannel: TemplateOutputChannel;
    layoutMode: TemplateLayoutMode;
    dataSourceKey: TemplateDataSourceKey;
    schemaVersion: number;
    locale: TemplateLocale;
    validationState: 'NOT_VALIDATED' | 'PASSED' | 'FAILED' | 'STALE';
    published: number | null;
  }[] = [
    { code: 'TPL-QT-MODERN', name: 'Modern sales quotation', documentType: 'QUOTATION', outputChannel: 'PRINT', layoutMode: 'HYBRID_DOCUMENT', dataSourceKey: 'TRADE_QUOTATION_PRINT_V1', schemaVersion: 2, locale: 'en-US', validationState: 'PASSED', published: 3 },
    { code: 'TPL-QT-COMPACT', name: 'Compact quotation', documentType: 'QUOTATION', outputChannel: 'PRINT', layoutMode: 'FLOW_DOCUMENT', dataSourceKey: 'TRADE_QUOTATION_PRINT_V1', schemaVersion: 2, locale: 'en-US', validationState: 'PASSED', published: 1 },
    { code: 'TPL-QT-SHOWROOM', name: 'عرض سعر صالة العرض', documentType: 'QUOTATION', outputChannel: 'PRINT', layoutMode: 'FIXED_CANVAS', dataSourceKey: 'TRADE_QUOTATION_PRINT_V1', schemaVersion: 2, locale: 'ar-EG', validationState: 'STALE', published: 2 },
    { code: 'TPL-INV-DETAILED', name: 'فاتورة ضريبية تفصيلية', documentType: 'INVOICE', outputChannel: 'PRINT', layoutMode: 'HYBRID_DOCUMENT', dataSourceKey: 'TRADE_INVOICE_PRINT_V1', schemaVersion: 2, locale: 'ar-EG', validationState: 'PASSED', published: 4 },
    { code: 'TPL-INV-RECEIPT', name: 'A5 branch invoice', documentType: 'INVOICE', outputChannel: 'PRINT', layoutMode: 'FLOW_DOCUMENT', dataSourceKey: 'TRADE_INVOICE_PRINT_V1', schemaVersion: 2, locale: 'en-US', validationState: 'NOT_VALIDATED', published: null },
    { code: 'TPL-SO-DISPATCH', name: 'Sales order dispatch slip', documentType: 'SALES_ORDER', outputChannel: 'PRINT', layoutMode: 'HYBRID_DOCUMENT', dataSourceKey: 'TRADE_SALES_ORDER_PRINT_V1', schemaVersion: 2, locale: 'en-US', validationState: 'PASSED', published: 2 },
    { code: 'TPL-PO-IMPORT', name: 'Import purchase order', documentType: 'PURCHASE_ORDER', outputChannel: 'PRINT', layoutMode: 'FLOW_DOCUMENT', dataSourceKey: 'TRADE_PURCHASE_ORDER_PRINT_V1', schemaVersion: 2, locale: 'en-US', validationState: 'PASSED', published: 1 },
    { code: 'TPL-PQ-RFQ', name: 'Supplier RFQ request', documentType: 'PURCHASE_QUOTATION', outputChannel: 'PRINT', layoutMode: 'HYBRID_DOCUMENT', dataSourceKey: 'TRADE_PURCHASE_QUOTATION_PRINT_V1', schemaVersion: 2, locale: 'en-US', validationState: 'PASSED', published: 1 },
    { code: 'TPL-CON-ANNUAL', name: 'اتفاقية الدعم السنوي', documentType: 'CONTRACT', outputChannel: 'PRINT', layoutMode: 'FLOW_DOCUMENT', dataSourceKey: 'TRADE_CONTRACT_PRINT_V1', schemaVersion: 2, locale: 'ar-EG', validationState: 'STALE', published: 1 },
    { code: 'TPL-LTR-CONFIRM', name: 'Arrangement confirmation letter', documentType: 'LETTER', outputChannel: 'PRINT', layoutMode: 'FLOW_DOCUMENT', dataSourceKey: 'CORE_BUSINESS_LETTER_PRINT_V1', schemaVersion: 1, locale: 'en-US', validationState: 'PASSED', published: 1 },
    { code: 'TPL-EM-CUSTOMER', name: 'Customer account update', documentType: 'CRM_OUTBOUND_EMAIL', outputChannel: 'EMAIL', layoutMode: 'EMAIL_FLOW', dataSourceKey: 'CRM_CUSTOMER_OUTBOUND_EMAIL_V1', schemaVersion: 1, locale: 'en-US', validationState: 'PASSED', published: 3 },
    { code: 'TPL-EM-OPPORTUNITY', name: 'Opportunity follow-up', documentType: 'CRM_OUTBOUND_EMAIL', outputChannel: 'EMAIL', layoutMode: 'EMAIL_FLOW', dataSourceKey: 'CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1', schemaVersion: 1, locale: 'en-US', validationState: 'PASSED', published: 2 },
    { code: 'TPL-EM-LEAD-EN', name: 'Lead enquiry follow-up', documentType: 'CRM_OUTBOUND_EMAIL', outputChannel: 'EMAIL', layoutMode: 'EMAIL_FLOW', dataSourceKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1', schemaVersion: 1, locale: 'en-US', validationState: 'PASSED', published: 1 },
    { code: 'TPL-EM-CUST-AR', name: 'تحديث حساب العميل', documentType: 'CRM_OUTBOUND_EMAIL', outputChannel: 'EMAIL', layoutMode: 'EMAIL_FLOW', dataSourceKey: 'CRM_CUSTOMER_OUTBOUND_EMAIL_V1', schemaVersion: 1, locale: 'ar-EG', validationState: 'PASSED', published: 1 },
  ];

  extraFamilies.forEach((item, idx) => {
    const num = 11 + idx;
    const hexId = `01948100-0000-7000-8000-0000000010${num}`;
    seedRest.push({
      sortOrder: num,
      templateId: hexId,
      code: item.code,
      name: item.name,
      description: item.locale === 'ar-EG' ? `قالب ${item.name}.` : `${item.name} template.`,
      documentType: item.documentType,
      outputChannel: item.outputChannel,
      layoutMode: item.layoutMode,
      dataSourceKey: item.dataSourceKey,
      schemaVersion: item.schemaVersion,
      locale: item.locale,
      scope: { type: 'TENANT' },
      lifecycleStatus: 'ACTIVE',
      validationState: item.validationState,
      publishedVersionNumber: item.published,
      draftRevision: 3,
      updatedAt: `2026-10-${String(28 - idx).padStart(2, '0')}T10:00:00.000Z`,
      publishedAt: item.published ? `2026-10-${String(20 - (idx % 10)).padStart(2, '0')}T09:00:00.000Z` : undefined,
      subject: item.outputChannel === 'EMAIL' ? item.name : undefined,
      bodyText: item.locale === 'ar-EG' ? `محتوى ${item.name}.` : `${item.name} content.`,
    });
  });

  for (const cfg of seedRest) {
    const doc = createSimpleFlowDocument({
      documentType: cfg.documentType,
      outputChannel: cfg.outputChannel,
      layoutMode: cfg.layoutMode,
      dataSourceKey: cfg.dataSourceKey,
      locale: cfg.locale,
      title: cfg.name,
      bodyText: cfg.bodyText,
      subject: cfg.subject,
      preheader: cfg.preheader,
    });
    const draftId = `01948100-0000-7000-8000-0000000020${String(cfg.sortOrder).padStart(2, '0')}`;
    const draftSum = pseudoSha256(`draft:${cfg.templateId}:${cfg.draftRevision}`);
    let publishedRef: TemplateVersionRef | null = null;
    if (cfg.publishedVersionNumber !== null) {
      const verId = `01948100-0000-7000-8000-0000000022${String(cfg.sortOrder).padStart(2, '0')}`;
      const runId = `01948100-0000-7000-8000-0000000062${String(cfg.sortOrder).padStart(2, '0')}`;
      const vDetail = makeVersionDetail({
        templateId: cfg.templateId,
        versionId: verId,
        versionNumber: cfg.publishedVersionNumber,
        documentType: cfg.documentType,
        outputChannel: cfg.outputChannel,
        layoutMode: cfg.layoutMode,
        locale: cfg.locale,
        dataSourceKey: cfg.dataSourceKey,
        schemaVersion: cfg.schemaVersion,
        publishedAt: cfg.publishedAt ?? cfg.updatedAt,
        status: 'PUBLISHED',
        changeNote: 'Published release.',
        doc,
        validationRunId: runId,
      });
      versions.set(cfg.templateId, [vDetail]);
      publishedRef = toVersionRef(vDetail);
    } else {
      versions.set(cfg.templateId, []);
    }

    const runId =
      cfg.validationState === 'PASSED' || cfg.validationState === 'FAILED'
        ? `01948100-0000-7000-8000-0000000063${String(cfg.sortOrder).padStart(2, '0')}`
        : null;

    if (runId) {
      validationRuns.set(runId, {
        validationRunId: runId,
        templateId: cfg.templateId,
        draftId,
        draftRevision: cfg.draftRevision,
        candidateChecksum: draftSum,
        editorSchemaVersion: 1,
        dataSourceKey: cfg.dataSourceKey,
        dataSourceSchemaVersion: cfg.schemaVersion,
        dataSourceSchemaChecksum: pseudoSha256(`${cfg.dataSourceKey}:${cfg.schemaVersion}`),
        nodeRegistryVersion: 'mvp-v1',
        compilerVersion: '1.4.0',
        compilerFingerprint: 'compiler-mvp-v1-sha256',
        rendererTargets: cfg.outputChannel === 'PRINT' ? ['HTML', 'PDF'] : ['EMAIL_HTML', 'EMAIL_TEXT'],
        assetResolutionFingerprint: pseudoSha256(`assets:${cfg.templateId}`),
        fixtureChecksum: pseudoSha256('fixture:default'),
        issues:
          cfg.validationState === 'FAILED'
            ? [
                {
                  severity: 'ERROR',
                  code: 'TEMPLATE_BINDING_NOT_REGISTERED',
                  jsonPointer: toJsonPointer(['nodes', doc.rootNodeIds[0] ?? '0', 'binding', 'path']),
                  nodeId: doc.rootNodeIds[0] ?? null,
                  messageKey: 'template.validation.template_binding_not_registered',
                  params: {},
                },
              ]
            : [],
        startedAt: cfg.updatedAt,
        completedAt: cfg.updatedAt,
        status: cfg.validationState === 'FAILED' ? 'FAILED' : 'PASSED',
        compiledChecksum: cfg.validationState === 'PASSED' ? pseudoSha256(`compiled:${draftSum}`) : null,
      });
    }

    drafts.set(cfg.templateId, {
      draftId,
      templateId: cfg.templateId,
      editorDocument: doc,
      schemaVersion: 1,
      contentChecksum: draftSum,
      baseVersionId: publishedRef?.templateVersionId ?? null,
      restoreSourceVersionId: null,
      validation: {
        state: cfg.validationState,
        lastValidationRunId: runId,
        validatedDraftRevision: cfg.validationState === 'PASSED' || cfg.validationState === 'FAILED' ? cfg.draftRevision : null,
        errorCount: cfg.validationState === 'FAILED' ? 1 : 0,
        warningCount: 0,
      },
      revision: cfg.draftRevision,
      etag: `"${cfg.draftRevision}"`,
      updatedAt: cfg.updatedAt,
      updatedBy: AUTHOR_USER,
    });

    const resolvedDirection: TemplateResolvedDirection = cfg.locale === 'ar-EG' ? 'RTL' : 'LTR';
    definitions.push({
      sortOrder: cfg.sortOrder,
      templateId: cfg.templateId,
      thumbnail: makeThumb(cfg.templateId, 'DRAFT', cfg.draftRevision, cfg.thumbnailState ?? 'READY'),
      code: cfg.code,
      name: cfg.name,
      description: cfg.description,
      documentType: cfg.documentType,
      outputChannel: cfg.outputChannel,
      layoutMode: cfg.layoutMode,
      dataSourceKey: cfg.dataSourceKey,
      dataSourceSchemaVersion: cfg.schemaVersion,
      dataSourceSchemaChecksum: pseudoSha256(`${cfg.dataSourceKey}:${cfg.schemaVersion}`),
      locale: cfg.locale,
      direction: 'AUTO',
      resolvedDirection,
      scope: cfg.scope,
      lifecycleStatus: cfg.lifecycleStatus,
      systemProtected: false,
      revision: 4,
      etag: '"4"',
      currentDraft: {
        draftId,
        revision: cfg.draftRevision,
        contentChecksum: draftSum,
        validationState: cfg.validationState,
        etag: `"${cfg.draftRevision}"`,
      },
      currentPublishedVersion: publishedRef,
      createdAt: '2026-09-15T08:00:00.000Z',
      createdBy: AUTHOR_USER,
      updatedAt: cfg.updatedAt,
      updatedBy: AUTHOR_USER,
      archivedAt: cfg.lifecycleStatus === 'ARCHIVED' ? cfg.updatedAt : null,
    });
  }

  // 6 assets
  const assets: TemplateAssetDto[] = [
    {
      assetId: ASSET_IDS.logoMain,
      definitionId: null,
      assetType: 'LOGO',
      originalFileName: 'nile-office-logo.png',
      mimeType: 'image/png',
      sizeBytes: 28450,
      widthPx: 380,
      heightPx: 180,
      checksum: pseudoSha256('asset:nile-office-logo.png'),
      deliveryClass: 'PRIVATE_ONLY',
      emailRendition: { kind: 'NOT_REQUESTED' },
      status: 'ACTIVE',
      revision: 1,
      etag: `"asset:${ASSET_IDS.logoMain}:1"`,
      createdAt: '2026-09-10T08:15:00.000Z',
      createdBy: AUTHOR_USER,
      updatedAt: '2026-09-10T08:15:00.000Z',
      updatedBy: AUTHOR_USER,
    },
    {
      assetId: ASSET_IDS.logoEmail,
      definitionId: null,
      assetType: 'LOGO',
      originalFileName: 'mutakamel-email-header-logo.png',
      mimeType: 'image/png',
      sizeBytes: 24120,
      widthPx: 360,
      heightPx: 120,
      checksum: pseudoSha256('asset:mutakamel-email-header-logo.png'),
      deliveryClass: 'EMAIL_PUBLIC',
      emailRendition: { kind: 'READY', checksum: pseudoSha256('asset-pub:mutakamel-email-header-logo.png') },
      status: 'ACTIVE',
      revision: 1,
      etag: `"asset:${ASSET_IDS.logoEmail}:1"`,
      createdAt: '2026-09-12T10:00:00.000Z',
      createdBy: AUTHOR_USER,
      updatedAt: '2026-09-12T10:00:00.000Z',
      updatedBy: AUTHOR_USER,
    },
    {
      assetId: ASSET_IDS.letterheadBg,
      definitionId: TPL_IDS.ltrOfficial,
      assetType: 'BACKGROUND',
      originalFileName: 'nile-letterhead-a4.png',
      mimeType: 'image/png',
      sizeBytes: 142800,
      widthPx: 1240,
      heightPx: 1754,
      checksum: pseudoSha256('asset:nile-letterhead-a4.png'),
      deliveryClass: 'PRIVATE_ONLY',
      emailRendition: { kind: 'NOT_REQUESTED' },
      status: 'ACTIVE',
      revision: 2,
      etag: `"asset:${ASSET_IDS.letterheadBg}:2"`,
      createdAt: '2026-10-02T11:30:00.000Z',
      createdBy: AUTHOR_USER,
      updatedAt: '2026-10-18T09:15:00.000Z',
      updatedBy: AUTHOR_USER,
    },
    {
      assetId: ASSET_IDS.showroomBanner,
      definitionId: null,
      assetType: 'IMAGE',
      originalFileName: 'cairo-showroom-banner.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 94310,
      widthPx: 1200,
      heightPx: 400,
      checksum: pseudoSha256('asset:cairo-showroom-banner.jpg'),
      deliveryClass: 'EMAIL_PUBLIC',
      emailRendition: { kind: 'READY', checksum: pseudoSha256('asset-pub:cairo-showroom-banner.jpg') },
      status: 'ACTIVE',
      revision: 1,
      etag: `"asset:${ASSET_IDS.showroomBanner}:1"`,
      createdAt: '2026-10-10T14:20:00.000Z',
      createdBy: AUTHOR_USER,
      updatedAt: '2026-10-10T14:20:00.000Z',
      updatedBy: AUTHOR_USER,
    },
    {
      assetId: ASSET_IDS.companyStamp,
      definitionId: TPL_IDS.qtCorp,
      assetType: 'IMAGE',
      originalFileName: 'nile-office-stamp.png',
      mimeType: 'image/png',
      sizeBytes: 19600,
      widthPx: 240,
      heightPx: 240,
      checksum: pseudoSha256('asset:nile-office-stamp.png'),
      deliveryClass: 'PRIVATE_ONLY',
      emailRendition: { kind: 'NOT_REQUESTED' },
      status: 'ACTIVE',
      revision: 1,
      etag: `"asset:${ASSET_IDS.companyStamp}:1"`,
      createdAt: '2026-10-19T13:05:00.000Z',
      createdBy: AUTHOR_USER,
      updatedAt: '2026-10-19T13:05:00.000Z',
      updatedBy: AUTHOR_USER,
    },
    {
      assetId: ASSET_IDS.legacyLogo,
      definitionId: null,
      assetType: 'LOGO',
      originalFileName: 'legacy-2024-mark.png',
      mimeType: 'image/png',
      sizeBytes: 15200,
      widthPx: 320,
      heightPx: 140,
      checksum: pseudoSha256('asset:legacy-2024-mark.png'),
      deliveryClass: 'PRIVATE_ONLY',
      emailRendition: { kind: 'NOT_REQUESTED' },
      status: 'RETIRED',
      revision: 2,
      etag: `"asset:${ASSET_IDS.legacyLogo}:2"`,
      createdAt: '2025-11-01T09:00:00.000Z',
      createdBy: AUTHOR_USER,
      updatedAt: '2026-09-01T09:00:00.000Z',
      updatedBy: AUTHOR_USER,
    },
  ];

  // 4 assignments matching mockup 08-assignments
  const getVerId = (tplId: string) => definitions.find((d) => d.templateId === tplId)?.currentPublishedVersion?.templateVersionId ?? '';
  const assignments: TemplateAssignmentDto[] = [
    {
      assignmentId: '01948100-0000-7000-8000-000000009001',
      definitionId: TPL_IDS.qtCorp,
      versionId: corpV4Id,
      versionNumber: 4,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      adapterKey: 'TRADE_QUOTATION_PRINT_V1',
      locale: 'en-US',
      scope: { type: 'BRANCH', companyId: COMPANY_NILE_ID, branchId: BRANCH_CAIRO_ID },
      priority: 100,
      isDefault: true,
      effectiveFrom: '2026-11-01T00:00:00.000Z',
      effectiveTo: null,
      status: 'ACTIVE',
      revision: 1,
      etag: '"1"',
      createdAt: '2026-11-01T10:20:00.000Z',
      createdBy: AUTHOR_USER,
      updatedAt: '2026-11-01T10:20:00.000Z',
      updatedBy: AUTHOR_USER,
    },
    {
      assignmentId: '01948100-0000-7000-8000-000000009002',
      definitionId: TPL_IDS.qtClassic,
      versionId: getVerId(TPL_IDS.qtClassic),
      versionNumber: 3,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      adapterKey: 'TRADE_QUOTATION_PRINT_V1',
      locale: 'ar-EG',
      scope: { type: 'COMPANY', companyId: COMPANY_NILE_ID },
      priority: 100,
      isDefault: true,
      effectiveFrom: '2026-10-15T00:00:00.000Z',
      effectiveTo: null,
      status: 'ACTIVE',
      revision: 1,
      etag: '"1"',
      createdAt: '2026-10-15T10:15:00.000Z',
      createdBy: AUTHOR_USER,
      updatedAt: '2026-10-15T10:15:00.000Z',
      updatedBy: AUTHOR_USER,
    },
    {
      assignmentId: '01948100-0000-7000-8000-000000009003',
      definitionId: TPL_IDS.emLeadWelcome,
      versionId: getVerId(TPL_IDS.emLeadWelcome),
      versionNumber: 2,
      documentType: 'CRM_OUTBOUND_EMAIL',
      outputChannel: 'EMAIL',
      adapterKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
      locale: null,
      scope: { type: 'TENANT' },
      priority: 0,
      isDefault: true,
      effectiveFrom: '2026-10-01T00:00:00.000Z',
      effectiveTo: null,
      status: 'ACTIVE',
      revision: 1,
      etag: '"1"',
      createdAt: '2026-10-01T09:10:00.000Z',
      createdBy: AUTHOR_USER,
      updatedAt: '2026-10-01T09:10:00.000Z',
      updatedBy: AUTHOR_USER,
    },
    {
      assignmentId: '01948100-0000-7000-8000-000000009004',
      definitionId: TPL_IDS.qt2025,
      versionId: getVerId(TPL_IDS.qt2025),
      versionNumber: 7,
      documentType: 'QUOTATION',
      outputChannel: 'PRINT',
      adapterKey: 'TRADE_QUOTATION_PRINT_V1',
      locale: 'en-US',
      scope: { type: 'BRANCH', companyId: COMPANY_NILE_ID, branchId: BRANCH_CAIRO_ID },
      priority: 100,
      isDefault: true,
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: '2026-10-31T23:59:59.000Z',
      status: 'INACTIVE',
      revision: 2,
      etag: '"2"',
      createdAt: '2026-01-01T08:05:00.000Z',
      createdBy: AUTHOR_USER,
      updatedAt: '2026-11-01T00:01:00.000Z',
      updatedBy: AUTHOR_USER,
    },
  ];

  // One COMPLETED PDF job for Corporate quotation
  const pdfJobs = new Map<string, TemplatePdfJobDto>();
  pdfJobs.set(CORP_PDF_JOB_ID, {
    templateId: TPL_IDS.qtCorp,
    source: { kind: 'DRAFT', draftId: corpDraftId, draftRevision: 24 },
    templateContentChecksum: corpContentSum,
    compiledArtifactChecksum: pseudoSha256(`compiled:${corpContentSum}`),
    renderJobId: CORP_PDF_JOB_ID,
    renderTarget: 'PDF',
    attemptCount: 1,
    createdAt: '2026-11-04T14:30:55.000Z',
    expiresAt: '2026-11-04T15:31:00.000Z',
    lifecycleRevision: 3,
    status: 'COMPLETED',
    nextRetryAt: null,
    failure: null,
    outputProfile: 'DOCUMENT_PRINT',
    artifact: {
      downloadUrl: `/api/tenant/core/v1/templates/preview-jobs/${CORP_PDF_JOB_ID}/artifact`,
      downloadUrlExpiresAt: '2026-11-04T15:31:00.000Z',
      checksum: pseudoSha256(`pdf-artifact:${CORP_PDF_JOB_ID}`),
      sizeBytes: 84210,
      pageCount: 1,
      rendererVersion: 'chromium-130.0',
      browserBuildFingerprint: 'headless-pdf-mvp-v1',
      createdAt: '2026-11-04T14:31:00.000Z',
      layoutReceiptChecksum: pseudoSha256(`receipt:${CORP_PDF_JOB_ID}`),
      layoutProof: {
        checksum: pseudoSha256(`proof:${CORP_PDF_JOB_ID}`),
        pageCount: 1,
        downloadPath: `/api/tenant/core/v1/templates/preview-jobs/${CORP_PDF_JOB_ID}/layout-receipt`,
      },
      pdfPackagingPolicyVersion: '1.0',
      pdfPackagingFingerprint: 'pdf-pack-v1',
    },
  });

  return {
    definitions,
    drafts,
    versions,
    validationRuns,
    recoverySnapshots,
    assets,
    assignments,
    pdfJobs,
    idempotency: new Map(),
  };
}

const STORE = createSeedStore();

function normalizeCompanyIdAlias(companyId: string): string {
  if (companyId === LEGACY_COMPANY_NILE_UUID) return COMPANY_NILE_ID;
  if (companyId === LEGACY_COMPANY_MTG_UUID) return COMPANY_MTG_ID;
  return companyId;
}

function normalizeBranchIdAlias(branchId: string): string {
  if (branchId === LEGACY_BRANCH_CAIRO_UUID) return BRANCH_CAIRO_ID;
  if (branchId === LEGACY_BRANCH_ALEX_UUID) return BRANCH_ALEX_ID;
  return branchId;
}

function normalizeScopeAlias(target: TemplateScopeRef): TemplateScopeRef {
  if (target.type === 'BRANCH') {
    return {
      type: 'BRANCH',
      companyId: normalizeCompanyIdAlias(target.companyId),
      branchId: normalizeBranchIdAlias(target.branchId),
    };
  }
  if (target.type === 'COMPANY') {
    return {
      type: 'COMPANY',
      companyId: normalizeCompanyIdAlias(target.companyId),
    };
  }
  return target;
}

function buildRequestedTarget(q: {
  assignmentScopeType: 'TENANT' | 'COMPANY' | 'BRANCH';
  assignmentCompanyId?: string;
  assignmentBranchId?: string;
}): TemplateScopeRef {
  if (q.assignmentScopeType === 'BRANCH') {
    return {
      type: 'BRANCH',
      companyId: q.assignmentCompanyId ?? COMPANY_NILE_ID,
      branchId: q.assignmentBranchId ?? BRANCH_CAIRO_ID,
    };
  }
  if (q.assignmentScopeType === 'COMPANY') {
    return { type: 'COMPANY', companyId: q.assignmentCompanyId ?? COMPANY_NILE_ID };
  }
  return { type: 'TENANT' };
}

function scopeMatchesTarget(assignmentScope: TemplateScopeRef, requestedTarget: TemplateScopeRef): boolean {
  const normAssign = normalizeScopeAlias(assignmentScope);
  const normReq = normalizeScopeAlias(requestedTarget);
  if (normReq.type === 'TENANT') {
    return normAssign.type === 'TENANT';
  }
  if (normReq.type === 'COMPANY') {
    return (
      normAssign.type === 'TENANT' ||
      (normAssign.type === 'COMPANY' && normAssign.companyId === normReq.companyId)
    );
  }
  return (
    normAssign.type === 'TENANT' ||
    (normAssign.type === 'COMPANY' && normAssign.companyId === normReq.companyId) ||
    (normAssign.type === 'BRANCH' &&
      normAssign.companyId === normReq.companyId &&
      normAssign.branchId === normReq.branchId)
  );
}

function summarizeAssignmentForDefinition(
  def: StoredTemplateDefinition,
  requestedTarget: TemplateScopeRef,
): TemplateRowAssignmentSummary {
  const evaluatedAt = '2026-11-04T14:30:00.000Z';
  const activeMatching = STORE.assignments
    .filter((a) => a.definitionId === def.templateId && a.status === 'ACTIVE' && scopeMatchesTarget(a.scope, requestedTarget))
    .sort((a, b) => b.priority - a.priority);

  // Additional branch-used badges for rows 3, 5, 6, 7 shown in mockup 01-library-table when inspecting Cairo HQ
  const normReq = normalizeScopeAlias(requestedTarget);
  const mockupBranchRowIds = new Set<string>([
    TPL_IDS.pqSupplier,
    TPL_IDS.poStandard,
    TPL_IDS.invClean,
    TPL_IDS.conService,
  ]);
  if (
    activeMatching.length === 0 &&
    normReq.type === 'BRANCH' &&
    normReq.branchId === BRANCH_CAIRO_ID &&
    mockupBranchRowIds.has(def.templateId) &&
    def.currentPublishedVersion !== null
  ) {
    const syntheticCandidate = {
      assignmentId: `01948100-0000-7000-8000-0000000099${String(def.sortOrder).padStart(2, '0')}`,
      versionId: def.currentPublishedVersion.templateVersionId,
      versionNumber: def.currentPublishedVersion.versionNumber,
      scope: { type: 'BRANCH' as const, companyId: COMPANY_NILE_ID, branchId: BRANCH_CAIRO_ID },
      locale: def.locale,
      localeMatch: 'EXACT' as const,
      priority: 100,
      effectiveFrom: '2026-10-01T00:00:00.000Z',
      effectiveTo: null,
    };
    return {
      requestedTarget: clone(requestedTarget),
      evaluatedAt,
      state: 'SINGLE',
      effectiveCandidateCount: 1,
      primary: syntheticCandidate,
      candidates: [syntheticCandidate],
      additionalCount: 0,
    };
  }

  const candidates = activeMatching.map((a) => ({
    assignmentId: a.assignmentId,
    versionId: a.versionId,
    versionNumber: a.versionNumber,
    scope: clone(a.scope),
    locale: a.locale,
    localeMatch: (a.locale === null ? 'DEFAULT' : 'EXACT') as 'EXACT' | 'DEFAULT',
    priority: a.priority,
    effectiveFrom: a.effectiveFrom,
    effectiveTo: a.effectiveTo,
  }));

  return {
    requestedTarget: clone(requestedTarget),
    evaluatedAt,
    state: candidates.length === 0 ? 'NONE' : candidates.length === 1 ? 'SINGLE' : 'MULTIPLE',
    effectiveCandidateCount: candidates.length,
    primary: candidates[0] ?? null,
    candidates,
    additionalCount: Math.max(0, candidates.length - 1),
  };
}

function toListRow(def: StoredTemplateDefinition, requestedTarget: TemplateScopeRef): TemplateListRow {
  const draft = STORE.drafts.get(def.templateId);
  const actions = draft
    ? computeListActions(def, draft)
    : computeListActions(def, {
        draftId: def.currentDraft.draftId,
        templateId: def.templateId,
        editorDocument: createCorporateQuotationDocument(),
        schemaVersion: 1,
        contentChecksum: def.currentDraft.contentChecksum,
        baseVersionId: null,
        restoreSourceVersionId: null,
        validation: {
          state: def.currentDraft.validationState,
          lastValidationRunId: null,
          validatedDraftRevision: null,
          errorCount: 0,
          warningCount: 0,
        },
        revision: def.currentDraft.revision,
        etag: def.currentDraft.etag,
        updatedAt: def.updatedAt,
        updatedBy: AUTHOR_USER,
      });

  return {
    templateId: def.templateId,
    thumbnail: clone(def.thumbnail),
    name: def.name,
    code: def.code,
    documentType: def.documentType,
    outputChannel: def.outputChannel,
    layoutMode: def.layoutMode,
    lifecycleStatus: def.lifecycleStatus,
    draft: {
      draftId: def.currentDraft.draftId,
      revision: def.currentDraft.revision,
      validationState: def.currentDraft.validationState,
    },
    currentPublishedVersion: def.currentPublishedVersion
      ? {
          versionId: def.currentPublishedVersion.templateVersionId,
          versionNumber: def.currentPublishedVersion.versionNumber,
          status: def.currentPublishedVersion.lifecycleStatus,
          publishedAt: def.currentPublishedVersion.publishedAt,
        }
      : null,
    locale: def.locale,
    direction: def.direction,
    resolvedDirection: def.resolvedDirection,
    definitionScope: clone(def.scope),
    assignment: summarizeAssignmentForDefinition(def, requestedTarget),
    updatedAt: def.updatedAt,
    createdAt: def.createdAt,
    author: clone(def.createdBy),
    definitionRevision: def.revision,
    definitionEtag: def.etag,
    actions,
  };
}

function toDetail(def: StoredTemplateDefinition): TemplateDefinitionDetail {
  const draft = STORE.drafts.get(def.templateId);
  const hasAssigned = STORE.assignments.some((a) => a.definitionId === def.templateId);
  const hasPublishedOrAssigned = def.currentPublishedVersion !== null || hasAssigned;
  const capabilities = draft
    ? computeDetailCapabilities(def, draft, hasPublishedOrAssigned)
    : computeDetailCapabilities(
        def,
        {
          draftId: def.currentDraft.draftId,
          templateId: def.templateId,
          editorDocument: createCorporateQuotationDocument(),
          schemaVersion: 1,
          contentChecksum: def.currentDraft.contentChecksum,
          baseVersionId: null,
          restoreSourceVersionId: null,
          validation: {
            state: def.currentDraft.validationState,
            lastValidationRunId: null,
            validatedDraftRevision: null,
            errorCount: 0,
            warningCount: 0,
          },
          revision: def.currentDraft.revision,
          etag: def.currentDraft.etag,
          updatedAt: def.updatedAt,
          updatedBy: AUTHOR_USER,
        },
        hasPublishedOrAssigned,
      );

  return {
    templateId: def.templateId,
    thumbnail: clone(def.thumbnail),
    code: def.code,
    name: def.name,
    description: def.description,
    documentType: def.documentType,
    outputChannel: def.outputChannel,
    layoutMode: def.layoutMode,
    dataSourceKey: def.dataSourceKey,
    dataSourceSchemaVersion: def.dataSourceSchemaVersion,
    dataSourceSchemaChecksum: def.dataSourceSchemaChecksum,
    locale: def.locale,
    direction: def.direction,
    resolvedDirection: def.resolvedDirection,
    scope: clone(def.scope),
    lifecycleStatus: def.lifecycleStatus,
    systemProtected: def.systemProtected,
    revision: def.revision,
    etag: def.etag,
    currentDraft: clone(def.currentDraft),
    currentPublishedVersion: def.currentPublishedVersion ? clone(def.currentPublishedVersion) : null,
    createdAt: def.createdAt,
    createdBy: clone(def.createdBy),
    updatedAt: def.updatedAt,
    updatedBy: clone(def.updatedBy),
    archivedAt: def.archivedAt,
    capabilities,
  };
}

/** Mirrors backend parseRevisionEtag: missing → 428, anything but a quoted positive integer → 409. */
function parseIfMatchRevision(ifMatch: string | null | undefined, namespace?: string): number {
  const value = (ifMatch ?? '').trim();
  if (!value) {
    throw new TemplateApiError(428, 'CORE.TEMPLATE.CONCURRENCY.PRECONDITION_REQUIRED');
  }
  const pattern = namespace
    ? new RegExp(`^"${namespace}:([1-9][0-9]*)"$`) // namespace is `draft-schema:<hex>`, no regex metacharacters
    : /^"([1-9][0-9]*)"$/;
  const match = pattern.exec(value);
  const revision = Number(match?.[1]);
  if (!match || !Number.isSafeInteger(revision)) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  return revision;
}

/**
 * Mirrors backend parseDraftSavePrecondition + saveDraft: PATCH draft accepts the plain
 * `"N"` tag or the strong `"draft-schema:<descriptor sha256>:N"` tag. The strong tag is
 * only allowed for TRADE_QUOTATION_PRINT_V1 (else stale) and its checksum must equal the
 * retained draft schema checksum (else CONCURRENCY.SCHEMA_CHANGED).
 */
function parseFakeDraftSavePrecondition(
  ifMatch: string | null | undefined,
  def: StoredTemplateDefinition,
): number {
  const descriptorChecksum = /^"draft-schema:([0-9a-f]{64}):/.exec((ifMatch ?? '').trim())?.[1];
  const revision = parseIfMatchRevision(ifMatch, descriptorChecksum ? `draft-schema:${descriptorChecksum}` : undefined);
  if (descriptorChecksum !== undefined) {
    if (def.dataSourceKey !== 'TRADE_QUOTATION_PRINT_V1') {
      throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
    }
    const retained = pseudoSha256(`${def.dataSourceKey}:${def.dataSourceSchemaVersion === 2 ? 2 : 1}`);
    if (descriptorChecksum !== retained) {
      throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.SCHEMA_CHANGED');
    }
  }
  return revision;
}

function findDefinitionOrThrow(templateId: string): StoredTemplateDefinition {
  const def = STORE.definitions.find((item) => item.templateId === templateId);
  if (!def) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  return def;
}

function compareTemplates(
  a: StoredTemplateDefinition,
  b: StoredTemplateDefinition,
  sortBy: TemplateListSortBy | undefined,
  sortDirection: TemplateSortDirection,
): number {
  if (!sortBy) {
    return a.sortOrder - b.sortOrder;
  }
  const factor = sortDirection === 'asc' ? 1 : -1;
  switch (sortBy) {
    case 'code':
      return a.code.localeCompare(b.code) * factor;
    case 'name':
      return a.name.localeCompare(b.name) * factor;
    case 'createdAt':
      return a.createdAt.localeCompare(b.createdAt) * factor;
    case 'publishedVersionNumber': {
      const av = a.currentPublishedVersion?.versionNumber ?? -1;
      const bv = b.currentPublishedVersion?.versionNumber ?? -1;
      return (av - bv) * factor;
    }
    case 'updatedAt':
    default:
      return a.updatedAt.localeCompare(b.updatedAt) * factor || a.sortOrder - b.sortOrder;
  }
}

function paginateByCursor<T>(
  items: readonly T[],
  getId: (item: T) => string,
  cursor?: string | null,
  rawLimit = 25,
): TemplateCursorPage<T> {
  const limit = Math.max(1, Math.min(100, Math.floor(rawLimit)));
  let start = 0;
  if (cursor) {
    const idx = items.findIndex((item) => getId(item) === cursor);
    if (idx < 0) {
      throw new TemplateApiError(400, 'CORE.TEMPLATE.CURSOR.INVALID');
    }
    start = idx + 1;
  }
  const slice = items.slice(start, start + limit);
  const hasNextPage = start + limit < items.length;
  const nextCursor = hasNextPage && slice.length > 0 ? getId(slice[slice.length - 1]) : null;
  return {
    items: slice.map(clone),
    pageInfo: {
      limit,
      hasNextPage,
      nextCursor,
    },
  };
}

/** §1 Library list and search. */
export async function fakeListTemplates(query: TemplateListRequestDto): Promise<TemplateListResponse> {
  await fakeDelay();
  const target = buildRequestedTarget(query);
  const nameFilter = query.name?.trim().toLowerCase() ?? '';
  const codeFilter = query.code?.trim().toUpperCase() ?? '';

  const filtered = STORE.definitions.filter((def) => {
    if (nameFilter && !def.name.toLowerCase().includes(nameFilter)) return false;
    if (codeFilter && def.code !== codeFilter) return false;
    if (query.documentType && def.documentType !== query.documentType) return false;
    if (query.outputChannel && def.outputChannel !== query.outputChannel) return false;
    if (query.layoutMode && def.layoutMode !== query.layoutMode) return false;
    if (query.lifecycleStatus && def.lifecycleStatus !== query.lifecycleStatus) return false;
    if (query.locale && def.locale !== query.locale) return false;
    if (query.definitionScopeType && def.scope.type !== query.definitionScopeType) return false;
    if (
      query.definitionScopeType === 'COMPANY' &&
      query.definitionCompanyId &&
      def.scope.type === 'COMPANY'
    ) {
      const normalizedFilter = normalizeScopeAlias({ type: 'COMPANY', companyId: query.definitionCompanyId });
      if (normalizedFilter.type === 'COMPANY' && def.scope.companyId !== normalizedFilter.companyId) {
        return false;
      }
    }
    if (query.hasPublishedVersion !== undefined) {
      const hasPub = def.currentPublishedVersion !== null;
      if (hasPub !== query.hasPublishedVersion) return false;
    }
    if (query.updatedFrom && def.updatedAt < query.updatedFrom) return false;
    if (query.updatedTo && def.updatedAt > query.updatedTo) return false;
    return true;
  });

  const sortBy = query.sortBy ?? 'updatedAt';
  const sortDirection = query.sortDirection ?? (sortBy === 'updatedAt' ? 'desc' : 'asc');
  const sorted = filtered.slice().sort((a, b) => compareTemplates(a, b, query.sortBy, sortDirection));

  // Default page size 10 matches mockup 01-library-table while honoring explicit limit up to 100.
  const limit = query.limit ?? 10;
  const page = paginateByCursor(sorted, (d) => d.templateId, query.cursor, limit);

  return {
    items: page.items.map((def) => toListRow(def, target)),
    totalCount: sorted.length,
    pageInfo: page.pageInfo,
    sort: { by: sortBy, direction: sortDirection },
    assignmentTarget: clone(target),
    assignmentEvaluatedAt: '2026-11-04T14:30:00.000Z',
  };
}

export async function fakeGetCreationScopes(): Promise<TemplateCreationScopesResponse> {
  await fakeDelay(100);
  const scopes: TemplateCreationScope[] = [
    { type: 'TENANT' },
    ...FAKE_COMPANIES.map((company) => ({
      type: 'COMPANY' as const,
      companyId: company.id,
      label: company.nameEn,
    })),
  ];
  return { scopes };
}

/** §2 Data sources, schemas, starters, create & duplicate. */
export async function fakeListDataSources(query: TemplateDataSourcesQuery): Promise<TemplateDataSourcesResponse> {
  await fakeDelay(100);
  const items = DATA_SOURCE_ADAPTERS.filter((item) => {
    if (query.documentType && item.documentType !== query.documentType) return false;
    if (query.outputChannel && !item.allowedOutputChannels.includes(query.outputChannel)) return false;
    if (query.layoutMode && !item.allowedLayoutModes.includes(query.layoutMode)) return false;
    return true;
  }).map((item) => withProductionAssignment(clone(item)));

  return {
    registryVersion: 'template-platform.mvp.v1',
    registryChecksum: pseudoSha256('data-source-registry:mvp-v1'),
    items,
  };
}

const OWNER_PROVIDER_PACKAGE: Record<string, TemplateProducerPackageName> = {
  TRADE: '@mutakamel/trade-app-contracts',
  CRM: '@mutakamel/crm-app-contracts',
  CORE: '@mutakamel/core-app-contracts',
};

/** Mirrors backend templateDataSourceOwnerContext: { admission, ownerContext } for an owned adapter. */
function fakeOwnerContextEnvelope(
  adapterKey: TemplateDataSourceKey,
  schemaVersion: number,
): { admission: TemplateDataSourceAdmission; ownerContext: TemplateOwnerContext } {
  const pin = (name: TemplateProducerPackageName, version: string): TemplateProducerPackagePin => ({
    name,
    version,
    manifestSha256: pseudoSha256(`manifest:${name}:${version}`),
    entrypointSha256: pseudoSha256(`entry:${name}:${version}`),
  });
  const pins: TemplateOwnerContextPins = {
    schema: pin('@mutakamel/template-schema', '1.0.0'),
    engine: pin('@mutakamel/template-engine', '1.4.0'),
    provider: pin(OWNER_PROVIDER_PACKAGE[adapterKey.split('_')[0]] ?? '@mutakamel/core-app-contracts', '1.0.0'),
  };
  const descriptorChecksum = pseudoSha256(`${adapterKey}:${schemaVersion}`);
  const descriptor: TemplateOwnerDescriptor = { key: adapterKey, version: schemaVersion, checksum: descriptorChecksum };
  return {
    admission: {
      contract: 'template-data-source-admission.v1',
      descriptorChecksum,
      pins: clone(pins),
      fingerprint: pseudoSha256(`admission:${adapterKey}:${schemaVersion}`),
      descriptor: clone(descriptor),
    },
    ownerContext: {
      contract: 'template-owner-context.v1',
      descriptorChecksum,
      descriptorCanonicalSha256: pseudoSha256(`descriptor-canonical:${adapterKey}:${schemaVersion}`),
      pins: clone(pins),
      fingerprint: pseudoSha256(`owner-ctx:${adapterKey}:${schemaVersion}`),
      descriptor: clone(descriptor),
    },
  };
}

export async function fakeGetDataSourceSchema(
  adapterKey: TemplateDataSourceKey,
  query: TemplateDataSourceSchemaQuery,
): Promise<TemplateDataSourceSchemaDto> {
  await fakeDelay(120);
  const adapter = DATA_SOURCE_ADAPTERS.find((item) => item.adapterKey === adapterKey);
  if (!adapter) {
    throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  }
  const isTrade = adapterKey.startsWith('TRADE_');
  if (!isTrade && query.schemaVersion !== 1) {
    throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  }

  const fields =
    adapterKey === 'TRADE_QUOTATION_PRINT_V1'
      ? QUOTATION_SCHEMA_FIELDS.map(clone)
      : QUOTATION_SCHEMA_FIELDS.slice(0, 14).map(clone);

  const syntheticFixtures: TemplateSyntheticFixture[] =
    adapterKey === 'TRADE_QUOTATION_PRINT_V1'
      ? QUOTATION_SYNTHETIC_FIXTURES.map(clone)
      : [
          {
            fixtureKey: `${adapterKey.toLowerCase()}-en`,
            locale: 'en-US',
            labelKey: 'templates.fixtures.salesStandardEn',
            fixtureChecksum: pseudoSha256(`fixture:${adapterKey}:en`),
          },
          {
            fixtureKey: `${adapterKey.toLowerCase()}-ar`,
            locale: 'ar-EG',
            labelKey: 'templates.fixtures.salesStandardAr',
            fixtureChecksum: pseudoSha256(`fixture:${adapterKey}:ar`),
          },
        ];

  const production = withProductionAssignment({ adapterKey: adapter.adapterKey });
  return {
    adapterKey: adapter.adapterKey,
    productionAssignmentEnabled: production.productionAssignmentEnabled,
    productionDisabledReason: production.productionDisabledReason,
    schemaVersion: query.schemaVersion,
    schemaChecksum: pseudoSha256(`${adapter.adapterKey}:${query.schemaVersion}`),
    documentType: adapter.documentType,
    allowedOutputChannels: [...adapter.allowedOutputChannels],
    allowedLayoutModes: [...adapter.allowedLayoutModes],
    supportedLocales: [...adapter.supportedLocales],
    fieldCount: adapter.fieldCount,
    ...fakeOwnerContextEnvelope(adapter.adapterKey, query.schemaVersion),
    capabilities:
      adapterKey === 'TRADE_QUOTATION_PRINT_V1' && query.scopeType !== 'BRANCH'
        ? {
            draftSavePrecondition: {
              kind: 'draft-schema',
              scope:
                query.scopeType === 'COMPANY' && query.companyId
                  ? { type: 'COMPANY', companyId: query.companyId }
                  : { type: 'TENANT' },
            },
          }
        : undefined,
    fields,
    syntheticFixtures,
  };
}

export async function fakeListStarters(query: TemplateStartersQuery): Promise<TemplateStartersResponse> {
  await fakeDelay(120);
  const items = STARTER_REGISTRY.filter(
    (s) =>
      s.documentType === query.documentType &&
      s.outputChannel === query.outputChannel &&
      s.layoutMode === query.layoutMode &&
      s.dataSourceKey === query.dataSourceKey &&
      s.dataSourceSchemaVersion === query.dataSourceSchemaVersion &&
      s.locale === query.locale,
  ).map(clone);

  return {
    items,
    count: items.length,
    registryVersion: 'template-platform.mvp.v1',
    registryFingerprint: pseudoSha256('starters:mvp.v1'),
  };
}

export async function fakeCreateTemplate(
  body: CreateTemplateDto,
  idempotencyKey: string,
): Promise<CreateTemplateResponse> {
  await fakeDelay();
  const idemKey = `create:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as CreateTemplateResponse);
  }

  const normalizedCode = body.code.trim().toUpperCase();
  if (STORE.definitions.some((d) => d.lifecycleStatus === 'ACTIVE' && d.code === normalizedCode)) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CODE.CONFLICT');
  }
  if (body.outputChannel === 'EMAIL' && body.page) {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.LAYOUT.INCOMPATIBLE');
  }
  if (body.outputChannel === 'PRINT' && !body.page) {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.PAGE.MISSING');
  }

  const now = new Date().toISOString();
  const templateId = uuidv7();
  const draftId = uuidv7();
  const editorDocument = createSimpleFlowDocument({
    documentType: body.documentType,
    outputChannel: body.outputChannel,
    layoutMode: body.layoutMode,
    dataSourceKey: body.dataSourceKey,
    locale: body.locale,
    title: body.name,
    bodyText: '',
    subject: body.outputChannel === 'EMAIL' ? body.name : undefined,
  });
  if (body.page) {
    editorDocument.page = {
      unit: 'MM',
      preset: body.page.preset,
      widthMm: body.page.widthMm ?? 210,
      heightMm: body.page.heightMm ?? 297,
      orientation: body.page.orientation,
      marginMm: { ...body.page.marginMm },
      bleedMm: 0,
    };
  }
  if (body.starterKey) {
    editorDocument.metadata = { starterKey: body.starterKey };
  }

  const contentChecksum = pseudoSha256(`draft:${templateId}:1`);
  const draft: TemplateDraftDto = {
    draftId,
    templateId,
    editorDocument,
    schemaVersion: 1,
    contentChecksum,
    baseVersionId: null,
    restoreSourceVersionId: null,
    validation: {
      state: 'NOT_VALIDATED',
      lastValidationRunId: null,
      validatedDraftRevision: null,
      errorCount: 0,
      warningCount: 0,
    },
    revision: 1,
    etag: '"1"',
    updatedAt: now,
    updatedBy: AUTHOR_USER,
  };

  const resolvedDirection: TemplateResolvedDirection =
    body.direction === 'AUTO' ? (body.locale === 'ar-EG' ? 'RTL' : 'LTR') : body.direction;

  const def: StoredTemplateDefinition = {
    sortOrder: 0,
    templateId,
    thumbnail: { state: 'PENDING', sourceChecksum: contentChecksum },
    code: normalizedCode,
    name: body.name.trim(),
    description: body.description?.trim() || null,
    documentType: body.documentType,
    outputChannel: body.outputChannel,
    layoutMode: body.layoutMode,
    dataSourceKey: body.dataSourceKey,
    dataSourceSchemaVersion: body.dataSourceKey === 'CORE_BUSINESS_LETTER_PRINT_V1' || body.outputChannel === 'EMAIL' ? 1 : 2,
    dataSourceSchemaChecksum: pseudoSha256(`${body.dataSourceKey}:1`),
    locale: body.locale,
    direction: body.direction,
    resolvedDirection,
    scope: clone(body.scope),
    lifecycleStatus: 'ACTIVE',
    systemProtected: false,
    revision: 1,
    etag: '"1"',
    currentDraft: {
      draftId,
      revision: 1,
      contentChecksum,
      validationState: 'NOT_VALIDATED',
      etag: '"1"',
    },
    currentPublishedVersion: null,
    createdAt: now,
    createdBy: AUTHOR_USER,
    updatedAt: now,
    updatedBy: AUTHOR_USER,
    archivedAt: null,
  };

  STORE.definitions.unshift(def);
  STORE.drafts.set(templateId, draft);
  STORE.versions.set(templateId, []);
  STORE.recoverySnapshots.set(templateId, []);

  const response: CreateTemplateResponse = {
    definition: toDetail(def),
    draft: clone(draft),
  };
  STORE.idempotency.set(idemKey, clone(response));
  return response;
}

export async function fakeDuplicateTemplate(
  templateId: string,
  body: DuplicateTemplateDto,
  idempotencyKey: string,
): Promise<CreateTemplateResponse> {
  await fakeDelay();
  const idemKey = `duplicate:${templateId}:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as CreateTemplateResponse);
  }

  const sourceDef = findDefinitionOrThrow(templateId);
  const normalizedCode = body.code.trim().toUpperCase();
  if (STORE.definitions.some((d) => d.lifecycleStatus === 'ACTIVE' && d.code === normalizedCode)) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CODE.CONFLICT');
  }

  let sourceDoc: TemplateDocumentV1;
  if (body.source.kind === 'CURRENT_DRAFT') {
    const draft = STORE.drafts.get(templateId);
    if (!draft) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
    if (draft.revision !== body.source.expectedDraftRevision) {
      throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
    }
    sourceDoc = clone(draft.editorDocument);
  } else {
    const versionList = STORE.versions.get(templateId) ?? [];
    const targetVersionId = body.source.versionId;
    const ver = versionList.find((v) => v.templateVersionId === targetVersionId);
    if (!ver) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
    sourceDoc = clone(ver.editorDocument);
  }

  if (body.conversion) {
    if (sourceDef.outputChannel !== 'PRINT') {
      throw new TemplateApiError(422, 'CORE.TEMPLATE.LAYOUT.INCOMPATIBLE');
    }
    sourceDoc.layoutMode = body.conversion.layoutMode;
  }

  const nextLocale = body.locale ?? sourceDef.locale;
  const nextDirection = body.direction ?? sourceDef.direction;
  sourceDoc.locale = nextLocale;
  sourceDoc.direction = nextDirection;

  const now = new Date().toISOString();
  const newTemplateId = uuidv7();
  const newDraftId = uuidv7();
  const contentChecksum = pseudoSha256(`dup:${newTemplateId}:${now}`);
  const draft: TemplateDraftDto = {
    draftId: newDraftId,
    templateId: newTemplateId,
    editorDocument: sourceDoc,
    schemaVersion: 1,
    contentChecksum,
    baseVersionId: null,
    restoreSourceVersionId: null,
    validation: {
      state: 'NOT_VALIDATED',
      lastValidationRunId: null,
      validatedDraftRevision: null,
      errorCount: 0,
      warningCount: 0,
    },
    revision: 1,
    etag: '"1"',
    updatedAt: now,
    updatedBy: AUTHOR_USER,
  };

  const newDef: StoredTemplateDefinition = {
    sortOrder: 0,
    templateId: newTemplateId,
    thumbnail: { state: 'PENDING', sourceChecksum: contentChecksum },
    code: normalizedCode,
    name: body.name.trim(),
    description: body.description !== undefined ? body.description : sourceDef.description,
    documentType: sourceDef.documentType,
    outputChannel: sourceDef.outputChannel,
    layoutMode: sourceDoc.layoutMode,
    dataSourceKey: sourceDef.dataSourceKey,
    dataSourceSchemaVersion: sourceDef.dataSourceSchemaVersion,
    dataSourceSchemaChecksum: sourceDef.dataSourceSchemaChecksum,
    locale: nextLocale,
    direction: nextDirection,
    resolvedDirection: nextDirection === 'AUTO' ? (nextLocale === 'ar-EG' ? 'RTL' : 'LTR') : nextDirection,
    scope: clone(body.scope),
    lifecycleStatus: 'ACTIVE',
    systemProtected: false,
    revision: 1,
    etag: '"1"',
    currentDraft: {
      draftId: newDraftId,
      revision: 1,
      contentChecksum,
      validationState: 'NOT_VALIDATED',
      etag: '"1"',
    },
    currentPublishedVersion: null,
    createdAt: now,
    createdBy: AUTHOR_USER,
    updatedAt: now,
    updatedBy: AUTHOR_USER,
    archivedAt: null,
  };

  STORE.definitions.unshift(newDef);
  STORE.drafts.set(newTemplateId, draft);
  STORE.versions.set(newTemplateId, []);
  STORE.recoverySnapshots.set(newTemplateId, []);

  const response: CreateTemplateResponse = {
    definition: toDetail(newDef),
    draft: clone(draft),
  };
  STORE.idempotency.set(idemKey, clone(response));
  return response;
}

/** §3 Definition overview / metadata / lifecycle. */
export async function fakeGetTemplate(templateId: string): Promise<TemplateDefinitionDetail> {
  await fakeDelay(120);
  const def = findDefinitionOrThrow(templateId);
  return toDetail(def);
}

export async function fakePatchTemplate(
  templateId: string,
  patch: PatchTemplateDefinitionDto,
  ifMatch: string,
): Promise<PatchTemplateDefinitionResponse> {
  await fakeDelay();
  const def = findDefinitionOrThrow(templateId);
  if (def.lifecycleStatus === 'ARCHIVED') {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DEFINITION.ARCHIVED');
  }
  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== def.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }

  let updatedDraft: TemplateDraftDto | null = null;
  const now = new Date().toISOString();

  if (patch.direction !== undefined) {
    if (patch.expectedDraftRevision === undefined) {
      throw new TemplateApiError(422, 'CORE.TEMPLATE.SCHEMA.INVALID');
    }
    const draft = STORE.drafts.get(templateId);
    if (!draft) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
    if (patch.expectedDraftRevision !== draft.revision) {
      throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
    }
    def.direction = patch.direction;
    def.resolvedDirection = patch.direction === 'AUTO' ? (def.locale === 'ar-EG' ? 'RTL' : 'LTR') : patch.direction;
    draft.editorDocument.direction = patch.direction;
    draft.revision += 1;
    draft.etag = `"${draft.revision}"`;
    draft.contentChecksum = pseudoSha256(`draft:${templateId}:${draft.revision}`);
    draft.validation = {
      ...draft.validation,
      state: 'STALE',
      validatedDraftRevision: null,
      lastValidationRunId: null,
      errorCount: 0,
      warningCount: 0,
    };
    draft.updatedAt = now;
    def.currentDraft = {
      draftId: draft.draftId,
      revision: draft.revision,
      contentChecksum: draft.contentChecksum,
      validationState: 'STALE',
      etag: draft.etag,
    };
    updatedDraft = clone(draft);
  }

  if (patch.name !== undefined) {
    def.name = patch.name.trim();
  }
  if (patch.description !== undefined) {
    def.description = patch.description;
  }
  def.revision += 1;
  def.etag = `"${def.revision}"`;
  def.updatedAt = now;

  return {
    definition: toDetail(def),
    draft: updatedDraft,
  };
}

export async function fakeArchiveTemplate(templateId: string, ifMatch: string): Promise<TemplateDefinitionDetail> {
  await fakeDelay();
  const def = findDefinitionOrThrow(templateId);
  if (def.systemProtected) {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.DEFINITION.SYSTEM_PROTECTED');
  }
  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== def.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  const now = new Date().toISOString();
  def.lifecycleStatus = 'ARCHIVED';
  def.archivedAt = now;
  def.revision += 1;
  def.etag = `"${def.revision}"`;
  def.updatedAt = now;
  return toDetail(def);
}

export async function fakeRestoreTemplate(templateId: string, ifMatch: string): Promise<TemplateDefinitionDetail> {
  await fakeDelay();
  const def = findDefinitionOrThrow(templateId);
  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== def.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  const now = new Date().toISOString();
  def.lifecycleStatus = 'ACTIVE';
  def.archivedAt = null;
  def.revision += 1;
  def.etag = `"${def.revision}"`;
  def.updatedAt = now;
  return toDetail(def);
}

export async function fakeDeleteTemplate(templateId: string, ifMatch: string): Promise<void> {
  await fakeDelay();
  const def = findDefinitionOrThrow(templateId);
  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== def.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  const hasVersions = (STORE.versions.get(templateId)?.length ?? 0) > 0;
  const hasAssignments = STORE.assignments.some((a) => a.definitionId === templateId);
  if (def.currentPublishedVersion !== null || hasVersions || hasAssignments) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DEFINITION.REFERENCED');
  }
  STORE.definitions = STORE.definitions.filter((item) => item.templateId !== templateId);
  STORE.drafts.delete(templateId);
  STORE.versions.delete(templateId);
  STORE.recoverySnapshots.delete(templateId);
}

/** §1 Thumbnails and §10 Assets. */
const FAMILY_ACCENT: Readonly<Record<TemplateDocumentType, string>> = {
  QUOTATION: '#0b7a85',
  PURCHASE_QUOTATION: '#b45309',
  SALES_ORDER: '#067d4d',
  PURCHASE_ORDER: '#b45309',
  INVOICE: '#1d56c9',
  CONTRACT: '#0f2f78',
  LETTER: '#0f2f78',
  CRM_OUTBOUND_EMAIL: '#1d56c9',
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function previewSampleForPath(path: string): string {
  switch (path) {
    case 'quotation.number':
      return 'QT-2026-0148';
    case 'quotation.issueDate':
      return 'Nov 4, 2026';
    case 'quotation.validUntil':
      return 'Dec 4, 2026';
    case 'quotation.currencyCode':
      return 'EGP';
    case 'customer.name':
      return 'Nile Business Solutions';
    case 'customer.contactName':
      return 'Maya Hassan';
    case 'customer.code':
      return 'CUS-0042';
    case 'branch.name':
      return 'Cairo HQ';
    case 'totals.grossSubtotal':
      return '93,900.00';
    case 'totals.discountTotal':
      return '2,760.00';
    case 'totals.netSubtotal':
      return '91,140.00';
    case 'totals.taxTotal':
      return '12,759.60';
    case 'totals.grandTotal':
      return 'EGP 103,899.60';
    default:
      return path;
  }
}

function resolveRichTextPreview(node: Extract<TemplateNode, { type: 'richText' }>): string[] {
  const lines: string[] = [];
  for (const block of node.props.document.content) {
    if (block.type === 'paragraph' || block.type === 'heading') {
      let current = '';
      for (const inline of block.content ?? []) {
        if (inline.type === 'text') {
          current += inline.text;
        } else if (inline.type === 'variable') {
          current += previewSampleForPath(inline.attrs.binding.path);
        } else if (inline.type === 'hardBreak') {
          lines.push(current);
          current = '';
        }
      }
      if (current) lines.push(current);
    }
  }
  return lines;
}

function renderAbsoluteDocThumbnailSvg(doc: TemplateDocumentV1): string {
  const wMm = doc.page?.widthMm ?? 210;
  const hMm = doc.page?.heightMm ?? 297;
  const wPx = 420;
  const hPx = Math.round((wPx * hMm) / wMm);
  const scale = wPx / wMm;
  const accent = doc.theme.accentColor ?? FAMILY_ACCENT[doc.documentType];

  const rootIds = doc.canvasPages?.[0]?.rootNodeIds ?? doc.rootNodeIds;
  const nodes = rootIds
    .map((id) => doc.nodes[id])
    .filter((n): n is TemplateNode => Boolean(n) && !n.hidden && n.layout.kind === 'ABSOLUTE')
    .sort((a, b) => (a.layout.kind === 'ABSOLUTE' && b.layout.kind === 'ABSOLUTE' ? a.layout.zIndex - b.layout.zIndex : 0));

  const parts: string[] = [];
  for (const node of nodes) {
    if (node.layout.kind !== 'ABSOLUTE') continue;
    const x = Math.round(node.layout.x * scale * 10) / 10;
    const y = Math.round(node.layout.y * scale * 10) / 10;
    const w = Math.round(node.layout.width * scale * 10) / 10;
    const h = Math.round(node.layout.height * scale * 10) / 10;
    const radius = node.style.borderRadiusPx ? Math.min(8, node.style.borderRadiusPx) : 0;

    if (node.type === 'container') {
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${node.style.backgroundColor ?? accent}" />`);
      continue;
    }

    if (node.type === 'image') {
      const lx = x + 2;
      const ly = y + Math.max(4, h / 2 - 9);
      parts.push(
        `<g><polygon points="${lx + 4},${ly} ${lx + 20},${ly} ${lx + 15},${ly + 18} ${lx - 1},${ly + 18}" fill="${accent}"/><text x="${lx + 24}" y="${ly + 12}" font-family="sans-serif" font-size="7.5" font-weight="700" fill="#0f2f78">NILE OFFICE</text></g>`,
      );
      continue;
    }

    if (node.type === 'text' || node.type === 'dataField' || node.type === 'richText') {
      if (node.style.backgroundColor) {
        parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${node.style.backgroundColor}" />`);
      }
      const lines =
        node.type === 'text'
          ? node.props.text.split('\n')
          : node.type === 'dataField'
            ? [previewSampleForPath(node.binding.path)]
            : resolveRichTextPreview(node);
      const fontSize = Math.max(6.5, Math.min(18, (node.style.fontSizePx ?? 9) * 0.88));
      const color = node.style.color ?? '#12141c';
      const weight = node.style.fontWeight === 'BOLD' || node.style.fontWeight === 'SEMIBOLD' ? '700' : '400';
      const align = node.style.textAlign ?? 'START';
      const anchor = align === 'CENTER' ? 'middle' : align === 'END' ? 'end' : 'start';
      const tx = align === 'CENTER' ? x + w / 2 : align === 'END' ? x + w - 2 : x + 3;
      const lineStep = fontSize * 1.25;
      lines.slice(0, 4).forEach((line, idx) => {
        const ty = y + fontSize + (node.style.backgroundColor ? 2 : 0) + idx * lineStep;
        parts.push(
          `<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-family="sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`,
        );
      });
      continue;
    }

    if (node.type === 'dynamicTable') {
      const headerH = 16;
      const colW = w / Math.max(1, node.props.columns.length);
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="#e4e7ec" stroke-width="0.8"/>`);
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${headerH}" fill="${accent}"/>`);
      node.props.columns.forEach((col, ci) => {
        const cx = x + ci * colW + 4;
        const hText = col.header.kind === 'TEXT' ? col.header.value : '';
        parts.push(
          `<text x="${cx}" y="${y + 11}" font-family="sans-serif" font-size="5.5" font-weight="600" fill="#ffffff">${escapeXml(hText.slice(0, 10))}</text>`,
        );
      });
      for (let r = 0; r < 3; r++) {
        const ry = y + headerH + r * 18;
        parts.push(`<line x1="${x}" y1="${ry + 18}" x2="${x + w}" y2="${ry + 18}" stroke="#e4e7ec" stroke-width="0.7"/>`);
        parts.push(`<rect x="${x + 4}" y="${ry + 6}" width="${Math.min(72, colW * 0.75)}" height="4" rx="2" fill="#3c4257" opacity="0.75"/>`);
        parts.push(`<rect x="${x + w - 34}" y="${ry + 6}" width="26" height="4" rx="2" fill="#5b6072" opacity="0.6"/>`);
      }
      continue;
    }

    if (node.type === 'staticTable') {
      const rows = node.props.rows;
      const rowH = h / Math.max(1, rows.length);
      rows.forEach((row, rIdx) => {
        const ry = y + rIdx * rowH;
        const labelCell = row.cells[0];
        const valCell = row.cells[1];
        const bg = labelCell?.style?.backgroundColor ?? (rIdx % 2 === 0 ? '#ffffff' : '#f8f9fc');
        const fg = labelCell?.style?.color ?? '#12141c';
        parts.push(`<rect x="${x}" y="${ry}" width="${w}" height="${rowH}" fill="${bg}" stroke="#e4e7ec" stroke-width="0.5"/>`);
        const lText = labelCell?.value.kind === 'TEXT' ? labelCell.value.value : '';
        const vText = valCell?.value.kind === 'BINDING' ? previewSampleForPath(valCell.value.binding.path) : '';
        parts.push(
          `<text x="${x + 5}" y="${ry + rowH * 0.68}" font-family="sans-serif" font-size="6.5" font-weight="600" fill="${fg}">${escapeXml(lText)}</text>`,
        );
        parts.push(
          `<text x="${x + w - 5}" y="${ry + rowH * 0.68}" text-anchor="end" font-family="sans-serif" font-size="6.5" font-weight="700" fill="${fg}">${escapeXml(vText)}</text>`,
        );
      });
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${wPx}" height="${hPx}" viewBox="0 0 ${wPx} ${hPx}"><rect width="${wPx}" height="${hPx}" fill="#ffffff" stroke="#e4e7ec" stroke-width="2"/>${parts.join('')}</svg>`;
}

function makePageThumbnailBlob(opts: {
  title: string;
  code?: string;
  outputChannel: TemplateOutputChannel;
  documentType: TemplateDocumentType;
  rtl: boolean;
  doc?: TemplateDocumentV1 | null;
}): Blob {
  if (opts.doc && opts.doc.layoutMode === 'FIXED_CANVAS') {
    return new Blob([renderAbsoluteDocThumbnailSvg(opts.doc)], { type: 'image/svg+xml' });
  }

  const accent = FAMILY_ACCENT[opts.documentType];
  const safeTitle = escapeXml(opts.title.slice(0, 34));
  const safeCode = opts.code ? escapeXml(opts.code) : '';

  if (opts.outputChannel === 'EMAIL') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520"><rect width="400" height="520" fill="#f7f8fa"/><rect x="24" y="20" width="352" height="480" rx="10" fill="#ffffff" stroke="#e4e7ec" stroke-width="2"/><rect x="24" y="20" width="352" height="10" rx="4" fill="#1d56c9"/><circle cx="58" cy="64" r="14" fill="#e6edfa"/><rect x="82" y="54" width="120" height="8" rx="4" fill="#1d56c9"/><rect x="82" y="68" width="84" height="6" rx="3" fill="#8b90a3"/><line x1="44" y1="94" x2="356" y2="94" stroke="#e4e7ec"/><text x="${opts.rtl ? 356 : 44}" y="128" text-anchor="${opts.rtl ? 'end' : 'start'}" font-family="sans-serif" font-size="15" font-weight="700" fill="#12141c">${safeTitle}</text><rect x="44" y="150" width="312" height="8" rx="4" fill="#dde1ea"/><rect x="44" y="168" width="286" height="8" rx="4" fill="#dde1ea"/><rect x="44" y="186" width="240" height="8" rx="4" fill="#dde1ea"/><rect x="44" y="218" width="312" height="64" rx="8" fill="#f8f9fc" stroke="#e4e7ec"/><rect x="44" y="308" width="136" height="32" rx="8" fill="#1d56c9"/><rect x="76" y="320" width="72" height="7" rx="3" fill="#ffffff"/><line x1="44" y1="446" x2="356" y2="446" stroke="#e4e7ec"/><rect x="44" y="462" width="160" height="6" rx="3" fill="#dde1ea"/></svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  const isTradeTableDoc =
    opts.documentType === 'QUOTATION' ||
    opts.documentType === 'PURCHASE_QUOTATION' ||
    opts.documentType === 'SALES_ORDER' ||
    opts.documentType === 'PURCHASE_ORDER' ||
    opts.documentType === 'INVOICE';
  const anchor = opts.rtl ? 'end' : 'start';
  const titleX = opts.rtl ? 392 : 28;
  const codeBadgeX = opts.rtl ? 28 : 282;

  const middleSvg = isTradeTableDoc
    ? `<rect x="28" y="152" width="364" height="22" rx="4" fill="${accent}"/><rect x="28" y="180" width="364" height="24" fill="#f8f9fc" stroke="#e4e7ec"/><rect x="28" y="204" width="364" height="24" fill="#ffffff" stroke="#e4e7ec"/><rect x="28" y="228" width="364" height="24" fill="#f8f9fc" stroke="#e4e7ec"/><rect x="28" y="252" width="364" height="24" fill="#ffffff" stroke="#e4e7ec"/><rect x="228" y="294" width="164" height="18" fill="#f8f9fc" stroke="#e4e7ec"/><rect x="228" y="312" width="164" height="18" fill="#ffffff" stroke="#e4e7ec"/><rect x="228" y="330" width="164" height="24" fill="${accent}"/>`
    : `<rect x="28" y="152" width="364" height="10" rx="4" fill="#dde1ea"/><rect x="28" y="172" width="340" height="10" rx="4" fill="#dde1ea"/><rect x="28" y="192" width="356" height="10" rx="4" fill="#dde1ea"/><rect x="28" y="212" width="290" height="10" rx="4" fill="#dde1ea"/><rect x="28" y="246" width="364" height="92" rx="6" fill="#f8f9fc" stroke="#e4e7ec"/><rect x="28" y="454" width="120" height="8" rx="4" fill="${accent}" opacity="0.7"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="594" viewBox="0 0 420 594"><rect width="420" height="594" fill="#ffffff" stroke="#e4e7ec" stroke-width="2"/><rect x="20" y="16" width="380" height="6" fill="${accent}"/><rect x="28" y="38" width="42" height="24" rx="4" fill="${accent}" opacity="0.16"/><polygon points="36,42 54,42 49,58 31,58" fill="${accent}"/><text x="${titleX}" y="94" text-anchor="${anchor}" font-family="sans-serif" font-size="16" font-weight="700" fill="#12141c">${safeTitle}</text>${
    safeCode
      ? `<rect x="${codeBadgeX}" y="40" width="110" height="20" rx="6" fill="#eceef2"/><text x="${codeBadgeX + 55}" y="54" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="600" fill="#3c4257">${safeCode}</text>`
      : ''
  }<rect x="28" y="114" width="180" height="8" rx="4" fill="#c8ccd4"/><rect x="28" y="128" width="130" height="7" rx="3" fill="#dde1ea"/>${middleSvg}<rect x="20" y="572" width="380" height="4" fill="${accent}"/></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

function makeAssetBlob(asset: TemplateAssetDto): Blob {
  const w = Math.max(80, asset.widthPx || 320);
  const h = Math.max(80, asset.heightPx || 160);
  const stem = asset.originalFileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').toUpperCase();

  if (asset.assetType === 'LOGO') {
    const brandColor =
      asset.status === 'RETIRED'
        ? '#5b6072'
        : asset.assetId === ASSET_IDS.logoEmail || asset.deliveryClass === 'EMAIL_PUBLIC'
          ? '#1d56c9'
          : '#0b7a85';
    const wordmark =
      asset.assetId === ASSET_IDS.logoMain
        ? 'NILE OFFICE'
        : asset.assetId === ASSET_IDS.logoEmail
          ? 'MUTAKAMEL'
          : asset.assetId === ASSET_IDS.legacyLogo
            ? 'LEGACY 2024'
            : escapeXml(stem.slice(0, 18));
    const padX = Math.round(w * 0.08);
    const markSize = Math.round(Math.min(h * 0.62, w * 0.22));
    const cy = Math.round(h / 2);
    const my = Math.round(cy - markSize / 2);
    const fontSize = Math.max(14, Math.round(h * 0.24));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="12" fill="#ffffff"/><polygon points="${padX + Math.round(markSize * 0.28)},${my} ${padX + markSize},${my} ${padX + Math.round(markSize * 0.72)},${my + markSize} ${padX},${my + markSize}" fill="${brandColor}"/><polygon points="${padX + Math.round(markSize * 0.7)},${my + Math.round(markSize * 0.35)} ${padX + Math.round(markSize * 1.15)},${my + Math.round(markSize * 0.35)} ${padX + Math.round(markSize * 0.92)},${my + markSize} ${padX + Math.round(markSize * 0.48)},${my + markSize}" fill="#0f2f78" opacity="0.85"/><text x="${padX + Math.round(markSize * 1.38)}" y="${cy + Math.round(fontSize * 0.35)}" font-family="sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="1" fill="#0f2f78">${wordmark}</text></svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  if (asset.assetType === 'BACKGROUND') {
    const band = Math.max(14, Math.round(h * 0.025));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#ffffff" stroke="#e4e7ec" stroke-width="4"/><rect x="0" y="0" width="${w}" height="${band}" fill="#0f2f78"/><rect x="0" y="${band}" width="${w}" height="${Math.round(band * 0.35)}" fill="#0b7a85"/><rect x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.06)}" width="${Math.round(w * 0.88)}" height="${Math.round(h * 0.88)}" fill="none" stroke="#e4e7ec" stroke-width="2" stroke-dasharray="10 8"/><rect x="0" y="${h - band}" width="${w}" height="${band}" fill="#0f2f78"/></svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  if (Math.abs(w - h) <= Math.min(w, h) * 0.25) {
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);
    const rOuter = Math.round(Math.min(w, h) * 0.42);
    const rInner = Math.round(rOuter * 0.74);
    const fs = Math.max(12, Math.round(rOuter * 0.17));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#ffffff"/><circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="#0b7a85" stroke-width="${Math.max(3, Math.round(rOuter * 0.06))}"/><circle cx="${cx}" cy="${cy}" r="${rInner}" fill="#e6f4f5" stroke="#0f2f78" stroke-width="2" stroke-dasharray="6 4"/><text x="${cx}" y="${cy - Math.round(fs * 0.3)}" text-anchor="middle" font-family="sans-serif" font-size="${fs}" font-weight="700" fill="#0f2f78">NILE OFFICE</text><text x="${cx}" y="${cy + Math.round(fs * 1.1)}" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(fs * 0.85)}" font-weight="600" fill="#0b7a85">APPROVED</text></svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  if (w / h >= 2) {
    const fs = Math.max(18, Math.round(h * 0.14));
    const title = asset.assetId === ASSET_IDS.showroomBanner ? 'CAIRO SHOWROOM' : escapeXml(stem.slice(0, 24));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="bnr" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#070f2b"/><stop offset="100%" stop-color="#0b7a85"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#bnr)"/><circle cx="${Math.round(w * 0.85)}" cy="${Math.round(h * 0.35)}" r="${Math.round(h * 0.45)}" fill="#ffffff" opacity="0.08"/><rect x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.3)}" width="${Math.round(w * 0.04)}" height="${Math.round(h * 0.4)}" rx="4" fill="#1fbf75"/><text x="${Math.round(w * 0.12)}" y="${Math.round(h * 0.56)}" font-family="sans-serif" font-size="${fs}" font-weight="700" letter-spacing="2" fill="#ffffff">${title}</text></svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  const label = escapeXml(stem.slice(0, 22));
  const fs = Math.max(14, Math.round(Math.min(w, h) * 0.09));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#f8f9fc" stroke="#e4e7ec" stroke-width="2"/><polygon points="${Math.round(w * 0.18)},${Math.round(h * 0.72)} ${Math.round(w * 0.44)},${Math.round(h * 0.36)} ${Math.round(w * 0.66)},${Math.round(h * 0.62)} ${Math.round(w * 0.82)},${Math.round(h * 0.46)} ${Math.round(w * 0.88)},${Math.round(h * 0.72)}" fill="#0b7a85" opacity="0.25"/><circle cx="${Math.round(w * 0.72)}" cy="${Math.round(h * 0.28)}" r="${Math.round(Math.min(w, h) * 0.1)}" fill="#1d56c9" opacity="0.3"/><text x="${Math.round(w / 2)}" y="${Math.round(h * 0.88)}" text-anchor="middle" font-family="sans-serif" font-size="${fs}" font-weight="600" fill="#3c4257">${label}</text></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

export async function fakeGetTemplateThumbnail(templateId: string, query: TemplateThumbnailQuery): Promise<Blob> {
  await fakeDelay(80);
  const def = findDefinitionOrThrow(templateId);
  if (def.thumbnail.state === 'PENDING') {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.THUMBNAIL.NOT_READY');
  }
  if (def.thumbnail.state === 'UNAVAILABLE') {
    throw new TemplateApiError(410, 'CORE.TEMPLATE.THUMBNAIL.UNAVAILABLE');
  }
  const doc =
    query.sourceKind === 'PUBLISHED'
      ? (STORE.versions.get(templateId) ?? []).find((v) => v.templateVersionId === query.versionId)?.editorDocument ??
        STORE.drafts.get(templateId)?.editorDocument ??
        null
      : STORE.drafts.get(templateId)?.editorDocument ?? null;

  return makePageThumbnailBlob({
    title: def.name,
    code: def.code,
    outputChannel: def.outputChannel,
    documentType: def.documentType,
    rtl: def.resolvedDirection === 'RTL',
    doc,
  });
}

export async function fakeGetTemplateThumbnailByPath(downloadPath: string): Promise<Blob> {
  const match = /\/templates\/([^/?]+)\/thumbnail(?:\?(.*))?$/.exec(downloadPath.trim());
  if (!match) {
    await fakeDelay(40);
    throw new TemplateApiError(400, 'CORE.TEMPLATE.THUMBNAIL.SOURCE_INVALID');
  }
  const templateId = decodeURIComponent(match[1]);
  const params = new URLSearchParams(match[2] ?? '');
  const sourceKind = params.get('sourceKind');
  const sourceChecksum = params.get('sourceChecksum') ?? '';

  if (sourceKind === 'PUBLISHED') {
    const versionId = params.get('versionId');
    if (!versionId || !sourceChecksum) {
      await fakeDelay(40);
      throw new TemplateApiError(400, 'CORE.TEMPLATE.THUMBNAIL.SOURCE_INVALID');
    }
    return fakeGetTemplateThumbnail(templateId, {
      sourceKind: 'PUBLISHED',
      versionId,
      sourceChecksum,
    });
  }
  if (sourceKind === 'DRAFT') {
    const revRaw = params.get('draftRevision');
    const draftRevision = revRaw !== null ? Number(revRaw) : Number.NaN;
    if (!Number.isFinite(draftRevision) || !sourceChecksum) {
      await fakeDelay(40);
      throw new TemplateApiError(400, 'CORE.TEMPLATE.THUMBNAIL.SOURCE_INVALID');
    }
    return fakeGetTemplateThumbnail(templateId, {
      sourceKind: 'DRAFT',
      draftRevision,
      sourceChecksum,
    });
  }
  await fakeDelay(40);
  throw new TemplateApiError(400, 'CORE.TEMPLATE.THUMBNAIL.SOURCE_INVALID');
}

/** Fake worker latency before a retried thumbnail job turns READY. */
export const FAKE_THUMBNAIL_RENDER_MS = 1200;

const THUMBNAIL_JOBS = new Map<string, { thumbnailJobId: string; generation: number }>();

/**
 * Mirrors TemplateThumbnailReadService.retryThumbnail: a fresh READY image answers
 * 409 CORE.TEMPLATE.THUMBNAIL.NOT_READY ("already available"); a PENDING job is returned
 * as-is; otherwise a replacement job is staged and the 202 THUMBNAIL_ACCEPTED body returned.
 * The fake worker completes the job after FAKE_THUMBNAIL_RENDER_MS.
 */
export async function fakeRetryTemplateThumbnail(
  templateId: string,
  body: TemplateThumbnailRetryRequest,
): Promise<TemplateThumbnailRetryResponse> {
  await fakeDelay();
  const def = findDefinitionOrThrow(templateId);
  if (!/^[0-9a-f]{64}$/.test(body.sourceChecksum)) {
    throw new TemplateApiError(400, 'CORE.TEMPLATE.THUMBNAIL.SOURCE_INVALID');
  }
  const qs =
    body.sourceKind === 'DRAFT'
      ? `sourceKind=DRAFT&draftRevision=${body.draftRevision}&sourceChecksum=${body.sourceChecksum}`
      : `sourceKind=PUBLISHED&versionId=${body.versionId}&sourceChecksum=${body.sourceChecksum}`;
  const location = `/api/tenant/core/v1/templates/${templateId}/thumbnail?${qs}`;
  const jobKey = `${templateId}:${body.sourceKind}:${body.sourceChecksum}`;
  const current = THUMBNAIL_JOBS.get(jobKey);

  if (def.thumbnail.state === 'READY') {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.THUMBNAIL.NOT_READY');
  }
  if (def.thumbnail.state === 'PENDING' && current) {
    return {
      kind: 'THUMBNAIL_ACCEPTED',
      thumbnailJobId: current.thumbnailJobId,
      state: 'PENDING',
      generation: current.generation,
      sourceChecksum: body.sourceChecksum,
      location,
    };
  }

  const job = { thumbnailJobId: uuidv7(), generation: (current?.generation ?? 0) + 1 };
  THUMBNAIL_JOBS.set(jobKey, job);
  def.thumbnail = { state: 'PENDING', sourceChecksum: body.sourceChecksum };
  setTimeout(() => {
    if (THUMBNAIL_JOBS.get(jobKey)?.thumbnailJobId !== job.thumbnailJobId) return;
    if (def.thumbnail.state !== 'PENDING' || def.thumbnail.sourceChecksum !== body.sourceChecksum) return;
    def.thumbnail = {
      state: 'READY',
      sourceChecksum: body.sourceChecksum,
      contentChecksum: pseudoSha256(`thumb:${job.thumbnailJobId}`),
      widthPx: 420,
      heightPx: 594,
      expiresAt: '2026-12-21T00:00:00.000Z',
      downloadPath: location,
    };
  }, FAKE_THUMBNAIL_RENDER_MS);

  return {
    kind: 'THUMBNAIL_ACCEPTED',
    thumbnailJobId: job.thumbnailJobId,
    state: 'PENDING',
    generation: job.generation,
    sourceChecksum: body.sourceChecksum,
    location,
  };
}

export async function fakeGetStarterThumbnail(starterKey: string): Promise<Blob> {
  await fakeDelay(80);
  const starter = STARTER_REGISTRY.find((s) => s.starterKey === starterKey);
  if (!starter) throw new TemplateApiError(410, 'CORE.TEMPLATE.THUMBNAIL.UNAVAILABLE');
  return makePageThumbnailBlob({
    title: starter.displayName,
    outputChannel: starter.outputChannel,
    documentType: starter.documentType,
    rtl: starter.resolvedDirection === 'RTL',
  });
}

/** §4 Draft, Validation & Publish. */
export async function fakeGetDraft(templateId: string): Promise<TemplateDraftDto> {
  await fakeDelay(120);
  findDefinitionOrThrow(templateId);
  const draft = STORE.drafts.get(templateId);
  if (!draft) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  return clone(draft);
}

export async function fakePatchDraft(
  templateId: string,
  body: PatchTemplateDraftDto,
  ifMatch: string,
  idempotencyKey: string,
): Promise<PatchTemplateDraftResponse> {
  await fakeDelay();
  const idemKey = `patch-draft:${templateId}:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as PatchTemplateDraftResponse);
  }

  const def = findDefinitionOrThrow(templateId);
  if (def.lifecycleStatus === 'ARCHIVED') {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DEFINITION.ARCHIVED');
  }
  const draft = STORE.drafts.get(templateId);
  if (!draft) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');

  const expectedRev = parseFakeDraftSavePrecondition(ifMatch, def);
  if (expectedRev !== draft.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }

  const now = new Date().toISOString();
  draft.editorDocument = clone(body.editorDocument);
  draft.revision += 1;
  draft.etag = `"${draft.revision}"`;
  draft.contentChecksum = pseudoSha256(`draft:${templateId}:${draft.revision}:${body.clientMutationId}`);
  draft.validation = {
    ...draft.validation,
    state: 'STALE',
    validatedDraftRevision: null,
    // Backend: an edit unlinks the run (fk_template_drafts_last_validation), so a STALE draft has no run and 0/0 counts.
    lastValidationRunId: null,
    errorCount: 0,
    warningCount: 0,
  };
  draft.updatedAt = now;

  def.currentDraft = {
    draftId: draft.draftId,
    revision: draft.revision,
    contentChecksum: draft.contentChecksum,
    validationState: 'STALE',
    etag: draft.etag,
  };
  def.updatedAt = now;

  const readyThumb: TemplateThumbnail = {
    state: 'READY',
    sourceChecksum: draft.contentChecksum,
    contentChecksum: pseudoSha256(`thumb-png:${draft.contentChecksum}`),
    widthPx: 420,
    heightPx: 594,
    expiresAt: '2026-12-21T00:00:00.000Z',
    downloadPath: `/api/tenant/core/v1/templates/${templateId}/thumbnail?sourceKind=DRAFT&draftRevision=${draft.revision}&sourceChecksum=${draft.contentChecksum}`,
  };
  def.thumbnail = readyThumb;

  const response: PatchTemplateDraftResponse = {
    draft: clone(draft),
    thumbnail: clone(readyThumb),
    migrationRecovery: null,
  };
  STORE.idempotency.set(idemKey, clone(response));
  return response;
}

/**
 * Mirrors the backend geometry rule (template-schema geometry.ts): a top-level ABSOLUTE node on a print page must
 * fit the printable area within 0.001 mm. Shape matches issueDto: ERROR, nodeId, jsonPointer, params always {}.
 */
/** Mirrors template-schema base-validation-core: an all-blank email subject is the ERROR issue TEMPLATE_EMAIL_SUBJECT_EMPTY. */
function fakeEmailSubjectIssues(doc: TemplateDocumentV1): TemplateValidationIssue[] {
  if (doc.outputChannel !== 'EMAIL' || !doc.email) return [];
  const segments = doc.email.subject?.segments ?? [];
  const blank = segments.every((segment) => segment.kind === 'TEXT' && segment.value.trim() === '');
  if (!blank) return [];
  return [
    {
      severity: 'ERROR',
      code: 'TEMPLATE_EMAIL_SUBJECT_EMPTY',
      jsonPointer: toJsonPointer(['email', 'subject']),
      nodeId: null,
      messageKey: 'template.validation.template_email_subject_empty',
      params: {},
    },
  ];
}

function fakeGeometryIssues(doc: TemplateDocumentV1): TemplateValidationIssue[] {
  const page = doc.page;
  if (doc.outputChannel !== 'PRINT' || !page) return [];
  const code = doc.layoutMode === 'FIXED_CANVAS' ? 'TEMPLATE_FIXED_CANVAS_OVERFLOW' : 'TEMPLATE_ABSOLUTE_ZONE_OVERFLOW';
  const tolerance = 0.001;
  const issues: TemplateValidationIssue[] = [];
  for (const nodeId of doc.rootNodeIds) {
    const layout = doc.nodes[nodeId]?.layout;
    if (!layout || layout.kind !== 'ABSOLUTE') continue;
    const fits =
      layout.x >= page.marginMm.start - tolerance &&
      layout.y >= page.marginMm.top - tolerance &&
      layout.x + layout.width <= page.widthMm - page.marginMm.end + tolerance &&
      layout.y + layout.height <= page.heightMm - page.marginMm.bottom + tolerance;
    if (fits) continue;
    issues.push({
      severity: 'ERROR',
      code,
      jsonPointer: toJsonPointer(['nodes', nodeId, 'layout']),
      nodeId,
      messageKey: `template.validation.${code.toLowerCase()}`,
      params: {},
    });
  }
  return issues;
}

export async function fakeValidateDraft(
  templateId: string,
  body: ValidateTemplateDraftDto,
  ifMatch: string,
): Promise<TemplateValidationRunDto> {
  await fakeDelay();
  const def = findDefinitionOrThrow(templateId);
  if (def.lifecycleStatus === 'ARCHIVED') {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DEFINITION.ARCHIVED');
  }
  const draft = STORE.drafts.get(templateId);
  if (!draft) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');

  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== draft.revision || body.draftRevision !== draft.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }

  const validPrint =
    def.outputChannel === 'PRINT' && body.rendererTargets[0] === 'HTML' && body.rendererTargets[1] === 'PDF';
  const validEmail =
    def.outputChannel === 'EMAIL' &&
    body.rendererTargets[0] === 'EMAIL_HTML' &&
    body.rendererTargets[1] === 'EMAIL_TEXT';
  if (!validPrint && !validEmail) {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.COMPILER.TARGET_UNSUPPORTED');
  }

  const issues = [...fakeGeometryIssues(draft.editorDocument), ...fakeEmailSubjectIssues(draft.editorDocument)];
  const errorCount = issues.filter((issue) => issue.severity === 'ERROR').length;
  const status = errorCount > 0 ? 'FAILED' : 'PASSED';

  const now = new Date().toISOString();
  const runId = uuidv7();
  const run: TemplateValidationRunDto = {
    validationRunId: runId,
    templateId,
    draftId: draft.draftId,
    draftRevision: draft.revision,
    candidateChecksum: draft.contentChecksum,
    editorSchemaVersion: 1,
    dataSourceKey: def.dataSourceKey,
    dataSourceSchemaVersion: def.dataSourceSchemaVersion,
    dataSourceSchemaChecksum: def.dataSourceSchemaChecksum,
    nodeRegistryVersion: 'mvp-v1',
    compilerVersion: '1.4.0',
    compilerFingerprint: 'compiler-mvp-v1-sha256',
    rendererTargets: [...body.rendererTargets],
    assetResolutionFingerprint: pseudoSha256(`assets:${templateId}`),
    fixtureChecksum: pseudoSha256(`fixture:${body.fixtureKey ?? 'default'}`),
    issues,
    startedAt: now,
    completedAt: now,
    status,
    compiledChecksum: status === 'PASSED' ? pseudoSha256(`compiled:${draft.contentChecksum}`) : null,
  };

  STORE.validationRuns.set(runId, run);
  draft.validation = {
    state: status,
    lastValidationRunId: runId,
    validatedDraftRevision: draft.revision,
    errorCount,
    warningCount: issues.length - errorCount,
  };
  def.currentDraft.validationState = status;

  return clone(run);
}

export async function fakeGetValidationRun(templateId: string, runId: string): Promise<TemplateValidationRunDto> {
  await fakeDelay(100);
  findDefinitionOrThrow(templateId);
  const run = STORE.validationRuns.get(runId);
  if (!run || run.templateId !== templateId) {
    throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  }
  return clone(run);
}

export async function fakePublishTemplate(
  templateId: string,
  body: PublishTemplateRequestDto,
  ifMatch: string,
  idempotencyKey: string,
): Promise<PublishTemplateResponseDto> {
  await fakeDelay();
  const idemKey = `publish:${templateId}:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as PublishTemplateResponseDto);
  }

  const def = findDefinitionOrThrow(templateId);
  if (def.lifecycleStatus === 'ARCHIVED') {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DEFINITION.ARCHIVED');
  }
  const draft = STORE.drafts.get(templateId);
  if (!draft) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');

  const expectedDraftRev = parseIfMatchRevision(ifMatch);
  if (expectedDraftRev !== draft.revision || body.draftRevision !== draft.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  if (body.definitionRevision !== def.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }

  const run = STORE.validationRuns.get(body.validationRunId);
  if (!run || run.templateId !== templateId || run.status !== 'PASSED') {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.PUBLISH.NOT_VALIDATED');
  }
  if (run.draftRevision !== draft.revision || run.candidateChecksum !== draft.contentChecksum) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.PUBLISH.VALIDATION_STALE');
  }

  const existingVersions = STORE.versions.get(templateId) ?? [];
  const nextVersionNumber = existingVersions.length > 0 ? existingVersions[0].versionNumber + 1 : 1;
  const now = new Date().toISOString();
  const versionId = uuidv7();
  const consumedDraftRevision = draft.revision;

  const newVersion: TemplateVersionDetail = {
    templateDefinitionId: templateId,
    templateVersionId: versionId,
    versionNumber: nextVersionNumber,
    documentType: def.documentType,
    outputChannel: def.outputChannel,
    layoutMode: def.layoutMode,
    locale: def.locale,
    direction: def.resolvedDirection,
    dataSourceKey: def.dataSourceKey,
    dataSourceSchemaVersion: def.dataSourceSchemaVersion,
    dataSourceSchemaChecksum: def.dataSourceSchemaChecksum,
    templateContentChecksum: draft.contentChecksum,
    compiledChecksum: run.compiledChecksum ?? pseudoSha256(`compiled:${versionId}`),
    compilerFingerprint: run.compilerFingerprint,
    lifecycleStatus: 'PUBLISHED',
    publishedAt: now,
    restoredFromVersionId: draft.restoreSourceVersionId,
    changeNote: body.changeNote?.trim() || null,
    publishedBy: AUTHOR_USER,
    retiredAt: null,
    retiredBy: null,
    editorDocument: clone(draft.editorDocument),
    editorSchemaVersion: 1,
    nodeRegistryVersion: 'mvp-v1',
    compilerVersion: run.compilerVersion,
    validationRunId: run.validationRunId,
    rendererTargets: [...run.rendererTargets],
    bindingManifest: [],
    assetManifest: [],
  };

  STORE.versions.set(templateId, [newVersion, ...existingVersions]);

  // Publish bumps draft revision +1 and sets validation state to STALE (§4).
  draft.revision += 1;
  draft.etag = `"${draft.revision}"`;
  draft.baseVersionId = versionId;
  draft.restoreSourceVersionId = null;
  draft.validation = {
    ...draft.validation,
    state: 'STALE',
    validatedDraftRevision: null,
    // Backend: an edit unlinks the run (fk_template_drafts_last_validation), so a STALE draft has no run and 0/0 counts.
    lastValidationRunId: null,
    errorCount: 0,
    warningCount: 0,
  };
  draft.updatedAt = now;

  def.revision += 1;
  def.etag = `"${def.revision}"`;
  def.updatedAt = now;
  def.currentDraft = {
    draftId: draft.draftId,
    revision: draft.revision,
    contentChecksum: draft.contentChecksum,
    validationState: 'STALE',
    etag: draft.etag,
  };
  def.currentPublishedVersion = {
    templateDefinitionId: templateId,
    templateVersionId: versionId,
    versionNumber: nextVersionNumber,
    documentType: def.documentType,
    outputChannel: def.outputChannel,
    layoutMode: def.layoutMode,
    locale: def.locale,
    direction: def.resolvedDirection,
    dataSourceKey: def.dataSourceKey,
    dataSourceSchemaVersion: def.dataSourceSchemaVersion,
    dataSourceSchemaChecksum: def.dataSourceSchemaChecksum,
    templateContentChecksum: newVersion.templateContentChecksum,
    compiledChecksum: newVersion.compiledChecksum,
    compilerFingerprint: newVersion.compilerFingerprint,
    lifecycleStatus: 'PUBLISHED',
    publishedAt: now,
  };

  const thumb: TemplateThumbnail = {
    state: 'READY',
    sourceChecksum: newVersion.templateContentChecksum,
    contentChecksum: pseudoSha256(`pub-thumb:${versionId}`),
    widthPx: 420,
    heightPx: 594,
    expiresAt: '2026-12-21T00:00:00.000Z',
    downloadPath: `/api/tenant/core/v1/templates/${templateId}/thumbnail?sourceKind=PUBLISHED&versionId=${versionId}&sourceChecksum=${newVersion.templateContentChecksum}`,
  };
  def.thumbnail = thumb;

  const response: PublishTemplateResponseDto = {
    version: clone(newVersion),
    thumbnail: clone(thumb),
    definitionRevision: def.revision,
    definitionEtag: def.etag,
    consumedDraftRevision,
    draftEtag: draft.etag,
  };
  STORE.idempotency.set(idemKey, clone(response));
  return response;
}

/** §9 Versions & recovery snapshots. */
export async function fakeListVersions(
  templateId: string,
  query: TemplateVersionsListQuery = {},
): Promise<TemplateCursorPage<TemplateVersionItem>> {
  await fakeDelay(120);
  findDefinitionOrThrow(templateId);
  const all = (STORE.versions.get(templateId) ?? []).slice().sort((a, b) => b.versionNumber - a.versionNumber);
  const filtered = all.filter((v) => {
    if (query.lifecycleStatus && v.lifecycleStatus !== query.lifecycleStatus) return false;
    if (query.publishedFrom && v.publishedAt < query.publishedFrom) return false;
    if (query.publishedTo && v.publishedAt > query.publishedTo) return false;
    return true;
  });

  const mapped: TemplateVersionItem[] = filtered.map((v) => ({
    templateDefinitionId: v.templateDefinitionId,
    templateVersionId: v.templateVersionId,
    versionNumber: v.versionNumber,
    documentType: v.documentType,
    outputChannel: v.outputChannel,
    layoutMode: v.layoutMode,
    locale: v.locale,
    direction: v.direction,
    dataSourceKey: v.dataSourceKey,
    dataSourceSchemaVersion: v.dataSourceSchemaVersion,
    dataSourceSchemaChecksum: v.dataSourceSchemaChecksum,
    templateContentChecksum: v.templateContentChecksum,
    compiledChecksum: v.compiledChecksum,
    compilerFingerprint: v.compilerFingerprint,
    lifecycleStatus: v.lifecycleStatus,
    publishedAt: v.publishedAt,
    restoredFromVersionId: v.restoredFromVersionId,
    changeNote: v.changeNote,
    publishedBy: v.publishedBy,
    retiredAt: v.retiredAt,
    retiredBy: v.retiredBy,
  }));

  return paginateByCursor(mapped, (v) => v.templateVersionId, query.cursor, query.limit ?? 25);
}

export async function fakeGetVersion(templateId: string, versionId: string): Promise<TemplateVersionDetail> {
  await fakeDelay(120);
  findDefinitionOrThrow(templateId);
  const ver = (STORE.versions.get(templateId) ?? []).find((v) => v.templateVersionId === versionId);
  if (!ver) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  return clone(ver);
}

export async function fakeRestoreVersion(
  templateId: string,
  versionId: string,
  body: RestoreTemplateVersionDto,
  ifMatch: string,
): Promise<RestoreTemplateVersionResponse> {
  await fakeDelay();
  const def = findDefinitionOrThrow(templateId);
  if (def.lifecycleStatus === 'ARCHIVED') {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DEFINITION.ARCHIVED');
  }
  const draft = STORE.drafts.get(templateId);
  if (!draft) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');

  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== draft.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }

  const ver = (STORE.versions.get(templateId) ?? []).find((v) => v.templateVersionId === versionId);
  if (!ver) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  if (def.currentPublishedVersion?.templateVersionId === versionId && !body.discardCurrentDraft) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.VERSION.RESTORE_CURRENT');
  }
  if (!body.discardCurrentDraft && draft.contentChecksum !== ver.templateContentChecksum) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DRAFT.DISCARD_CONFIRMATION_REQUIRED');
  }

  const now = new Date().toISOString();
  draft.editorDocument = clone(ver.editorDocument);
  draft.revision += 1;
  draft.etag = `"${draft.revision}"`;
  draft.restoreSourceVersionId = versionId;
  draft.contentChecksum = pseudoSha256(`restored:${templateId}:${draft.revision}`);
  draft.validation = {
    ...draft.validation,
    state: 'STALE',
    validatedDraftRevision: null,
    // Backend: an edit unlinks the run (fk_template_drafts_last_validation), so a STALE draft has no run and 0/0 counts.
    lastValidationRunId: null,
    errorCount: 0,
    warningCount: 0,
  };
  draft.updatedAt = now;

  def.currentDraft = {
    draftId: draft.draftId,
    revision: draft.revision,
    contentChecksum: draft.contentChecksum,
    validationState: 'STALE',
    etag: draft.etag,
  };
  def.updatedAt = now;

  return {
    draft: clone(draft),
    migrationRecovery: null,
  };
}

export async function fakeRetireVersion(
  templateId: string,
  versionId: string,
  ifMatch: string,
): Promise<RetireTemplateVersionResponse> {
  await fakeDelay();
  const def = findDefinitionOrThrow(templateId);
  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== def.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  if (def.currentPublishedVersion?.templateVersionId === versionId) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.VERSION.RETIRE_CURRENT');
  }
  const ver = (STORE.versions.get(templateId) ?? []).find((v) => v.templateVersionId === versionId);
  if (!ver) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  if (ver.lifecycleStatus === 'RETIRED') {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.VERSION.RETIRED');
  }

  const now = new Date().toISOString();
  ver.lifecycleStatus = 'RETIRED';
  ver.retiredAt = now;
  ver.retiredBy = AUTHOR_USER;
  def.revision += 1;
  def.etag = `"${def.revision}"`;
  def.updatedAt = now;

  return {
    version: clone(ver),
    definitionRevision: def.revision,
    definitionEtag: def.etag,
  };
}

export async function fakeListRecoverySnapshots(
  templateId: string,
  query: TemplateRecoverySnapshotsQuery = {},
): Promise<TemplateCursorPage<TemplateRecoverySnapshotItem>> {
  await fakeDelay(120);
  findDefinitionOrThrow(templateId);
  const items = (STORE.recoverySnapshots.get(templateId) ?? []).map((record) => record.item);
  return paginateByCursor(items, (item) => item.snapshotId, query.cursor, query.limit ?? 20);
}

export async function fakeRestoreRecoverySnapshot(
  templateId: string,
  snapshotId: string,
  body: RestoreRecoverySnapshotDto,
  ifMatch: string,
): Promise<RestoreRecoverySnapshotResponse> {
  await fakeDelay();
  const def = findDefinitionOrThrow(templateId);
  if (def.lifecycleStatus === 'ARCHIVED') {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DEFINITION.ARCHIVED');
  }
  const draft = STORE.drafts.get(templateId);
  if (!draft) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');

  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== draft.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }

  const record = (STORE.recoverySnapshots.get(templateId) ?? []).find((r) => r.item.snapshotId === snapshotId);
  if (!record) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  if (record.item.restoredAt !== null) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_ALREADY_RESTORED');
  }
  if (record.item.integrityStatus === 'QUARANTINED') {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_INTEGRITY_FAILED');
  }
  if (record.item.snapshotChecksum !== body.expectedSnapshotChecksum) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_STALE');
  }

  const now = new Date().toISOString();
  draft.editorDocument = clone(record.document);
  draft.revision += 1;
  draft.etag = `"${draft.revision}"`;
  draft.contentChecksum = pseudoSha256(`recovery-restore:${templateId}:${draft.revision}`);
  draft.validation = {
    ...draft.validation,
    state: 'STALE',
    validatedDraftRevision: null,
    // Backend: an edit unlinks the run (fk_template_drafts_last_validation), so a STALE draft has no run and 0/0 counts.
    lastValidationRunId: null,
    errorCount: 0,
    warningCount: 0,
  };
  draft.updatedAt = now;

  record.item.restoredAt = now;
  record.item.restoredBy = AUTHOR_USER;
  record.item.restoredToDraftRevision = draft.revision;

  def.currentDraft = {
    draftId: draft.draftId,
    revision: draft.revision,
    contentChecksum: draft.contentChecksum,
    validationState: 'STALE',
    etag: draft.etag,
  };
  def.updatedAt = now;

  return {
    draft: clone(draft),
    migrationRecovery: null,
    recoveredFrom: clone(record.item),
    replacedDraftRecovery: null,
  };
}

/** §10 Assets. */
export async function fakeListAssets(query: TemplateAssetsListQuery = {}): Promise<TemplateCursorPage<TemplateAssetDto>> {
  await fakeDelay(120);
  const search = query.search?.trim().toLowerCase() ?? '';
  const filtered = STORE.assets.filter((asset) => {
    if (query.scope === 'REUSABLE' && asset.definitionId !== null) return false;
    if (query.scope === 'DEFINITION' && asset.definitionId !== query.definitionId) return false;
    if (query.assetType && asset.assetType !== query.assetType) return false;
    if (query.deliveryClass && asset.deliveryClass !== query.deliveryClass) return false;
    if (query.status && asset.status !== query.status) return false;
    if (search && !asset.originalFileName.toLowerCase().includes(search)) return false;
    return true;
  });

  const sort = query.sort ?? 'createdAt:desc';
  const sorted = filtered.slice().sort((a, b) => {
    switch (sort) {
      case 'createdAt:asc':
        return a.createdAt.localeCompare(b.createdAt);
      case 'fileName:asc':
        return a.originalFileName.localeCompare(b.originalFileName);
      case 'fileName:desc':
        return b.originalFileName.localeCompare(a.originalFileName);
      case 'createdAt:desc':
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });

  return paginateByCursor(sorted, (a) => a.assetId, query.cursor, query.limit ?? 25);
}

export async function fakeGetAsset(assetId: string): Promise<TemplateAssetDetailResponse> {
  await fakeDelay(100);
  const asset = STORE.assets.find((a) => a.assetId === assetId);
  if (!asset) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');

  return {
    asset: clone(asset),
    delivery:
      asset.status === 'ACTIVE'
        ? { kind: 'SAME_ORIGIN_AUTHENTICATED_READ', url: `/api/tenant/core/v1/templates/assets/${asset.assetId}/content` }
        : { kind: 'UNAVAILABLE', reason: 'RETIRED' },
  };
}

export async function fakeGetAssetContent(assetId: string): Promise<Blob> {
  await fakeDelay(80);
  const asset = STORE.assets.find((a) => a.assetId === assetId);
  if (!asset) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  return makeAssetBlob(asset);
}

export async function fakeUploadAsset(
  request: UploadTemplateAssetRequest,
  idempotencyKey: string,
): Promise<UploadTemplateAssetResponse> {
  await fakeDelay();
  const idemKey = `upload-asset:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as UploadTemplateAssetResponse);
  }

  const { metadata, file } = request;
  if (metadata.deliveryClass === 'EMAIL_PUBLIC' && metadata.confirmPublicEmailDelivery !== true) {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.ASSET.EMAIL_PUBLIC_NOT_ALLOWED');
  }
  if (!/^[a-f0-9]{64}$/i.test(metadata.expectedRawSha256)) {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.ASSET.CHECKSUM_MISMATCH');
  }

  const now = new Date().toISOString();
  const assetId = uuidv7();
  const asset: TemplateAssetDto = {
    assetId,
    definitionId: metadata.definitionId ?? null,
    assetType: metadata.assetType,
    originalFileName: metadata.fileName || file.name,
    mimeType: metadata.declaredMimeType === 'image/webp' ? 'image/png' : metadata.declaredMimeType,
    sizeBytes: file.size || 16384,
    widthPx: 640,
    heightPx: 320,
    checksum: metadata.expectedRawSha256.toLowerCase(),
    deliveryClass: metadata.deliveryClass,
    emailRendition:
      metadata.deliveryClass === 'EMAIL_PUBLIC'
        ? { kind: 'READY', checksum: pseudoSha256(`email-rendition:${assetId}`) }
        : { kind: 'NOT_REQUESTED' },
    status: 'ACTIVE',
    revision: 1,
    etag: `"asset:${assetId}:1"`,
    createdAt: now,
    createdBy: AUTHOR_USER,
    updatedAt: now,
    updatedBy: AUTHOR_USER,
  };

  STORE.assets.unshift(asset);
  const response: UploadTemplateAssetResponse = {
    asset: clone(asset),
    delivery: {
      kind: 'SAME_ORIGIN_AUTHENTICATED_READ',
      url: `/api/tenant/core/v1/templates/assets/${asset.assetId}/content`,
    },
  };
  STORE.idempotency.set(idemKey, clone(response));
  return response;
}

export async function fakeRetireAsset(assetId: string, ifMatch: string): Promise<void> {
  await fakeDelay();
  const asset = STORE.assets.find((a) => a.assetId === assetId);
  if (!asset) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  if (asset.etag !== ifMatch.trim()) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }

  // Check if any retained published version references this asset
  for (const versionList of STORE.versions.values()) {
    const used = versionList.some(
      (v) => v.lifecycleStatus === 'PUBLISHED' && v.assetManifest.some((ref) => ref.assetId === assetId),
    );
    if (used) {
      throw new TemplateApiError(409, 'CORE.TEMPLATE.ASSET.IN_USE');
    }
  }

  asset.status = 'RETIRED';
  asset.revision += 1;
  asset.etag = `"asset:${asset.assetId}:${asset.revision}"`;
  asset.updatedAt = new Date().toISOString();
}

/** §11 Assignments. */
/** Mirrors backend PRODUCTION_ASSIGNABLE_TEMPLATE_TUPLES (template-assignment-policy.ts). */
const PRODUCTION_ASSIGNABLE_TUPLES: readonly {
  adapterKey: TemplateDataSourceKey;
  documentType: TemplateDocumentType;
  outputChannel: 'PRINT' | 'EMAIL';
}[] = [
  { adapterKey: 'TRADE_QUOTATION_PRINT_V1', documentType: 'QUOTATION', outputChannel: 'PRINT' },
  { adapterKey: 'TRADE_SALES_ORDER_PRINT_V1', documentType: 'SALES_ORDER', outputChannel: 'PRINT' },
  { adapterKey: 'TRADE_PURCHASE_ORDER_PRINT_V1', documentType: 'PURCHASE_ORDER', outputChannel: 'PRINT' },
  { adapterKey: 'TRADE_PURCHASE_QUOTATION_PRINT_V1', documentType: 'PURCHASE_QUOTATION', outputChannel: 'PRINT' },
  { adapterKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1', documentType: 'CRM_OUTBOUND_EMAIL', outputChannel: 'EMAIL' },
  { adapterKey: 'CRM_CUSTOMER_OUTBOUND_EMAIL_V1', documentType: 'CRM_OUTBOUND_EMAIL', outputChannel: 'EMAIL' },
  { adapterKey: 'CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1', documentType: 'CRM_OUTBOUND_EMAIL', outputChannel: 'EMAIL' },
];

function isProductionAssignableAdapterKey(adapterKey: string): boolean {
  return PRODUCTION_ASSIGNABLE_TUPLES.some((tuple) => tuple.adapterKey === adapterKey);
}

function withProductionAssignment<T extends { adapterKey: TemplateDataSourceKey }>(
  item: T,
): T & { productionAssignmentEnabled: boolean; productionDisabledReason: 'OWNER_RUNTIME_UNAVAILABLE' | null } {
  const enabled = isProductionAssignableAdapterKey(item.adapterKey);
  return { ...item, productionAssignmentEnabled: enabled, productionDisabledReason: enabled ? null : 'OWNER_RUNTIME_UNAVAILABLE' };
}

/** Backend assertProductionAssignment: 422 CORE.TEMPLATE.ASSIGNMENT.OWNER_RUNTIME_UNAVAILABLE. */
function assertProductionAssignment(adapterKey: string): void {
  if (!isProductionAssignableAdapterKey(adapterKey)) {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.ASSIGNMENT.OWNER_RUNTIME_UNAVAILABLE');
  }
}

function isAssignmentTupleCompatible(body: {
  adapterKey: TemplateDataSourceKey;
  documentType: TemplateDocumentType;
  outputChannel: string;
}): boolean {
  return PRODUCTION_ASSIGNABLE_TUPLES.some(
    (tuple) =>
      tuple.adapterKey === body.adapterKey &&
      tuple.documentType === body.documentType &&
      tuple.outputChannel === body.outputChannel,
  );
}

function buildAssignmentImpact(scope: TemplateScopeRef, locale: TemplateLocale | null): TemplateAssignmentImpact {
  return {
    effectiveNow: true,
    affectedSelectors: [
      {
        scope: clone(scope),
        locale,
        previousEpoch: pseudoSha256('epoch-prev'),
        assignmentEpoch: pseudoSha256(`epoch:${Date.now()}`),
      },
    ],
  };
}

export async function fakeListAssignments(
  query: TemplateAssignmentsListQuery,
): Promise<TemplateCursorPage<TemplateAssignmentDto>> {
  await fakeDelay(120);
  const target: TemplateScopeRef =
    query.scopeType === 'BRANCH'
      ? { type: 'BRANCH', companyId: query.companyId ?? COMPANY_NILE_ID, branchId: query.branchId ?? BRANCH_CAIRO_ID }
      : query.scopeType === 'COMPANY'
        ? { type: 'COMPANY', companyId: query.companyId ?? COMPANY_NILE_ID }
        : { type: 'TENANT' };

  const filtered = STORE.assignments.filter((a) => {
    if (!scopeMatchesTarget(a.scope, target)) return false;
    if (query.documentType && a.documentType !== query.documentType) return false;
    if (query.outputChannel && a.outputChannel !== query.outputChannel) return false;
    if (query.adapterKey && a.adapterKey !== query.adapterKey) return false;
    if (query.status && a.status !== query.status) return false;
    if (query.versionId && a.versionId !== query.versionId) return false;
    if (query.locale) {
      if (query.locale === 'DEFAULT' && a.locale !== null) return false;
      if (query.locale !== 'DEFAULT' && a.locale !== query.locale) return false;
    }
    if (query.effectiveAt) {
      if (a.effectiveFrom > query.effectiveAt) return false;
      if (a.effectiveTo !== null && a.effectiveTo <= query.effectiveAt) return false;
    }
    return true;
  });

  const sorted = filtered.slice().sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return paginateByCursor(sorted, (a) => a.assignmentId, query.cursor, query.limit ?? 25);
}

export async function fakeGetAssignment(assignmentId: string): Promise<TemplateAssignmentDto> {
  await fakeDelay(100);
  const found = STORE.assignments.find((a) => a.assignmentId === assignmentId);
  if (!found) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  return clone(found);
}

export async function fakeCreateAssignment(
  body: CreateTemplateAssignmentDto,
  idempotencyKey: string,
): Promise<TemplateAssignmentWriteResponse> {
  await fakeDelay();
  const idemKey = `create-assignment:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as TemplateAssignmentWriteResponse);
  }

  assertProductionAssignment(body.adapterKey);
  if (!isAssignmentTupleCompatible(body)) {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.ASSIGNMENT.VERSION_INCOMPATIBLE');
  }
  if (body.effectiveTo && body.effectiveTo <= body.effectiveFrom) {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.ASSIGNMENT.CONFLICT');
  }

  let matchedVersion: TemplateVersionDetail | null = null;
  for (const list of STORE.versions.values()) {
    const found = list.find((v) => v.templateVersionId === body.versionId);
    if (found) {
      matchedVersion = found;
      break;
    }
  }
  if (!matchedVersion || matchedVersion.lifecycleStatus !== 'PUBLISHED') {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.ASSIGNMENT.VERSION_INCOMPATIBLE');
  }

  const def = findDefinitionOrThrow(matchedVersion.templateDefinitionId);
  const normalizedBodyScope = normalizeScopeAlias(body.scope);
  const normalizedDefScope =
    def.scope.type === 'COMPANY'
      ? { type: 'COMPANY' as const, companyId: normalizeCompanyIdAlias(def.scope.companyId) }
      : def.scope;
  if (normalizedDefScope.type === 'COMPANY') {
    const targetCompanyId = normalizedBodyScope.type === 'TENANT' ? null : normalizedBodyScope.companyId;
    if (targetCompanyId !== normalizedDefScope.companyId) {
      throw new TemplateApiError(422, 'CORE.TEMPLATE.ASSIGNMENT.SCOPE_INVALID');
    }
  }

  const now = new Date().toISOString();
  const created: TemplateAssignmentDto = {
    assignmentId: uuidv7(),
    definitionId: def.templateId,
    versionId: matchedVersion.templateVersionId,
    versionNumber: matchedVersion.versionNumber,
    documentType: body.documentType,
    outputChannel: body.outputChannel,
    adapterKey: body.adapterKey,
    locale: body.locale,
    scope: clone(normalizedBodyScope),
    priority: body.priority,
    isDefault: body.isDefault,
    effectiveFrom: body.effectiveFrom,
    effectiveTo: body.effectiveTo,
    status: 'ACTIVE',
    revision: 1,
    etag: '"1"',
    createdAt: now,
    createdBy: AUTHOR_USER,
    updatedAt: now,
    updatedBy: AUTHOR_USER,
  };

  STORE.assignments.unshift(created);
  const response: TemplateAssignmentWriteResponse = {
    assignment: clone(created),
    impact: buildAssignmentImpact(created.scope, created.locale),
  };
  STORE.idempotency.set(idemKey, clone(response));
  return response;
}

export async function fakePatchAssignment(
  assignmentId: string,
  patch: PatchTemplateAssignmentDto,
  ifMatch: string,
): Promise<TemplateAssignmentWriteResponse> {
  await fakeDelay();
  const assignment = STORE.assignments.find((a) => a.assignmentId === assignmentId);
  if (!assignment) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');

  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== assignment.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  if ((patch.status ?? assignment.status) === 'ACTIVE') {
    assertProductionAssignment(assignment.adapterKey);
  }

  if (patch.versionId !== undefined) {
    let ver: TemplateVersionDetail | null = null;
    for (const list of STORE.versions.values()) {
      const match = list.find((v) => v.templateVersionId === patch.versionId);
      if (match) {
        ver = match;
        break;
      }
    }
    if (!ver || ver.lifecycleStatus !== 'PUBLISHED') {
      throw new TemplateApiError(422, 'CORE.TEMPLATE.ASSIGNMENT.VERSION_INCOMPATIBLE');
    }
    assignment.versionId = ver.templateVersionId;
    assignment.versionNumber = ver.versionNumber;
  }
  if (patch.priority !== undefined) assignment.priority = patch.priority;
  if (patch.isDefault !== undefined) assignment.isDefault = patch.isDefault;
  if (patch.effectiveFrom !== undefined) assignment.effectiveFrom = patch.effectiveFrom;
  if (patch.effectiveTo !== undefined) assignment.effectiveTo = patch.effectiveTo;
  if (patch.status !== undefined) assignment.status = patch.status;

  if (assignment.effectiveTo && assignment.effectiveTo <= assignment.effectiveFrom) {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.ASSIGNMENT.CONFLICT');
  }

  assignment.revision += 1;
  assignment.etag = `"${assignment.revision}"`;
  assignment.updatedAt = new Date().toISOString();

  return {
    assignment: clone(assignment),
    impact: buildAssignmentImpact(assignment.scope, assignment.locale),
  };
}

export async function fakeDeactivateAssignment(assignmentId: string, ifMatch: string): Promise<void> {
  await fakeDelay();
  const assignment = STORE.assignments.find((a) => a.assignmentId === assignmentId);
  if (!assignment) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  const expectedRev = parseIfMatchRevision(ifMatch);
  if (expectedRev !== assignment.revision) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION');
  }
  if (assignment.status !== 'INACTIVE') {
    assignment.status = 'INACTIVE';
    assignment.revision += 1;
    assignment.etag = `"${assignment.revision}"`;
    assignment.updatedAt = new Date().toISOString();
  }
}

export async function fakeResolveAssignment(
  body: ResolveTemplateAssignmentRequestDto,
): Promise<ResolveTemplateAssignmentResponseDto> {
  await fakeDelay(140);
  const now = body.businessTime ?? new Date().toISOString();
  const scopeRank = (s: TemplateScopeRef): number => (s.type === 'BRANCH' ? 3 : s.type === 'COMPANY' ? 2 : 1);

  const eligible = STORE.assignments
    .filter((a) => {
      if (a.status !== 'ACTIVE' || !a.isDefault) return false;
      if (a.documentType !== body.documentType || a.outputChannel !== body.outputChannel || a.adapterKey !== body.adapterKey) {
        return false;
      }
      if (!scopeMatchesTarget(a.scope, body.scope)) return false;
      if (a.locale !== null && a.locale !== body.locale) return false;
      if (a.effectiveFrom > now) return false;
      if (a.effectiveTo !== null && a.effectiveTo <= now) return false;
      return true;
    })
    .sort((a, b) => {
      const aExact = a.locale === body.locale ? 1 : 0;
      const bExact = b.locale === body.locale ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      const sDiff = scopeRank(b.scope) - scopeRank(a.scope);
      if (sDiff !== 0) return sDiff;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.assignmentId.localeCompare(b.assignmentId);
    });

  const winner = eligible[0] ?? null;
  let chosen: ResolveTemplateAssignmentResponseDto['chosen'] = null;
  if (winner) {
    const version = (STORE.versions.get(winner.definitionId) ?? []).find((v) => v.templateVersionId === winner.versionId);
    if (version) {
      chosen = {
        assignmentId: winner.assignmentId,
        matchedScope: clone(winner.scope),
        localeMatch: winner.locale === body.locale ? 'EXACT' : 'DEFAULT',
        priority: winner.priority,
        version: {
          templateDefinitionId: version.templateDefinitionId,
          templateVersionId: version.templateVersionId,
          versionNumber: version.versionNumber,
          documentType: version.documentType,
          outputChannel: version.outputChannel,
          layoutMode: version.layoutMode,
          locale: version.locale,
          direction: version.direction,
          dataSourceKey: version.dataSourceKey,
          dataSourceSchemaVersion: version.dataSourceSchemaVersion,
          dataSourceSchemaChecksum: version.dataSourceSchemaChecksum,
          templateContentChecksum: version.templateContentChecksum,
          compiledChecksum: version.compiledChecksum,
          compilerFingerprint: version.compilerFingerprint,
          lifecycleStatus: version.lifecycleStatus,
          publishedAt: version.publishedAt,
        },
      };
    }
  }

  return {
    evaluatedAt: now,
    selector: {
      scope: clone(body.scope),
      documentType: body.documentType,
      outputChannel: body.outputChannel,
      adapterKey: body.adapterKey,
      locale: body.locale,
    },
    chosen,
    eligibleCandidateCount: chosen ? 1 : 0,
    orderedSelectorEpochs: [
      {
        selectorFingerprintPrefix: pseudoSha256(`${body.documentType}:${body.locale}`).slice(0, 12),
        assignmentEpoch: pseudoSha256(`epoch:${now}`),
      },
    ],
    receiptChecksum: pseudoSha256(`resolve:${body.adapterKey}:${now}`),
  };
}

/** §12 Preview (HTML / Email / PDF) & Jobs. */
function resolvePreviewSource(
  templateId: string,
  source: TemplateHtmlOrEmailPreviewRequestDto['source'],
): {
  resolved: { kind: 'DRAFT'; draftId: string; draftRevision: number } | { kind: 'VERSION'; versionId: string; versionNumber: number };
  contentChecksum: string;
} {
  const def = findDefinitionOrThrow(templateId);
  if (def.lifecycleStatus === 'ARCHIVED') {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.DEFINITION.ARCHIVED');
  }
  if (source.kind === 'DRAFT') {
    const draft = STORE.drafts.get(templateId);
    if (!draft) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
    if (draft.revision !== source.draftRevision) {
      throw new TemplateApiError(409, 'CORE.TEMPLATE.PREVIEW.SOURCE_STALE');
    }
    if (draft.validation.state === 'FAILED') {
      throw new TemplateApiError(422, 'CORE.TEMPLATE.VALIDATION.FAILED');
    }
    return {
      resolved: { kind: 'DRAFT', draftId: draft.draftId, draftRevision: draft.revision },
      contentChecksum: draft.contentChecksum,
    };
  }
  const version = (STORE.versions.get(templateId) ?? []).find((v) => v.templateVersionId === source.versionId);
  if (!version) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  return {
    resolved: { kind: 'VERSION', versionId: version.templateVersionId, versionNumber: version.versionNumber },
    contentChecksum: version.templateContentChecksum,
  };
}

function buildQuotationPreviewHtml(locale: TemplateLocale): string {
  const isAr = locale === 'ar-EG';
  const dir = isAr ? 'rtl' : 'ltr';
  return `<!doctype html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${dir}">
<head><meta charset="utf-8"><style>
body{margin:0;padding:24px;font-family:sans-serif;background:#fff;color:#12141c;font-size:12px}
.band{height:6px;background:#0b7a85;margin-bottom:16px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.title{font-size:20px;font-weight:700;color:#0b7a85}
.pill{display:inline-block;padding:2px 8px;background:#e6f4f5;color:#0f2f78;border-radius:4px;font-weight:600}
table{width:100%;border-collapse:collapse;margin-top:16px}
th{background:#0b7a85;color:#fff;padding:6px 8px;text-align:start;font-size:11px}
td{border-bottom:1px solid #e4e7ec;padding:6px 8px}
.num{text-align:end;direction:ltr}
.totals{width:240px;margin-inline-start:auto;margin-top:16px}
.grand{background:#0b7a85;color:#fff;font-weight:700}
.wm{margin-top:20px;font-size:10px;color:#8b90a3;text-align:center}
</style></head>
<body>
<div class="band"></div>
<div class="hdr">
  <div><strong>${isAr ? 'نايل لتجهيزات المكاتب' : 'Nile Office Furnishings'}</strong><br>${isAr ? '14 شارع التحرير، الدقي، الجيزة، مصر' : '14 El Tahrir Street, Dokki, Giza, Egypt'}<br>+20 2 5550 0148 · sales@nileoffice.example.invalid</div>
  <div style="text-align:end"><div class="title">${isAr ? 'عرض سعر' : 'QUOTATION'}</div><div class="pill">QT-2026-0148</div><div>${isAr ? 'التاريخ: 2026-11-04' : 'Date: Nov 4, 2026 · Valid until: Dec 4, 2026'}</div></div>
</div>
<div><strong>${isAr ? 'مُعد إلى:' : 'Prepared for:'}</strong> ${isAr ? 'نايل لحلول الأعمال · مايا حسن (CUS-0042)' : 'Nile Business Solutions · Contact: Maya Hassan (CUS-0042)'}</div>
<table>
  <thead><tr><th>${isAr ? 'الصنف' : 'Item'}</th><th class="num">${isAr ? 'الكمية' : 'Qty'}</th><th>${isAr ? 'الوحدة' : 'Unit'}</th><th class="num">${isAr ? 'السعر' : 'Unit price'}</th><th class="num">${isAr ? 'الخصم' : 'Discount'}</th><th class="num">${isAr ? 'الصافي' : 'Net'}</th><th class="num">${isAr ? 'الضريبة 14%' : 'VAT 14%'}</th><th class="num">${isAr ? 'الإجمالي' : 'Line total'}</th></tr></thead>
  <tbody>
    <tr><td>${isAr ? 'كرسي مكتب مريح' : 'Ergonomic chair'}</td><td class="num">12</td><td>${isAr ? 'قطعة' : 'pcs'}</td><td class="num">3,250.00</td><td class="num">1,950.00</td><td class="num">37,050.00</td><td class="num">5,187.00</td><td class="num">42,237.00</td></tr>
    <tr><td>${isAr ? 'مكتب تنفيذي' : 'Executive desk'}</td><td class="num">6</td><td>${isAr ? 'قطعة' : 'pcs'}</td><td class="num">7,800.00</td><td class="num">0.00</td><td class="num">46,800.00</td><td class="num">6,552.00</td><td class="num">53,352.00</td></tr>
    <tr><td>${isAr ? 'طقم تنظيم الكابلات' : 'Cable kit'}</td><td class="num">18</td><td>${isAr ? 'قطعة' : 'pcs'}</td><td class="num">450.00</td><td class="num">810.00</td><td class="num">7,290.00</td><td class="num">1,020.60</td><td class="num">8,310.60</td></tr>
  </tbody>
</table>
<table class="totals">
  <tr><td>${isAr ? 'الإجمالي قبل الخصم' : 'Gross'}</td><td class="num">93,900.00</td></tr>
  <tr><td>${isAr ? 'الخصم' : 'Discount'}</td><td class="num">2,760.00</td></tr>
  <tr><td>${isAr ? 'الصافي' : 'Net'}</td><td class="num">91,140.00</td></tr>
  <tr><td>${isAr ? 'ضريبة القيمة المضافة 14%' : 'VAT 14%'}</td><td class="num">12,759.60</td></tr>
  <tr class="grand"><td>${isAr ? 'الإجمالي النهائي' : 'Grand total'}</td><td class="num">EGP 103,899.60</td></tr>
</table>
<div class="wm">NON-PRODUCTION PREVIEW</div>
</body></html>`;
}

export async function fakePreviewHtml(
  templateId: string,
  body: TemplateHtmlOrEmailPreviewRequestDto,
): Promise<TemplateHtmlPreviewResponseDto> {
  await fakeDelay();
  const def = findDefinitionOrThrow(templateId);
  if (def.outputChannel !== 'PRINT') {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.LAYOUT.INCOMPATIBLE');
  }
  const src = resolvePreviewSource(templateId, body.source);
  const html = buildQuotationPreviewHtml(body.locale);
  return {
    templateId,
    source: src.resolved,
    templateContentChecksum: src.contentChecksum,
    compiledArtifactChecksum: pseudoSha256(`compiled:${src.contentChecksum}`),
    kind: 'HTML',
    renderTarget: 'HTML',
    html,
    outputChecksum: pseudoSha256(html),
    warnings: [],
  };
}

export async function fakePreviewEmail(
  templateId: string,
  body: TemplateHtmlOrEmailPreviewRequestDto,
): Promise<TemplateEmailPreviewResponseDto> {
  await fakeDelay();
  const def = findDefinitionOrThrow(templateId);
  if (def.outputChannel !== 'EMAIL') {
    throw new TemplateApiError(422, 'CORE.TEMPLATE.LAYOUT.INCOMPATIBLE');
  }
  const src = resolvePreviewSource(templateId, body.source);
  const isAr = body.locale === 'ar-EG';
  const subject = isAr ? 'استفسارك عن تجهيز مساحة العمل' : 'Your office workspace enquiry';
  const preheader = isAr ? 'متابعة سريعة من فريق متكامل.' : 'A short follow-up from your Mutakamel team.';
  const textBody = isAr
    ? 'مرحباً مايا، شكراً لاهتمامك بحلولنا لمساحات العمل. ستساعدك سارة في اختيار تجهيزات المكتب المناسبة لفريقك.'
    : 'Hello Maya, Thank you for your interest in our workspace solutions. Sara will help you select the right office equipment for your team.';
  const html = `<!doctype html><html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}"><body style="margin:0;padding:24px;background:#fff;font-family:sans-serif;color:#12141c"><h2>${subject}</h2><p>${textBody}</p><p style="font-size:11px;color:#8b90a3">NON-PRODUCTION PREVIEW</p></body></html>`;

  return {
    templateId,
    source: src.resolved,
    templateContentChecksum: src.contentChecksum,
    compiledArtifactChecksum: pseudoSha256(`compiled:${src.contentChecksum}`),
    kind: 'EMAIL',
    renderTarget: 'EMAIL',
    subject,
    preheader,
    html,
    text: `${subject}\n\n${textBody}`,
    outputChecksum: pseudoSha256(html),
    warnings: [],
  };
}

export async function fakePreviewPdf(
  templateId: string,
  body: TemplatePdfPreviewRequestDto,
  idempotencyKey: string,
): Promise<TemplatePdfPreviewAcceptedDto> {
  await fakeDelay();
  const idemKey = `preview-pdf:${templateId}:${idempotencyKey}`;
  if (STORE.idempotency.has(idemKey)) {
    return clone(STORE.idempotency.get(idemKey) as TemplatePdfPreviewAcceptedDto);
  }

  const def = findDefinitionOrThrow(templateId);
  const src = resolvePreviewSource(templateId, body.source);
  const jobId = uuidv7();
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 60 * 1000);
  const outputProfile =
    body.outputProfile ?? (def.outputChannel === 'EMAIL' ? 'EMAIL_PRINT_PROJECTION' : 'DOCUMENT_PRINT');
  const compiledChecksum = pseudoSha256(`compiled:${src.contentChecksum}`);

  const job: TemplatePdfJobDto = {
    templateId,
    source: src.resolved,
    templateContentChecksum: src.contentChecksum,
    compiledArtifactChecksum: compiledChecksum,
    renderJobId: jobId,
    renderTarget: 'PDF',
    attemptCount: 1,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    lifecycleRevision: 1,
    status: 'PENDING',
    nextRetryAt: null,
    failure: null,
    artifact: null,
    outputProfile,
  };
  STORE.pdfJobs.set(jobId, job);

  const accepted: TemplatePdfPreviewAcceptedDto = {
    templateId,
    source: src.resolved,
    templateContentChecksum: src.contentChecksum,
    compiledArtifactChecksum: compiledChecksum,
    kind: 'PDF_ACCEPTED',
    renderTarget: 'PDF',
    outputProfile,
    renderJobId: jobId,
    status: 'PENDING',
    location: `/api/tenant/core/v1/templates/preview-jobs/${jobId}`,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  STORE.idempotency.set(idemKey, clone(accepted));
  return accepted;
}

export async function fakeGetPreviewJob(jobId: string): Promise<TemplatePdfJobDto> {
  await fakeDelay(120);
  const job = STORE.pdfJobs.get(jobId);
  if (!job) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');

  // Progress PENDING jobs to COMPLETED on poll to simulate worker completion.
  if (job.status === 'PENDING' || job.status === 'RESOLVING_SOURCE') {
    const now = new Date();
    const expires = new Date(now.getTime() + 60 * 60 * 1000);
    job.status = 'COMPLETED';
    job.lifecycleRevision += 1;
    job.artifact = {
      downloadUrl: `/api/tenant/core/v1/templates/preview-jobs/${job.renderJobId}/artifact`,
      downloadUrlExpiresAt: expires.toISOString(),
      checksum: pseudoSha256(`pdf-artifact:${job.renderJobId}`),
      sizeBytes: 84210,
      pageCount: 1,
      rendererVersion: 'chromium-130.0',
      browserBuildFingerprint: 'headless-pdf-mvp-v1',
      createdAt: now.toISOString(),
      layoutReceiptChecksum: pseudoSha256(`receipt:${job.renderJobId}`),
      layoutProof: {
        checksum: pseudoSha256(`proof:${job.renderJobId}`),
        pageCount: 1,
        downloadPath: `/api/tenant/core/v1/templates/preview-jobs/${job.renderJobId}/layout-receipt`,
      },
      pdfPackagingPolicyVersion: '1.0',
      pdfPackagingFingerprint: 'pdf-pack-v1',
    };
  }
  return clone(job);
}

export async function fakeGetPreviewJobArtifact(jobId: string): Promise<Blob> {
  await fakeDelay(100);
  const job = STORE.pdfJobs.get(jobId);
  if (!job) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  if (job.status !== 'COMPLETED' || !job.artifact) {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.PREVIEW.ARTIFACT_NOT_READY');
  }
  const minimalPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF';
  return new Blob([minimalPdf], { type: 'application/pdf' });
}

export async function fakeGetPreviewJobLayoutReceipt(jobId: string): Promise<TemplateLayoutReceiptV1> {
  await fakeDelay(100);
  const job = STORE.pdfJobs.get(jobId);
  if (!job) throw new TemplateApiError(404, 'CORE.TEMPLATE.NOT_FOUND');
  if (job.status !== 'COMPLETED') {
    throw new TemplateApiError(409, 'CORE.TEMPLATE.PREVIEW.ARTIFACT_NOT_READY');
  }
  return {
    layoutRuntimeChecksum: pseudoSha256(`layout-runtime:${jobId}`),
    geometryUnit: 'MM',
    pageLayoutMode: 'EXPLICIT',
    pages: [{ pageIndex: 0, width: 210, height: 297 }],
    fragments: [
      { nodeId: CORP_NODE_IDS.logo, pageIndex: 0, x: 18, y: 13, width: 38, height: 18 },
      { nodeId: CORP_NODE_IDS.itemsTable, pageIndex: 0, x: 12, y: 84, width: 186, height: 52 },
    ],
    fonts: ['Readex Pro'],
  };
}

export const FAKE_TEMPLATE_IDS = {
  corporateQuotationId: TPL_IDS.qtCorp,
  corporateValidationRunId: CORP_VALIDATION_RUN_ID,
  corporatePdfJobId: CORP_PDF_JOB_ID,
  corporateRecoverySnapshotId: CORP_SNAPSHOT_ID,
} as const;
