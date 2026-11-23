import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationCancel, NavigationEnd, NavigationError, Params, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowBackUp,
  tablerArrowLeft,
  tablerCircleX,
  tablerClipboardCheck,
  tablerFileSearch,
  tablerFileText,
  tablerHistory,
  tablerListDetails,
  tablerLock,
  tablerRefresh,
  tablerShoppingCart,
  tablerTarget,
} from '@ng-icons/tabler-icons';
import { filter } from 'rxjs';
import { CurrentUser } from '../../../../core/auth/current-user';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { NotFoundPage } from '../../../../layout/not-found/not-found-page';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog, type ConfirmTone } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../shared/ui/date-time/time-field';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { SectionBar } from '../../../../shared/ui/section-bar/section-bar';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { branchGrants } from '../../shared/trade-access';
import { ApiError } from '../../shared/trade-api';
import { formatDate } from '../../shared/trade-format';
import { itemName, listReasons } from '../../shared/trade-foundation.api';
import type { ReasonCode, ReasonKind } from '../../shared/trade-foundation.model';
import { ActionBar } from '../document-actions/action-bar/action-bar';
import { ApprovalLine } from '../document-actions/approval-line/approval-line';
import { DeliveryStatus } from '../document-actions/delivery-status/delivery-status';
import { type DocAction, type ResolvedAction, resolveActions } from '../document-actions/document-actions';
import { PriceLockChip } from '../document-actions/price-lock-chip/price-lock-chip';
import { ReasonDialog, type ReasonDialogResult } from '../document-actions/reason-dialog/reason-dialog';
import { DocumentLines } from '../document-lines/document-lines';
import { PrintDialog, type PrintSource } from '../document-print/print-dialog/print-dialog';
import type { CanLeaveDocumentPage } from '../documents.routes';
import { KIND_CONFIG, KindConfig } from '../shared/document-kinds';
import { STATUS_TONE_CLASSES, statusBadge } from '../shared/document-status';
import type {
  AnyDocumentDetail,
  DocumentKind,
  EditableLine,
  PurchaseOrderDetail,
  PurchaseQuotationDetail,
  QuotationDetail,
  QuotationRevision,
  ReasonHistoryEntry,
  SalesOrderDetail,
  SourceCrmOpportunity,
  TermSelections,
  TermsSnapshot,
  TotalsSnapshot,
} from '../shared/document.model';
import {
  type ReceivingNodeOption,
  embeddedSourceOpportunityOf,
  getDocument,
  injectDiscountPolicy,
  injectDocument,
  invalidateDocumentQueries,
  listReceivingNodes,
} from '../shared/documents.api';
import { DocumentRequestKeys } from '../shared/document-request-keys';
import { DOCUMENT_ACTION_PERMISSION_KEYS, runCommand } from './document-commands';
import {
  type DocumentDraft,
  type PageMode,
  currencyDecimalPlacesOf,
  draftFromPurchaseQuotation,
  draftFromQuotation,
  emptyDraft,
  extractNotes,
  extractTermSelections,
  isDirty,
  quotationChangeKind,
  toDraft,
  undoDraft,
} from './document-draft';
import { type SaveOutcome, saveDocument, validateDraft } from './document-save';
import { type CrmPrefillParams, HeaderFields, type HeaderFieldMode } from './header-fields/header-fields';
import { RevisionsPanel } from './revisions-panel/revisions-panel';
import { TERMS_NOTES_MAX_LENGTH, TermsSection } from './terms-section/terms-section';
import { TotalsPanel } from './totals-panel/totals-panel';
import { smoothScrollBehavior } from '../../../../shared/ui/scroll/scroll-into-view';
import { translationEvents } from '../../../../core/i18n/translation-events';

const NOT_FOUND_CODES = new Set([
  'TRADE.QUOTE.NOT_FOUND',
  'TRADE.SALES_ORDER.SOURCE_NOT_FOUND',
  'TRADE.PURCHASE_ORDER.NOT_FOUND',
  'TRADE.PURCHASE_QUOTATION.NOT_FOUND',
]);

const FIELD_ORDER: readonly string[] = [
  'partyId',
  'supplierPartyId',
  'supplierAccountId',
  'currencyCode',
  'priceBookId',
  'validUntil',
  'receivingNodeId',
  'pricingValue',
  'pricingReason',
  'paymentTermId',
  'notes',
];

interface CarriedPageState {
  targetId?: string;
  draft?: DocumentDraft;
  fieldErrors?: Record<string, string>;
  lineErrors?: Record<string, string>;
  lineErrorParams?: Record<string, Record<string, string>>;
  pendingOutcome?: SaveOutcome;
}

interface ConfirmDialogSpec {
  tone: ConfirmTone;
  titleKey: string;
  textKey: string;
  confirmKey: string;
  cancelKey: string;
}

interface ReasonDialogSpec {
  action: DocAction;
  reasonKind: ReasonKind;
  titleKey: string;
  textKey: string;
  confirmKey: string;
  danger: boolean;
}

function parseKind(raw: unknown): DocumentKind {
  if (raw === 'quotation' || raw === 'sales-order' || raw === 'purchase-order' || raw === 'purchase-quotation') {
    return raw;
  }
  return 'quotation';
}

function todayIsoDate(): string {
  const now = new Date();
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Component({
  selector: 'app-document-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    Badge,
    Button,
    ConfirmDialog,
    ConflictDialog,
    DateField,
    TimeField,
    Dropdown,
    Field,
    Modal,
    SectionBar,
    UnsavedDialog,
    NotFoundPage,
    ActionBar,
    ApprovalLine,
    DeliveryStatus,
    PriceLockChip,
    ReasonDialog,
    DocumentLines,
    PrintDialog,
    HeaderFields,
    TermsSection,
    TotalsPanel,
    RevisionsPanel,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-documents', alias: 'td' },
      { scope: 'trade-documents-page', alias: 'tdpg' },
      { scope: 'trade-documents-actions', alias: 'tda' },
      { scope: 'trade-documents-lines', alias: 'tdlines' },
    ),
    provideIcons({
      tablerArrowBackUp,
      tablerArrowLeft,
      tablerCircleX,
      tablerClipboardCheck,
      tablerFileSearch,
      tablerFileText,
      tablerHistory,
      tablerListDetails,
      tablerLock,
      tablerRefresh,
      tablerShoppingCart,
      tablerTarget,
    }),
  ],
  templateUrl: './document-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col p-12' },
})
export class DocumentPage implements CanLeaveDocumentPage {
  private static nextId = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly currentUser = inject(CurrentUser);
  private readonly transloco = inject(TranslocoService);
  // Deferred so a synchronous scope load never writes the signal while Angular renders (NG0600).
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lang = inject(LanguageState).current;

  private readonly headerFields = viewChild(HeaderFields);
  private readonly documentLines = viewChild(DocumentLines);
  private readonly termsSection = viewChild(TermsSection);
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);
  private readonly confirmDialog = viewChild.required(ConfirmDialog);
  private readonly soConfirmModal = viewChild<Modal>('soConfirmModal');
  private readonly directPoModal = viewChild<Modal>('directPoModal');

  protected readonly uid = `doc-page-${++DocumentPage.nextId}`;
  protected readonly todayIso = todayIsoDate();

  private readonly routeData = toSignal(this.route.data);
  private readonly paramMap = toSignal(this.route.paramMap);
  private readonly queryParamMap = toSignal(this.route.queryParamMap);

  protected readonly kind = computed<DocumentKind>(() => parseKind(this.routeData()?.['kind']));
  protected readonly kindConfig = computed<KindConfig>(() => KIND_CONFIG[this.kind()]);
  protected readonly docId = computed<string | null>(() => this.paramMap()?.get('id') ?? null);

  protected readonly fromQuotationId = computed<string | null>(() =>
    this.kind() === 'sales-order' && !this.docId() ? (this.queryParamMap()?.get('fromQuotation') ?? null) : null,
  );
  protected readonly fromPurchaseQuotationId = computed<string | null>(() =>
    this.kind() === 'purchase-order' && !this.docId()
      ? (this.queryParamMap()?.get('fromPurchaseQuotation') ?? null)
      : null,
  );
  protected readonly printParam = computed(() => this.queryParamMap()?.get('print') === '1');
  protected readonly crmPrefill = computed<CrmPrefillParams | null>(() => {
    if (this.kind() !== 'quotation' || this.docId()) return null;
    const qp = this.queryParamMap();
    const customerProfileId = qp?.get('customerProfileId') ?? null;
    const opportunityId = qp?.get('crmOpportunityId') ?? null;
    if (!customerProfileId && !opportunityId) return null;
    return { customerProfileId, opportunityId };
  });

  protected readonly canRead = computed(() => this.hasBranchGrant(`trade.${this.kindConfig().segment.replaceAll('-', '_')}.read`));
  protected readonly canCreate = computed(() => this.hasBranchGrant(`trade.${this.kindConfig().segment.replaceAll('-', '_')}.create`));
  protected readonly canUpdate = computed(() => this.hasBranchGrant(`trade.${this.kindConfig().segment.replaceAll('-', '_')}.update`));
  protected readonly canConvertQuotation = computed(
    () =>
      this.hasBranchGrant('trade.quotations.read') &&
      this.hasBranchGrant('trade.quotations.convert') &&
      this.hasBranchGrant('trade.sales_orders.create'),
  );
  protected readonly canConvertPurchaseQuotation = computed(
    () =>
      this.hasBranchGrant('trade.purchase_quotations.read') &&
      this.hasBranchGrant('trade.purchase_quotations.convert') &&
      this.hasBranchGrant('trade.purchase_orders.create'),
  );

  protected readonly docQuery = injectDocument(this.kind, this.docId, this.canRead);
  protected readonly sourceQuotationQuery = injectDocument(
    'quotation',
    this.fromQuotationId,
    this.canConvertQuotation,
  );
  protected readonly sourcePqQuery = injectDocument(
    'purchase-quotation',
    this.fromPurchaseQuotationId,
    this.canConvertPurchaseQuotation,
  );
  protected readonly discountPolicyQuery = injectDiscountPolicy(
    computed(() => this.kind() === 'quotation' && (this.isNewMode() ? this.canCreate() : this.canRead())),
  );

  private readonly now = signal(new Date());
  /** x-idempotency-keys: one per save or command action, reused on a retry, reset after a success. */
  private readonly saveKeys = new DocumentRequestKeys();
  private readonly commandKeys = new DocumentRequestKeys();
  protected readonly loaded = signal<DocumentDraft>(emptyDraft('quotation'));
  protected readonly draft = signal<DocumentDraft>(emptyDraft('quotation'));
  private readonly detailVersionOverride = signal<number | null>(null);

  protected readonly saving = signal(false);
  protected readonly commandBusy = signal<DocAction | null>(null);
  protected readonly showValidationErrors = signal(false);
  private readonly actionForbidden = signal(false);
  private readonly costUnavailable = signal(false);
  private readonly rawFieldErrors = signal<Record<string, string>>({});
  private readonly rawLineErrors = signal<Record<string, string>>({});
  private readonly rawLineErrorParams = signal<Record<string, Record<string, string>>>({});

  protected readonly resolvedHeaderOpportunity = signal<SourceCrmOpportunity | null>(null);
  private readonly resolvedSourceNumber = signal<string | null>(null);
  private readonly reasonsByKind = signal<Partial<Record<ReasonKind, ReasonCode[]>>>({});

  protected readonly printOpen = signal(false);
  protected readonly conflictOpen = signal(false);
  protected readonly reasonDialogOpen = signal(false);

  protected readonly confirmSpec = signal<ConfirmDialogSpec>({
    tone: 'warning',
    titleKey: '',
    textKey: '',
    confirmKey: '',
    cancelKey: 'td.common.cancel',
  });
  protected readonly reasonSpec = signal<ReasonDialogSpec | null>(null);

  protected readonly soConfirmDate = signal<string | null>(null);
  protected readonly soConfirmTime = signal<string | null>(null);
  protected readonly receivingNodes = signal<ReceivingNodeOption[]>([]);
  protected readonly directPoNodeId = signal<string | null>(null);
  protected readonly directPoNodeError = signal<string | null>(null);

  private backQueryParams: Params = {};
  private lastRouteKey = '';
  private lastDetailSyncKey = '';
  private lastSourceSyncKey = '';
  private sourceNumberSeq = 0;
  private bypassGuard = false;
  private confirmingLeave = false;
  private handledPrintForId: string | null = null;
  private carriedState: CarriedPageState | null = null;
  private confirmResolver: ((confirmed: boolean) => void) | null = null;
  private readonly loadingReasons = new Set<ReasonKind>();
  private readonly consumedNavigations = new WeakSet<object>();

  protected readonly detail = computed<AnyDocumentDetail | null>(() => {
    const id = this.docId();
    if (!id) return null;
    const data = this.docQuery.data();
    return data && data.id === id ? data : null;
  });

  protected readonly effectiveDetail = computed<AnyDocumentDetail | null>(() => {
    const d = this.detail();
    if (!d) return null;
    const override = this.detailVersionOverride();
    return override !== null ? { ...d, version: override } : d;
  });

  protected readonly sourceQuotation = computed<QuotationDetail | null>(() => {
    const id = this.fromQuotationId();
    if (!id) return null;
    const data = this.sourceQuotationQuery.data();
    return data && data.id === id ? data : null;
  });

  protected readonly sourcePurchaseQuotation = computed<PurchaseQuotationDetail | null>(() => {
    const id = this.fromPurchaseQuotationId();
    if (!id) return null;
    const data = this.sourcePqQuery.data();
    return data && data.id === id ? data : null;
  });

  protected readonly pageMode = computed<PageMode>(() => {
    if (!this.docId()) {
      if (this.fromQuotationId()) return 'convert-quotation';
      if (this.fromPurchaseQuotationId()) return 'convert-purchase-quotation';
      return 'new';
    }
    const d = this.detail();
    if (!d) return 'readonly';
    const kind = this.kind();
    if (!this.canUpdate()) return 'readonly';

    switch (kind) {
      case 'quotation':
        return d.lifecycleStatus === 'DRAFT' || d.lifecycleStatus === 'SENT' ? 'edit' : 'readonly';
      case 'sales-order':
        return d.lifecycleStatus === 'DRAFT' ? 'edit' : 'readonly';
      case 'purchase-order': {
        const po = d as PurchaseOrderDetail;
        return po.lifecycleStatus === 'DRAFT' && po.approvalStatus !== 'PENDING' ? 'edit' : 'readonly';
      }
      case 'purchase-quotation':
        return d.lifecycleStatus === 'DRAFT' ? 'edit' : 'readonly';
    }
  });

  protected readonly headerFieldMode = computed<HeaderFieldMode>(() => {
    const m = this.pageMode();
    if (m === 'convert-quotation' || m === 'convert-purchase-quotation') return 'convert';
    return m;
  });

  protected readonly isNewMode = computed(() => !this.docId());
  protected readonly isConvertMode = computed(
    () => this.pageMode() === 'convert-quotation' || this.pageMode() === 'convert-purchase-quotation',
  );

  protected readonly loading = computed(() => {
    if (this.docId()) return this.docQuery.isPending() && !this.docQuery.data();
    if (this.fromQuotationId()) return this.sourceQuotationQuery.isPending() && !this.sourceQuotationQuery.data();
    if (this.fromPurchaseQuotationId()) return this.sourcePqQuery.isPending() && !this.sourcePqQuery.data();
    return false;
  });

  protected readonly activeLoadError = computed<unknown | null>(() => {
    if (this.docId()) return this.docQuery.isError() ? this.docQuery.error() : null;
    if (this.fromQuotationId()) return this.sourceQuotationQuery.isError() ? this.sourceQuotationQuery.error() : null;
    if (this.fromPurchaseQuotationId()) return this.sourcePqQuery.isError() ? this.sourcePqQuery.error() : null;
    return null;
  });

  protected readonly loadErrorKind = computed<'not-found' | 'forbidden' | 'failed' | null>(() => {
    if (this.actionForbidden()) {
      return 'forbidden';
    }
    const err = this.activeLoadError();
    if (!err) {
      if (this.docId() && !this.canRead()) {
        return 'forbidden';
      }
      if (this.fromQuotationId() && !this.canConvertQuotation()) {
        return 'forbidden';
      }
      if (this.fromPurchaseQuotationId() && !this.canConvertPurchaseQuotation()) {
        return 'forbidden';
      }
      if (this.isNewMode() && !this.isConvertMode() && !this.canCreate()) {
        return 'forbidden';
      }
      return null;
    }
    if (err instanceof ApiError) {
      if (err.status === 404 || NOT_FOUND_CODES.has(err.code)) return 'not-found';
      if (err.status === 403 || err.code === 'TRADE.AUTH.TARGET_DENIED') return 'forbidden';
    }
    return 'failed';
  });

  protected readonly dirty = computed(
    () => this.pageMode() !== 'readonly' && isDirty(this.loaded(), this.draft()),
  );

  protected readonly currentUserId = computed(() => this.currentUser.user().email);

  protected readonly grantedActionPerms = computed<ReadonlySet<string>>(() => {
    const granted = new Set<string>();
    for (const key of DOCUMENT_ACTION_PERMISSION_KEYS) {
      if (this.hasBranchGrant(key)) {
        granted.add(key);
      }
    }
    for (const segment of ['quotations', 'sales_orders', 'purchase_orders', 'purchase_quotations'] as const) {
      if (granted.has(`trade.${segment}.update`)) {
        granted.add(`trade.${segment}.delete`);
      }
    }
    return granted;
  });

  protected readonly headerActions = computed<ResolvedAction[]>(() => {
    const d = this.effectiveDetail();
    if (this.isNewMode() || !d) return [];
    const dirty = this.dirty();
    const perms = this.grantedActionPerms();
    let resolved = resolveActions(this.kind(), d, {
      dirty,
      isNew: false,
      currentUserId: this.currentUserId(),
      perms,
      now: this.now(),
    });
    if (this.kind() === 'purchase-quotation' && !perms.has('trade.purchase_quotations.convert')) {
      resolved = resolved.filter(
        (item) =>
          item.action !== 'convertToPurchaseOrder' &&
          item.action !== 'createPurchaseOrderDirect',
      );
    }
    return dirty ? resolved.map((item) => ({ ...item, primary: false })) : resolved;
  });

  protected readonly showSaveButton = computed(
    () => this.pageMode() !== 'readonly' && (this.isNewMode() || this.dirty()),
  );

  protected readonly saveLabelKey = computed(() => {
    if (this.isNewMode()) {
      return `tdpg.save.create.${this.kind()}`;
    }
    const d = this.detail();
    if (
      this.kind() === 'quotation' &&
      d?.lifecycleStatus === 'SENT' &&
      quotationChangeKind(this.loaded(), this.draft()).revision
    ) {
      return 'tdpg.save.newRevision';
    }
    return 'tdpg.save.save';
  });

  protected readonly draftValidation = computed(() => {
    const kind = this.kind();
    const mode = this.pageMode();
    const validateRevision =
      kind === 'quotation' && mode === 'edit' ? quotationChangeKind(this.loaded(), this.draft()).revision : true;
    return validateDraft(kind, mode, this.draft(), {
      discountReasonRequired: this.headerFields()?.pricingReasonRequired() ?? false,
      validateRevision,
    });
  });

  protected readonly paymentTermsMissing = computed(
    () => this.termsSection()?.paymentTermsMissing() ?? false,
  );

  protected readonly isDraftInvalid = computed(() => {
    if (this.pageMode() === 'readonly') return false;
    const baseInvalid = !this.draftValidation().valid;
    const termsInvalid = !(this.termsSection()?.valid() ?? true);
    return baseInvalid || termsInvalid;
  });

  protected readonly translatedFieldErrors = computed<Record<string, string>>(() => {
    this.i18n();
    const merged: Record<string, string> = {};
    const paramsFor = (field: string): Record<string, number> | undefined =>
      field === 'notes' ? { max: TERMS_NOTES_MAX_LENGTH } : undefined;
    if (this.showValidationErrors()) {
      for (const [k, key] of Object.entries(this.draftValidation().fieldErrors)) {
        merged[k] = this.transloco.translate(key, paramsFor(k));
      }
    }
    for (const [k, key] of Object.entries(this.rawFieldErrors())) {
      merged[k] = this.transloco.translate(key, paramsFor(k));
    }
    return merged;
  });

  protected readonly translatedLineErrors = computed<Record<string, string>>(() => {
    this.i18n();
    const merged: Record<string, string> = {};
    if (this.showValidationErrors()) {
      for (const [lineId, key] of Object.entries(this.draftValidation().lineErrors)) {
        merged[lineId] = this.transloco.translate(key);
      }
    }
    const paramsMap = this.rawLineErrorParams();
    for (const [lineId, key] of Object.entries(this.rawLineErrors())) {
      merged[lineId] = this.transloco.translate(key, paramsMap[lineId]);
    }
    return merged;
  });

  protected readonly quotationDetail = computed<QuotationDetail | null>(() =>
    this.kind() === 'quotation' ? (this.detail() as QuotationDetail | null) : null,
  );
  protected readonly salesOrderDetail = computed<SalesOrderDetail | null>(() =>
    this.kind() === 'sales-order' ? (this.detail() as SalesOrderDetail | null) : null,
  );
  protected readonly purchaseOrderDetail = computed<PurchaseOrderDetail | null>(() =>
    this.kind() === 'purchase-order' ? (this.detail() as PurchaseOrderDetail | null) : null,
  );

  protected readonly currentQuotationRevision = computed<QuotationRevision | null>(() => {
    const q = this.quotationDetail();
    if (!q || !q.revisions.length) return null;
    return q.revisions.find((r) => r.id === q.currentRevisionId) ?? q.revisions[q.revisions.length - 1] ?? null;
  });

  protected readonly quotationRevisions = computed<readonly QuotationRevision[]>(
    () => this.quotationDetail()?.revisions ?? [],
  );

  protected readonly lifecycleStatusBadge = computed(() => {
    const d = this.detail();
    if (!d) return null;
    const b = statusBadge(this.kind(), 'lifecycle', d.lifecycleStatus);
    return { ...b, className: STATUS_TONE_CLASSES[b.tone] };
  });

  protected readonly salesOrderHoldBadge = computed(() => {
    const so = this.salesOrderDetail();
    if (!so || so.holdStatus !== 'HELD') return null;
    const b = statusBadge('sales-order', 'hold', 'HELD');
    return { ...b, className: STATUS_TONE_CLASSES[b.tone] };
  });

  protected readonly poApprovalBadge = computed(() => {
    const po = this.purchaseOrderDetail();
    if (!po || po.approvalStatus === 'NOT_REQUIRED') return null;
    const b = statusBadge('purchase-order', 'approval', po.approvalStatus);
    return { ...b, className: STATUS_TONE_CLASSES[b.tone] };
  });

  protected readonly showPoApprovalLine = computed(() => {
    const po = this.purchaseOrderDetail();
    return Boolean(po && (po.approvalStatus !== 'NOT_REQUIRED' || po.approvalReady));
  });

  protected readonly showPoDeliveryStatus = computed(() => {
    const po = this.purchaseOrderDetail();
    return Boolean(po && po.lifecycleStatus === 'CONFIRMED');
  });

  protected readonly headerOpportunityId = computed<string | null>(() => {
    const kind = this.kind();
    if (kind === 'quotation') {
      const linkedId = this.draft().header['sourceCrmOpportunityId'];
      if (typeof linkedId === 'string' && linkedId.trim().length > 0) {
        return linkedId.trim();
      }
      return embeddedSourceOpportunityOf(this.detail())?.id ?? null;
    }
    if (kind === 'sales-order') {
      return embeddedSourceOpportunityOf(this.detail())?.id ?? null;
    }
    return null;
  });

  protected readonly headerOpportunity = computed<SourceCrmOpportunity | null>(() => {
    const linkedId = this.headerOpportunityId();
    if (!linkedId) return null;
    const embedded = embeddedSourceOpportunityOf(this.detail());
    if (embedded && embedded.id === linkedId && embedded.available && embedded.name?.trim()) {
      const lang = this.lang();
      const stageName = embedded.stageName
        ? ((lang === 'ar' ? embedded.stageName.ar || embedded.stageName.en : embedded.stageName.en || embedded.stageName.ar) ?? '')
        : '';
      return {
        id: embedded.id,
        name: embedded.name.trim(),
        stageName: stageName.trim(),
        status: embedded.status ?? 'IN_PROGRESS',
      };
    }
    return null;
  });

  protected readonly sourceQuotationId = computed<string | null>(
    () => this.fromQuotationId() ?? this.salesOrderDetail()?.sourceQuotationId ?? null,
  );
  protected readonly sourcePurchaseQuotationId = computed<string | null>(
    () => this.fromPurchaseQuotationId() ?? this.purchaseOrderDetail()?.sourcePurchaseQuotationId ?? null,
  );

  protected readonly sourceTagNumber = computed<string | null>(() => {
    const srcQ = this.sourceQuotation();
    if (srcQ) return srcQ.documentNumber ?? srcQ.id;
    const srcPq = this.sourcePurchaseQuotation();
    if (srcPq) return srcPq.documentNumber ?? srcPq.id;
    return this.resolvedSourceNumber();
  });

  protected readonly sourcePartyName = computed<string | null>(
    () => this.sourceQuotation()?.partySnapshot.displayName ?? this.sourcePurchaseQuotation()?.partySnapshot.displayName ?? null,
  );

  protected readonly draftCurrency = computed(() => {
    const raw = this.draft().header['currencyCode'];
    return typeof raw === 'string' && raw.trim() ? raw : 'EGP';
  });

  protected readonly draftPartyId = computed<string | null>(() => {
    const h = this.draft().header;
    const raw = h['partyId'] ?? h['supplierPartyId'];
    return typeof raw === 'string' && raw.trim() ? raw : null;
  });

  protected readonly discountMode = computed<'none' | 'line'>(() => {
    const p = this.draft().pricing;
    return this.kind() === 'quotation' && p?.mode === 'DISCOUNT' && (p.scope ?? 'LINE') === 'LINE' ? 'line' : 'none';
  });

  protected readonly linesEditable = computed(() => this.pageMode() !== 'readonly');

  protected readonly structureLocked = computed(() => {
    if (this.isConvertMode()) return true;
    if (this.kind() === 'sales-order' && this.salesOrderDetail()?.sourceQuotationId) return true;
    if (this.kind() === 'purchase-order' && this.purchaseOrderDetail()?.sourcePurchaseQuotationId) return true;
    return false;
  });

  protected readonly itemsBarNote = computed<string | null>(() => {
    this.i18n();
    if (this.costUnavailable()) {
      return this.transloco.translate('tdpg.errors.TRADE.PRICE.COST_UNAVAILABLE');
    }
    const mode = this.pageMode();
    if (mode === 'convert-quotation') {
      return this.transloco.translate('tdpg.itemsNote.convertQuotation');
    }
    if (mode === 'convert-purchase-quotation') {
      return this.transloco.translate('tdpg.itemsNote.convertPurchaseQuotation');
    }
    const po = this.purchaseOrderDetail();
    if (
      po &&
      mode === 'edit' &&
      (po.approvalStatus === 'APPROVED' || po.approvalStatus === 'REJECTED')
    ) {
      return this.transloco.translate('tdpg.itemsNote.poResubmitApproval');
    }
    if (this.kind() === 'quotation' && this.discountMode() === 'line' && this.linesEditable()) {
      const policy = this.discountPolicyQuery.data();
      if (!policy) return null;
      if (policy.limit === null) {
        return this.transloco.translate('tdpg.itemsNote.lineDiscountNoLimit');
      }
      return this.transloco.translate('tdpg.itemsNote.lineDiscount', { max: policy.limit.maxPercent });
    }
    if (po?.sourcePurchaseQuotationId) {
      return this.transloco.translate('tdpg.itemsNote.convertPurchaseQuotation');
    }
    return null;
  });

  protected readonly activeTermsSnapshot = computed<TermsSnapshot | null>(() => {
    const q = this.quotationDetail();
    if (q) return this.currentQuotationRevision()?.termsSnapshot ?? null;
    const srcQ = this.sourceQuotation();
    if (srcQ) {
      const rev =
        srcQ.revisions.find((r) => r.id === (srcQ.acceptedRevisionId ?? srcQ.currentRevisionId)) ??
        srcQ.revisions[srcQ.revisions.length - 1];
      return rev?.termsSnapshot ?? null;
    }
    const srcPq = this.sourcePurchaseQuotation();
    if (srcPq) return srcPq.termsSnapshot;
    const d = this.detail();
    if (d && 'termsSnapshot' in d) return d.termsSnapshot;
    return null;
  });

  protected readonly convertLockedSelections = computed<TermSelections | null>(() => {
    if (!this.isConvertMode()) return null;
    return extractTermSelections(this.activeTermsSnapshot());
  });

  protected readonly convertNotesLocked = computed(() => {
    if (!this.isConvertMode()) return false;
    const srcPq = this.sourcePurchaseQuotation();
    const text = srcPq ? (srcPq.notes ?? extractNotes(srcPq.termsSnapshot)) : extractNotes(this.activeTermsSnapshot());
    return text.trim().length > 0;
  });

  protected readonly activeTotalsSnapshot = computed<TotalsSnapshot | null>(() => {
    const d = this.detail();
    return d && 'totalsSnapshot' in d ? d.totalsSnapshot : null;
  });

  protected readonly activeCurrencyDecimalPlaces = computed<number>(() => {
    const snap = this.activeTotalsSnapshot();
    if (snap?.currencyDecimalPlaces != null) return snap.currencyDecimalPlaces;
    const rev = this.currentQuotationRevision();
    if (rev) return rev.discountSnapshot.currencyDecimalPlaces;
    const srcQ = this.sourceQuotation();
    if (srcQ) {
      const accRev =
        srcQ.revisions.find((r) => r.id === (srcQ.acceptedRevisionId ?? srcQ.currentRevisionId)) ?? null;
      if (accRev) return accRev.discountSnapshot.currencyDecimalPlaces;
    }
    const srcPq = this.sourcePurchaseQuotation();
    if (srcPq?.totalsSnapshot?.currencyDecimalPlaces != null) {
      return srcPq.totalsSnapshot.currencyDecimalPlaces;
    }
    return currencyDecimalPlacesOf(this.draftCurrency());
  });

  protected readonly printSource = computed<PrintSource | null>(() => {
    const d = this.detail();
    if (!d) return null;
    if (this.kind() === 'quotation') {
      const revId = (d as QuotationDetail).currentRevisionId;
      return revId ? { revisionId: revId } : null;
    }
    return { sourceVersion: d.version };
  });

  protected readonly receivingNodeDropdownOptions = computed<DropdownOption<string | null>[]>(() =>
    this.receivingNodes().map((n) => ({ value: n.id, label: n.name })),
  );

  constructor() {
    // Capture list query params when arriving from the document list.
    const nav = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
    const prevUrl = nav?.previousNavigation?.extractedUrl;
    if (prevUrl) {
      const segs = prevUrl.root.children['primary']?.segments.map((s) => s.path) ?? [];
      if (segs[0] === 'trade' && segs[1] === 'documents' && segs[2] === KIND_CONFIG[this.kind()].segment && segs.length === 3) {
        this.backQueryParams = { ...prevUrl.queryParams };
      }
    }

    const timer = setInterval(() => this.now.set(new Date()), 30_000);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      this.settleConfirm(false);
    });

    this.router.events
      .pipe(
        filter(
          (e) => e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.bypassGuard = false;
      });

    // Reset state when route kind/id/convert params change.
    effect(() => {
      const kind = this.kind();
      const id = this.docId();
      const fromQ = this.fromQuotationId();
      const fromPq = this.fromPurchaseQuotationId();
      const routeKey = `${kind}:${id ?? 'new'}:${fromQ ?? ''}:${fromPq ?? ''}`;
      if (routeKey === this.lastRouteKey) return;
      this.lastRouteKey = routeKey;

      untracked(() => {
        const nav = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
        const navState =
          nav && !this.consumedNavigations.has(nav) ? (nav.extras.state as CarriedPageState | undefined) : undefined;
        if (nav && navState?.targetId === id) {
          this.consumedNavigations.add(nav);
          this.carriedState = navState;
        } else {
          this.carriedState = null;
        }
        this.lastDetailSyncKey = '';
        this.lastSourceSyncKey = '';
        this.handledPrintForId = null;
        this.detailVersionOverride.set(null);
        this.resolvedHeaderOpportunity.set(null);
        this.resolvedSourceNumber.set(null);
        this.showValidationErrors.set(false);
        this.actionForbidden.set(false);
        this.costUnavailable.set(false);
        this.rawFieldErrors.set({});
        this.rawLineErrors.set({});
        this.rawLineErrorParams.set({});
        this.conflictOpen.set(false);
        this.reasonDialogOpen.set(false);
        this.printOpen.set(false);

        if (!id && !fromQ && !fromPq) {
          const fresh = emptyDraft(kind);
          this.loaded.set(structuredClone(fresh));
          this.draft.set(structuredClone(fresh));
          afterNextRender(
            () => {
              if (!this.docId() && !this.fromQuotationId() && !this.fromPurchaseQuotationId()) {
                this.termsSection()?.applyDefaults();
              }
            },
            { injector: this.injector },
          );
        }
      });
    });

    // Sync loaded/draft when detail arrives or updates.
    effect(() => {
      const kind = this.kind();
      const id = this.docId();
      const d = this.detail();
      if (!id || !d) return;
      const syncKey = `${id}:${d.version}:${d.updatedAt}`;
      if (syncKey === this.lastDetailSyncKey) return;
      this.lastDetailSyncKey = syncKey;

      untracked(() => {
        const mapped = toDraft(kind, d);
        this.detailVersionOverride.set(null);
        this.loaded.set(structuredClone(mapped));

        const carried = this.carriedState;
        if (carried && carried.targetId === id && carried.draft) {
          this.carriedState = null;
          this.draft.set(structuredClone(carried.draft));
          if (carried.pendingOutcome) {
            this.handleSaveOutcome(carried.pendingOutcome);
          }
          return;
        }

        this.draft.set(structuredClone(mapped));
        this.showValidationErrors.set(false);
        this.actionForbidden.set(false);
        this.costUnavailable.set(false);
        this.rawFieldErrors.set({});
        this.rawLineErrors.set({});
        this.rawLineErrorParams.set({});
      });
    });

    // Sync convert-quotation or convert-purchase-quotation prefill.
    effect(() => {
      const fromQ = this.fromQuotationId();
      const q = this.sourceQuotation();
      if (fromQ && q) {
        const syncKey = `q:${q.id}:${q.version}`;
        if (syncKey === this.lastSourceSyncKey) return;
        this.lastSourceSyncKey = syncKey;

        untracked(() => {
          if (q.lifecycleStatus !== 'ACCEPTED') {
            this.notify.error(this.transloco.translate('tdpg.toast.quotationMustBeAccepted'));
            this.bypassGuard = true;
            void this.router.navigate(['/trade/documents/quotations', q.id], { replaceUrl: true });
            return;
          }
          const mapped = draftFromQuotation(q);
          this.loaded.set(structuredClone(mapped));
          this.draft.set(structuredClone(mapped));
        });
        return;
      }

      const fromPq = this.fromPurchaseQuotationId();
      const pq = this.sourcePurchaseQuotation();
      if (fromPq && pq) {
        const syncKey = `pq:${pq.id}:${pq.version}`;
        if (syncKey === this.lastSourceSyncKey) return;
        this.lastSourceSyncKey = syncKey;

        untracked(() => {
          if (pq.lifecycleStatus !== 'ISSUED') {
            this.notify.error(this.transloco.translate('tdpg.toast.purchaseQuotationMustBeIssued'));
            this.bypassGuard = true;
            void this.router.navigate(['/trade/documents/purchase-quotations', pq.id], { replaceUrl: true });
            return;
          }
          const mapped = draftFromPurchaseQuotation(pq);
          this.loaded.set(structuredClone(mapped));
          this.draft.set(structuredClone(mapped));
        });
      }
    });

    // Resolve source quotation/PQ documentNumber for header link tag on existing SO/PO.
    effect(() => {
      const d = this.detail();
      if (!d) return;
      const soSrc = this.kind() === 'sales-order' ? (d as SalesOrderDetail).sourceQuotationId : null;
      const poSrc = this.kind() === 'purchase-order' ? (d as PurchaseOrderDetail).sourcePurchaseQuotationId : null;
      if (!soSrc && !poSrc) {
        untracked(() => this.resolvedSourceNumber.set(null));
        return;
      }
      const seq = ++this.sourceNumberSeq;
      const targetKind: DocumentKind = soSrc ? 'quotation' : 'purchase-quotation';
      const targetId = (soSrc ?? poSrc)!;
      untracked(() => {
        void getDocument(targetKind, targetId, this.scope, this.lang())
          .then((src) => {
            if (seq === this.sourceNumberSeq) {
              this.resolvedSourceNumber.set(src.documentNumber ?? src.id);
            }
          })
          .catch(() => {
            if (seq === this.sourceNumberSeq) {
              this.resolvedSourceNumber.set(targetId);
            }
          });
      });
    });

    // Load reason labels when reasonHistory has entries so badge tooltips show human names.
    effect(() => {
      const d = this.detail();
      if (!d || !Array.isArray(d.reasonHistory) || d.reasonHistory.length === 0) return;
      const kinds = new Set<ReasonKind>();
      for (const entry of d.reasonHistory) {
        if (entry.action === 'CANCEL' || entry.action === 'PO_CANCEL' || entry.action === 'PQ_CANCEL') {
          kinds.add('DOCUMENT_CANCEL');
        } else if (entry.action === 'REJECT') kinds.add('QUOTATION_REJECT');
        else if (entry.action === 'PO_REJECT') kinds.add('PURCHASE_ORDER_REJECT');
        else if (entry.action === 'HOLD') kinds.add('DOCUMENT_HOLD');
        else if (entry.action === 'RELEASE_HOLD') kinds.add('DOCUMENT_HOLD_RELEASE');
      }
      for (const rk of kinds) {
        if (untracked(() => this.reasonsByKind()[rk]) || this.loadingReasons.has(rk)) continue;
        this.loadingReasons.add(rk);
        void listReasons(rk, { includeInactive: true })
          .then((list) => {
            this.reasonsByKind.update((prev) => ({ ...prev, [rk]: list }));
          })
          .catch(() => {
            // Fall back to reasonCode in tooltip.
          })
          .finally(() => {
            this.loadingReasons.delete(rk);
          });
      }
    });

    // Open print dialog once when /:id?print=1 loads.
    effect(() => {
      const id = this.docId();
      const d = this.detail();
      const wantPrint = this.printParam();
      const src = this.printSource();
      if (!id || !d || !wantPrint || !src || this.handledPrintForId === id) return;
      this.handledPrintForId = id;
      untracked(() => {
        this.printOpen.set(true);
        this.bypassGuard = true;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { print: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  async canLeave(): Promise<boolean> {
    if (this.bypassGuard) return true;
    if (this.pageMode() === 'readonly' || this.loading() || this.loadErrorKind() !== null || !this.dirty()) {
      return true;
    }
    if (this.confirmingLeave) return false;
    this.confirmingLeave = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'cancel') return false;
      if (choice === 'discard') {
        this.onUndo();
        return true;
      }
      return await this.onSave({ navigateOnCreate: false });
    } finally {
      this.confirmingLeave = false;
    }
  }

  protected badgeLabel(labelKey: string): string {
    this.i18n();
    const translated = this.transloco.translate(labelKey);
    return translated && translated !== labelKey
      ? translated
      : this.transloco.translate('td.common.unknownStatus');
  }

  protected goBack(): void {
    void this.router.navigate(['/trade/documents', this.kindConfig().segment], {
      queryParams: this.backQueryParams,
    });
  }

  protected reloadPage(): void {
    this.actionForbidden.set(false);
    this.costUnavailable.set(false);
    if (this.docId()) {
      invalidateDocumentQueries(this.kind());
      void this.docQuery.refetch();
      return;
    }
    if (this.fromQuotationId()) {
      invalidateDocumentQueries('quotation');
      void this.sourceQuotationQuery.refetch();
      return;
    }
    if (this.fromPurchaseQuotationId()) {
      invalidateDocumentQueries('purchase-quotation');
      void this.sourcePqQuery.refetch();
    }
  }

  protected reasonTooltipFor(badgeType: 'lifecycle' | 'hold' | 'approval'): string | null {
    const d = this.detail();
    if (!d || !Array.isArray(d.reasonHistory) || d.reasonHistory.length === 0) return null;

    // Backend action names (trade-app appendDocumentReason): CANCEL, REJECT, HOLD, RELEASE_HOLD for quotations
    // and sales orders; PO_REJECT / PO_CANCEL for purchase orders; PQ_CANCEL for purchase quotations.
    const cancelAction = this.kind() === 'purchase-order' ? 'PO_CANCEL' : this.kind() === 'purchase-quotation' ? 'PQ_CANCEL' : 'CANCEL';
    let matchingAction: string | null = null;
    let reasonKind: ReasonKind | null = null;

    if (badgeType === 'lifecycle') {
      if (d.lifecycleStatus === 'CANCELLED') {
        matchingAction = cancelAction;
        reasonKind = 'DOCUMENT_CANCEL';
      } else if (d.lifecycleStatus === 'REJECTED' && this.kind() === 'quotation') {
        matchingAction = 'REJECT';
        reasonKind = 'QUOTATION_REJECT';
      }
    } else if (badgeType === 'hold') {
      matchingAction = 'HOLD';
      reasonKind = 'DOCUMENT_HOLD';
    } else if (badgeType === 'approval' && this.purchaseOrderDetail()?.approvalStatus === 'REJECTED') {
      matchingAction = 'PO_REJECT';
      reasonKind = 'PURCHASE_ORDER_REJECT';
    }

    if (!matchingAction || !reasonKind) return null;

    // The history comes newest first (at most 50 entries), so the first match is the latest reason.
    const entry: ReasonHistoryEntry | null = d.reasonHistory.find((item) => item.action === matchingAction) ?? null;
    if (!entry) return null;

    const list = this.reasonsByKind()[reasonKind] ?? [];
    const matchedReason = list.find((r) => r.code === entry.reasonCode);
    const reasonLabel = matchedReason ? (itemName(matchedReason, this.lang()) || entry.reasonCode) : entry.reasonCode;
    const parts = [reasonLabel];
    if (entry.reasonNote?.trim()) {
      parts.push(entry.reasonNote.trim());
    }
    parts.push(formatDate(entry.at, this.lang()));
    return parts.join(' · ');
  }

  protected onDraftChange(updated: DocumentDraft): void {
    if (this.pageMode() === 'readonly') return;
    this.draft.set(updated);
    this.clearServerErrors();
  }

  protected onHeaderAutoDefault(headerPatch: Record<string, unknown>): void {
    const mode = this.pageMode();
    if (mode !== 'new' && mode !== 'convert-purchase-quotation') return;
    this.loaded.update((prev) => ({
      ...prev,
      header: { ...prev.header, ...structuredClone(headerPatch) },
    }));
  }

  protected onTermsDefaultsApplied(termSelections: TermSelections): void {
    if (this.pageMode() !== 'new') return;
    this.loaded.update((prev) => ({
      ...prev,
      termSelections: structuredClone(termSelections),
    }));
  }

  protected onLinesChange(lines: EditableLine[]): void {
    if (this.pageMode() === 'readonly') return;
    this.draft.update((curr) => ({ ...curr, lines }));
    this.clearServerErrors();
  }

  protected onTermSelectionsChange(termSelections: TermSelections): void {
    if (this.pageMode() === 'readonly') return;
    this.draft.update((curr) => ({ ...curr, termSelections }));
    this.clearServerErrors();
  }

  protected onNotesChange(notes: string): void {
    if (this.pageMode() === 'readonly') return;
    this.draft.update((curr) => ({ ...curr, notes }));
    this.clearServerErrors();
  }

  protected onUndo(): void {
    if (this.saving()) return;
    this.draft.set(undoDraft(this.loaded()));
    this.showValidationErrors.set(false);
    this.clearServerErrors();
  }

  protected revealValidationAndFocusFirst(): void {
    this.showValidationErrors.set(true);
    const { fieldErrors, lineErrors } = this.draftValidation();
    afterNextRender(() => this.focusFirstError(fieldErrors, lineErrors), { injector: this.injector });
  }

  protected async onSave(opts?: { navigateOnCreate?: boolean }): Promise<boolean> {
    if (this.saving() || this.commandBusy() !== null || this.pageMode() === 'readonly') {
      return false;
    }

    if (this.isDraftInvalid()) {
      this.revealValidationAndFocusFirst();
      return false;
    }

    this.saving.set(true);
    this.clearServerErrors();

    try {
      const outcome = await saveDocument({
        kind: this.kind(),
        mode: this.pageMode(),
        draft: this.draft(),
        loaded: this.loaded(),
        detail: this.effectiveDetail() ?? this.sourceQuotation() ?? this.sourcePurchaseQuotation(),
        sourceId: this.fromQuotationId() ?? this.fromPurchaseQuotationId(),
        sourceVersion:
          this.sourceQuotation()?.version ?? this.sourcePurchaseQuotation()?.version ?? null,
        fingerprint: this.documentLines()?.lastFingerprint() ?? null,
        discountReasonRequired: this.headerFields()?.pricingReasonRequired() ?? false,
        confirm: (titleKey, textKey) => this.askConfirm('warning', titleKey, textKey, 'tdpg.save.newRevision'),
        requestKeys: this.saveKeys,
        ctx: this.scope,
      });
      if (outcome.type === 'saved' || outcome.type === 'redirect') {
        this.saveKeys.reset();
      }

      return await this.handleSaveOutcome(outcome, opts?.navigateOnCreate ?? true);
    } finally {
      this.saving.set(false);
    }
  }

  protected async onActionBarRun(action: DocAction): Promise<void> {
    const d = this.effectiveDetail();
    if (!d || this.saving() || this.commandBusy() !== null) return;

    if (action === 'print') {
      this.printOpen.set(true);
      return;
    }

    const resolved = this.headerActions().find((item) => item.action === action);

    if (resolved?.needsReason) {
      this.reasonSpec.set({
        action,
        reasonKind: resolved.needsReason,
        titleKey: `tda.reason.title.${action}`,
        textKey: `tda.reason.text.${action}`,
        confirmKey: `tda.actions.${action}`,
        danger: action !== 'hold' && action !== 'releaseHold',
      });
      this.reasonDialogOpen.set(true);
      return;
    }

    if (action === 'confirm') {
      this.soConfirmDate.set(null);
      this.soConfirmTime.set(null);
      this.soConfirmModal()?.open();
      return;
    }

    if (action === 'createPurchaseOrderDirect') {
      this.directPoNodeError.set(null);
      this.directPoNodeId.set(null);
      this.directPoModal()?.open();
      try {
        const nodes = await listReceivingNodes(this.scope);
        this.receivingNodes.set(nodes);
        if (nodes.length > 0 && !this.directPoNodeId()) {
          this.directPoNodeId.set(nodes[0].id);
        }
      } catch {
        this.receivingNodes.set([]);
      }
      return;
    }

    if (action === 'poConfirm') {
      const ok = await this.askConfirm(
        'warning',
        'tda.confirm.poConfirm.title',
        'tdpg.confirm.poConfirmText',
        'tda.actions.poConfirm',
      );
      if (!ok) return;
    } else if (action === 'issue' || action === 'deleteDraft' || action === 'createSalesOrderDirect') {
      const ok = await this.askConfirm(
        action === 'deleteDraft' ? 'danger' : 'warning',
        `tda.confirm.${action}.title`,
        `tda.confirm.${action}.text`,
        `tda.actions.${action}`,
      );
      if (!ok) return;
    }

    await this.executeCommand(action);
  }

  protected onReasonConfirmed(result: ReasonDialogResult): void {
    const spec = this.reasonSpec();
    if (!spec) return;
    this.reasonSpec.set(null);
    void this.executeCommand(spec.action, {
      reasonCode: result.reasonCode,
      reasonNote: result.reasonNote,
    });
  }

  protected submitSoConfirm(): void {
    const date = this.soConfirmDate();
    const time = this.soConfirmTime();
    let requestedDeadline: string | undefined;
    if (date) {
      const parsed = new Date(`${date}T${time || '00:00'}:00`);
      requestedDeadline = Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
    }
    this.soConfirmModal()?.close();
    void this.executeCommand('confirm', requestedDeadline ? { requestedDeadline } : undefined);
  }

  protected closeSoConfirm(): void {
    this.soConfirmModal()?.close();
  }

  protected submitDirectPo(): void {
    const nodeId = this.directPoNodeId();
    if (!nodeId) {
      this.directPoNodeError.set(this.transloco.translate('tdpg.confirm.receivingWarehouseRequired'));
      return;
    }
    this.directPoModal()?.close();
    void this.executeCommand('createPurchaseOrderDirect', { receivingNodeId: nodeId });
  }

  protected closeDirectPo(): void {
    this.directPoModal()?.close();
  }

  protected async onConflictReload(): Promise<void> {
    this.detailVersionOverride.set(null);
    const id = this.docId();
    if (!id) return;
    invalidateDocumentQueries(this.kind());
    this.lastDetailSyncKey = '';
    await this.docQuery.refetch();
  }

  protected async onConflictKeep(): Promise<void> {
    const id = this.docId();
    if (!id) return;
    try {
      const fresh = await getDocument(this.kind(), id, this.scope, this.lang());
      this.detailVersionOverride.set(fresh.version);
    } catch (err) {
      this.showApiErrorToast(err instanceof ApiError ? err.code : 'generic');
    }
  }

  private async executeCommand(
    action: DocAction,
    params?: { reasonCode?: string; reasonNote?: string | null; requestedDeadline?: string; receivingNodeId?: string },
  ): Promise<void> {
    const d = this.effectiveDetail();
    if (!d) return;

    this.commandBusy.set(action);
    try {
      const outcome = await runCommand({
        kind: this.kind(),
        action,
        detail: d,
        params,
        idempotencyKey: this.commandKeys.for(action, { kind: this.kind(), id: d.id, version: d.version, params }),
        ctx: this.scope,
      });

      switch (outcome.type) {
        case 'done': {
          this.commandKeys.reset();
          this.detailVersionOverride.set(null);
          if (outcome.toastKey) {
            this.notify.success(this.transloco.translate(outcome.toastKey, outcome.toastParams));
          }
          if (outcome.infoToastKey) {
            this.notify.info(this.transloco.translate(outcome.infoToastKey, outcome.infoToastParams));
          }
          if (outcome.navigateTo) {
            this.bypassGuard = true;
            await this.router.navigateByUrl(outcome.navigateTo, {
              replaceUrl: action === 'deleteDraft',
            });
            return;
          }
          if (this.docId()) {
            invalidateDocumentQueries(this.kind());
            await this.docQuery.refetch();
          }
          break;
        }

        case 'conflict':
          this.conflictOpen.set(true);
          break;

        case 'forbidden':
          this.actionForbidden.set(true);
          break;

        case 'error':
          this.handleCommandError(outcome.code, outcome.details);
          break;
      }
    } finally {
      this.commandBusy.set(null);
    }
  }

  private handleCommandError(code: string, details?: Record<string, unknown>): void {
    if (
      code === 'TRADE.QUOTE.PRICING_CHANGED' ||
      code === 'TRADE.PRICE.PREVIEW_CHANGED' ||
      code === 'TRADE.PRICE.PREVIEW_REQUIRED' ||
      code === 'TRADE.PRICE.PREVIEW_EXPIRED' ||
      code === 'TRADE.PRICE.PREVIEW_EMPTY'
    ) {
      this.documentLines()?.refreshPricing();
      this.notify.warning(this.transloco.translate('tdpg.toast.pricingChanged'));
      return;
    }

    if (code === 'TRADE.QUOTE.PRICE_LOCKED' || [
      'TRADE.PRICE.LOCK_INVALID',
      'TRADE.PRICE.LOCK_EXPIRED',
      'TRADE.PRICE.LOCK_CONTEXT_MISMATCH',
      'TRADE.PRICE.LOCK_DATA_INVALID',
    ].includes(code)) {
      this.documentLines()?.refreshPricing();
      this.notify.warning(this.transloco.translate('tdpg.toast.priceLockReload'));
      return;
    }

    if (code === 'TRADE.PRICE.COST_UNAVAILABLE') {
      this.costUnavailable.set(true);
      this.showApiErrorToast(code);
      return;
    }

    const field = ['TRADE.PRICE.CURRENCY_INACTIVE', 'TRADE.PRICE.FX_UNAVAILABLE'].includes(code)
      ? 'currencyCode'
      : ['TRADE.PRICE.BOOK_REQUIRED', 'TRADE.PRICE.BOOK_OVERRIDE_FORBIDDEN'].includes(code)
        ? 'priceBookId'
        : null;
    if (field) {
      const errors = { [field]: this.errorKeyFor(code) };
      this.rawFieldErrors.set(errors);
      afterNextRender(() => this.focusFirstError(errors, {}), { injector: this.injector });
      return;
    }

    const lineId = this.resolveCommandLineId(details);
    if (lineId) {
      const errorKey = this.errorKeyFor(code);
      this.rawLineErrors.set({ [lineId]: errorKey });
      afterNextRender(() => this.focusFirstError({}, { [lineId]: errorKey }), { injector: this.injector });
    }
    this.showApiErrorToast(code);
  }

  private resolveCommandLineId(details?: Record<string, unknown>): string | null {
    if (!details) return null;
    const direct = details['clientLineId'];
    if (typeof direct === 'string' && direct.length > 0) return direct;
    if (Array.isArray(direct) && typeof direct[0] === 'string' && direct[0].length > 0) {
      return direct[0];
    }
    const lines = this.draft().lines;
    const rawIndex = details['lineIndex'];
    const rawIdx = Array.isArray(rawIndex) ? rawIndex[0] : rawIndex;
    if (typeof rawIdx === 'number' && Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < lines.length) {
      return lines[rawIdx]?.clientLineId ?? null;
    }
    if (typeof rawIdx === 'string' && /^\d+$/.test(rawIdx)) {
      const idx = Number(rawIdx);
      if (idx >= 0 && idx < lines.length) {
        return lines[idx]?.clientLineId ?? null;
      }
    }
    const itemId = details['itemId'];
    if (typeof itemId === 'string' && itemId.length > 0) {
      return lines.find((line) => line.itemId === itemId)?.clientLineId ?? null;
    }
    return null;
  }

  private async handleSaveOutcome(outcome: SaveOutcome, navigateOnCreate = true): Promise<boolean> {
    if (outcome.type !== 'saved' && outcome.type !== 'cancelled' && outcome.type !== 'redirect' && outcome.navigateTo) {
      const targetId = outcome.navigateTo.split('/').pop() ?? '';
      this.bypassGuard = true;
      await this.router.navigateByUrl(outcome.navigateTo, {
        replaceUrl: true,
        state: {
          targetId,
          draft: structuredClone(this.draft()),
          pendingOutcome: { ...outcome, navigateTo: undefined },
        } satisfies CarriedPageState,
      });
      return false;
    }

    switch (outcome.type) {
      case 'saved': {
        this.detailVersionOverride.set(null);
        this.showValidationErrors.set(false);
        this.clearServerErrors();
        this.notify.success(this.transloco.translate(outcome.toastKey));
        if (outcome.navigateTo && navigateOnCreate) {
          this.bypassGuard = true;
          await this.router.navigateByUrl(outcome.navigateTo, { replaceUrl: true });
        } else if (this.docId()) {
          this.lastDetailSyncKey = '';
          invalidateDocumentQueries(this.kind());
          await this.docQuery.refetch();
        } else {
          this.loaded.set(structuredClone(this.draft()));
        }
        return true;
      }

      case 'cancelled':
        return false;

      case 'conflict':
        this.conflictOpen.set(true);
        return false;

      case 'forbidden':
        this.actionForbidden.set(true);
        return false;

      case 'pricingChanged':
        this.documentLines()?.refreshPricing();
        this.notify.warning(this.transloco.translate(outcome.toastKey ?? 'tdpg.toast.pricingChanged'));
        return false;

      case 'costUnavailable':
        this.costUnavailable.set(true);
        this.showApiErrorToast(outcome.code);
        return false;

      case 'invalid':
        this.rawFieldErrors.set(outcome.fieldErrors);
        this.rawLineErrors.set(outcome.lineErrors);
        this.rawLineErrorParams.set(outcome.lineErrorParams ?? {});
        afterNextRender(() => this.focusFirstError(outcome.fieldErrors, outcome.lineErrors), {
          injector: this.injector,
        });
        return false;

      case 'redirect':
        this.notify.info(this.transloco.translate(outcome.toastKey));
        this.bypassGuard = true;
        await this.router.navigateByUrl(outcome.url, { replaceUrl: true });
        return false;

      case 'error':
        this.showApiErrorToast(outcome.code);
        return false;
    }
  }

  private errorKeyFor(code: string): string {
    const tdpgKey = `tdpg.errors.${code}`;
    const tdpgTranslated = this.transloco.translate(tdpgKey);
    if (tdpgTranslated && tdpgTranslated !== tdpgKey) {
      return tdpgKey;
    }
    const tdKey = `td.errors.${code}`;
    const tdTranslated = this.transloco.translate(tdKey);
    if (tdTranslated && tdTranslated !== tdKey) {
      return tdKey;
    }
    return 'td.errors.generic';
  }

  private showApiErrorToast(code: string): void {
    this.notify.error(this.transloco.translate(this.errorKeyFor(code)));
  }

  private clearServerErrors(): void {
    this.actionForbidden.set(false);
    this.costUnavailable.set(false);
    if (Object.keys(this.rawFieldErrors()).length > 0) this.rawFieldErrors.set({});
    if (Object.keys(this.rawLineErrors()).length > 0) this.rawLineErrors.set({});
    if (Object.keys(this.rawLineErrorParams()).length > 0) this.rawLineErrorParams.set({});
  }

  private focusFirstError(fieldErrors: Record<string, string>, lineErrors: Record<string, string>): void {
    for (const key of FIELD_ORDER) {
      if (!fieldErrors[key]) continue;
      if (key === 'paymentTermId') {
        if (this.termsSection()?.focusPaymentTerms()) return;
      } else if (key === 'notes') {
        if (this.termsSection()?.focusNotes()) return;
      } else if (this.headerFields()?.focusField(key)) {
        return;
      }
    }
    if (Object.keys(lineErrors).length > 0 || fieldErrors['lines']) {
      const el = this.host.nativeElement.querySelector<HTMLElement>(
        'app-document-lines [aria-invalid="true"], app-document-lines input:not([disabled]), app-document-lines button:not([disabled])',
      );
      if (el) {
        el.scrollIntoView({ behavior: smoothScrollBehavior(), block: 'center' });
        el.focus({ preventScroll: true });
      }
    }
  }

  private askConfirm(tone: ConfirmTone, titleKey: string, textKey: string, confirmKey: string): Promise<boolean> {
    this.settleConfirm(false);
    this.confirmSpec.set({
      tone,
      titleKey,
      textKey,
      confirmKey,
      cancelKey: 'td.common.cancel',
    });
    return new Promise<boolean>((resolve) => {
      this.confirmResolver = resolve;
      afterNextRender(
        () => {
          void this.confirmDialog()
            .open()
            .then((confirmed) => this.settleConfirm(confirmed));
        },
        { injector: this.injector },
      );
    });
  }

  private settleConfirm(confirmed: boolean): void {
    const resolve = this.confirmResolver;
    this.confirmResolver = null;
    resolve?.(confirmed);
  }

  private hasBranchGrant(key: string): boolean {
    const grants = runInInjectionContext(this.injector, () => branchGrants(key));
    if (grants === 'ALL') return true;
    const branchId = this.scope.branch()?.id;
    return Boolean(branchId) && grants.has(branchId);
  }
}
