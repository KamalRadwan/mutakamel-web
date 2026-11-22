import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCalculator,
  tablerCornerDownRight,
  tablerHistory,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../shared/ui/date-time/time-field';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../shared/ui/overlay/zoom';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { TradeItemPicker } from '../../shared/pickers/item-picker/item-picker';
import { errorCodeOf, errorKey, tradeContext } from '../../shared/trade-api';
import { formatMoney, formatQty } from '../../shared/trade-format';
import {
  getItem,
  itemName,
  listChannels,
  listUoms,
  searchCommercialAccounts,
} from '../../shared/trade-foundation.api';
import type {
  Channel,
  CommercialAccountRole,
  CommercialAccountSummary,
  ItemDetail,
  LocalizedNames,
  Uom,
} from '../../shared/trade-foundation.model';
import { governanceErrorKey } from '../governance-fake-actors';
import {
  PriceAnswer,
  type PriceAnswerContext,
  type PriceAnswerError,
  type PriceAnswerErrorCode,
} from '../price-answer/price-answer';
import {
  evaluate,
  getPriceBook,
  getPriceVersion,
  getReferenceData,
  listEntries,
  listPriceBooks,
} from '../pricing.api';
import type {
  PriceBookDossier,
  PriceBookListItem,
  PricePurpose,
  PricingDecision,
  PricingEvaluateInput,
  PricingReferenceData,
  VersionHead,
} from '../pricing.model';

const CAN = { manage: true, test: true, approve: true, publish: true }; // later from the session

const MAX_RECENT_QUESTIONS = 10;
const POSITIVE_DECIMAL_8_RE = /^(?:\d+(?:\.\d{1,8})?|\.\d{1,8})$/;

const BUSINESS_ERROR_CODES = new Set<PriceAnswerErrorCode>([
  'TRADE.PRICE.NO_ELIGIBLE_PRICE',
  'TRADE.PRICE.AMBIGUOUS_RULES',
  'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_NOT_FOUND',
  'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_INCOMPATIBLE',
  'TRADE.PRICE.BOOK_INVALID',
  'TRADE.PRICE.BOOK_NOT_FOUND',
  'TRADE.PRICE.ENTRY_INVALID',
]);

/** GET /price-book-versions/:id/entries allows up to 200 rows per page. */
const CONTEXT_ENTRY_LIMIT = 200;

interface PriceQuestionModel {
  purpose: PricePurpose;
  itemId: string;
  uomId: string;
  quantity: string;
  currencyCode: string;
  atDate: string;
  atTime: string;
  partyId: string;
  branchId: string;
  channelId: string;
  priceBookId: string;
  priceBookVersionId: string;
}

interface QuestionLabelsSnapshot {
  itemLocalizedNames: LocalizedNames | null;
  itemFallback: string;
  uomLocalizedNames: LocalizedNames | null;
  uomFallback: string;
  accountLabel: string;
}

interface RecentQuestion {
  id: string;
  question: PriceQuestionModel;
  itemLocalizedNames: LocalizedNames | null;
  itemFallback: string;
  uomLocalizedNames: LocalizedNames | null;
  uomFallback: string;
  accountLabel: string;
  currencyCode: string;
  unitPrice: string;
}

interface PopoverPlace {
  top: number;
  start: number;
  width: number;
}

function isPositiveDecimal8(raw: string): boolean {
  const trimmed = raw.trim();
  if (!POSITIVE_DECIMAL_8_RE.test(trimmed)) return false;
  return /[1-9]/.test(trimmed);
}

function currentHm(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function buildIsoTimestamp(dateIso: string, timeHm: string): string | null {
  const cleanDate = dateIso.trim();
  if (!cleanDate) return null;
  const cleanTime = timeHm.trim() || '00:00';
  const parsed = new Date(`${cleanDate}T${cleanTime}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function questionSignature(q: PriceQuestionModel): string {
  return [
    q.purpose,
    q.itemId,
    q.uomId,
    q.quantity.trim(),
    q.currencyCode,
    q.atDate,
    q.atTime,
    q.partyId,
    q.branchId,
    q.channelId,
    q.priceBookId,
    q.priceBookVersionId,
  ].join('|');
}

/**
 * The decision carries ids only. Read the matched version head (book names,
 * promotions) and its lines for this item and unit, for the answer's labels.
 * A failed read leaves the answer with short ids instead of labels.
 */
async function loadAnswerContext(
  decision: PricingDecision,
  payload: PricingEvaluateInput,
): Promise<PriceAnswerContext | null> {
  try {
    const [head, entries] = await Promise.all([
      getPriceVersion(decision.priceBookVersionId, { include: 'none' }),
      listEntries(decision.priceBookVersionId, {
        itemId: payload.itemId,
        uomId: payload.uomId,
        limit: CONTEXT_ENTRY_LIMIT,
      }),
    ]);
    return { book: head.book, entries: entries.items, promotions: head.promotions };
  } catch {
    return null;
  }
}

function resolveLocalized(
  names: LocalizedNames | null | undefined,
  lang: 'en' | 'ar',
  fallback: string,
): string {
  return names?.[lang] || names?.['en'] || fallback;
}

@Component({
  selector: 'app-price-evaluation-page',
  imports: [
    FormField,
    TranslocoPipe,
    NgIcon,
    Button,
    DateField,
    TimeField,
    Dropdown,
    Field,
    Segmented,
    TradeItemPicker,
    PriceAnswer,
  ],
  providers: [
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-price-eval', alias: 'priceEval' }),
    provideIcons({
      tablerCalculator,
      tablerCornerDownRight,
      tablerHistory,
      tablerSearch,
      tablerX,
    }),
  ],
  templateUrl: './price-evaluation-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col p-12',
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'closeAccountList()',
  },
})
export class PriceEvaluationPage {
  private readonly transloco = inject(TranslocoService);
  private readonly langState = inject(LanguageState);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private readonly itemPickerWrapRef = viewChild<ElementRef<HTMLElement>>('itemPickerWrap');
  private readonly accountAnchorRef = viewChild<ElementRef<HTMLElement>>('accountAnchor');
  private readonly accountInputRef = viewChild<ElementRef<HTMLInputElement>>('accountInput');
  private readonly accountListRef = viewChild<ElementRef<HTMLElement>>('accountList');

  private evalSeq = 0;
  private recentSeq = 0;
  private accountListSeq = 0;
  private lastCompanyId = this.scopeState.company().id;
  private readonly translationTick = translationEvents(this.transloco);
  private readonly uomAutoPending = signal(false);
  protected readonly submitAttempted = signal(false);

  protected readonly questionModel = signal<PriceQuestionModel>({
    purpose: 'SALES',
    itemId: '',
    uomId: '',
    quantity: '1',
    currencyCode: '',
    atDate: '',
    atTime: '',
    partyId: '',
    branchId: '',
    channelId: '',
    priceBookId: '',
    priceBookVersionId: '',
  });

  protected readonly questionForm = form(this.questionModel, (path) => {
    required(path.itemId, { message: 'itemRequired' });
    required(path.uomId, { message: 'uomRequired' });
    required(path.currencyCode, { message: 'currencyRequired' });
    required(path.quantity, { message: 'quantityRequired' });
    validate(path.quantity, ({ value }) => {
      const current = value();
      if (!current || !current.trim()) return undefined;
      return isPositiveDecimal8(current)
        ? undefined
        : { kind: 'quantityInvalid', message: 'quantityInvalid' };
    });
  });

  protected readonly selectedAccountLabel = signal('');
  protected readonly accountFilterText = signal('');
  protected readonly accountEditing = signal(false);
  protected readonly accountOpen = signal(false);
  protected readonly accountPlaced = signal(false);
  protected readonly accountPlace = signal<PopoverPlace>({ top: 0, start: 0, width: 0 });
  protected readonly accountHighlightIndex = signal(-1);

  protected readonly evaluating = signal(false);
  protected readonly answerDecision = signal<PricingDecision | null>(null);
  protected readonly answerContext = signal<PriceAnswerContext | null>(null);
  protected readonly answerError = signal<PriceAnswerError | null>(null);
  private readonly evaluatedUomNames = signal<LocalizedNames | null>(null);
  private readonly evaluatedUomFallback = signal('');
  protected readonly recentQuestions = signal<RecentQuestion[]>([]);

  protected readonly canCalculate = computed(() => this.questionForm().valid() && !this.evaluating());

  protected readonly branchContext = computed(() => tradeContext(this.scopeState, 'BRANCH'));

  protected readonly evaluatedUnitLabel = computed(() =>
    resolveLocalized(this.evaluatedUomNames(), this.langState.current(), this.evaluatedUomFallback()),
  );

  private readonly referenceResource = resource({
    loader: () =>
      getReferenceData().catch((): PricingReferenceData => ({ branches: [], currencies: [] })),
  });

  private readonly itemDetailResource = resource({
    params: () => ({ itemId: this.questionModel().itemId, ctx: this.branchContext() }),
    loader: async ({ params }): Promise<ItemDetail | null> =>
      params.itemId ? getItem(params.ctx, params.itemId).catch(() => null) : null,
  });

  private readonly uomsResource = resource({
    params: () => ({
      purpose: this.questionModel().purpose,
      itemId: this.questionModel().itemId,
      ctx: tradeContext(this.scopeState, 'COMPANY'),
    }),
    loader: async ({ params }): Promise<Uom[]> =>
      params.itemId
        ? listUoms(
            { purpose: params.purpose, itemId: params.itemId, status: 'ACTIVE' },
            params.ctx,
          ).catch(() => [])
        : [],
  });

  private readonly channelsResource = resource({
    params: () => ({ ctx: tradeContext(this.scopeState, 'COMPANY') }),
    loader: async ({ params }): Promise<Channel[]> =>
      params.ctx.companyId ? listChannels(params.ctx).catch(() => []) : [],
  });

  private readonly booksResource = resource({
    params: () => ({ purpose: this.questionModel().purpose }),
    loader: async ({ params }) =>
      listPriceBooks({ purpose: params.purpose, status: 'ACTIVE', limit: 100 }).catch(() => ({
        items: [] as PriceBookListItem[],
        total: 0,
        page: 1,
        limit: 100,
      })),
  });

  private readonly bookDossierResource = resource({
    params: () => ({ bookId: this.questionModel().priceBookId }),
    loader: async ({ params }): Promise<PriceBookDossier | null> =>
      params.bookId ? getPriceBook(params.bookId).catch(() => null) : null,
  });

  private readonly accountsResource = resource({
    params: () => ({
      open: this.accountOpen(),
      companyId: this.scopeState.company().id,
      purpose: this.questionModel().purpose,
      search: this.accountEditing() ? this.accountFilterText().trim() : '',
      lang: this.langState.current(),
    }),
    loader: async ({ params }): Promise<CommercialAccountSummary[]> => {
      if (!params.open || !params.companyId) return [];
      const role: CommercialAccountRole = params.purpose === 'SALES' ? 'CUSTOMER' : 'SUPPLIER';
      return searchCommercialAccounts(
        { companyId: params.companyId },
        { role, ...(params.search ? { search: params.search } : {}) },
      ).catch(() => []);
    },
  });

  protected readonly accountsLoading = computed(() => this.accountsResource.isLoading());

  protected readonly accounts = computed<CommercialAccountSummary[]>(() =>
    this.accountsResource.hasValue() ? this.accountsResource.value() : [],
  );

  protected readonly purposeOptions = computed<SegmentedOption[]>(() => {
    this.translationTick();
    this.langState.current();
    return [
      { value: 'SALES', label: this.transloco.translate('priceEval.question.purpose.sales') },
      { value: 'PURCHASE', label: this.transloco.translate('priceEval.question.purpose.purchase') },
    ];
  });

  protected readonly unitOptions = computed<DropdownOption<string>[]>(() => {
    this.translationTick();
    const lang = this.langState.current();
    const uoms = this.uomsResource.hasValue() ? this.uomsResource.value() : [];
    const mapped: DropdownOption<string>[] = uoms.map((u) => ({
      value: u.id,
      label: resolveLocalized(u.localizedNames, lang, u.displayName),
    }));
    if (!this.questionModel().itemId || !this.questionModel().uomId || mapped.length === 0) {
      return [
        {
          value: '',
          label: this.transloco.translate('priceEval.question.unit.placeholder'),
          disabled: true,
        },
        ...mapped,
      ];
    }
    return mapped;
  });

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    this.translationTick();
    this.langState.current();
    const currencies = this.referenceResource.hasValue()
      ? this.referenceResource.value().currencies
      : [];
    if (currencies.length === 0) {
      return [
        {
          value: '',
          label: this.transloco.translate('priceEval.question.currency.placeholder'),
          disabled: true,
        },
      ];
    }
    return currencies.map((c) => ({
      value: c.code,
      label: c.code,
    }));
  });

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.translationTick();
    const lang = this.langState.current();
    const companyId = this.scopeState.company().id;
    const branches = (
      this.referenceResource.hasValue() ? this.referenceResource.value().branches : []
    ).filter((b) => b.companyId === companyId);
    return [
      { value: '', label: this.transloco.translate('priceEval.question.branch.current') },
      ...branches.map((b) => ({
        value: b.id,
        label: lang === 'ar' ? b.nameAr : b.nameEn,
      })),
    ];
  });

  protected readonly channelOptions = computed<DropdownOption<string>[]>(() => {
    this.translationTick();
    this.langState.current();
    const channels = (
      this.channelsResource.hasValue() ? this.channelsResource.value() : []
    ).filter((c) => c.status === 'ACTIVE');
    return [
      { value: '', label: this.transloco.translate('priceEval.question.channel.current') },
      ...channels.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    ];
  });

  protected readonly priceBookOptions = computed<DropdownOption<string>[]>(() => {
    this.translationTick();
    const lang = this.langState.current();
    const currency = this.questionModel().currencyCode;
    const purpose = this.questionModel().purpose;
    const books = (
      this.booksResource.hasValue() ? this.booksResource.value().items : []
    ).filter(
      (b: PriceBookListItem) =>
        b.status === 'ACTIVE' && b.purpose === purpose && (!currency || b.currencyCode === currency),
    );
    return [
      { value: '', label: this.transloco.translate('priceEval.question.priceBook.auto') },
      ...books.map((b) => ({
        value: b.id,
        label: resolveLocalized(b.localizedNames, lang, b.name ?? b.code),
      })),
    ];
  });

  protected readonly versionOptions = computed<DropdownOption<string>[]>(() => {
    this.translationTick();
    this.langState.current();
    const dossier = this.bookDossierResource.hasValue() ? this.bookDossierResource.value() : null;
    const versions = (dossier?.versions ?? [])
      .filter((v: VersionHead) => {
        if (v.status === 'DRAFT' || v.status === 'TESTED') {
          return CAN.manage;
        }
        return v.status === 'PUBLISHED' || v.status === 'SCHEDULED';
      })
      .slice()
      .sort((a, b) => b.versionNumber - a.versionNumber);

    return [
      { value: '', label: this.transloco.translate('priceEval.question.version.live') },
      ...versions.map((v) => ({
        value: v.id,
        label: this.transloco.translate('priceEval.question.version.option', {
          number: v.versionNumber,
          status: this.transloco.translate(`priceEval.versionStatuses.${v.status}`),
        }),
      })),
    ];
  });

  protected readonly accountLabel = computed(() => {
    this.translationTick();
    this.langState.current();
    return this.questionModel().purpose === 'PURCHASE'
      ? this.transloco.translate('priceEval.question.account.supplierLabel')
      : this.transloco.translate('priceEval.question.account.customerLabel');
  });

  protected readonly accountInputValue = computed(() =>
    this.accountEditing() ? this.accountFilterText() : this.selectedAccountLabel(),
  );

  protected readonly itemError = computed(() => {
    this.translationTick();
    this.langState.current();
    if (!this.submitAttempted() && !this.questionForm.itemId().touched()) return null;
    const err = this.questionForm.itemId().errors()[0];
    return err?.message ? this.transloco.translate(`priceEval.validation.${err.message}`) : null;
  });

  protected readonly uomError = computed(() => {
    this.translationTick();
    this.langState.current();
    if (!this.submitAttempted() && !this.questionForm.uomId().touched()) return null;
    const err = this.questionForm.uomId().errors()[0];
    return err?.message ? this.transloco.translate(`priceEval.validation.${err.message}`) : null;
  });

  protected readonly quantityError = computed(() => {
    this.translationTick();
    this.langState.current();
    const qState = this.questionForm.quantity();
    if (!this.submitAttempted() && !qState.touched() && !qState.dirty()) return null;
    const err = qState.errors()[0];
    return err?.message ? this.transloco.translate(`priceEval.validation.${err.message}`) : null;
  });

  protected readonly currencyError = computed(() => {
    this.translationTick();
    this.langState.current();
    if (!this.submitAttempted() && !this.questionForm.currencyCode().touched()) return null;
    const err = this.questionForm.currencyCode().errors()[0];
    return err?.message ? this.transloco.translate(`priceEval.validation.${err.message}`) : null;
  });

  constructor() {
    effect(() => {
      const companyId = this.scopeState.company().id;
      if (companyId === this.lastCompanyId) return;
      this.lastCompanyId = companyId;
      this.selectedAccountLabel.set('');
      this.accountFilterText.set('');
      this.accountEditing.set(false);
      this.closeAccountList();
      this.questionModel.update((prev) => ({
        ...prev,
        partyId: '',
        branchId: '',
        channelId: '',
      }));
    });

    effect(() => {
      if (!this.accountOpen()) return;
      this.accounts();
      this.accountsLoading();
      this.placeAccountList();
    });

    effect(() => {
      if (this.referenceResource.isLoading() || !this.referenceResource.hasValue()) return;
      const currencies = this.referenceResource.value().currencies;
      if (currencies.length === 0 || this.questionModel().currencyCode) return;
      this.questionModel.update((prev) => ({
        ...prev,
        currencyCode: currencies[0].code,
      }));
    });

    effect(() => {
      if (!this.uomAutoPending()) return;
      const itemId = this.questionModel().itemId;
      if (!itemId) return;
      if (this.uomsResource.isLoading() || this.itemDetailResource.isLoading()) return;
      if (!this.uomsResource.hasValue() || !this.itemDetailResource.hasValue()) return;

      const uoms = this.uomsResource.value();
      const detail = this.itemDetailResource.value();
      if (!detail || detail.id !== itemId) return;

      const preferredId =
        this.questionModel().purpose === 'SALES'
          ? detail.companyProfile?.defaultSalesUomId || detail.baseUomId
          : detail.companyProfile?.defaultPurchaseUomId || detail.baseUomId;

      const match = uoms.find((u) => u.id === preferredId) ?? uoms[0];
      this.questionModel.update((prev) => ({ ...prev, uomId: match?.id ?? '' }));
      this.uomAutoPending.set(false);
    });

    const onScroll = (event: Event) => {
      if (!this.accountOpen()) return;
      const target = event.target;
      const listEl = this.accountListRef()?.nativeElement;
      if (listEl && target instanceof Node && listEl.contains(target)) return;
      this.closeAccountList();
    };
    window.addEventListener('scroll', onScroll, true);
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll, true));
  }

  protected onPurposeChange(value: string | null): void {
    if (value !== 'SALES' && value !== 'PURCHASE') return;
    if (value === this.questionModel().purpose) return;
    this.uomAutoPending.set(!!this.questionModel().itemId);
    this.selectedAccountLabel.set('');
    this.accountFilterText.set('');
    this.accountEditing.set(false);
    this.closeAccountList();
    this.questionModel.update((prev) => ({
      ...prev,
      purpose: value,
      uomId: '',
      partyId: '',
      priceBookId: '',
      priceBookVersionId: '',
    }));
  }

  protected onItemChange(itemId: string | null): void {
    const nextId = itemId ?? '';
    if (nextId === this.questionModel().itemId) return;
    this.questionForm.itemId().markAsTouched();
    this.uomAutoPending.set(!!nextId);
    this.questionModel.update((prev) => ({
      ...prev,
      itemId: nextId,
      uomId: '',
    }));
  }

  protected onUomChange(uomId: string): void {
    this.uomAutoPending.set(false);
    this.questionForm.uomId().markAsTouched();
    this.questionModel.update((prev) => ({ ...prev, uomId }));
  }

  protected onCurrencyChange(currencyCode: string): void {
    if (currencyCode === this.questionModel().currencyCode) return;
    this.questionForm.currencyCode().markAsTouched();
    this.questionModel.update((prev) => ({
      ...prev,
      currencyCode,
      priceBookId: '',
      priceBookVersionId: '',
    }));
  }

  protected onDateChange(atDate: string | null): void {
    const nextDate = atDate ?? '';
    this.questionModel.update((prev) => ({
      ...prev,
      atDate: nextDate,
      atTime: nextDate ? prev.atTime || currentHm() : '',
    }));
  }

  protected onTimeChange(atTime: string | null): void {
    this.questionModel.update((prev) => ({ ...prev, atTime: atTime ?? '' }));
  }

  protected clearDateTime(): void {
    this.questionModel.update((prev) => ({ ...prev, atDate: '', atTime: '' }));
  }

  protected onBranchChange(branchId: string): void {
    this.questionModel.update((prev) => ({ ...prev, branchId }));
  }

  protected onChannelChange(channelId: string): void {
    this.questionModel.update((prev) => ({ ...prev, channelId }));
  }

  protected onPriceBookChange(priceBookId: string): void {
    this.questionModel.update((prev) => ({
      ...prev,
      priceBookId,
      priceBookVersionId: '',
    }));
  }

  protected onVersionChange(priceBookVersionId: string): void {
    this.questionModel.update((prev) => ({ ...prev, priceBookVersionId }));
  }

  protected onQuantityEnter(event: Event): void {
    event.preventDefault();
    if (this.canCalculate()) {
      void this.calculate();
    } else {
      this.submitAttempted.set(true);
    }
  }

  protected onAccountFocus(): void {
    this.openAccountList();
  }

  protected onAccountInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.accountEditing.set(true);
    this.accountFilterText.set(value);
    this.accountHighlightIndex.set(0);
    if (this.questionModel().partyId) {
      this.selectedAccountLabel.set('');
      this.questionModel.update((prev) => ({ ...prev, partyId: '' }));
    }
    this.openAccountList();
  }

  protected onAccountKeydown(event: KeyboardEvent): void {
    const accounts = this.accounts();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.accountOpen()) {
        this.openAccountList();
        return;
      }
      if (accounts.length > 0) {
        const next = Math.min(this.accountHighlightIndex() + 1, accounts.length - 1);
        this.accountHighlightIndex.set(next);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (accounts.length > 0 && this.accountOpen()) {
        const next = Math.max(this.accountHighlightIndex() - 1, 0);
        this.accountHighlightIndex.set(next);
      }
    } else if (event.key === 'Enter' && this.accountOpen()) {
      const idx = this.accountHighlightIndex();
      if (idx >= 0 && idx < accounts.length) {
        event.preventDefault();
        this.selectAccount(accounts[idx]);
      }
    } else if (event.key === 'Escape' && this.accountOpen()) {
      event.preventDefault();
      event.stopPropagation();
      this.closeAccountList();
    } else if (event.key === 'Tab') {
      this.closeAccountList();
    }
  }

  protected selectAccount(account: CommercialAccountSummary): void {
    const label = account.partyName || account.party.displayName;
    this.selectedAccountLabel.set(label);
    this.accountFilterText.set('');
    this.accountEditing.set(false);
    this.questionModel.update((prev) => ({ ...prev, partyId: account.partyId }));
    this.closeAccountList();
  }

  protected clearAccount(): void {
    this.selectedAccountLabel.set('');
    this.accountFilterText.set('');
    this.accountEditing.set(false);
    this.questionModel.update((prev) => ({ ...prev, partyId: '' }));
    this.closeAccountList();
    this.accountInputRef()?.nativeElement.focus();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.accountOpen()) return;
    const target = event.target as Node;
    const anchor = this.accountAnchorRef()?.nativeElement;
    const list = this.accountListRef()?.nativeElement;
    if ((anchor && anchor.contains(target)) || (list && list.contains(target))) return;
    this.closeAccountList();
  }

  protected closeAccountList(): void {
    if (!this.accountOpen()) return;
    this.accountOpen.set(false);
    this.accountPlaced.set(false);
    this.accountHighlightIndex.set(-1);
    if (!this.questionModel().partyId) {
      this.accountEditing.set(false);
      this.accountFilterText.set('');
    }
  }

  protected focusItemPicker(): void {
    const host = this.itemPickerWrapRef()?.nativeElement;
    const control = host?.querySelector<HTMLElement>('input, button, [role="combobox"]');
    control?.focus();
  }

  protected applyRecentQuestion(entry: RecentQuestion): void {
    this.uomAutoPending.set(false);
    this.submitAttempted.set(false);
    this.accountEditing.set(false);
    this.accountFilterText.set('');
    this.selectedAccountLabel.set(entry.accountLabel);
    this.closeAccountList();
    this.questionModel.set({ ...entry.question });
    void this.runEvaluation(entry.question, {
      itemLocalizedNames: entry.itemLocalizedNames,
      itemFallback: entry.itemFallback,
      uomLocalizedNames: entry.uomLocalizedNames,
      uomFallback: entry.uomFallback,
      accountLabel: entry.accountLabel,
    });
  }

  protected recentSummary(entry: RecentQuestion): string {
    const lang = this.langState.current();
    const item = resolveLocalized(entry.itemLocalizedNames, lang, entry.itemFallback);
    const uom = resolveLocalized(entry.uomLocalizedNames, lang, entry.uomFallback);
    const qty = formatQty(entry.question.quantity);
    const qtyWithUnit = uom ? `${qty} ${uom}` : qty;
    const base = `${item} · ${qtyWithUnit}`;
    return entry.accountLabel ? `${base} · ${entry.accountLabel}` : base;
  }

  protected formatRecentPrice(currencyCode: string, amount: string): string {
    return formatMoney(currencyCode, amount);
  }

  protected async calculate(): Promise<void> {
    this.submitAttempted.set(true);
    if (!this.questionForm().valid()) return;

    const snapshot: PriceQuestionModel = { ...this.questionModel() };
    const uoms = this.uomsResource.hasValue() ? this.uomsResource.value() : [];
    const uom = uoms.find((u) => u.id === snapshot.uomId);
    const uomOption = this.unitOptions().find((opt) => opt.value === snapshot.uomId);
    const detail = this.itemDetailResource.hasValue() ? this.itemDetailResource.value() : null;
    const matchingDetail = detail && detail.id === snapshot.itemId ? detail : null;

    await this.runEvaluation(snapshot, {
      itemLocalizedNames: matchingDetail?.localizedNames ?? null,
      itemFallback: matchingDetail
        ? itemName(matchingDetail, this.langState.current())
        : snapshot.itemId,
      uomLocalizedNames: uom?.localizedNames ?? null,
      uomFallback: uomOption?.label ?? uom?.displayName ?? '',
      accountLabel: snapshot.partyId ? this.selectedAccountLabel() : '',
    });
  }

  private async runEvaluation(
    snapshot: PriceQuestionModel,
    labels: QuestionLabelsSnapshot,
  ): Promise<void> {
    const seq = ++this.evalSeq;
    this.evaluating.set(true);

    const payload: PricingEvaluateInput = {
      purpose: snapshot.purpose,
      itemId: snapshot.itemId,
      uomId: snapshot.uomId,
      quantity: snapshot.quantity.trim(),
      currencyCode: snapshot.currencyCode,
      pricingAt: buildIsoTimestamp(snapshot.atDate, snapshot.atTime) ?? undefined,
      partyId: snapshot.partyId || undefined,
      branchId: snapshot.branchId || this.scopeState.branch()?.id || undefined,
      channelId: snapshot.channelId || undefined,
      priceBookId: snapshot.priceBookId || undefined,
      priceBookVersionId: (snapshot.priceBookId && snapshot.priceBookVersionId) || undefined,
    };

    try {
      const decision = await evaluate(payload);
      const context = await loadAnswerContext(decision, payload);
      if (seq !== this.evalSeq) return;

      this.answerError.set(null);
      this.answerContext.set(context);
      this.answerDecision.set(decision);
      this.evaluatedUomNames.set(labels.uomLocalizedNames);
      this.evaluatedUomFallback.set(labels.uomFallback);
      this.pushRecentQuestion(snapshot, labels, decision);
    } catch (err) {
      if (seq !== this.evalSeq) return;

      const code = errorCodeOf(err);
      if (code && BUSINESS_ERROR_CODES.has(code as PriceAnswerErrorCode)) {
        this.answerDecision.set(null);
        this.answerContext.set(null);
        this.answerError.set({ code: code as PriceAnswerErrorCode });
      } else {
        this.answerError.set(null);
        this.showUnexpectedErrorToast(err);
      }
    } finally {
      if (seq === this.evalSeq) {
        this.evaluating.set(false);
      }
    }
  }

  private pushRecentQuestion(
    question: PriceQuestionModel,
    labels: QuestionLabelsSnapshot,
    decision: PricingDecision,
  ): void {
    const sig = questionSignature(question);
    const nextItem: RecentQuestion = {
      id: `rq-${++this.recentSeq}`,
      question: { ...question },
      itemLocalizedNames: labels.itemLocalizedNames,
      itemFallback: labels.itemFallback,
      uomLocalizedNames: labels.uomLocalizedNames,
      uomFallback: labels.uomFallback,
      accountLabel: labels.accountLabel,
      currencyCode: decision.currencyCode,
      unitPrice: decision.unitPrice,
    };
    this.recentQuestions.update((list) => {
      const filtered = list.filter((item) => questionSignature(item.question) !== sig);
      return [nextItem, ...filtered].slice(0, MAX_RECENT_QUESTIONS);
    });
  }

  private showUnexpectedErrorToast(err: unknown): void {
    const title = this.transloco.translate('priceEval.errors.unexpectedTitle');
    const govKey = governanceErrorKey(err, 'governance');
    const govMsg = this.transloco.translate(govKey);
    if (govMsg !== govKey) {
      this.notify.error(title, govMsg);
      return;
    }

    const sharedKey = errorKey(err);
    const sharedMsg = this.transloco.translate(sharedKey);
    if (sharedMsg !== sharedKey) {
      this.notify.error(title, sharedMsg);
      return;
    }

    this.notify.error(title, this.transloco.translate('priceEval.errors.unexpected'));
  }

  private openAccountList(): void {
    this.accountOpen.set(true);
    this.placeAccountList();
  }

  private placeAccountList(): void {
    const seq = ++this.accountListSeq;
    afterNextRender(
      () => {
        if (seq !== this.accountListSeq || !this.accountOpen()) return;
        const anchor = this.accountAnchorRef()?.nativeElement;
        if (!anchor) return;
        const box = rectInPage(anchor);
        const vp = viewport();
        const rtl = getComputedStyle(anchor).direction === 'rtl';
        const listEl = this.accountListRef()?.nativeElement;
        const listHeight = listEl ? rectInPage(listEl).height : 200;
        const spaceBelow = vp.height - box.bottom - 8;
        const openAbove = spaceBelow < Math.min(listHeight, 200) && box.top - 8 > spaceBelow;
        const top = openAbove ? Math.max(8, box.top - listHeight - 4) : box.bottom + 4;
        const start = rtl ? vp.width - box.right : box.left;
        this.accountPlace.set({ top, start, width: box.width });
        this.accountPlaced.set(true);
      },
      { injector: this.injector },
    );
  }
}
