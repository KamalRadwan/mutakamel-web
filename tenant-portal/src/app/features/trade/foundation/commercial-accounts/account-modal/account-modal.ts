import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAddressBook,
  tablerCloudOff,
  tablerFileText,
  tablerGitBranch,
  tablerShieldCheck,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiError as CoreApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { TagPicker, type TagOption } from '../../../../../shared/ui/tag-picker/tag-picker';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import {
  ApiError,
  errorCodeOf,
  errorKey,
  newIdempotencyKey,
  tradeContext,
  type TradeContext,
} from '../../../shared/trade-api';
import { formatMoney } from '../../../shared/trade-format';
import { itemName, listReasons } from '../../../shared/trade-foundation.api';
import type { CommercialAccount, CommercialAccountRole, ReasonCode } from '../../../shared/trade-foundation.model';
import { ACCOUNT_ROLE_KEY, ACCOUNT_STATUS_KEY, BADGE_CLASS } from '../../../shared/trade-labels';
import { AccountCreditCheck } from '../account-credit-check/account-credit-check';
import { AccountStatusDialog } from '../account-status-dialog/account-status-dialog';
import {
  blockAccount,
  createAccount,
  createBranchRule,
  getAccount,
  listAccountLookups,
  listAccounts,
  listBranchRules,
  listParties,
  unblockAccount,
  updateAccount,
  updateBranchRule,
} from '../commercial-accounts.api';
import {
  ACCOUNT_CURRENCIES,
  type AccountDetail,
  type AccountInput,
  type AccountStatusTransitionInput,
  type AccountWarning,
  type AccountWithParty,
  type BranchRule,
  type BranchRuleNarrowing,
  CREDIT_LIMIT_PATTERN,
  type CreditPolicy,
  type DirectoryParty,
  type PriceBookOption,
  type UpdateAccountPatch,
  partyDisplayName,
} from '../commercial-accounts.model';

function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

type AccountServerErrorField = 'party' | 'priceBook' | 'creditLimit' | 'branchCreditLimit';

interface AccountFormState {
  accountRole: CommercialAccountRole;
  partyId: string;
  creditLimit: string;
  creditCurrencyCode: string;
  priceBookId: string;
  creditPolicyVersionId: string;
  orderingHold: boolean;
  allowedCurrencies: string[];
}

interface BranchRuleFormState {
  creditLimit: string;
  orderingHold: boolean;
  allowedCurrencies: string[];
  active: boolean;
}

interface OtherBranchRuleRow {
  id: string;
  branchName: string;
  limitLabel: string;
  holdLabel: string;
  retired: boolean;
}

function emptyAccountForm(): AccountFormState {
  return {
    accountRole: 'CUSTOMER',
    partyId: '',
    creditLimit: '',
    creditCurrencyCode: '',
    priceBookId: '',
    creditPolicyVersionId: '',
    orderingHold: false,
    allowedCurrencies: [],
  };
}

function emptyBranchRuleForm(): BranchRuleFormState {
  return {
    creditLimit: '',
    orderingHold: false,
    allowedCurrencies: [],
    active: true,
  };
}

function extractExtraTerms(terms: CommercialAccount['terms'] | undefined): Record<string, unknown> {
  if (!terms) return {};
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(terms)) {
    if (k !== 'orderingHold' && k !== 'allowedCurrencies') {
      extra[k] = v;
    }
  }
  return extra;
}

function accountFormFromDetail(detail: AccountWithParty): AccountFormState {
  return {
    accountRole: detail.accountRole,
    partyId: detail.partyId,
    creditLimit: detail.creditLimit ?? '',
    creditCurrencyCode: detail.creditCurrencyCode ?? '',
    priceBookId: detail.priceBookId ?? '',
    creditPolicyVersionId: detail.creditPolicyVersionId ?? '',
    orderingHold: detail.terms.orderingHold === true,
    allowedCurrencies: detail.terms.allowedCurrencies ? [...detail.terms.allowedCurrencies] : [],
  };
}

function branchFormFromRule(rule: BranchRule | null): BranchRuleFormState {
  if (!rule) return emptyBranchRuleForm();
  return {
    creditLimit: rule.narrowingRules.creditLimit ?? '',
    orderingHold: rule.narrowingRules.orderingHold === true,
    allowedCurrencies: rule.narrowingRules.allowedCurrencies ? [...rule.narrowingRules.allowedCurrencies] : [],
    active: rule.status === 'ACTIVE',
  };
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, idx) => item === b[idx]);
}

function accountFormsEqual(a: AccountFormState, b: AccountFormState): boolean {
  return (
    a.accountRole === b.accountRole &&
    a.partyId === b.partyId &&
    a.creditLimit.trim() === b.creditLimit.trim() &&
    a.creditCurrencyCode === b.creditCurrencyCode &&
    a.priceBookId === b.priceBookId &&
    a.creditPolicyVersionId === b.creditPolicyVersionId &&
    a.orderingHold === b.orderingHold &&
    arraysEqual(a.allowedCurrencies, b.allowedCurrencies)
  );
}

function branchFormsEqual(a: BranchRuleFormState, b: BranchRuleFormState): boolean {
  return (
    a.creditLimit.trim() === b.creditLimit.trim() &&
    a.orderingHold === b.orderingHold &&
    a.active === b.active &&
    arraysEqual(a.allowedCurrencies, b.allowedCurrencies)
  );
}

@Component({
  selector: 'app-account-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    AccountCreditCheck,
    AccountStatusDialog,
    Button,
    Dropdown,
    Field,
    Modal,
    Segmented,
    Switch,
    TagPicker,
    UnsavedDialog,
  ],
  providers: [
    provideIcons({
      tablerAddressBook,
      tablerFileText,
      tablerGitBranch,
      tablerShieldCheck,
      tablerCloudOff,
    }),
  ],
  templateUrl: './account-modal.html',
})
export class AccountModal {
  private static nextId = 0;

  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly conflictDialog = viewChild.required<UnsavedDialog>('conflictDialog');
  private readonly statusDialog = viewChild.required(AccountStatusDialog);

  protected readonly uid = `account-modal-${++AccountModal.nextId}`;
  protected readonly formatMoney = formatMoney;
  protected readonly mutedBadgeClass = BADGE_CLASS.muted;

  readonly canManage = input(true);
  readonly canViewCredit = input(true);
  readonly saved = output<AccountDetail>();
  readonly closed = output<void>();
  readonly forbidden = output<void>();

  protected readonly isOpen = signal(false);
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly accountId = signal<string | null>(null);
  protected readonly detail = signal<AccountDetail | null>(null);
  protected readonly branchRules = signal<readonly (BranchRule & { branchName?: string; branchNameAr?: string | null })[]>([]);
  protected readonly partyPickerForbidden = signal(false);

  protected readonly accountBase = signal<AccountFormState>(emptyAccountForm());
  protected readonly accountDraft = signal<AccountFormState>(emptyAccountForm());
  protected readonly branchBase = signal<BranchRuleFormState>(emptyBranchRuleForm());
  protected readonly branchDraft = signal<BranchRuleFormState>(emptyBranchRuleForm());
  private extraTerms: Record<string, unknown> = {};
  private hadOrderingHoldKey = false;

  protected readonly parties = signal<readonly DirectoryParty[]>([]);
  protected readonly existingAccounts = signal<readonly AccountWithParty[]>([]);
  protected readonly priceBooks = signal<readonly PriceBookOption[]>([]);
  protected readonly creditPolicies = signal<readonly CreditPolicy[]>([]);
  protected readonly blockReasons = signal<readonly ReasonCode[]>([]);

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly statusSaving = signal(false);
  protected readonly guardBusy = signal(false);
  protected readonly attempted = signal(false);
  protected readonly serverErrors = signal<Partial<Record<AccountServerErrorField, string>>>({});
  protected readonly statusDialogMode = signal<'block' | 'unblock'>('block');

  private allowClose = false;
  private loadSeq = 0;
  private lookupSeq = 0;
  private booksLookupSeq = 0;
  private openedCompanyId: string | null = null;
  private openedBranchId: string | null = null;

  private lastCreateFingerprint: string | null = null;
  private lastCreateKey: string | null = null;
  private lastUpdateFingerprint: string | null = null;
  private lastUpdateKey: string | null = null;
  private lastBranchFingerprint: string | null = null;
  private lastBranchKey: string | null = null;
  private lastStatusFingerprint: string | null = null;
  private lastStatusKey: string | null = null;

  protected readonly ctx = computed<TradeContext>(() => tradeContext(this.scope, 'BRANCH'));

  protected readonly isSupplier = computed(() => this.accountDraft().accountRole === 'SUPPLIER');
  protected readonly isReadonly = computed(() => !this.canManage() || this.loading() || this.loadFailed());

  protected readonly accountDirty = computed(() => !accountFormsEqual(this.accountBase(), this.accountDraft()));
  protected readonly branchDirty = computed(
    () => this.mode() === 'edit' && !branchFormsEqual(this.branchBase(), this.branchDraft()),
  );
  protected readonly dirty = computed(() => {
    if (this.mode() === 'create') return this.accountDirty();
    return this.accountDirty() || this.branchDirty();
  });

  protected readonly hasSavedBranchRule = computed(
    () => this.mode() === 'edit' && Boolean(this.detail()?.branchRule),
  );
  protected readonly savedRuleHasHold = computed(
    () => this.detail()?.branchRule?.narrowingRules.orderingHold === true,
  );

  protected readonly currentBranchName = computed(() => {
    const branch = this.scope.branch();
    return (this.language() === 'ar' ? branch?.nameAr : branch?.nameEn) ?? '';
  });

  protected readonly otherBranchRules = computed<OtherBranchRuleRow[]>(() => {
    this.i18n();
    const acc = this.detail();
    if (!acc) return [];
    const currentBranchId = this.ctx().branchId;
    const lang = this.language();
    const branchNames = new Map(
      this.scope.branches().map((branch) => [branch.id, lang === 'ar' ? branch.nameAr : branch.nameEn]),
    );
    const currency = acc.creditCurrencyCode;
    const noneLabel = this.transloco.translate('tradeAccounts.none');
    const holdLabel = this.transloco.translate('tradeAccounts.branchRules.hold');
    const noHoldLabel = this.transloco.translate('tradeAccounts.branchRules.noHold');

    return this.branchRules()
      .filter((rule) => rule.branchId !== currentBranchId)
      .map((rule) => ({
        id: rule.id,
        branchName: branchNames.get(rule.branchId) ?? rule.branchName ?? rule.branchId,
        limitLabel: rule.narrowingRules.creditLimit
          ? formatMoney(currency, rule.narrowingRules.creditLimit)
          : noneLabel,
        holdLabel: rule.narrowingRules.orderingHold ? holdLabel : noHoldLabel,
        retired: rule.status === 'RETIRED',
      }));
  });

  protected readonly modalTitle = computed(() => {
    this.i18n();
    if (this.mode() === 'create') {
      return this.transloco.translate('tradeAccounts.modal.newTitle');
    }
    const current = this.detail();
    if (!current) {
      return this.transloco.translate('tradeAccounts.modal.loadingTitle');
    }
    return partyDisplayName(current.party, this.language()) || current.partyId;
  });

  protected readonly modalSubtitle = computed(() => {
    this.i18n();
    if (this.mode() !== 'edit') return '';
    const current = this.detail();
    if (!current) return '';
    const roleLabel = this.transloco.translate(ACCOUNT_ROLE_KEY[current.accountRole]);
    const statusLabel = this.transloco.translate(ACCOUNT_STATUS_KEY[current.status]);
    return `${roleLabel} · ${statusLabel}`;
  });

  protected readonly roleSegmentedOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'CUSTOMER', label: this.transloco.translate('tradeShared.accountRole.CUSTOMER') },
      { value: 'SUPPLIER', label: this.transloco.translate('tradeShared.accountRole.SUPPLIER') },
    ];
  });

  protected readonly partyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const role = this.accountDraft().accountRole;
    const existingSet = new Set(
      this.existingAccounts()
        .filter((acc) => acc.accountRole === role)
        .map((acc) => acc.partyId),
    );
    const suffixKey =
      role === 'CUSTOMER' ? 'tradeAccounts.modal.alreadyHasCustomer' : 'tradeAccounts.modal.alreadyHasSupplier';
    const suffix = this.transloco.translate(suffixKey);

    return [
      { value: '', label: this.transloco.translate('tradeAccounts.modal.selectParty'), disabled: true },
      ...this.parties()
        .filter((party) => party.roles.includes(role))
        .map((party) => {
          const name = lang === 'ar' ? party.displayNameAr : party.displayName;
          const exists = existingSet.has(party.id);
          return {
            value: party.id,
            label: exists ? `${name}${suffix}` : name,
            disabled: exists,
          };
        }),
    ];
  });

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('tradeAccounts.none') },
      ...ACCOUNT_CURRENCIES.map((code) => ({ value: code, label: code })),
    ];
  });

  protected readonly allCurrencyTagOptions: TagOption[] = ACCOUNT_CURRENCIES.map((code) => ({
    id: code,
    name: code,
    backgroundColor: null,
    textColor: null,
  }));

  protected readonly baseCurrencyList = computed<string[]>(() => {
    const draft = this.accountDraft();
    if (draft.allowedCurrencies.length > 0) return draft.allowedCurrencies;
    return draft.creditCurrencyCode ? [draft.creditCurrencyCode] : [];
  });

  protected readonly branchCurrencyTagOptions = computed<TagOption[]>(() => {
    const codes = Array.from(new Set([...this.baseCurrencyList(), ...this.branchDraft().allowedCurrencies]));
    return codes.map((code) => ({
      id: code,
      name: code,
      backgroundColor: null,
      textColor: null,
    }));
  });

  protected readonly priceBookOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const expectedPurpose = this.accountDraft().accountRole === 'CUSTOMER' ? 'SALES' : 'PURCHASE';
    const matching = this.priceBooks().filter(
      (book) => book.status === 'ACTIVE' && book.purpose === expectedPurpose,
    );
    return [
      { value: '', label: this.transloco.translate('tradeAccounts.none') },
      ...matching.map((book) => ({ value: book.id, label: book.name })),
    ];
  });

  protected readonly creditPolicyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('tradeAccounts.none') },
      ...this.creditPolicies().map((policy) => ({
        value: policy.id,
        label: `${policy.code} · v${policy.versionNumber}`,
      })),
    ];
  });

  protected readonly readonlyRoleLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(ACCOUNT_ROLE_KEY[this.accountDraft().accountRole]);
  });

  protected readonly readonlyPartyLabel = computed(() => {
    const current = this.detail();
    if (!current) return '—';
    return partyDisplayName(current.party, this.language()) || current.partyId;
  });

  protected readonly readonlyPriceBookLabel = computed(() => {
    this.i18n();
    const id = this.accountDraft().priceBookId;
    if (!id) return this.transloco.translate('tradeAccounts.none');
    return this.priceBooks().find((b) => b.id === id)?.name ?? id;
  });

  protected readonly readonlyCreditPolicyLabel = computed(() => {
    this.i18n();
    const id = this.accountDraft().creditPolicyVersionId;
    if (!id) return this.transloco.translate('tradeAccounts.none');
    const policy = this.creditPolicies().find((p) => p.id === id);
    return policy ? `${policy.code} · v${policy.versionNumber}` : id;
  });

  protected readonly blockReasonLabel = computed(() => {
    this.i18n();
    const code = this.detail()?.blockReasonCode;
    if (!code) return '—';
    const reason = this.blockReasons().find((item) => item.code === code);
    if (reason) {
      return itemName(reason, this.language()) || code;
    }
    return code;
  });

  protected readonly partyError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverErrors().party;
    if (server) return server;
    if (this.mode() === 'create' && this.attempted() && !this.accountDraft().partyId) {
      return this.transloco.translate('tradeShared.common.required');
    }
    return null;
  });

  protected readonly priceBookError = computed<string | null>(() => this.serverErrors().priceBook ?? null);

  protected readonly creditLimitError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverErrors().creditLimit;
    if (server) return server;
    if (this.isSupplier() || !this.attempted()) return null;

    const limit = this.accountDraft().creditLimit.trim();
    const currency = this.accountDraft().creditCurrencyCode;
    if (limit && !CREDIT_LIMIT_PATTERN.test(limit)) {
      return this.transloco.translate('tradeAccounts.validation.invalidDecimal');
    }
    if (!limit && currency) {
      return this.transloco.translate('tradeAccounts.validation.limitRequiredWithCurrency');
    }
    return null;
  });

  protected readonly creditCurrencyError = computed<string | null>(() => {
    this.i18n();
    if (this.isSupplier() || !this.attempted()) return null;
    const limit = this.accountDraft().creditLimit.trim();
    const currency = this.accountDraft().creditCurrencyCode;
    if (limit && !currency) {
      return this.transloco.translate('tradeAccounts.validation.currencyRequiredWithLimit');
    }
    return null;
  });

  protected readonly allowedCurrenciesError = computed<string | null>(() => {
    this.i18n();
    const currency = this.accountDraft().creditCurrencyCode;
    const allowed = this.accountDraft().allowedCurrencies;
    if (!this.isSupplier() && currency && allowed.length > 0 && !allowed.includes(currency)) {
      return this.transloco.translate('tradeAccounts.validation.allowedMustIncludeCreditCurrency', { currency });
    }
    return null;
  });

  protected readonly branchCreditLimitError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverErrors().branchCreditLimit;
    if (server) return server;
    if (!this.attempted() || this.isSupplier()) return null;
    const limit = this.branchDraft().creditLimit.trim();
    if (limit && !CREDIT_LIMIT_PATTERN.test(limit)) {
      return this.transloco.translate('tradeAccounts.validation.invalidDecimal');
    }
    return null;
  });

  protected readonly branchCurrenciesError = computed<string | null>(() => {
    this.i18n();
    if (!this.attempted() || this.isSupplier() || !this.branchDirty()) return null;
    const baseSet = new Set(this.baseCurrencyList());
    const invalid = this.branchDraft().allowedCurrencies.some((code) => !baseSet.has(code));
    return invalid ? this.transloco.translate('tradeAccounts.validation.branchCurrenciesSubset') : null;
  });

  constructor() {
    effect(() => {
      const companyId = this.scope.company()?.id ?? null;
      const branchId = this.scope.branch()?.id ?? null;
      untracked(() => {
        if (!this.isOpen()) return;
        if (this.openedCompanyId !== null && companyId !== this.openedCompanyId) {
          this.allowClose = true;
          this.modal().close();
          return;
        }
        if (this.openedBranchId !== null && branchId !== this.openedBranchId) {
          this.openedBranchId = branchId;
          const id = this.accountId();
          if (this.mode() === 'edit' && id && !this.dirty()) {
            void this.loadAccount(id);
          } else {
            void this.loadLookups(this.mode() === 'create');
          }
        }
      });
    });
  }

  openAccountId(): string | null {
    return this.isOpen() ? this.accountId() : null;
  }

  forceClose(): void {
    this.allowClose = true;
    if (this.isOpen()) {
      this.modal().close();
    }
  }

  openCreate(): void {
    this.loadSeq++;
    this.allowClose = false;
    this.guardBusy.set(false);
    this.partyPickerForbidden.set(false);
    this.resetIdempotencyKeys();

    const ctx = this.ctx();
    this.openedCompanyId = ctx.companyId ?? null;
    this.openedBranchId = ctx.branchId ?? null;

    const blank = emptyAccountForm();
    this.mode.set('create');
    this.accountId.set(null);
    this.detail.set(null);
    this.branchRules.set([]);
    this.extraTerms = {};
    this.hadOrderingHoldKey = false;
    this.accountBase.set(blank);
    this.accountDraft.set(blank);
    this.branchBase.set(emptyBranchRuleForm());
    this.branchDraft.set(emptyBranchRuleForm());
    this.loading.set(false);
    this.loadFailed.set(false);
    this.saving.set(false);
    this.statusSaving.set(false);
    this.attempted.set(false);
    this.serverErrors.set({});

    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.modal().open();
    }
    void this.loadLookups(true);
  }

  openEdit(id: string): void {
    this.allowClose = false;
    this.guardBusy.set(false);
    this.partyPickerForbidden.set(false);
    this.resetIdempotencyKeys();

    const ctx = this.ctx();
    this.openedCompanyId = ctx.companyId ?? null;
    this.openedBranchId = ctx.branchId ?? null;

    this.mode.set('edit');
    this.accountId.set(id);
    this.detail.set(null);
    this.branchRules.set([]);

    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.modal().open();
    }
    void this.loadAccount(id);
  }

  protected retryLoad(): void {
    const id = this.accountId();
    if (!id) return;
    void this.loadAccount(id);
  }

  protected onRoleChange(role: string | null): void {
    if (this.mode() !== 'create' || this.isReadonly()) return;
    if (role !== 'CUSTOMER' && role !== 'SUPPLIER') return;
    if (role === this.accountDraft().accountRole) return;
    this.clearServerErrors('party', 'priceBook', 'creditLimit');
    this.accountDraft.update((d) => ({
      ...d,
      accountRole: role,
      partyId: '',
      priceBookId: '',
      creditLimit: role === 'SUPPLIER' ? '' : d.creditLimit,
      creditCurrencyCode: role === 'SUPPLIER' ? '' : d.creditCurrencyCode,
    }));
    void this.loadLookupsForRole(role);
  }

  protected onPartyChange(partyId: string): void {
    if (this.mode() !== 'create' || this.isReadonly()) return;
    this.clearServerErrors('party');
    this.accountDraft.update((d) => ({ ...d, partyId }));
  }

  protected onCreditLimitInput(event: Event): void {
    if (this.isReadonly() || this.isSupplier()) return;
    const creditLimit = (event.target as HTMLInputElement).value;
    this.clearServerErrors('creditLimit');
    this.accountDraft.update((d) => ({
      ...d,
      creditLimit,
      creditCurrencyCode: creditLimit.trim() === '' ? '' : d.creditCurrencyCode,
    }));
  }

  protected onCreditCurrencyChange(creditCurrencyCode: string): void {
    if (this.isReadonly() || this.isSupplier()) return;
    this.clearServerErrors('creditLimit');
    this.accountDraft.update((d) => ({ ...d, creditCurrencyCode }));
  }

  protected onPriceBookChange(priceBookId: string): void {
    if (this.isReadonly()) return;
    this.clearServerErrors('priceBook');
    this.accountDraft.update((d) => ({ ...d, priceBookId }));
  }

  protected onCreditPolicyChange(creditPolicyVersionId: string): void {
    if (this.isReadonly()) return;
    this.accountDraft.update((d) => ({ ...d, creditPolicyVersionId }));
  }

  protected onOrderingHoldChange(orderingHold: boolean): void {
    if (this.isReadonly()) return;
    this.accountDraft.update((d) => ({ ...d, orderingHold }));
  }

  protected onAllowedCurrenciesChange(allowedCurrencies: string[]): void {
    if (this.isReadonly()) return;
    this.accountDraft.update((d) => ({ ...d, allowedCurrencies }));
  }

  protected onBranchCreditLimitInput(event: Event): void {
    if (this.isReadonly() || this.isSupplier()) return;
    const creditLimit = (event.target as HTMLInputElement).value;
    this.clearServerErrors('branchCreditLimit');
    this.branchDraft.update((d) => ({ ...d, creditLimit }));
  }

  protected onBranchOrderingHoldChange(orderingHold: boolean): void {
    if (this.isReadonly() || this.isSupplier() || this.savedRuleHasHold()) return;
    this.clearServerErrors('branchCreditLimit');
    this.branchDraft.update((d) => ({ ...d, orderingHold }));
  }

  protected onBranchCurrenciesChange(allowedCurrencies: string[]): void {
    if (this.isReadonly() || this.baseCurrencyList().length === 0) return;
    this.clearServerErrors('branchCreditLimit');
    this.branchDraft.update((d) => ({ ...d, allowedCurrencies }));
  }

  protected onRuleActiveChange(active: boolean): void {
    if (this.isReadonly() || !this.hasSavedBranchRule()) return;
    this.clearServerErrors('branchCreditLimit');
    this.branchDraft.update((d) => ({ ...d, active }));
  }

  protected undoChanges(): void {
    if (!this.dirty() || this.saving() || this.statusSaving()) return;
    this.accountDraft.set(this.cloneAccountForm(this.accountBase()));
    this.branchDraft.set(this.cloneBranchForm(this.branchBase()));
    this.attempted.set(false);
    this.serverErrors.set({});
  }

  async requestClose(): Promise<boolean> {
    if (this.saving() || this.statusSaving()) return false;
    if (!(await this.confirmLeave())) return false;
    this.allowClose = true;
    this.modal().close();
    return true;
  }

  protected openStatusDialog(mode: 'block' | 'unblock'): void {
    if (!this.canManage() || !this.detail() || this.saving() || this.statusSaving() || this.guardBusy()) return;
    this.statusDialogMode.set(mode);
    this.guardBusy.set(true);
    this.statusDialog().open();
  }

  protected onStatusDialogCancelled(): void {
    this.guardBusy.set(false);
  }

  protected async onStatusConfirmed(input: AccountStatusTransitionInput): Promise<void> {
    const current = this.detail();
    if (!current || this.statusSaving()) return;

    const mode = this.statusDialogMode();
    const ctx = this.ctx();
    const fingerprint = JSON.stringify({ mode, id: current.id, version: current.version, input });
    if (fingerprint !== this.lastStatusFingerprint || !this.lastStatusKey) {
      this.lastStatusFingerprint = fingerprint;
      this.lastStatusKey = newIdempotencyKey();
    }

    this.statusSaving.set(true);
    try {
      const updated =
        mode === 'block'
          ? await blockAccount(ctx, current.id, current.version, input, this.lastStatusKey)
          : await unblockAccount(ctx, current.id, current.version, input, this.lastStatusKey);

      this.lastStatusFingerprint = null;
      this.lastStatusKey = null;
      this.statusDialog().close();
      this.guardBusy.set(false);

      const nextDetail: AccountDetail = {
        ...updated,
        branchRule: current.branchRule,
      };
      this.detail.set(nextDetail);
      this.notify.success(
        this.transloco.translate(mode === 'block' ? 'tradeAccounts.toast.blocked' : 'tradeAccounts.toast.unblocked'),
      );
      this.saved.emit(nextDetail);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.statusDialog().close();
        this.guardBusy.set(false);
        this.statusSaving.set(false);
        this.handleForbidden();
        return;
      }
      const code = errorCodeOf(error);
      if (code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH') {
        this.lastStatusFingerprint = null;
        this.lastStatusKey = null;
      }
      if (this.isStaleVersion(error)) {
        this.statusDialog().close();
        this.guardBusy.set(false);
        this.statusSaving.set(false);
        await this.handleStatusConflict(current.id, mode, input);
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      this.statusSaving.set(false);
    }
  }

  protected onCreditForbidden(): void {
    this.handleForbidden();
  }

  protected async save(): Promise<boolean> {
    if (!this.canManage() || this.saving() || this.statusSaving() || this.loading() || this.loadFailed()) {
      return false;
    }

    this.attempted.set(true);
    this.serverErrors.set({});

    if (!this.validateClient()) {
      return false;
    }

    if (this.mode() === 'create') {
      return this.submitCreate();
    }
    return this.submitEdit();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.guardBusy()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty() && this.canManage() && !this.loading() && !this.loadFailed()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }

    this.allowClose = false;
    this.loadSeq++;
    this.lookupSeq++;
    this.booksLookupSeq++;
    this.isOpen.set(false);
    this.accountId.set(null);
    this.detail.set(null);
    this.branchRules.set([]);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.saving.set(false);
    this.statusSaving.set(false);
    this.guardBusy.set(false);
    this.partyPickerForbidden.set(false);
    this.attempted.set(false);
    this.serverErrors.set({});
    this.openedCompanyId = null;
    this.openedBranchId = null;
    this.resetIdempotencyKeys();
    this.closed.emit();
  }

  private async confirmModalClose(): Promise<void> {
    if (await this.confirmLeave()) {
      this.allowClose = true;
      this.modal().close();
    }
  }

  private async confirmLeave(): Promise<boolean> {
    if (!this.dirty() || !this.canManage() || this.loading() || this.loadFailed()) return true;
    if (this.guardBusy()) return false;
    this.guardBusy.set(true);
    let choice: 'save' | 'discard' | 'cancel' = 'cancel';
    try {
      choice = await this.unsavedDialog().open();
    } finally {
      this.guardBusy.set(false);
    }
    if (choice === 'cancel') return false;
    if (choice === 'discard') {
      this.undoChanges();
      return true;
    }
    return this.save();
  }

  private validateClient(): boolean {
    const acc = this.accountDraft();
    if (this.mode() === 'create' && !acc.partyId) {
      return false;
    }

    if (acc.accountRole === 'CUSTOMER') {
      const limit = acc.creditLimit.trim();
      const currency = acc.creditCurrencyCode;
      if (limit && !CREDIT_LIMIT_PATTERN.test(limit)) return false;
      if (limit && !currency) return false;
      if (!limit && currency) return false;
      if (currency && acc.allowedCurrencies.length > 0 && !acc.allowedCurrencies.includes(currency)) {
        return false;
      }
      if (this.mode() === 'edit') {
        const brLimit = this.branchDraft().creditLimit.trim();
        if (brLimit && !CREDIT_LIMIT_PATTERN.test(brLimit)) return false;
        if (this.branchDirty()) {
          const baseSet = new Set(this.baseCurrencyList());
          if (this.branchDraft().allowedCurrencies.some((code) => !baseSet.has(code))) return false;
        }
      }
    }

    return true;
  }

  private buildTerms(): CommercialAccount['terms'] {
    const acc = this.accountDraft();
    const terms: CommercialAccount['terms'] = { ...this.extraTerms };
    if (acc.orderingHold) {
      terms.orderingHold = true;
    } else if (this.hadOrderingHoldKey) {
      terms.orderingHold = false;
    }
    if (acc.allowedCurrencies.length > 0) {
      terms.allowedCurrencies = [...acc.allowedCurrencies];
    }
    return terms;
  }

  private buildAccountInput(): AccountInput {
    const acc = this.accountDraft();
    const isSupplier = acc.accountRole === 'SUPPLIER';
    const limit = acc.creditLimit.trim();
    return {
      creditLimit: isSupplier || !limit ? null : limit,
      creditCurrencyCode: isSupplier || !limit || !acc.creditCurrencyCode ? null : acc.creditCurrencyCode,
      priceBookId: acc.priceBookId || null,
      creditPolicyVersionId: acc.creditPolicyVersionId || null,
      terms: this.buildTerms(),
    };
  }

  private buildAccountPatch(): UpdateAccountPatch {
    const base = this.accountBase();
    const draft = this.accountDraft();
    const full = this.buildAccountInput();
    const patch: UpdateAccountPatch = {};

    if (base.creditLimit.trim() !== draft.creditLimit.trim()) {
      patch.creditLimit = full.creditLimit;
    }
    if (base.creditCurrencyCode !== draft.creditCurrencyCode) {
      patch.creditCurrencyCode = full.creditCurrencyCode;
    }
    if (base.priceBookId !== draft.priceBookId) {
      patch.priceBookId = full.priceBookId;
    }
    if (base.creditPolicyVersionId !== draft.creditPolicyVersionId) {
      patch.creditPolicyVersionId = full.creditPolicyVersionId;
    }
    if (base.orderingHold !== draft.orderingHold || !arraysEqual(base.allowedCurrencies, draft.allowedCurrencies)) {
      patch.terms = full.terms;
    }

    return patch;
  }

  private buildNarrowingRules(): BranchRuleNarrowing {
    const br = this.branchDraft();
    const narrowing: BranchRuleNarrowing = {};
    const limit = br.creditLimit.trim();
    if (limit && !this.isSupplier()) {
      narrowing.creditLimit = limit;
    }
    if (br.orderingHold) {
      narrowing.orderingHold = true;
    }
    if (br.allowedCurrencies.length > 0) {
      narrowing.allowedCurrencies = [...br.allowedCurrencies];
    }
    return narrowing;
  }

  private async submitCreate(): Promise<boolean> {
    const acc = this.accountDraft();
    const body = {
      ...this.buildAccountInput(),
      partyId: acc.partyId,
      accountRole: acc.accountRole,
    };
    const ctx = this.ctx();
    const fingerprint = JSON.stringify({ companyId: ctx.companyId ?? '', body });
    if (fingerprint !== this.lastCreateFingerprint || !this.lastCreateKey) {
      this.lastCreateFingerprint = fingerprint;
      this.lastCreateKey = newIdempotencyKey();
    }

    this.saving.set(true);
    try {
      const created = await createAccount(ctx, body, this.lastCreateKey);
      this.lastCreateFingerprint = null;
      this.lastCreateKey = null;
      this.notify.success(this.transloco.translate('tradeAccounts.toast.created'));

      const createdDetail: AccountDetail = { ...created, branchRule: null };
      this.applyLoadedDetail(createdDetail, []);
      this.saved.emit(createdDetail);
      return true;
    } catch (error) {
      this.handleSaveError(error, 'account');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async submitEdit(): Promise<boolean> {
    const current = this.detail();
    if (!current || !this.dirty()) return true;

    const ctx = this.ctx();
    const needAccountPatch = this.accountDirty();
    const needBranchSave = this.branchDirty();

    this.saving.set(true);
    let activeDetail = current;
    let savedSomething = false;

    try {
      if (needAccountPatch) {
        const patch = this.buildAccountPatch();
        const fingerprint = JSON.stringify({ id: activeDetail.id, version: activeDetail.version, patch });
        if (fingerprint !== this.lastUpdateFingerprint || !this.lastUpdateKey) {
          this.lastUpdateFingerprint = fingerprint;
          this.lastUpdateKey = newIdempotencyKey();
        }

        try {
          const res = await updateAccount(ctx, activeDetail.id, activeDetail.version, patch, this.lastUpdateKey);
          this.lastUpdateFingerprint = null;
          this.lastUpdateKey = null;
          savedSomething = true;

          const { warnings, ...account } = res;
          activeDetail = { ...account, branchRule: activeDetail.branchRule };
          this.detail.set(activeDetail);
          this.extraTerms = extractExtraTerms(activeDetail.terms);
          this.hadOrderingHoldKey = 'orderingHold' in activeDetail.terms;
          const syncedAccount = accountFormFromDetail(activeDetail);
          this.accountBase.set(syncedAccount);
          this.accountDraft.set(this.cloneAccountForm(syncedAccount));

          this.showWarningsToast(warnings);
          if (!needBranchSave) {
            this.attempted.set(false);
            this.notify.success(this.transloco.translate('tradeAccounts.toast.saved'));
            this.saved.emit(activeDetail);
            return true;
          }
          this.saved.emit(activeDetail);
        } catch (error) {
          if (this.isStaleVersion(error)) {
            this.saving.set(false);
            return await this.handleEditConflict(activeDetail.id);
          }
          this.handleSaveError(error, 'account');
          return false;
        }
      }

      if (needBranchSave) {
        const branchId = ctx.branchId;
        if (!branchId) {
          this.notify.error(this.transloco.translate('tradeShared.errors.TRADE_CONTEXT_MISSING_BRANCH'));
          return false;
        }
        const narrowingRules = this.buildNarrowingRules();
        const existingRule = activeDetail.branchRule;

        const fingerprint = JSON.stringify({
          id: activeDetail.id,
          ruleId: existingRule?.id ?? null,
          ruleVersion: existingRule?.version ?? null,
          branchId,
          narrowingRules,
          active: this.branchDraft().active,
        });
        if (fingerprint !== this.lastBranchFingerprint || !this.lastBranchKey) {
          this.lastBranchFingerprint = fingerprint;
          this.lastBranchKey = newIdempotencyKey();
        }

        try {
          const updatedRule = existingRule
            ? await updateBranchRule(
                ctx,
                activeDetail.id,
                existingRule.branchId,
                existingRule.version,
                { narrowingRules, status: this.branchDraft().active ? 'ACTIVE' : 'RETIRED' },
                this.lastBranchKey,
              )
            : await createBranchRule(ctx, activeDetail.id, { branchId, narrowingRules }, this.lastBranchKey);

          this.lastBranchFingerprint = null;
          this.lastBranchKey = null;
          savedSomething = true;

          activeDetail = { ...activeDetail, branchRule: updatedRule };
          this.detail.set(activeDetail);
          this.upsertBranchRule(updatedRule);
          const syncedBranch = branchFormFromRule(updatedRule);
          this.branchBase.set(syncedBranch);
          this.branchDraft.set(this.cloneBranchForm(syncedBranch));
          this.attempted.set(false);
          this.notify.success(this.transloco.translate('tradeAccounts.toast.saved'));
          this.saved.emit(activeDetail);
          return true;
        } catch (error) {
          if (this.isStaleVersion(error)) {
            this.saving.set(false);
            return await this.handleEditConflict(activeDetail.id);
          }
          this.handleSaveError(error, 'branch');
          if (savedSomething) {
            this.saved.emit(activeDetail);
          }
          return false;
        }
      }

      return true;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleEditConflict(id: string): Promise<boolean> {
    if (this.guardBusy()) return false;
    this.guardBusy.set(true);
    let choice: 'save' | 'discard' | 'cancel' = 'cancel';
    try {
      choice = await this.conflictDialog().open();
    } finally {
      this.guardBusy.set(false);
    }
    if (choice === 'cancel') return false;

    try {
      const ctx = this.ctx();
      const [fresh, allRules] = await Promise.all([
        getAccount(ctx, id),
        listBranchRules(ctx, id).catch(() => [] as BranchRule[]),
      ]);
      if (choice === 'save') {
        this.applyLoadedDetail(fresh, allRules);
        this.saved.emit(fresh);
        return false;
      }

      const rebasedAccount = this.rebaseAccountForm(
        this.accountBase(),
        this.accountDraft(),
        accountFormFromDetail(fresh),
      );
      const rebasedBranch = this.rebaseBranchForm(
        this.branchBase(),
        this.branchDraft(),
        branchFormFromRule(fresh.branchRule),
      );
      this.applyLoadedDetail(fresh, allRules);
      this.accountDraft.set(rebasedAccount);
      this.branchDraft.set(rebasedBranch);
      return await this.save();
    } catch (error) {
      if (isForbiddenError(error)) {
        this.handleForbidden();
        return false;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
      return false;
    }
  }

  private async handleStatusConflict(
    id: string,
    mode: 'block' | 'unblock',
    input: AccountStatusTransitionInput,
  ): Promise<void> {
    if (this.guardBusy()) return;
    this.guardBusy.set(true);
    let choice: 'save' | 'discard' | 'cancel' = 'cancel';
    try {
      choice = await this.conflictDialog().open();
    } finally {
      this.guardBusy.set(false);
    }
    if (choice === 'cancel') return;

    try {
      const ctx = this.ctx();
      const [fresh, allRules] = await Promise.all([
        getAccount(ctx, id),
        listBranchRules(ctx, id).catch(() => [] as BranchRule[]),
      ]);
      if (choice === 'save') {
        this.applyLoadedDetail(fresh, allRules);
        this.saved.emit(fresh);
        return;
      }

      const key = newIdempotencyKey();
      const updated =
        mode === 'block'
          ? await blockAccount(ctx, id, fresh.version, input, key)
          : await unblockAccount(ctx, id, fresh.version, input, key);
      const nextDetail: AccountDetail = { ...updated, branchRule: fresh.branchRule };
      this.applyLoadedDetail(nextDetail, allRules);
      this.notify.success(
        this.transloco.translate(mode === 'block' ? 'tradeAccounts.toast.blocked' : 'tradeAccounts.toast.unblocked'),
      );
      this.saved.emit(nextDetail);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.handleForbidden();
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
    }
  }

  private rebaseAccountForm(
    oldBase: AccountFormState,
    userDraft: AccountFormState,
    freshBase: AccountFormState,
  ): AccountFormState {
    return {
      accountRole: freshBase.accountRole,
      partyId: freshBase.partyId,
      creditLimit: userDraft.creditLimit !== oldBase.creditLimit ? userDraft.creditLimit : freshBase.creditLimit,
      creditCurrencyCode:
        userDraft.creditCurrencyCode !== oldBase.creditCurrencyCode
          ? userDraft.creditCurrencyCode
          : freshBase.creditCurrencyCode,
      priceBookId: userDraft.priceBookId !== oldBase.priceBookId ? userDraft.priceBookId : freshBase.priceBookId,
      creditPolicyVersionId:
        userDraft.creditPolicyVersionId !== oldBase.creditPolicyVersionId
          ? userDraft.creditPolicyVersionId
          : freshBase.creditPolicyVersionId,
      orderingHold: userDraft.orderingHold !== oldBase.orderingHold ? userDraft.orderingHold : freshBase.orderingHold,
      allowedCurrencies: !arraysEqual(userDraft.allowedCurrencies, oldBase.allowedCurrencies)
        ? [...userDraft.allowedCurrencies]
        : [...freshBase.allowedCurrencies],
    };
  }

  private rebaseBranchForm(
    oldBase: BranchRuleFormState,
    userDraft: BranchRuleFormState,
    freshBase: BranchRuleFormState,
  ): BranchRuleFormState {
    return {
      creditLimit: userDraft.creditLimit !== oldBase.creditLimit ? userDraft.creditLimit : freshBase.creditLimit,
      orderingHold: userDraft.orderingHold !== oldBase.orderingHold ? userDraft.orderingHold : freshBase.orderingHold,
      allowedCurrencies: !arraysEqual(userDraft.allowedCurrencies, oldBase.allowedCurrencies)
        ? [...userDraft.allowedCurrencies]
        : [...freshBase.allowedCurrencies],
      active: userDraft.active !== oldBase.active ? userDraft.active : freshBase.active,
    };
  }

  private handleForbidden(): void {
    this.allowClose = true;
    if (this.isOpen()) {
      this.modal().close();
    }
    this.forbidden.emit();
  }

  private handleSaveError(error: unknown, stage: 'account' | 'branch'): void {
    if (isForbiddenError(error)) {
      this.handleForbidden();
      return;
    }

    const code = errorCodeOf(error);
    const message = this.transloco.translate(errorKey(error));

    if (code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH') {
      this.lastCreateFingerprint = null;
      this.lastCreateKey = null;
      this.lastUpdateFingerprint = null;
      this.lastUpdateKey = null;
      this.lastBranchFingerprint = null;
      this.lastBranchKey = null;
    }

    if (error instanceof ApiError && code === 'TRADE.VALIDATION_FAILED' && error.details) {
      const mapped: Partial<Record<AccountServerErrorField, string>> = {};
      const details = error.details;
      if (details['partyId']?.[0]) mapped.party = details['partyId'][0];
      if (details['priceBookId']?.[0]) mapped.priceBook = details['priceBookId'][0];
      const limitMsg = details['creditLimit']?.[0] ?? details['creditCurrencyCode']?.[0];
      if (limitMsg) {
        if (stage === 'branch') mapped.branchCreditLimit = limitMsg;
        else mapped.creditLimit = limitMsg;
      }
      const branchMsg =
        details['narrowingRules']?.[0] ??
        details['narrowingRules.creditLimit']?.[0] ??
        details['branchId']?.[0];
      if (branchMsg) mapped.branchCreditLimit = branchMsg;
      if (Object.keys(mapped).length > 0) {
        this.serverErrors.set(mapped);
        return;
      }
    }

    switch (code) {
      case 'TRADE.ACCOUNT.PARTY_ROLE_INVALID':
      case 'TRADE.ACCOUNT.ALREADY_EXISTS':
        this.serverErrors.set({ party: message });
        return;
      case 'TRADE.ACCOUNT.PRICE_BOOK_INCOMPATIBLE':
      case 'TRADE.ACCOUNT.TERM_INVALID':
        this.serverErrors.set({ priceBook: message });
        return;
      case 'TRADE.ACCOUNT.CREDIT_LIMIT_INVALID':
        this.serverErrors.set(stage === 'branch' ? { branchCreditLimit: message } : { creditLimit: message });
        return;
      case 'TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY':
        this.serverErrors.set({ branchCreditLimit: message });
        return;
      default:
        this.notify.error(message);
    }
  }

  private showWarningsToast(warnings: readonly AccountWarning[]): void {
    if (!warnings.length) return;
    const branchesMap = new Map(this.scope.branches().map((b) => [b.id, this.language() === 'ar' ? b.nameAr : b.nameEn]));
    const names = warnings.map((w) => branchesMap.get(w.branchId) ?? w.branchId).join(', ');
    this.notify.warning(this.transloco.translate('tradeAccounts.warnings.branchRulesWider', { branches: names }));
  }

  private upsertBranchRule(rule: BranchRule): void {
    this.branchRules.update((rules) => {
      const idx = rules.findIndex((item) => item.id === rule.id);
      if (idx >= 0) {
        return rules.map((item, i) =>
          i === idx
            ? {
                ...rule,
                ...(item.branchName !== undefined ? { branchName: item.branchName } : {}),
                ...(item.branchNameAr !== undefined ? { branchNameAr: item.branchNameAr } : {}),
              }
            : item,
        );
      }
      return [...rules, rule];
    });
  }

  private async loadAccount(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    const ctx = this.ctx();
    this.loading.set(true);
    this.loadFailed.set(false);
    this.attempted.set(false);
    this.serverErrors.set({});

    try {
      const [loaded, allRules] = await Promise.all([
        getAccount(ctx, id),
        listBranchRules(ctx, id).catch(() => [] as BranchRule[]),
        this.loadLookups(false),
      ]);
      if (seq !== this.loadSeq) return;
      this.applyLoadedDetail(loaded, allRules);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loading.set(false);
      if (isForbiddenError(error)) {
        this.handleForbidden();
        return;
      }
      this.loadFailed.set(true);
    }
  }

  private async loadLookups(includeCreateLists: boolean): Promise<void> {
    const seq = ++this.lookupSeq;
    const booksSeq = ++this.booksLookupSeq;
    const ctx = this.ctx();
    const role = includeCreateLists ? this.accountDraft().accountRole : undefined;

    if (includeCreateLists) {
      this.partyPickerForbidden.set(false);
      void this.loadPartiesForCreate(role, seq);
    }

    try {
      const [lookups, reasons, existing] = await Promise.all([
        listAccountLookups(ctx, role),
        listReasons('ACCOUNT_BLOCK', { includeInactive: true }).catch(() => [] as ReasonCode[]),
        includeCreateLists
          ? this.loadAllCompanyAccounts(ctx.companyId).catch(() => [] as AccountWithParty[])
          : Promise.resolve<readonly AccountWithParty[] | null>(null),
      ]);
      if (booksSeq === this.booksLookupSeq) {
        this.priceBooks.set(lookups.priceBooks);
        this.creditPolicies.set(lookups.creditPolicies);
      }
      if (seq !== this.lookupSeq) return;
      this.blockReasons.set(reasons);
      if (existing) this.existingAccounts.set(existing);
    } catch (error) {
      if (seq !== this.lookupSeq) return;
      if (isForbiddenError(error)) {
        this.handleForbidden();
      }
    }
  }

  private async loadLookupsForRole(role: CommercialAccountRole): Promise<void> {
    const seq = ++this.booksLookupSeq;
    const lookupSeq = this.lookupSeq;
    const ctx = this.ctx();
    void this.loadPartiesForCreate(role, lookupSeq);
    try {
      const lookups = await listAccountLookups(ctx, role);
      if (seq !== this.booksLookupSeq) return;
      this.priceBooks.set(lookups.priceBooks);
      this.creditPolicies.set(lookups.creditPolicies);
    } catch (error) {
      if (seq !== this.booksLookupSeq) return;
      if (isForbiddenError(error)) {
        this.handleForbidden();
      }
    }
  }

  private async loadPartiesForCreate(role: CommercialAccountRole | undefined, seq: number): Promise<void> {
    try {
      const parties = await listParties(role);
      if (seq !== this.lookupSeq) return;
      this.partyPickerForbidden.set(false);
      this.parties.set(parties);
    } catch (error) {
      if (seq !== this.lookupSeq) return;
      if (isForbiddenError(error)) {
        this.partyPickerForbidden.set(true);
        this.parties.set([]);
      }
    }
  }

  private async loadAllCompanyAccounts(companyId: string | undefined): Promise<AccountWithParty[]> {
    if (!companyId) return [];
    const collected: AccountWithParty[] = [];
    let page = 1;
    while (true) {
      const res = await listAccounts({ companyId }, { page, limit: 100 });
      collected.push(...res.items);
      if (collected.length >= res.total || res.items.length < 100) break;
      page += 1;
    }
    return collected;
  }

  private applyLoadedDetail(loaded: AccountDetail, allRules?: readonly BranchRule[]): void {
    this.mode.set('edit');
    this.accountId.set(loaded.id);
    this.detail.set(loaded);
    if (allRules !== undefined) {
      this.branchRules.set(allRules);
    }
    this.extraTerms = extractExtraTerms(loaded.terms);
    this.hadOrderingHoldKey = 'orderingHold' in loaded.terms;

    const accForm = accountFormFromDetail(loaded);
    const brForm = branchFormFromRule(loaded.branchRule);
    this.accountBase.set(accForm);
    this.accountDraft.set(this.cloneAccountForm(accForm));
    this.branchBase.set(brForm);
    this.branchDraft.set(this.cloneBranchForm(brForm));

    this.loading.set(false);
    this.loadFailed.set(false);
    this.attempted.set(false);
    this.serverErrors.set({});
  }

  private isStaleVersion(error: unknown): boolean {
    return error instanceof ApiError && error.status === 409 && error.code === 'TRADE.CONCURRENCY.STALE_VERSION';
  }

  private clearServerErrors(...fields: AccountServerErrorField[]): void {
    const current = this.serverErrors();
    let changed = false;
    const next: Partial<Record<AccountServerErrorField, string>> = { ...current };
    for (const field of fields) {
      if (next[field]) {
        delete next[field];
        changed = true;
      }
    }
    if (changed) {
      this.serverErrors.set(next);
    }
  }

  private resetIdempotencyKeys(): void {
    this.lastCreateFingerprint = null;
    this.lastCreateKey = null;
    this.lastUpdateFingerprint = null;
    this.lastUpdateKey = null;
    this.lastBranchFingerprint = null;
    this.lastBranchKey = null;
    this.lastStatusFingerprint = null;
    this.lastStatusKey = null;
  }

  private cloneAccountForm(form: AccountFormState): AccountFormState {
    return { ...form, allowedCurrencies: [...form.allowedCurrencies] };
  }

  private cloneBranchForm(form: BranchRuleFormState): BranchRuleFormState {
    return { ...form, allowedCurrencies: [...form.allowedCurrencies] };
  }
}
