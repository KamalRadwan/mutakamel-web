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
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCheck,
  tablerChevronDown,
  tablerLoader2,
  tablerPercentage,
  tablerRefresh,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../shared/ui/overlay/zoom';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../shared/ui/switch/switch';
import { TradeItemPicker } from '../../shared/pickers/item-picker/item-picker';
import { type TradeContext, tradeContext } from '../../shared/trade-api';
import { itemName, searchCommercialAccounts } from '../../shared/trade-foundation.api';
import type {
  Channel,
  CommercialAccountRole,
  CommercialAccountSummary,
  Uom,
} from '../../shared/trade-foundation.model';
import type {
  BenefitType,
  PricePurpose,
  PromotionRule,
  ReferenceBranch,
} from '../pricing.model';

const DECIMAL_RE = /^(0|[1-9]\d{0,15})(\.\d{1,8})?$/;
const PROMO_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SCALE = 8;
const SCALE_FACTOR = 100_000_000n;
const DEBOUNCE_MS = 250;

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

function toScaled(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!DECIMAL_RE.test(trimmed)) return null;
  const [intPart, fracRaw = ''] = trimmed.split('.');
  const fracPart = fracRaw.slice(0, SCALE).padEnd(SCALE, '0');
  return BigInt(intPart) * SCALE_FACTOR + BigInt(fracPart);
}

@Component({
  selector: 'app-promotion-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    Segmented,
    Switch,
    TradeItemPicker,
  ],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerCheck,
      tablerChevronDown,
      tablerLoader2,
      tablerPercentage,
      tablerRefresh,
      tablerX,
    }),
  ],
  templateUrl: './promotion-modal.html',
  host: {
    '(document:click)': 'closeAccountIfOutside($event)',
    '(window:resize)': 'closeAccountMenu(true)',
  },
})
export class PromotionModal {
  private static nextId = 0;
  private static tempSeq = 0;
  protected readonly uid = `gov-promo-modal-${++PromotionModal.nextId}`;
  protected readonly accountListId = `${this.uid}-account-list`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(ScopeState);
  private readonly lang = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly accountBox = viewChild<ElementRef<HTMLElement>>('accountBox');
  private readonly accountInput = viewChild<ElementRef<HTMLInputElement>>('accountInput');
  private readonly accountListRef = viewChild<ElementRef<HTMLElement>>('accountList');

  readonly bookPurpose = input.required<PricePurpose>();
  readonly currencyCode = input.required<string>();
  readonly existingPromotions = input<readonly PromotionRule[]>([]);
  readonly uoms = input<readonly Uom[]>([]);
  readonly branches = input<readonly ReferenceBranch[]>([]);
  readonly channels = input<readonly Channel[]>([]);
  readonly accounts = input<readonly CommercialAccountSummary[]>([]);

  readonly saved = output<PromotionRule>();
  readonly closed = output<void>();

  protected readonly editingId = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly benefitType = signal<BenefitType>('PERCENTAGE');
  protected readonly benefitValue = signal('');
  protected readonly priorityText = signal('100');
  protected readonly stackGroup = signal('DEFAULT');
  protected readonly exclusive = signal(false);

  protected readonly itemId = signal<string | null>(null);
  protected readonly uomId = signal('');
  protected readonly branchId = signal('');
  protected readonly channelId = signal('');
  protected readonly partyId = signal<string | null>(null);
  protected readonly minQty = signal('0');
  protected readonly maxQty = signal('');

  protected readonly submitted = signal(false);
  protected readonly touched = signal<ReadonlySet<string>>(new Set());

  protected readonly accountOpen = signal(false);
  protected readonly accountPlaced = signal(false);
  protected readonly accountPlace = signal<ListPlace>({ top: 0, start: 0, width: 200, maxHeight: null });
  protected readonly accountActiveIndex = signal(0);
  private readonly accountEditing = signal(false);
  private readonly accountQuery = signal('');
  private readonly accountDebouncedQuery = signal('');
  protected readonly accountResults = signal<CommercialAccountSummary[]>([]);
  private readonly pickedAccount = signal<CommercialAccountSummary | null>(null);
  protected readonly accountLoading = signal(false);
  protected readonly accountLoadError = signal(false);
  private readonly accountRetryTick = signal(0);

  private accountFetchSeq = 0;
  private accountListSeq = 0;
  private accountDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private initialSnapshot = '';
  private allowClose = false;
  private confirmingLeave = false;

  protected readonly companyContext = computed<TradeContext>(() => tradeContext(this.scope, 'COMPANY'));

  protected readonly accountRole = computed<CommercialAccountRole>(() =>
    this.bookPurpose() === 'PURCHASE' ? 'SUPPLIER' : 'CUSTOMER',
  );

  protected readonly isEdit = computed(() => this.editingId() !== null);

  protected readonly benefitOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'PERCENTAGE', label: this.transloco.translate('pricing.promoModal.percent') },
      { value: 'FIXED_AMOUNT', label: this.transloco.translate('pricing.promoModal.fixedAmount') },
    ];
  });

  protected readonly unitOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const language = this.lang();
    const anyLabel = this.transloco.translate('pricing.promoModal.anyOption');
    const selectedId = this.uomId();
    const options: DropdownOption<string>[] = [{ value: '', label: anyLabel }];
    for (const u of this.uoms()) {
      if (u.status === 'RETIRED' && u.id !== selectedId) continue;
      options.push({
        value: u.id,
        label: `${u.code} — ${itemName(u, language) || u.displayName}`,
      });
    }
    return options;
  });

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const language = this.lang();
    const anyLabel = this.transloco.translate('pricing.promoModal.anyOption');
    return [
      { value: '', label: anyLabel },
      ...this.branches().map((b) => ({
        value: b.id,
        label: `${language === 'ar' ? b.nameAr : b.nameEn} (${b.code})`,
      })),
    ];
  });

  protected readonly channelOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const anyLabel = this.transloco.translate('pricing.promoModal.anyOption');
    return [
      { value: '', label: anyLabel },
      ...this.channels().map((c) => ({
        value: c.id,
        label: `${c.name} (${c.code})`,
      })),
    ];
  });

  protected readonly selectedAccountLabel = computed(() => {
    const id = this.partyId();
    if (!id) return '';
    const picked = this.pickedAccount();
    if (picked && (picked.partyId === id || picked.id === id)) {
      return picked.party.code ? `${picked.partyName} (${picked.party.code})` : picked.partyName;
    }
    const fromResults = this.accountResults().find((a) => a.partyId === id || a.id === id);
    if (fromResults) {
      return fromResults.party.code
        ? `${fromResults.partyName} (${fromResults.party.code})`
        : fromResults.partyName;
    }
    const fromParent = this.accounts().find((a) => a.partyId === id || a.id === id);
    if (fromParent) {
      return fromParent.party.code
        ? `${fromParent.partyName} (${fromParent.party.code})`
        : fromParent.partyName;
    }
    return id;
  });

  protected readonly accountInputText = computed(() =>
    this.accountEditing() ? this.accountQuery() : this.selectedAccountLabel(),
  );

  protected readonly safeAccountActiveIndex = computed(() => {
    const count = this.accountResults().length;
    if (count === 0) return -1;
    const idx = this.accountActiveIndex();
    return idx >= 0 && idx < count ? idx : 0;
  });

  protected readonly accountActiveDescendant = computed(() => {
    if (!this.accountOpen() || this.accountLoading() || this.accountLoadError()) return null;
    const idx = this.safeAccountActiveIndex();
    return idx >= 0 ? this.accountOptionId(idx) : null;
  });

  protected readonly accountBoxClasses = computed(() => {
    const base =
      'flex h-field w-full items-center gap-4 rounded-8 border px-8 text-12 transition-colors duration-fast';
    if (this.accountOpen()) {
      return `${base} border-focus-ring bg-surface-field text-text ring-3 ring-focus-halo`;
    }
    return `${base} border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo`;
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    if (!this.showErrorFor('code')) return null;
    const trimmed = this.code().trim();
    if (!trimmed) {
      return this.transloco.translate('pricing.promoModal.errors.codeRequired');
    }
    if (!PROMO_CODE_RE.test(trimmed)) {
      return this.transloco.translate('pricing.promoModal.errors.codePattern');
    }
    const upper = trimmed.toUpperCase();
    const editingId = this.editingId();
    const duplicate = this.existingPromotions().some(
      (p) => p.id !== editingId && p.code.trim().toUpperCase() === upper,
    );
    if (duplicate) {
      return this.transloco.translate('pricing.promoModal.errors.codeUnique');
    }
    return null;
  });

  protected readonly nameError = computed<string | null>(() => {
    this.i18n();
    if (!this.showErrorFor('name')) return null;
    if (!this.name().trim()) {
      return this.transloco.translate('pricing.promoModal.errors.nameRequired');
    }
    return null;
  });

  protected readonly valueError = computed<string | null>(() => {
    this.i18n();
    if (!this.showErrorFor('benefitValue')) return null;
    const raw = this.benefitValue().trim();
    if (!raw) {
      return this.transloco.translate('pricing.promoModal.errors.valueRequired');
    }
    const scaled = toScaled(raw);
    if (scaled === null) {
      return this.transloco.translate('pricing.promoModal.errors.invalidDecimal');
    }
    if (scaled <= 0n) {
      return this.transloco.translate('pricing.promoModal.errors.valuePositive');
    }
    if (this.benefitType() === 'PERCENTAGE' && scaled > 100n * SCALE_FACTOR) {
      return this.transloco.translate('pricing.promoModal.errors.percentCap');
    }
    return null;
  });

  protected readonly priorityError = computed<string | null>(() => {
    this.i18n();
    if (!this.showErrorFor('priority')) return null;
    const raw = this.priorityText().trim();
    if (!/^\d+$/.test(raw)) {
      return this.transloco.translate('pricing.promoModal.errors.priorityRange');
    }
    const num = Number(raw);
    if (!Number.isInteger(num) || num < 0 || num > 10_000) {
      return this.transloco.translate('pricing.promoModal.errors.priorityRange');
    }
    return null;
  });

  protected readonly equalPriorityCode = computed<string | null>(() => {
    const raw = this.priorityText().trim();
    if (!/^\d+$/.test(raw)) return null;
    const num = Number(raw);
    if (!Number.isInteger(num) || num < 0 || num > 10_000) return null;

    const group = this.stackGroup().trim() || 'DEFAULT';
    const editingId = this.editingId();
    const conflict = this.existingPromotions().find(
      (p) =>
        p.id !== editingId &&
        (p.stackGroup.trim() || 'DEFAULT') === group &&
        p.priority === num,
    );
    return conflict?.code ?? null;
  });

  protected readonly minQtyError = computed<string | null>(() => {
    this.i18n();
    if (!this.showErrorFor('minQty')) return null;
    const raw = this.minQty().trim() || '0';
    if (toScaled(raw) === null) {
      return this.transloco.translate('pricing.promoModal.errors.invalidDecimal');
    }
    return null;
  });

  protected readonly maxQtyError = computed<string | null>(() => {
    this.i18n();
    if (!this.showErrorFor('maxQty')) return null;
    const raw = this.maxQty().trim();
    if (!raw) return null;
    const maxScaled = toScaled(raw);
    if (maxScaled === null) {
      return this.transloco.translate('pricing.promoModal.errors.invalidDecimal');
    }
    const minScaled = toScaled(this.minQty().trim() || '0');
    if (minScaled !== null && maxScaled <= minScaled) {
      return this.transloco.translate('pricing.promoModal.errors.maxAfterMin');
    }
    return null;
  });

  protected readonly dirty = computed(() => this.snapshot() !== this.initialSnapshot);

  constructor() {
    effect(() => {
      const isOpen = this.accountOpen();
      const search = this.accountDebouncedQuery();
      const ctx = this.companyContext();
      const role = this.accountRole();
      const _retry = this.accountRetryTick();
      if (!isOpen) return;
      untracked(() => void this.loadAccounts(ctx, role, search));
    });

    effect(() => {
      const isOpen = this.accountOpen();
      this.accountLoading();
      this.accountLoadError();
      this.accountResults();
      if (isOpen) {
        untracked(() => this.scheduleAccountPlace());
      }
    });

    const onScroll = (event: Event) => {
      if (!this.accountOpen()) return;
      const target = event.target;
      const box = this.accountBox()?.nativeElement;
      const list = this.accountListRef()?.nativeElement;
      if (target instanceof Node && (box?.contains(target) || list?.contains(target))) return;
      this.closeAccountMenu(true);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });

    this.destroyRef.onDestroy(() => {
      this.clearAccountDebounce();
      document.removeEventListener('scroll', onScroll, { capture: true });
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.code.set('');
    this.name.set('');
    this.benefitType.set('PERCENTAGE');
    this.benefitValue.set('');
    this.priorityText.set('100');
    this.stackGroup.set('DEFAULT');
    this.exclusive.set(false);
    this.itemId.set(null);
    this.uomId.set('');
    this.branchId.set('');
    this.channelId.set('');
    this.partyId.set(null);
    this.pickedAccount.set(null);
    this.minQty.set('0');
    this.maxQty.set('');
    this.resetInternalState();
    this.initialSnapshot = this.snapshot();
    this.modal().open();
  }

  openEdit(promo: PromotionRule): void {
    this.editingId.set(promo.id);
    this.code.set(promo.code);
    this.name.set(promo.name);
    this.benefitType.set(promo.benefit.type);
    this.benefitValue.set(promo.benefit.value);
    this.priorityText.set(String(promo.priority));
    this.stackGroup.set(promo.stackGroup || 'DEFAULT');
    this.exclusive.set(promo.exclusive);
    this.itemId.set(promo.selector.itemId ?? null);
    this.uomId.set(promo.selector.uomId ?? '');
    this.branchId.set(promo.selector.branchId ?? '');
    this.channelId.set(promo.selector.channelId ?? '');
    this.partyId.set(promo.selector.partyId ?? null);
    this.pickedAccount.set(null);
    this.minQty.set(promo.selector.minimumQuantity ?? '0');
    this.maxQty.set(promo.selector.maximumQuantity ?? '');
    this.resetInternalState();
    this.initialSnapshot = this.snapshot();
    this.modal().open();
  }

  protected onTextField(
    field: 'code' | 'name' | 'benefitValue' | 'priorityText' | 'stackGroup' | 'minQty' | 'maxQty',
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'code':
        this.code.set(value);
        break;
      case 'name':
        this.name.set(value);
        break;
      case 'benefitValue':
        this.benefitValue.set(value);
        break;
      case 'priorityText':
        this.priorityText.set(value);
        break;
      case 'stackGroup':
        this.stackGroup.set(value);
        break;
      case 'minQty':
        this.minQty.set(value);
        break;
      case 'maxQty':
        this.maxQty.set(value);
        break;
    }
  }

  protected onBenefitTypeChange(next: string | null): void {
    if (next === 'PERCENTAGE' || next === 'FIXED_AMOUNT') {
      this.benefitType.set(next);
    }
  }

  protected markTouched(field: string): void {
    this.touched.update((set) => {
      if (set.has(field)) return set;
      const next = new Set(set);
      next.add(field);
      return next;
    });
  }

  protected accountOptionId(index: number): string {
    return `${this.uid}-acct-opt-${index}`;
  }

  protected accountRowClasses(acc: CommercialAccountSummary, index: number): string {
    const selected = this.partyId() === acc.partyId || this.partyId() === acc.id;
    const active = this.safeAccountActiveIndex() === index;
    if (selected) {
      return active
        ? 'cursor-pointer bg-brand-soft text-on-brand-soft ring-2 ring-focus-halo'
        : 'cursor-pointer bg-brand-soft text-on-brand-soft';
    }
    return active ? 'cursor-pointer bg-row-hover text-text' : 'cursor-pointer text-text hover:bg-row-hover';
  }

  protected onAccountBoxClick(): void {
    this.accountInput()?.nativeElement.focus();
    this.openAccountMenu();
  }

  protected onAccountInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.accountEditing.set(true);
    this.accountQuery.set(text);
    this.accountActiveIndex.set(0);
    if (!this.accountOpen()) {
      this.openAccountMenu();
    }
    this.clearAccountDebounce();
    this.accountDebounceTimer = setTimeout(() => {
      this.accountDebounceTimer = null;
      this.accountDebouncedQuery.set(text);
    }, DEBOUNCE_MS);
  }

  protected onAccountKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (!this.accountOpen()) {
          this.accountActiveIndex.set(0);
          this.openAccountMenu();
          return;
        }
        const count = this.accountResults().length;
        if (count > 0) {
          const next = (this.safeAccountActiveIndex() + 1) % count;
          this.accountActiveIndex.set(next);
          document.getElementById(this.accountOptionId(next))?.scrollIntoView({ block: 'nearest' });
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.accountOpen()) {
          this.accountActiveIndex.set(0);
          this.openAccountMenu();
          return;
        }
        const count = this.accountResults().length;
        if (count > 0) {
          const prev = (this.safeAccountActiveIndex() - 1 + count) % count;
          this.accountActiveIndex.set(prev);
          document.getElementById(this.accountOptionId(prev))?.scrollIntoView({ block: 'nearest' });
        }
        break;
      }
      case 'Enter': {
        if (!this.accountOpen()) return;
        event.preventDefault();
        event.stopPropagation();
        if (this.accountLoadError()) {
          this.retryAccounts();
          return;
        }
        const list = this.accountResults();
        const idx = this.safeAccountActiveIndex();
        if (idx >= 0 && idx < list.length) {
          this.chooseAccount(list[idx]);
        }
        break;
      }
      case 'Escape': {
        if (!this.accountOpen()) return;
        event.preventDefault();
        event.stopPropagation();
        this.closeAccountMenu(true);
        break;
      }
      case 'Tab': {
        this.closeAccountMenu(true);
        break;
      }
    }
  }

  protected chooseAccount(acc: CommercialAccountSummary): void {
    this.pickedAccount.set(acc);
    this.partyId.set(acc.partyId);
    this.closeAccountMenu(true);
    this.accountInput()?.nativeElement.focus();
  }

  protected clearAccount(event: Event): void {
    event.stopPropagation();
    this.clearAccountDebounce();
    this.pickedAccount.set(null);
    this.partyId.set(null);
    this.accountEditing.set(false);
    this.accountQuery.set('');
    this.accountDebouncedQuery.set('');
    const input = this.accountInput()?.nativeElement;
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  protected retryAccounts(): void {
    this.accountRetryTick.update((n) => n + 1);
  }

  protected closeAccountIfOutside(event: Event): void {
    if (!this.accountOpen()) return;
    const box = this.accountBox()?.nativeElement;
    const list = this.accountListRef()?.nativeElement;
    const target = event.target as Node | null;
    if (target && (box?.contains(target) || list?.contains(target))) return;
    this.closeAccountMenu(true);
  }

  protected closeAccountMenu(restore: boolean): void {
    this.clearAccountDebounce();
    this.accountListSeq++;
    this.accountOpen.set(false);
    this.accountPlaced.set(false);
    if (restore) {
      this.accountEditing.set(false);
      this.accountQuery.set('');
      this.accountDebouncedQuery.set('');
      const input = this.accountInput()?.nativeElement;
      if (input) {
        input.value = this.selectedAccountLabel();
      }
    }
  }

  protected save(): void {
    this.submitted.set(true);
    if (
      this.codeError() ||
      this.nameError() ||
      this.valueError() ||
      this.priorityError() ||
      this.minQtyError() ||
      this.maxQtyError()
    ) {
      return;
    }

    const existing = this.editingId()
      ? this.existingPromotions().find((p) => p.id === this.editingId())
      : undefined;
    // promotionSelector() stores only the keys that were sent.
    const scope = {
      itemId: this.itemId(),
      uomId: this.uomId(),
      branchId: this.branchId(),
      channelId: this.channelId(),
      partyId: this.partyId(),
    };
    const selectorKeys = Object.fromEntries(Object.entries(scope).filter(([, value]) => !!value)) as
      Partial<Record<keyof typeof scope, string>>;
    // Unsaved rows get placeholder version fields; only the PromotionChangeDto fields are sent.
    const rule: PromotionRule = {
      version: 1,
      promotionDefinitionId: '',
      versionNumber: 1,
      status: 'DRAFT',
      itemCode: null,
      uomCode: null,
      effectiveFrom: '',
      effectiveTo: null,
      contentHash: '',
      ...existing,
      id: this.editingId() ?? `temp-promo-${++PromotionModal.tempSeq}`,
      code: this.code().trim(),
      name: this.name().trim(),
      selector: {
        ...selectorKeys,
        minimumQuantity: this.minQty().trim() || '0',
        maximumQuantity: this.maxQty().trim() || null,
      },
      benefit: {
        type: this.benefitType(),
        value: this.benefitValue().trim(),
      },
      priority: Number(this.priorityText().trim()),
      stackGroup: this.stackGroup().trim() || 'DEFAULT',
      exclusive: this.exclusive(),
    };

    this.closeAccountMenu(true);
    this.allowClose = true;
    this.modal().close();
    this.saved.emit(rule);
  }

  protected async requestClose(): Promise<void> {
    if (!(await this.confirmLeave())) return;
    this.closeAccountMenu(true);
    this.allowClose = true;
    this.modal().close();
    this.closed.emit();
  }

  protected onModalClosed(): void {
    this.closeAccountMenu(true);
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
    this.closed.emit();
  }

  private async confirmModalClose(): Promise<void> {
    if (await this.confirmLeave()) {
      this.allowClose = true;
      this.modal().close();
      this.closed.emit();
    }
  }

  private async confirmLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    if (this.confirmingLeave) return false;
    this.confirmingLeave = true;
    try {
      return await this.discardDialog().open();
    } finally {
      this.confirmingLeave = false;
    }
  }

  private showErrorFor(field: string): boolean {
    return this.submitted() || this.touched().has(field);
  }

  private resetInternalState(): void {
    this.submitted.set(false);
    this.touched.set(new Set());
    this.allowClose = false;
    this.closeAccountMenu(true);
  }

  private snapshot(): string {
    return JSON.stringify({
      code: this.code(),
      name: this.name(),
      benefitType: this.benefitType(),
      benefitValue: this.benefitValue(),
      priorityText: this.priorityText(),
      stackGroup: this.stackGroup(),
      exclusive: this.exclusive(),
      itemId: this.itemId(),
      uomId: this.uomId(),
      branchId: this.branchId(),
      channelId: this.channelId(),
      partyId: this.partyId(),
      minQty: this.minQty(),
      maxQty: this.maxQty(),
    });
  }

  private openAccountMenu(): void {
    if (this.accountOpen()) return;
    this.accountPlaced.set(false);
    this.accountPlace.set(this.initialAccountPlace());
    this.accountOpen.set(true);
    this.scheduleAccountPlace();
  }

  private async loadAccounts(
    ctx: TradeContext,
    role: CommercialAccountRole,
    search: string,
  ): Promise<void> {
    const seq = ++this.accountFetchSeq;
    this.accountLoading.set(true);
    this.accountLoadError.set(false);
    try {
      const list = await searchCommercialAccounts(ctx, {
        role,
        search: search.trim() || undefined,
      });
      if (seq !== this.accountFetchSeq) return;
      this.accountResults.set(list);
      this.accountActiveIndex.set(0);
    } catch {
      if (seq !== this.accountFetchSeq) return;
      this.accountResults.set([]);
      this.accountLoadError.set(true);
    } finally {
      if (seq === this.accountFetchSeq) {
        this.accountLoading.set(false);
      }
    }
  }

  private clearAccountDebounce(): void {
    if (this.accountDebounceTimer !== null) {
      clearTimeout(this.accountDebounceTimer);
      this.accountDebounceTimer = null;
    }
  }

  private scheduleAccountPlace(): void {
    const seq = ++this.accountListSeq;
    queueMicrotask(() => this.placeAccountList(seq));
    afterNextRender(() => this.placeAccountList(seq), { injector: this.injector });
  }

  private initialAccountPlace(): ListPlace {
    const box = this.accountBox()?.nativeElement;
    if (!box) return { top: 0, start: 0, width: 200, maxHeight: null };
    const rect = rectInPage(box);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeAccountList(seq: number): void {
    if (seq !== this.accountListSeq || !this.accountOpen()) return;
    const box = this.accountBox()?.nativeElement;
    const listEl = this.accountListRef()?.nativeElement;
    if (!box || !listEl) return;

    listEl.style.maxHeight = '';
    const rect = rectInPage(box);
    const listRect = rectInPage(listEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = listRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? listRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + listRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - listRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listRect.width));

    this.accountPlace.set({ top, start, width: rect.width, maxHeight });
    this.accountPlaced.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${rect.width}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');
  }
}
