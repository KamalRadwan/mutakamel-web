import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerChevronDown,
  tablerLoader2,
  tablerLock,
  tablerRefresh,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { PricingPanel } from '../../document-lines/pricing-panel/pricing-panel';
import {
  type ContactOption,
  type CustomerOption,
  type DiscountPolicy,
  type ReceivingNodeOption,
  type SupplierAccountOption,
  type SupplierOption,
  getOpportunity,
  listContactOptions,
  listCustomerOptions,
  listOpportunityOptions,
  listReceivingNodes,
  listSupplierOptions,
} from '../../shared/documents.api';
import type {
  AnyDocumentDetail,
  DocumentKind,
  PricingIntent,
  PurchaseOrderDetail,
  SourceCrmOpportunity,
} from '../../shared/document.model';
import type { DocumentDraft } from '../document-draft';
import { smoothScrollBehavior } from '../../../../../shared/ui/scroll/scroll-into-view';
import { translationEvents } from '../../../../../core/i18n/translation-events';

export type HeaderFieldMode = 'new' | 'edit' | 'readonly' | 'convert';

export interface CrmPrefillParams {
  customerProfileId: string | null;
  opportunityId: string | null;
}

type SearchMenuKind = 'customer' | 'supplier' | 'opportunity';

interface PopoverPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const CURRENCIES: readonly string[] = ['EGP', 'USD', 'SAR', 'AED', 'KWD'];
const DEBOUNCE_MS = 250;
const MAX_CUSTOMER_PREFILL_PAGES = 20;

function todayIsoDate(): string {
  const now = new Date();
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDmy(iso: string | null | undefined): string {
  if (!iso) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return '—';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function headerStr(header: Record<string, unknown>, key: string): string {
  const val = header[key];
  return typeof val === 'string' ? val : '';
}

function headerOpt(header: Record<string, unknown>, key: string): string | null {
  const val = header[key];
  return typeof val === 'string' && val.trim().length > 0 ? val : null;
}

@Component({
  selector: 'app-header-fields',
  imports: [NgIcon, TranslocoPipe, Button, DateField, Dropdown, Field, PricingPanel],
  providers: [
    provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-documents-page', alias: 'tdpg' }),
    provideIcons({
      tablerCheck,
      tablerChevronDown,
      tablerLoader2,
      tablerLock,
      tablerRefresh,
      tablerSearch,
      tablerX,
    }),
  ],
  templateUrl: './header-fields.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'closeSearchMenu(false)',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class HeaderFields {
  private static nextId = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  // Deferred so a synchronous scope load never writes the signal while Angular renders (NG0600).
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lang = inject(LanguageState).current;

  private readonly pricingPanel = viewChild(PricingPanel);
  private readonly customerTrigger = viewChild<ElementRef<HTMLButtonElement>>('customerTrigger');
  private readonly supplierTrigger = viewChild<ElementRef<HTMLButtonElement>>('supplierTrigger');
  private readonly opportunityTrigger = viewChild<ElementRef<HTMLButtonElement>>('opportunityTrigger');
  private readonly searchMenuRef = viewChild<ElementRef<HTMLElement>>('searchMenu');
  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly uid = `doc-hdr-${++HeaderFields.nextId}`;
  protected readonly todayIso = todayIsoDate();

  readonly kind = input.required<DocumentKind>();
  readonly draft = model.required<DocumentDraft>();
  readonly detail = input<AnyDocumentDetail | null>(null);
  readonly mode = input.required<HeaderFieldMode>();
  readonly fieldErrors = input<Record<string, string>>({});
  readonly discountPolicy = input<DiscountPolicy | null>(null);
  readonly sourcePartyName = input<string | null>(null);
  readonly crmPrefill = input<CrmPrefillParams | null>(null);

  readonly opportunityResolved = output<SourceCrmOpportunity | null>();
  readonly autoDefaultApplied = output<Record<string, unknown>>();

  readonly pricingReasonRequired = computed(() => this.pricingPanel()?.reasonRequired() ?? false);

  protected readonly openMenu = signal<SearchMenuKind | null>(null);
  protected readonly popoverPlaced = signal(false);
  protected readonly popoverPlace = signal<PopoverPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly searchQuery = signal('');
  protected readonly activeOptionId = signal<string | null>(null);
  protected readonly searchLabelKey = computed(() => {
    const kind = this.openMenu();
    return kind === 'customer'
      ? 'tdpg.fields.customerSearchPlaceholder'
      : kind === 'supplier'
        ? 'tdpg.fields.supplierSearchPlaceholder'
        : 'tdpg.fields.opportunitySearchPlaceholder';
  });

  protected readonly customers = signal<CustomerOption[]>([]);
  protected readonly customersLoading = signal(false);
  protected readonly customersError = signal(false);
  protected readonly customersNextCursor = signal<string | null>(null);
  protected readonly selectedCustomer = signal<CustomerOption | null>(null);

  protected readonly contacts = signal<ContactOption[]>([]);
  protected readonly contactsLoading = signal(false);
  protected readonly contactsError = signal(false);
  private readonly contactsRetryTick = signal(0);

  protected readonly opportunities = signal<SourceCrmOpportunity[]>([]);
  protected readonly opportunitiesLoading = signal(false);
  protected readonly opportunitiesError = signal(false);
  private readonly opportunitiesLoadedPartyId = signal<string | null>(null);

  protected readonly suppliers = signal<SupplierOption[]>([]);
  protected readonly suppliersLoading = signal(false);
  protected readonly suppliersError = signal(false);
  protected readonly selectedSupplier = signal<SupplierOption | null>(null);

  protected readonly receivingNodes = signal<ReceivingNodeOption[]>([]);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private popoverSeq = 0;
  private customerSeq = 0;
  private supplierSeq = 0;
  private contactSeq = 0;
  private opportunitySeq = 0;
  private nodesSeq = 0;
  private customerResolveSeq = 0;
  private supplierResolveSeq = 0;
  private lastPrefillKey = '';

  protected readonly isQuotation = computed(() => this.kind() === 'quotation');
  protected readonly isSalesOrder = computed(() => this.kind() === 'sales-order');
  protected readonly isPurchaseOrder = computed(() => this.kind() === 'purchase-order');
  protected readonly isPurchaseQuotation = computed(() => this.kind() === 'purchase-quotation');

  protected readonly lifecycleStatus = computed(() => this.detail()?.lifecycleStatus ?? 'DRAFT');
  protected readonly poApprovalStatus = computed(() =>
    this.isPurchaseOrder() ? (this.detail() as PurchaseOrderDetail | null)?.approvalStatus ?? 'NOT_REQUIRED' : 'NOT_REQUIRED',
  );

  protected readonly customerEditable = computed(() => this.mode() === 'new');
  protected readonly currencyEditable = computed(() =>
    this.isPurchaseQuotation()
      ? this.mode() === 'new' || (this.mode() === 'edit' && this.lifecycleStatus() === 'DRAFT')
      : this.mode() === 'new',
  );
  protected readonly validUntilEditable = computed(() => {
    if (this.isQuotation()) {
      return (
        this.mode() === 'new' ||
        (this.mode() === 'edit' && (this.lifecycleStatus() === 'DRAFT' || this.lifecycleStatus() === 'SENT'))
      );
    }
    if (this.isPurchaseQuotation()) {
      return this.mode() === 'new' || (this.mode() === 'edit' && this.lifecycleStatus() === 'DRAFT');
    }
    return false;
  });

  protected readonly contactEditable = computed(() => {
    if (this.isQuotation()) {
      return this.mode() === 'new' || (this.mode() === 'edit' && this.lifecycleStatus() === 'DRAFT');
    }
    if (this.isSalesOrder()) {
      return (
        this.mode() === 'new' ||
        this.mode() === 'convert' ||
        (this.mode() === 'edit' && this.lifecycleStatus() === 'DRAFT')
      );
    }
    return false;
  });

  protected readonly referenceEditable = computed(() => {
    if (this.isQuotation()) {
      return this.mode() === 'new' || (this.mode() === 'edit' && this.lifecycleStatus() === 'DRAFT');
    }
    if (this.isSalesOrder()) {
      return (
        this.mode() === 'new' ||
        this.mode() === 'convert' ||
        (this.mode() === 'edit' && this.lifecycleStatus() === 'DRAFT')
      );
    }
    if (this.isPurchaseOrder()) {
      return (
        this.mode() === 'new' ||
        this.mode() === 'convert' ||
        (this.mode() === 'edit' && this.lifecycleStatus() === 'DRAFT' && this.poApprovalStatus() !== 'PENDING')
      );
    }
    return this.mode() === 'new' || (this.mode() === 'edit' && this.lifecycleStatus() === 'DRAFT');
  });

  protected readonly opportunityEditable = computed(
    () => this.isQuotation() && (this.mode() === 'new' || (this.mode() === 'edit' && this.lifecycleStatus() === 'DRAFT')),
  );

  protected readonly pricingEditable = computed(
    () =>
      this.isQuotation() &&
      (this.mode() === 'new' ||
        (this.mode() === 'edit' && (this.lifecycleStatus() === 'DRAFT' || this.lifecycleStatus() === 'SENT'))),
  );

  protected readonly supplierEditable = computed(() =>
    this.isPurchaseQuotation()
      ? this.mode() === 'new' || (this.mode() === 'edit' && this.lifecycleStatus() === 'DRAFT')
      : this.mode() === 'new',
  );

  protected readonly poFieldsEditable = computed(
    () =>
      this.isPurchaseOrder() &&
      (this.mode() === 'new' ||
        this.mode() === 'convert' ||
        (this.mode() === 'edit' && this.lifecycleStatus() === 'DRAFT' && this.poApprovalStatus() !== 'PENDING')),
  );

  protected readonly partyId = computed(() => headerOpt(this.draft().header, 'partyId'));
  protected readonly contactPartyId = computed(() => headerOpt(this.draft().header, 'contactPartyId'));
  protected readonly currencyCode = computed(() => headerStr(this.draft().header, 'currencyCode'));
  protected readonly draftReference = computed(() => headerStr(this.draft().header, 'draftReference'));
  protected readonly pqReference = computed(() => headerStr(this.draft().header, 'reference'));
  protected readonly sourceCrmOpportunityId = computed(() => headerOpt(this.draft().header, 'sourceCrmOpportunityId'));
  protected readonly supplierPartyId = computed(
    () => headerOpt(this.draft().header, 'supplierPartyId') ?? headerOpt(this.draft().header, 'partyId'),
  );
  protected readonly supplierAccountId = computed(() => headerOpt(this.draft().header, 'supplierAccountId'));
  protected readonly receivingNodeId = computed(() => headerOpt(this.draft().header, 'receivingNodeId'));

  protected readonly isPersonCustomer = computed(() => this.selectedCustomer()?.partyType === 'PERSON');

  protected readonly customerDisplay = computed(() => {
    const selected = this.selectedCustomer();
    if (selected && selected.partyId === this.partyId()) {
      return selected.displayName;
    }
    const detail = this.detail();
    if (detail && detail.partyId === this.partyId()) {
      return detail.partySnapshot.displayName;
    }
    return this.sourcePartyName() ?? '';
  });

  protected readonly contactDisplay = computed(() => {
    const id = this.contactPartyId();
    if (!id) return '';
    return this.contacts().find((c) => c.contactPartyId === id)?.displayName ?? id;
  });

  protected readonly supplierDisplay = computed(() => {
    const selected = this.selectedSupplier();
    if (selected && selected.partyId === this.supplierPartyId()) {
      return selected.displayName;
    }
    const detail = this.detail();
    if (detail && detail.partyId === this.supplierPartyId()) {
      return detail.partySnapshot.displayName;
    }
    return this.sourcePartyName() ?? '';
  });

  protected readonly supplierAccounts = computed<SupplierAccountOption[]>(() => {
    const supId = this.supplierPartyId();
    if (!supId) return [];
    const selected = this.selectedSupplier();
    if (selected && selected.partyId === supId) return selected.accounts;
    return this.suppliers().find((s) => s.partyId === supId)?.accounts ?? [];
  });

  protected readonly supplierAccountSingle = computed(() => this.supplierAccounts().length === 1);

  protected readonly supplierAccountDisplay = computed(() => {
    const accId = this.supplierAccountId();
    if (!accId) return '';
    const found = this.supplierAccounts().find((a) => a.id === accId);
    return found ? this.supplierAccountLabel(found) : accId;
  });

  /**
   * "<supplier name> · <currency>", or the name alone when the account has no credit currency. Core parties have no
   * code, so accounts[].code is always null (coordinator 2026-11-22); tax and registration numbers are not used.
   */
  private supplierAccountLabel(account: SupplierAccountOption): string {
    const name = this.supplierDisplay();
    return account.currencyCode ? `${name} · ${account.currencyCode}` : name;
  }

  protected readonly receivingWarehouseDisplay = computed(() => {
    const nodeId = this.receivingNodeId();
    if (!nodeId) return '';
    return this.receivingNodes().find((n) => n.id === nodeId)?.name ?? nodeId;
  });

  protected readonly businessDateDisplay = computed(() => {
    const raw = this.detail()?.businessDate ?? this.todayIso;
    return formatDmy(raw);
  });

  protected readonly validUntilDisplay = computed(() => formatDmy(this.draft().validUntil));

  private readonly fallbackOpportunityParams = computed<{ id: string; lang: string } | undefined>(
    () => {
      if (!this.isQuotation()) return undefined;
      const id = this.sourceCrmOpportunityId();
      if (!id) return undefined;
      const pid = this.partyId();
      if (pid && this.opportunitiesLoadedPartyId() !== pid) return undefined;
      if (this.opportunities().some((o) => o.id === id)) return undefined;
      return { id, lang: this.lang() };
    },
    { equal: (a, b) => a?.id === b?.id && a?.lang === b?.lang },
  );

  private readonly fallbackOpportunity = resource({
    params: () => this.fallbackOpportunityParams(),
    loader: async ({ params }) => {
      try {
        return await getOpportunity(params.id);
      } catch {
        return null;
      }
    },
  });

  protected readonly selectedOpportunity = computed<SourceCrmOpportunity | null>(() => {
    const id = this.sourceCrmOpportunityId();
    if (!id) return null;
    const fromList = this.opportunities().find((o) => o.id === id);
    if (fromList) return fromList;
    const resolved = this.fallbackOpportunity.hasValue() ? this.fallbackOpportunity.value() : null;
    return resolved && resolved.id === id ? resolved : null;
  });

  protected readonly opportunityResolving = computed<boolean>(() => {
    if (!this.isQuotation()) return false;
    const id = this.sourceCrmOpportunityId();
    if (!id || this.selectedOpportunity()) return false;
    const pid = this.partyId();
    if (pid && this.opportunitiesLoadedPartyId() !== pid) return true;
    return this.fallbackOpportunity.isLoading();
  });

  protected readonly opportunityUnavailable = computed<boolean>(() => {
    if (!this.isQuotation()) return false;
    const id = this.sourceCrmOpportunityId();
    if (!id || this.selectedOpportunity() || this.opportunityResolving()) return false;
    const status = this.fallbackOpportunity.status();
    if (status === 'error') return true;
    return status === 'resolved' && this.fallbackOpportunity.hasValue() && this.fallbackOpportunity.value() === null;
  });

  protected readonly filteredOpportunities = computed<SourceCrmOpportunity[]>(() => {
    const needle = this.searchQuery().trim().toLowerCase();
    const base = this.opportunities();
    const selected = this.selectedOpportunity();
    const list = selected && !base.some((o) => o.id === selected.id) ? [selected, ...base] : base;
    if (!needle) return list;
    return list.filter(
      (opp) => opp.name.toLowerCase().includes(needle) || opp.stageName.toLowerCase().includes(needle),
    );
  });

  protected readonly showUnavailableOpportunityOption = computed<boolean>(() => {
    this.i18n();
    if (!this.opportunityUnavailable()) return false;
    const id = this.sourceCrmOpportunityId();
    if (!id) return false;
    const needle = this.searchQuery().trim().toLowerCase();
    if (!needle) return true;
    const label = this.transloco.translate('tdpg.fields.opportunityNotAvailable').toLowerCase();
    return label.includes(needle) || id.toLowerCase().includes(needle);
  });

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() =>
    CURRENCIES.map((code) => ({ value: code, label: code })),
  );

  protected readonly contactOptions = computed<DropdownOption<string | null>[]>(() =>
    this.contacts().map((c) => ({
      value: c.contactPartyId,
      label: c.role ? `${c.displayName} — ${c.role}` : c.displayName,
    })),
  );

  protected readonly supplierAccountOptions = computed<DropdownOption<string | null>[]>(() =>
    this.supplierAccounts().map((a) => ({
      value: a.id,
      label: this.supplierAccountLabel(a),
    })),
  );

  protected readonly receivingNodeOptions = computed<DropdownOption<string | null>[]>(() =>
    this.receivingNodes().map((n) => ({
      value: n.id,
      label: n.name,
    })),
  );

  protected readonly pricingErrors = computed<string | null>(() => {
    const errs = this.fieldErrors();
    return errs['pricingReason'] ?? errs['pricingValue'] ?? null;
  });

  constructor() {
    // Load contacts whenever partyId changes for quotation / sales-order.
    effect(() => {
      const need = this.isQuotation() || this.isSalesOrder();
      const pid = this.partyId();
      this.lang();
      this.contactsRetryTick();
      if (!need || !pid) {
        this.contactSeq++;
        untracked(() => {
          this.contacts.set([]);
          this.contactsError.set(false);
          this.contactsLoading.set(false);
        });
        return;
      }
      untracked(() => void this.loadContacts(pid));
    });

    // Resolve customer metadata (including partyType for PERSON contact disablement).
    effect(() => {
      const need = this.isQuotation() || this.isSalesOrder();
      const pid = this.partyId();
      this.lang();
      if (!need || !pid) {
        untracked(() => this.selectedCustomer.set(null));
        return;
      }
      if (untracked(() => this.selectedCustomer()?.partyId === pid)) {
        // Still re-resolve on language change to keep displayName fresh.
      }
      untracked(() => void this.resolveCustomerById(pid));
    });

    // Load opportunities for quotation customer.
    effect(() => {
      const isQ = this.isQuotation();
      const pid = this.partyId();
      this.lang();
      if (!isQ || !pid) {
        this.opportunitySeq++;
        untracked(() => {
          this.opportunities.set([]);
          this.opportunitiesLoading.set(false);
          this.opportunitiesError.set(false);
          this.opportunitiesLoadedPartyId.set(null);
        });
        return;
      }
      untracked(() => {
        if (this.opportunitiesLoadedPartyId() !== pid) {
          this.opportunities.set([]);
          this.opportunitiesLoadedPartyId.set(null);
        }
        void this.loadOpportunities(pid);
      });
    });

    // Emit resolved opportunity for page header tag.
    effect(() => {
      this.opportunityResolved.emit(this.selectedOpportunity());
    });

    // Load supplier options & receiving nodes for purchase documents.
    effect(() => {
      const isPo = this.isPurchaseOrder();
      const isPq = this.isPurchaseQuotation();
      const supId = this.supplierPartyId();
      this.lang();
      if (!isPo && !isPq) return;
      if (isPo) {
        untracked(() => void this.loadReceivingNodes());
      }
      if (supId) {
        untracked(() => void this.resolveSupplierById(supId));
      } else {
        untracked(() => this.selectedSupplier.set(null));
      }
    });

    // Auto-select single supplier account on PO when supplier has exactly 1 account.
    effect(() => {
      if (!this.isPurchaseOrder() || !this.poFieldsEditable()) return;
      const accounts = this.supplierAccounts();
      if (accounts.length !== 1) return;
      const onlyId = accounts[0].id;
      const currentAcc = untracked(() => this.supplierAccountId());
      if (currentAcc !== onlyId) {
        untracked(() => {
          const patch: Record<string, unknown> = { supplierAccountId: onlyId };
          if (!headerStr(this.draft().header, 'currencyCode') && accounts[0].currencyCode) {
            patch['currencyCode'] = accounts[0].currencyCode;
          }
          const updated = { ...this.draft(), header: { ...this.draft().header, ...patch } };
          this.draft.set(updated);
          if (this.mode() === 'convert') {
            this.autoDefaultApplied.emit(patch);
          }
        });
      }
    });

    // Handle CRM prefill on /trade/documents/quotations/new?crmOpportunityId&customerProfileId.
    effect(() => {
      const prefill = this.crmPrefill();
      const active = this.isQuotation() && this.mode() === 'new';
      if (!active || !prefill || (!prefill.customerProfileId && !prefill.opportunityId)) return;
      const key = `${prefill.customerProfileId ?? ''}:${prefill.opportunityId ?? ''}`;
      if (key === this.lastPrefillKey) return;
      this.lastPrefillKey = key;
      untracked(() => void this.applyCrmPrefill(prefill));
    });

    // Reposition open search menu when content changes.
    effect(() => {
      const menu = this.openMenu();
      this.customers();
      this.customersLoading();
      this.customersError();
      this.suppliers();
      this.suppliersLoading();
      this.suppliersError();
      this.opportunities();
      this.opportunitiesLoading();
      this.opportunitiesError();
      this.searchQuery();
      if (menu) {
        untracked(() => this.schedulePlace(menu));
      }
    });

    const onScroll = (event: Event) => {
      if (!this.openMenu()) return;
      const target = event.target;
      if (target instanceof Node && this.searchMenuRef()?.nativeElement.contains(target)) {
        return;
      }
      this.closeSearchMenu(false);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      this.clearDebounce();
      document.removeEventListener('scroll', onScroll, { capture: true });
    });
  }

  focusField(fieldKey: string): boolean {
    let target: HTMLElement | null = null;
    if (fieldKey === 'pricingReason') {
      target = this.host.nativeElement.querySelector<HTMLElement>('input[id$="-reason"]');
    } else if (fieldKey === 'pricingValue') {
      target = this.host.nativeElement.querySelector<HTMLElement>('input[id$="-value"]');
    } else {
      target = this.host.nativeElement.querySelector<HTMLElement>(`#${this.uid}-${fieldKey}`);
    }
    if (!target) return false;
    target.scrollIntoView({ behavior: smoothScrollBehavior(), block: 'center' });
    target.focus({ preventScroll: true });
    return true;
  }

  protected controlBoxClasses(hasError: boolean, disabled = false): string {
    const base = 'flex h-field w-full items-center gap-6 rounded-8 border px-8 text-12 transition-colors duration-fast';
    if (disabled) {
      return `${base} cursor-not-allowed border-border-field bg-neutral-soft text-text-placeholder`;
    }
    if (hasError) {
      return `${base} border-danger-border bg-surface-field text-text ring-2 ring-danger-halo`;
    }
    return `${base} border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo`;
  }

  protected openSearchMenu(kind: SearchMenuKind): void {
    if (kind === 'customer' && !this.customerEditable()) return;
    if (kind === 'supplier' && !this.supplierEditable()) return;
    if (kind === 'opportunity' && (!this.opportunityEditable() || !this.partyId())) return;

    if (this.openMenu() === kind) {
      this.closeSearchMenu(true);
      return;
    }

    this.clearDebounce();
    this.searchQuery.set('');
    this.popoverPlaced.set(false);
    const trigger = this.triggerElFor(kind);
    if (trigger) {
      this.popoverPlace.set(this.initialPlace(trigger));
    }
    this.openMenu.set(kind);
    this.schedulePlace(kind);

    if (kind === 'customer') {
      void this.loadCustomers('');
    } else if (kind === 'supplier') {
      void this.loadSuppliers('');
    }

    afterNextRender(() => this.searchInputRef()?.nativeElement.focus(), { injector: this.injector });
  }

  protected onSearchInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.searchQuery.set(text);
    this.activeOptionId.set(null);
    const menu = this.openMenu();
    if (menu === 'opportunity') return;

    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (menu === 'customer') {
        void this.loadCustomers(text);
      } else if (menu === 'supplier') {
        void this.loadSuppliers(text);
      }
    }, DEBOUNCE_MS);
  }

  protected loadMoreCustomers(): void {
    const cursor = this.customersNextCursor();
    if (!cursor || this.customersLoading()) return;
    void this.loadCustomers(this.searchQuery(), cursor);
  }

  protected retryMenuLoad(): void {
    const menu = this.openMenu();
    if (menu === 'customer') {
      void this.loadCustomers(this.searchQuery());
    } else if (menu === 'supplier') {
      void this.loadSuppliers(this.searchQuery());
    } else if (menu === 'opportunity' && this.partyId()) {
      void this.loadOpportunities(this.partyId()!);
    }
  }

  protected retryContacts(): void {
    this.contactsRetryTick.update((n) => n + 1);
  }

  protected isCustomerBlocked(opt: CustomerOption): boolean {
    return !opt.quotationSelectable || opt.accountStatus === 'BLOCKED';
  }

  protected chooseCustomer(opt: CustomerOption): void {
    if (!this.customerEditable() || this.isCustomerBlocked(opt)) return;
    this.selectedCustomer.set(opt);
    this.draft.update((curr) => ({
      ...curr,
      header: {
        ...curr.header,
        partyId: opt.partyId,
        ...(this.isQuotation()
          ? { crmCustomerProfileId: opt.crmCustomerProfileId, sourceCrmOpportunityId: null }
          : {}),
        contactPartyId: null,
      },
    }));
    this.closeSearchMenu(true);
  }

  protected chooseSupplier(opt: SupplierOption): void {
    if (!this.supplierEditable()) return;
    this.selectedSupplier.set(opt);
    this.draft.update((curr) => {
      const nextHeader: Record<string, unknown> = {
        ...curr.header,
        supplierPartyId: opt.partyId,
      };
      if (this.isPurchaseOrder()) {
        if (opt.accounts.length === 1) {
          nextHeader['supplierAccountId'] = opt.accounts[0].id;
          if (!headerStr(nextHeader, 'currencyCode') && opt.accounts[0].currencyCode) {
            nextHeader['currencyCode'] = opt.accounts[0].currencyCode;
          }
        } else {
          const prevAcc = headerOpt(nextHeader, 'supplierAccountId');
          const stillValid = prevAcc && opt.accounts.some((a) => a.id === prevAcc);
          nextHeader['supplierAccountId'] = stillValid ? prevAcc : null;
        }
      } else if (this.isPurchaseQuotation() && !headerStr(nextHeader, 'currencyCode') && opt.accounts[0]?.currencyCode) {
        nextHeader['currencyCode'] = opt.accounts[0].currencyCode;
      }
      return { ...curr, header: nextHeader };
    });
    this.closeSearchMenu(true);
  }

  protected chooseOpportunity(opp: SourceCrmOpportunity): void {
    if (!this.opportunityEditable()) return;
    this.patchHeader({ sourceCrmOpportunityId: opp.id });
    this.closeSearchMenu(true);
  }

  protected clearOpportunity(event: Event): void {
    event.stopPropagation();
    if (!this.opportunityEditable()) return;
    this.patchHeader({ sourceCrmOpportunityId: null });
    this.opportunityTrigger()?.nativeElement.focus();
  }

  protected onContactChange(contactPartyId: string | null): void {
    if (!this.contactEditable()) return;
    this.patchHeader({ contactPartyId });
  }

  protected clearContact(event: Event): void {
    event.stopPropagation();
    if (!this.contactEditable()) return;
    this.patchHeader({ contactPartyId: null });
  }

  protected onCurrencyChange(currencyCode: string): void {
    if (!this.currencyEditable()) return;
    this.patchHeader({ currencyCode });
  }

  protected onValidUntilChange(validUntil: string | null): void {
    if (!this.validUntilEditable()) return;
    this.draft.update((curr) => ({ ...curr, validUntil }));
  }

  protected onDraftReferenceInput(event: Event): void {
    if (!this.referenceEditable()) return;
    this.patchHeader({ draftReference: (event.target as HTMLInputElement).value });
  }

  protected onPqReferenceInput(event: Event): void {
    if (!this.referenceEditable()) return;
    this.patchHeader({ reference: (event.target as HTMLInputElement).value });
  }

  protected onSupplierAccountChange(supplierAccountId: string | null): void {
    if (!this.poFieldsEditable()) return;
    this.patchHeader({ supplierAccountId });
  }

  protected onReceivingNodeChange(receivingNodeId: string | null): void {
    if (!this.poFieldsEditable()) return;
    this.patchHeader({ receivingNodeId });
  }

  protected onPricingChange(pricing: PricingIntent): void {
    if (!this.pricingEditable()) return;
    this.draft.update((curr) => ({ ...curr, pricing }));
  }

  protected onDocumentClick(event: Event): void {
    const menu = this.openMenu();
    if (!menu) return;
    const target = event.target;
    if (!(target instanceof Node)) {
      this.closeSearchMenu(false);
      return;
    }
    if (
      this.searchMenuRef()?.nativeElement.contains(target) ||
      this.triggerElFor(menu)?.contains(target)
    ) {
      return;
    }
    this.closeSearchMenu(false);
  }

  protected onSearchArrow(event: Event, step: 1 | -1): void {
    const list = this.host.nativeElement.querySelector<HTMLElement>('[role="listbox"]');
    if (!list) return;
    const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="option"] button:not([disabled])'));
    if (buttons.length === 0) return;
    event.preventDefault();
    const current = buttons.indexOf(this.host.nativeElement.ownerDocument.activeElement as HTMLButtonElement);
    const next = current === -1 ? (step === 1 ? 0 : buttons.length - 1) : current + step;
    if (next < 0 || next >= buttons.length) {
      this.activeOptionId.set(null);
      this.searchInputRef()?.nativeElement.focus();
      return;
    }
    buttons[next].focus();
    this.activeOptionId.set(buttons[next].closest('[role="option"]')?.id ?? null);
  }

  protected onEscape(event: Event): void {
    if (!this.openMenu()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeSearchMenu(true);
  }

  protected closeSearchMenu(restoreFocus: boolean): void {
    const current = this.openMenu();
    this.clearDebounce();
    this.popoverSeq++;
    this.openMenu.set(null);
    this.popoverPlaced.set(false);
    this.searchQuery.set('');
    this.activeOptionId.set(null);
    if (restoreFocus && current) {
      this.triggerElFor(current)?.focus();
    }
  }

  protected contactHintLabel(): string {
    this.i18n();
    return this.transloco.translate('tdpg.fields.contactHint');
  }

  private patchHeader(patch: Record<string, unknown>): void {
    this.draft.update((curr) => ({
      ...curr,
      header: { ...curr.header, ...patch },
    }));
  }

  private clearDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private triggerElFor(kind: SearchMenuKind): HTMLButtonElement | undefined {
    if (kind === 'customer') return this.customerTrigger()?.nativeElement;
    if (kind === 'supplier') return this.supplierTrigger()?.nativeElement;
    return this.opportunityTrigger()?.nativeElement;
  }

  private async loadCustomers(search: string, cursor?: string): Promise<void> {
    const seq = ++this.customerSeq;
    this.customersLoading.set(true);
    this.customersError.set(false);
    try {
      const page = await listCustomerOptions(search.trim() || undefined, cursor);
      if (seq !== this.customerSeq) return;
      if (cursor) {
        this.customers.update((prev) => [...prev, ...page.items]);
      } else {
        this.customers.set(page.items);
      }
      this.customersNextCursor.set(page.nextCursor);
    } catch {
      if (seq !== this.customerSeq) return;
      if (!cursor) this.customers.set([]);
      this.customersError.set(true);
    } finally {
      if (seq === this.customerSeq) {
        this.customersLoading.set(false);
      }
    }
  }

  private async resolveCustomerById(partyId: string): Promise<void> {
    const seq = ++this.customerResolveSeq;
    try {
      let cursor: string | undefined;
      for (let i = 0; i < MAX_CUSTOMER_PREFILL_PAGES; i += 1) {
        const page = await listCustomerOptions(undefined, cursor);
        if (seq !== this.customerResolveSeq) return;
        const match = page.items.find((item) => item.partyId === partyId);
        if (match) {
          this.selectedCustomer.set(match);
          return;
        }
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
    } catch {
      // Best-effort metadata lookup for existing documents.
    }
  }

  private async loadContacts(partyId: string): Promise<void> {
    const seq = ++this.contactSeq;
    this.contactsLoading.set(true);
    this.contactsError.set(false);
    try {
      const list = await listContactOptions(partyId);
      if (seq !== this.contactSeq) return;
      this.contacts.set(list);
    } catch {
      if (seq !== this.contactSeq) return;
      this.contacts.set([]);
      this.contactsError.set(true);
    } finally {
      if (seq === this.contactSeq) {
        this.contactsLoading.set(false);
      }
    }
  }

  private async loadOpportunities(partyId: string): Promise<void> {
    const seq = ++this.opportunitySeq;
    this.opportunitiesLoading.set(true);
    this.opportunitiesError.set(false);
    try {
      const list = await listOpportunityOptions(partyId);
      if (seq !== this.opportunitySeq) return;
      this.opportunities.set(list);
    } catch {
      if (seq !== this.opportunitySeq) return;
      this.opportunities.set([]);
      this.opportunitiesError.set(true);
    } finally {
      if (seq === this.opportunitySeq) {
        this.opportunitiesLoading.set(false);
        this.opportunitiesLoadedPartyId.set(partyId);
      }
    }
  }

  private async loadSuppliers(search: string): Promise<void> {
    const seq = ++this.supplierSeq;
    this.suppliersLoading.set(true);
    this.suppliersError.set(false);
    try {
      const list = await listSupplierOptions(search.trim() || undefined);
      if (seq !== this.supplierSeq) return;
      this.suppliers.set(list);
    } catch {
      if (seq !== this.supplierSeq) return;
      this.suppliers.set([]);
      this.suppliersError.set(true);
    } finally {
      if (seq === this.supplierSeq) {
        this.suppliersLoading.set(false);
      }
    }
  }

  private async resolveSupplierById(partyId: string): Promise<void> {
    const seq = ++this.supplierResolveSeq;
    try {
      const list = await listSupplierOptions();
      if (seq !== this.supplierResolveSeq) return;
      this.suppliers.set(list);
      const match = list.find((s) => s.partyId === partyId) ?? null;
      this.selectedSupplier.set(match);
    } catch {
      // Best-effort lookup; dropdown retry handles user-triggered refresh.
    }
  }

  private async loadReceivingNodes(): Promise<void> {
    const seq = ++this.nodesSeq;
    try {
      const list = await listReceivingNodes();
      if (seq !== this.nodesSeq) return;
      this.receivingNodes.set(list);
    } catch {
      if (seq !== this.nodesSeq) return;
      this.receivingNodes.set([]);
    }
  }

  private async applyCrmPrefill(prefill: CrmPrefillParams): Promise<void> {
    if (!prefill.customerProfileId) return;
    try {
      let cursor: string | undefined;
      let matchedCustomer: CustomerOption | null = null;
      for (let i = 0; i < MAX_CUSTOMER_PREFILL_PAGES; i += 1) {
        const page = await listCustomerOptions(undefined, cursor);
        const hit = page.items.find((c) => c.crmCustomerProfileId === prefill.customerProfileId);
        if (hit) {
          matchedCustomer = hit;
          break;
        }
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }

      if (!matchedCustomer || this.isCustomerBlocked(matchedCustomer)) return;
      if (this.mode() !== 'new' || !this.isQuotation()) return;
      if (headerOpt(this.draft().header, 'partyId')) return;

      let matchedOppId: string | null = null;
      if (prefill.opportunityId) {
        const opps = await listOpportunityOptions(matchedCustomer.partyId);
        this.opportunities.set(opps);
        const oppHit = opps.find((o) => o.id === prefill.opportunityId);
        if (oppHit) {
          matchedOppId = oppHit.id;
        }
      }

      if (this.mode() !== 'new' || !this.isQuotation() || headerOpt(this.draft().header, 'partyId')) {
        return;
      }

      const patch: Record<string, unknown> = {
        partyId: matchedCustomer.partyId,
        crmCustomerProfileId: matchedCustomer.crmCustomerProfileId,
        sourceCrmOpportunityId: matchedOppId,
      };
      this.selectedCustomer.set(matchedCustomer);
      this.draft.update((curr) => ({
        ...curr,
        header: {
          ...curr.header,
          ...patch,
        },
      }));
      this.autoDefaultApplied.emit(patch);
    } catch {
      // Drop prefill silently on error.
    }
  }

  private initialPlace(anchorEl: HTMLElement): PopoverPlace {
    const rect = rectInPage(anchorEl);
    const { width } = viewport();
    const rtl = getComputedStyle(anchorEl).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private schedulePlace(kind: SearchMenuKind): void {
    const seq = ++this.popoverSeq;
    const run = () => this.placePopover(seq, kind);
    queueMicrotask(run);
    afterNextRender(run, { injector: this.injector });
  }

  private placePopover(seq: number, kind: SearchMenuKind): void {
    if (seq !== this.popoverSeq || this.openMenu() !== kind) return;
    const anchorEl = this.triggerElFor(kind);
    const menuEl = this.searchMenuRef()?.nativeElement;
    if (!anchorEl || !menuEl) return;

    menuEl.style.maxHeight = '';
    const rect = rectInPage(anchorEl);
    const menuRect = rectInPage(menuEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(anchorEl).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = menuRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = menuRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? menuRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + menuRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - menuRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - menuRect.width));

    this.popoverPlace.set({ top, start, width: rect.width, maxHeight });
    this.popoverPlaced.set(true);

    menuEl.style.top = `${top}px`;
    menuEl.style.insetInlineStart = `${start}px`;
    menuEl.style.minWidth = `${rect.width}px`;
    menuEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    menuEl.classList.remove('invisible');
  }
}
