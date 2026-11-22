import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowLeft,
  tablerCheck,
  tablerCircleCheck,
  tablerLoader2,
  tablerPlus,
  tablerRefresh,
  tablerTrendingUp,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { errorCodeOf } from '../../../../../core/api/api-errors';
import {
  ApiError,
  AppliedReceipt,
  CommercialChange,
  CommercialOperation,
  CommercialPreview,
  PrepareBody,
  SubscriptionOffer,
  SubscriptionView,
  applyChange,
  billingErrorMessage,
  seatDowngradeDetails,
  seatDowngradeMessage,
  correlationIdOf,
  getOperation,
  getReceipt,
  getSubscription,
  listCatalogue,
  newIdempotencyKey,
  prepareChange,
  quoteChange,
  recoverOperation,
} from '../../billing.api';
import { BillingFailed } from '../../shared/billing-failed/billing-failed';
import { BillingForbidden } from '../../shared/billing-forbidden/billing-forbidden';
import { BillingSession } from '../../shared/billing-session';
import { catalogueNames, localizeOffers, localizeSubscription } from '../../shared/catalogue-names';
import { ChangePrefill, parseChangePrefill } from '../../shared/change-link';
import { formatUsd } from '../../shared/money';
import {
  ChangeJournalEntry,
  clearChangeJournal,
  readChangeJournal,
  writeChangeJournal,
} from '../change-journal';
import {
  AppCatalogGroup,
  CartRow,
  ChangeRow,
  buildAppCatalogGroups,
  isAppTierAvailable,
  parseSeatInt,
  toCommercialChange,
  validateCartRow,
} from '../change-row/change-row';
import { OperationPoller } from '../operation-poller';
import { QuoteView } from '../quote-view/quote-view';

const STEPPER_STEPS = [
  { num: 1 as const, key: 'changes' },
  { num: 2 as const, key: 'review' },
  { num: 3 as const, key: 'done' },
] as const;

const SKELETON_ROWS = [1, 2] as const;
const MAX_REASON_LEN = 256;

type StepNum = 1 | 2 | 3;
type ReviewPhase = 'preparing' | 'quoting' | 'quoted';

@Component({
  selector: 'app-billing-change-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    Button,
    Field,
    Modal,
    UnsavedDialog,
    BillingForbidden,
    BillingFailed,
    ChangeRow,
    QuoteView,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-billing', alias: 'bill' }, { scope: 'ws-billing-subscription', alias: 'bsub' }),
    OperationPoller,
    provideIcons({
      tablerAlertTriangle,
      tablerArrowLeft,
      tablerCheck,
      tablerCircleCheck,
      tablerLoader2,
      tablerPlus,
      tablerRefresh,
      tablerTrendingUp,
      tablerUsers,
    }),
  ],
  templateUrl: './change-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col gap-12 overflow-y-auto p-12',
    '(document:click)': 'closeAddMenuIfOutside($event)',
    '(keydown.escape)': 'closeAddMenu()',
  },
})
export class ChangePage {
  private static nextId = 0;
  protected readonly uid = `billing-change-${++ChangePage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(BillingSession);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly bsubReady = toSignal(this.transloco.selectTranslation('ws-billing-subscription'));
  private readonly poller = inject(OperationPoller);
  private readonly destroyRef = inject(DestroyRef);

  private readonly addMenuHost = viewChild<ElementRef<HTMLElement>>('addMenuHost');
  private readonly pageHeading = viewChild<ElementRef<HTMLElement>>('pageHeading');
  private readonly doneHeading = viewChild<ElementRef<HTMLElement>>('doneHeading');
  private readonly injector = inject(Injector);
  private readonly unsavedDialog = viewChild(UnsavedDialog);
  private readonly journalModal = viewChild<Modal>('journalModal');
  private readonly conflictModal = viewChild<Modal>('conflictModal');

  protected readonly steps = STEPPER_STEPS;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly maxReasonLen = MAX_REASON_LEN;
  protected readonly formatUsd = formatUsd;

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly correlationId = signal<string | null>(null);
  private readonly rawSubscription = signal<SubscriptionView | null>(null);
  private readonly rawOffers = signal<SubscriptionOffer[]>([]);
  private readonly names = computed(() => {
    this.i18n();
    return catalogueNames(this.transloco);
  });
  /** Display copies with localized application, plan and add-on names. */
  protected readonly subscription = computed(() => {
    const sub = this.rawSubscription();
    return sub ? localizeSubscription(sub, this.names()) : null;
  });
  protected readonly catalogueOffers = computed(() => localizeOffers(this.rawOffers(), this.names()));

  protected readonly step = signal<StepNum>(1);
  protected readonly cart = signal<CartRow[]>([]);
  protected readonly reason = signal('');
  protected readonly reasonTouched = signal(false);
  protected readonly step1Submitted = signal(false);
  protected readonly addMenuOpen = signal(false);

  protected readonly reviewPhase = signal<ReviewPhase>('preparing');
  protected readonly preview = signal<CommercialPreview | null>(null);
  protected readonly refreshingQuote = signal(false);
  protected readonly applying = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly receipt = signal<AppliedReceipt | null>(null);

  protected readonly journalBusy = signal(false);
  protected readonly reloadingConflict = signal(false);
  protected readonly remainingSeconds = signal(0);

  private activeOperation: CommercialOperation | null = null;
  private preparedBody: PrepareBody | null = null;
  private pendingJournalEntry: ChangeJournalEntry | null = null;
  private applyKeyByPreviewId = new Map<string, string>();
  private destroyed = false;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private loadSeq = 0;

  protected readonly forbidden = signal(false);

  protected get isOwner(): boolean {
    return !this.forbidden() && this.session.isOwner();
  }

  protected readonly catalogueGroups = computed<AppCatalogGroup[]>(() =>
    buildAppCatalogGroups(this.catalogueOffers()),
  );

  protected readonly addAppAvailable = computed(() => {
    const sub = this.subscription();
    if (!sub) return false;
    const subAppIds = new Set(sub.baseItems.map((b) => b.applicationId));
    const cartAppIds = new Set(
      this.cart()
        .filter((r): r is Extract<CartRow, { kind: 'add-app' }> => r.kind === 'add-app')
        .map((r) => r.applicationId),
    );
    return this.catalogueGroups().some((g) => !subAppIds.has(g.applicationId) && !cartAppIds.has(g.applicationId));
  });

  protected readonly changeSeatsAvailable = computed(() => {
    const sub = this.subscription();
    if (!sub) return false;
    const usedTokens = new Set(
      this.cart()
        .filter((r): r is Extract<CartRow, { kind: 'change-seats' }> => r.kind === 'change-seats')
        .map((r) => `${r.targetKind}:${r.targetId}`),
    );
    const hasBase = sub.baseItems.some((b) => !usedTokens.has(`APPLICATION:${b.id}`));
    const hasAddon = sub.addonSelections.some((a) => !usedTokens.has(`ADDON:${a.id}`));
    return hasBase || hasAddon;
  });

  protected readonly upgradeTierAvailable = computed(() => {
    const sub = this.subscription();
    if (!sub) return false;
    const usedItemIds = new Set(
      this.cart()
        .filter((r): r is Extract<CartRow, { kind: 'upgrade-tier' }> => r.kind === 'upgrade-tier')
        .map((r) => r.itemId),
    );
    const groups = this.catalogueGroups();
    return sub.baseItems.some((item) => {
      if (usedItemIds.has(item.id)) return false;
      const group = groups.find((g) => g.applicationId === item.applicationId);
      return (group?.tiers ?? []).some((t) => t.tier.rank > item.tierRank);
    });
  });

  protected readonly reasonError = computed<string | null>(() => {
    this.i18n();
    this.bsubReady();
    if (this.reason().trim().length > MAX_REASON_LEN) {
      return this.transloco.translate('bsub.change.row.errors.reasonTooLong');
    }
    return null;
  });

  protected readonly canReview = computed(() => {
    this.i18n();
    this.bsubReady();
    const sub = this.subscription();
    const rows = this.cart();
    if (!sub || rows.length === 0) return false;
    if (this.reasonError() !== null) return false;
    const groups = this.catalogueGroups();
    return rows.every((row) => validateCartRow(row, sub, groups, rows, this.transloco) === null);
  });

  protected readonly quoteExpired = computed(() => {
    if (this.reviewPhase() !== 'quoted' || !this.preview()) return false;
    return this.remainingSeconds() <= 0;
  });

  protected readonly remainingText = computed(() => {
    const total = Math.max(0, this.remainingSeconds());
    const mins = Math.floor(total / 60);
    const secs = String(total % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  });

  protected readonly canConfirmApply = computed(() => {
    const p = this.preview();
    return (
      this.reviewPhase() === 'quoted' &&
      Boolean(p) &&
      !this.quoteExpired() &&
      Boolean(p?.financial.canApply)
    );
  });

  protected readonly stepCounterParams = computed(() => ({
    current: this.step(),
    total: 3,
  }));

  protected readonly receiptCycleUnitKey = computed(() =>
    this.subscription()?.subscription.billingCycle === 'ANNUAL'
      ? 'bill.common.perYear'
      : 'bill.common.perMonth',
  );

  protected readonly quoteItemLabels = computed<ReadonlyMap<string, string>>(() => {
    const map = new Map<string, string>();
    const sub = this.subscription();
    const groups = this.catalogueGroups();
    const offers = this.catalogueOffers();
    for (const row of this.cart()) {
      switch (row.kind) {
        case 'add-app': {
          const group = groups.find((g) => g.applicationId === row.applicationId);
          if (group) map.set(row.selectionKey, group.applicationName);
          break;
        }
        case 'change-seats': {
          if (row.targetKind === 'APPLICATION') {
            const base = sub?.baseItems.find((b) => b.id === row.targetId);
            if (base) map.set(row.selectionKey, base.applicationName ?? base.applicationKey);
          } else {
            const addon = sub?.addonSelections.find((a) => a.id === row.targetId);
            if (addon) {
              const offer = offers.find((o) => o.sourceKind === 'ADDON' && o.addon.id === addon.addonId);
              map.set(row.selectionKey, offer?.sourceKind === 'ADDON' ? offer.addon.name : addon.addonKey);
            }
          }
          break;
        }
        case 'upgrade-tier': {
          const base = sub?.baseItems.find((b) => b.id === row.itemId);
          if (base) map.set(row.selectionKey, base.applicationName ?? base.applicationKey);
          break;
        }
        case 'add-addon': {
          const offer = offers.find((o) => o.sourceKind === 'ADDON' && o.addon.id === row.addonId);
          map.set(row.selectionKey, offer?.sourceKind === 'ADDON' ? offer.addon.name : row.addonId);
          break;
        }
      }
    }
    return map;
  });

  protected readonly tierNames = computed<ReadonlyMap<string, string>>(() => {
    const map = new Map<string, string>();
    for (const offer of this.catalogueOffers()) {
      if (offer.sourceKind === 'APPLICATION') {
        map.set(offer.tier.id, offer.tier.name);
      }
    }
    for (const item of this.subscription()?.baseItems ?? []) {
      if (!map.has(item.tierId)) {
        map.set(item.tierId, item.tierName ?? item.tierKey);
      }
    }
    return map;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.stopCountdown();
    });
    if (this.isOwner) {
      void this.loadInitial();
    }
  }

  async canDeactivate(): Promise<boolean> {
    if (!this.isOwner || this.step() === 3 || this.cart().length === 0) {
      return true;
    }
    const dialog = this.unsavedDialog();
    if (!dialog) return true;
    const choice = await dialog.open();
    return choice === 'discard';
  }

  protected reload(): void {
    if (!this.isOwner) return;
    void this.loadInitial();
  }

  protected toggleAddMenu(): void {
    this.addMenuOpen.update((open) => !open);
  }

  protected closeAddMenu(): void {
    this.addMenuOpen.set(false);
  }

  protected closeAddMenuIfOutside(event: Event): void {
    if (!this.addMenuOpen()) return;
    const hostEl = this.addMenuHost()?.nativeElement;
    if (hostEl && !hostEl.contains(event.target as Node)) {
      this.addMenuOpen.set(false);
    }
  }

  protected addRow(kind: 'add-app' | 'change-seats' | 'upgrade-tier'): void {
    this.addMenuOpen.set(false);
    const key = newIdempotencyKey();
    if (kind === 'add-app') {
      if (!this.addAppAvailable()) return;
      this.cart.update((rows) => [
        ...rows,
        { kind: 'add-app', selectionKey: key, applicationId: '', tierId: '', seats: '1' },
      ]);
      return;
    }
    if (kind === 'change-seats') {
      if (!this.changeSeatsAvailable()) return;
      this.cart.update((rows) => [
        ...rows,
        {
          kind: 'change-seats',
          selectionKey: key,
          targetKind: 'APPLICATION',
          targetId: '',
          newSeats: '',
          locked: false,
        },
      ]);
      return;
    }
    if (!this.upgradeTierAvailable()) return;
    this.cart.update((rows) => [
      ...rows,
      { kind: 'upgrade-tier', selectionKey: key, itemId: '', tierId: '', locked: false },
    ]);
  }

  protected updateRow(index: number, next: CartRow): void {
    this.cart.update((rows) => rows.map((row, idx) => (idx === index ? next : row)));
  }

  protected removeRow(index: number): void {
    this.cart.update((rows) => rows.filter((_, idx) => idx !== index));
  }

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
    this.reasonTouched.set(true);
  }

  protected async startReview(): Promise<void> {
    this.step1Submitted.set(true);
    const sub = this.subscription();
    if (!sub || !this.canReview()) return;

    const changes: CommercialChange[] = [];
    for (const row of this.cart()) {
      const converted = toCommercialChange(row);
      if (!converted) return;
      changes.push(converted);
    }

    const trimmedReason = this.reason().trim();
    const body: PrepareBody = {
      expectedSubscriptionRevision: sub.subscriptionRevision,
      changes,
      ...(trimmedReason ? { reason: trimmedReason } : {}),
    };

    this.clearRowErrors();
    this.stopCountdown();
    this.poller.stop();
    this.activeOperation = null;
    this.step.set(2);
    this.reviewPhase.set('preparing');
    this.preview.set(null);
    this.preparedBody = body;

    // Retrying the same body reuses its key, so the server returns the same operation instead of a new one.
    const bodySignature = JSON.stringify(body);
    if (this.prepareKeyCache?.signature !== bodySignature) {
      this.prepareKeyCache = { signature: bodySignature, key: newIdempotencyKey() };
    }
    const prepareKey = this.prepareKeyCache.key;
    let op: CommercialOperation;
    try {
      op = await this.withSingleNetworkRetry(() => prepareChange(body, prepareKey));
    } catch (error) {
      if (this.destroyed) return;
      this.handlePrepareOrQuoteFailure(error, body);
      return;
    }

    if (this.destroyed) return;
    this.activeOperation = op;
    writeChangeJournal({
      operationId: op.operationId,
      operationRevision: op.operationRevision,
      body,
    });

    await this.pollAndQuote(op, body, op.retryAfterSeconds ? op.retryAfterSeconds * 1000 : 2000);
  }

  private prepareKeyCache: { signature: string; key: string } | null = null;

  protected async refreshQuote(): Promise<void> {
    if (!this.activeOperation || !this.preparedBody || this.refreshingQuote() || this.applying()) {
      return;
    }
    this.refreshingQuote.set(true);
    try {
      await this.executeQuote(this.preparedBody, this.activeOperation.operationId, true);
    } finally {
      this.refreshingQuote.set(false);
    }
  }

  protected async confirmApply(): Promise<void> {
    const currentPreview = this.preview();
    if (!currentPreview || !this.canConfirmApply() || this.applying() || this.cancelling()) return;

    this.applying.set(true);
    const previewId = currentPreview.previewId;
    const applyKey = this.applyKeyByPreviewId.get(previewId) ?? newIdempotencyKey();
    this.applyKeyByPreviewId.set(previewId, applyKey);

    try {
      const res = await this.withSingleNetworkRetry(() => applyChange(previewId, applyKey));
      this.finishWithReceipt(res);
    } catch (error) {
      if (this.destroyed) return;
      const code = errorCodeOf(error);
      if (code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED') {
        this.notify.warning(billingErrorMessage(error, this.transloco));
        this.applying.set(false);
        await this.refreshQuote();
        return;
      }
      if (
        code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_STALE' ||
        code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_NOT_FOUND'
      ) {
        this.conflictModal()?.open();
        return;
      }
      if (code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_ALREADY_APPLIED') {
        try {
          const existingReceipt = await getReceipt(previewId);
          this.finishWithReceipt(existingReceipt);
          return;
        } catch (receiptError) {
          this.notify.error(billingErrorMessage(receiptError, this.transloco));
          return;
        }
      }
      this.notify.error(billingErrorMessage(error, this.transloco));
    } finally {
      this.applying.set(false);
    }
  }

  protected async goBackToStep1(): Promise<void> {
    if (this.cancelling() || this.applying()) return;
    this.stopCountdown();
    this.poller.stop();

    const op = this.activeOperation;
    if (!op) {
      clearChangeJournal();
      this.preview.set(null);
      this.preparedBody = null;
      this.step.set(1);
      return;
    }

    this.cancelling.set(true);
    try {
      const ok = await this.cancelPreparationWithRecovery(op, 'Edited before confirming');
      if (this.destroyed) return;
      if (!ok) {
        // Recovery failed: the operation is still open, so bring the review step back to a working state.
        const current = this.preview();
        const body = this.preparedBody;
        if (current) {
          this.startCountdown(current.expiresAt);
        } else if (body) {
          this.cancelling.set(false);
          await this.pollAndQuote(op, body, 2000);
        }
        return;
      }
      clearChangeJournal();
      this.activeOperation = null;
      this.preview.set(null);
      this.preparedBody = null;
      this.step.set(1);
    } finally {
      this.cancelling.set(false);
    }
  }

  protected async continueJournal(): Promise<void> {
    const entry = this.pendingJournalEntry;
    const sub = this.subscription();
    if (!entry || !sub || this.journalBusy()) return;

    this.journalBusy.set(true);
    this.pendingJournalEntry = null;
    this.journalModal()?.close();

    this.restoreCartFromJournal(entry, sub);
    this.preparedBody = entry.body;
    this.activeOperation = {
      operationId: entry.operationId,
      operationRevision: entry.operationRevision,
      intentKind: 'COMMERCIAL_CHANGE',
      state: 'PREPARING',
      phase: 'PREPARING',
      createdAt: '',
      updatedAt: '',
      terminalAt: null,
      safeReasonCode: null,
      retryAfterSeconds: 2,
      relatedPreviewId: entry.previewId ?? null,
      committedReceiptRef: null,
      projectionState: 'NOT_REQUIRED',
    };

    this.step.set(2);
    this.reviewPhase.set('preparing');
    this.preview.set(null);

    try {
      await this.pollAndQuote(this.activeOperation, entry.body, 0);
    } finally {
      this.journalBusy.set(false);
    }
  }

  protected async discardJournal(): Promise<void> {
    const entry = this.pendingJournalEntry;
    if (!entry || this.journalBusy()) return;

    this.journalBusy.set(true);
    try {
      const ok = await this.cancelPreparationByIds(
        entry.operationId,
        entry.operationRevision,
        'Discarded unfinished change',
      );
      if (!ok) return;
      clearChangeJournal();
      this.pendingJournalEntry = null;
      this.journalModal()?.close();
      this.applyUrlPrefill();
    } finally {
      this.journalBusy.set(false);
    }
  }

  protected onJournalModalClosed(): void {
    if (this.pendingJournalEntry === null) return;
    this.pendingJournalEntry = null;
    this.applyUrlPrefill();
  }

  protected async reloadAfterConflict(): Promise<void> {
    if (this.reloadingConflict()) return;
    this.reloadingConflict.set(true);
    try {
      const [sub, offers] = await Promise.all([getSubscription(), this.loadAllCatalogue()]);
      this.rawSubscription.set(sub);
      this.rawOffers.set(offers);
      this.cart.update((rows) => this.filterApplicableRows(rows, sub, offers));
      clearChangeJournal();
      this.activeOperation = null;
      this.preview.set(null);
      this.preparedBody = null;
      this.stopCountdown();
      this.poller.stop();
      this.step.set(1);
      this.conflictModal()?.close();
    } catch (error) {
      this.notify.error(billingErrorMessage(error, this.transloco));
    } finally {
      this.reloadingConflict.set(false);
    }
  }

  protected keepChangesOnConflict(): void {
    if (this.reloadingConflict()) return;
    clearChangeJournal();
    this.activeOperation = null;
    this.preview.set(null);
    this.preparedBody = null;
    this.stopCountdown();
    this.poller.stop();
    this.step.set(1);
    this.conflictModal()?.close();
  }

  protected onConflictModalClosed(): void {
    if (this.step() === 2 && !this.reloadingConflict()) {
      this.keepChangesOnConflict();
    }
  }

  private async loadInitial(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.correlationId.set(null);

    try {
      const [sub, offers] = await Promise.all([getSubscription(), this.loadAllCatalogue()]);
      if (seq !== this.loadSeq) return;
      this.rawSubscription.set(sub);
      this.rawOffers.set(offers);

      const journal = readChangeJournal();
      if (journal) {
        this.pendingJournalEntry = journal;
        queueMicrotask(() => this.journalModal()?.open());
      } else {
        this.applyUrlPrefill();
        this.focusAfterRender(() => this.pageHeading());
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.code === 'TENANT_OWNER_REQUIRED') {
        this.forbidden.set(true);
        return;
      }
      this.loadFailed.set(true);
      this.correlationId.set(correlationIdOf(error));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadAllCatalogue(): Promise<SubscriptionOffer[]> {
    const all: SubscriptionOffer[] = [];
    let page = 1;
    while (true) {
      const res = await listCatalogue({ page, limit: 100 });
      all.push(...res.items);
      if (!res.meta.hasNext) break;
      page += 1;
    }
    return all;
  }

  private applyUrlPrefill(): void {
    const raw = this.route.snapshot.queryParamMap.get('add');
    const prefill = parseChangePrefill(raw);
    if (!prefill) return;

    const sub = this.subscription();
    if (!sub) return;
    const row = this.buildRowFromPrefill(prefill, sub, this.catalogueOffers());
    if (!row) {
      this.notify.warning(this.transloco.translate('bsub.change.toasts.prefillSkipped'));
      return;
    }
    this.cart.set([row]);
  }

  private buildRowFromPrefill(
    prefill: ChangePrefill,
    sub: SubscriptionView,
    offers: readonly SubscriptionOffer[],
  ): CartRow | null {
    const key = newIdempotencyKey();
    const cycle = sub.subscription.billingCycle;
    const groups = buildAppCatalogGroups(offers);

    switch (prefill.kind) {
      case 'app': {
        if (sub.baseItems.some((b) => b.applicationId === prefill.applicationId)) {
          return null;
        }
        const group = groups.find((g) => g.applicationId === prefill.applicationId);
        if (!group) return null;
        const requested = group.tiers.find((t) => t.tier.id === prefill.tierId);
        const tierId =
          requested && isAppTierAvailable(requested, cycle)
            ? requested.tier.id
            : group.tiers.find((t) => isAppTierAvailable(t, cycle))?.tier.id ?? '';
        return {
          kind: 'add-app',
          selectionKey: key,
          applicationId: group.applicationId,
          tierId,
          seats: '1',
        };
      }

      case 'seats': {
        const base = sub.baseItems.find((b) => b.id === prefill.itemId);
        if (base) {
          return {
            kind: 'change-seats',
            selectionKey: key,
            targetKind: 'APPLICATION',
            targetId: base.id,
            newSeats: '',
            locked: true,
          };
        }
        const addon = sub.addonSelections.find((a) => a.id === prefill.itemId);
        if (addon) {
          return {
            kind: 'change-seats',
            selectionKey: key,
            targetKind: 'ADDON',
            targetId: addon.id,
            newSeats: '',
            locked: true,
          };
        }
        return null;
      }

      case 'tier': {
        const base = sub.baseItems.find((b) => b.id === prefill.itemId);
        if (!base) return null;
        const group = groups.find((g) => g.applicationId === base.applicationId);
        const higherTiers = (group?.tiers ?? []).filter((t) => t.tier.rank > base.tierRank);
        if (!higherTiers.length) return null;
        const requested = prefill.tierId
          ? higherTiers.find((t) => t.tier.id === prefill.tierId && isAppTierAvailable(t, cycle))
          : undefined;
        return {
          kind: 'upgrade-tier',
          selectionKey: key,
          itemId: base.id,
          tierId: requested?.tier.id ?? '',
          locked: true,
        };
      }

      case 'addon': {
        const parent = sub.baseItems.find((b) => b.id === prefill.parentItemId);
        const offer = offers.find(
          (o): o is Extract<SubscriptionOffer, { sourceKind: 'ADDON' }> =>
            o.sourceKind === 'ADDON' && o.addon.id === prefill.addonId,
        );
        if (!parent || !offer) return null;
        const alreadySubscribed = sub.addonSelections.some(
          (a) => a.addonId === prefill.addonId && a.parentItemId === prefill.parentItemId,
        );
        if (alreadySubscribed) return null;
        return {
          kind: 'add-addon',
          selectionKey: key,
          addonId: prefill.addonId,
          targetDefinitionVersionId: prefill.definitionVersionId || offer.addon.definitionVersionId,
          parentItemId: parent.id,
          seats: '1',
        };
      }
    }
  }

  private restoreCartFromJournal(entry: ChangeJournalEntry, sub: SubscriptionView): void {
    const rows: CartRow[] = [];
    for (const ch of entry.body.changes) {
      if (ch.sourceKind === 'APPLICATION' && ch.operation === 'ADD') {
        rows.push({
          kind: 'add-app',
          selectionKey: ch.selectionKey,
          applicationId: ch.applicationId,
          tierId: ch.tierId,
          seats: String(ch.seats),
        });
      } else if (ch.sourceKind === 'APPLICATION' && ch.operation === 'CHANGE') {
        if (ch.tierId !== undefined) {
          rows.push({
            kind: 'upgrade-tier',
            selectionKey: ch.selectionKey,
            itemId: ch.itemId,
            tierId: ch.tierId,
            locked: sub.baseItems.some((b) => b.id === ch.itemId),
          });
        } else if (ch.seats !== undefined) {
          rows.push({
            kind: 'change-seats',
            selectionKey: ch.selectionKey,
            targetKind: 'APPLICATION',
            targetId: ch.itemId,
            newSeats: String(ch.seats),
            locked: sub.baseItems.some((b) => b.id === ch.itemId),
          });
        }
      } else if (ch.sourceKind === 'ADDON' && ch.operation === 'ADD') {
        rows.push({
          kind: 'add-addon',
          selectionKey: ch.selectionKey,
          addonId: ch.addonId,
          targetDefinitionVersionId: ch.targetDefinitionVersionId,
          parentItemId: ch.parentItemId ?? '',
          seats: String(ch.seats),
        });
      } else if (ch.sourceKind === 'ADDON' && ch.operation === 'CHANGE') {
        rows.push({
          kind: 'change-seats',
          selectionKey: ch.selectionKey,
          targetKind: 'ADDON',
          targetId: ch.addonSelectionId,
          newSeats: String(ch.seats),
          locked: sub.addonSelections.some((a) => a.id === ch.addonSelectionId),
        });
      }
    }
    this.cart.set(rows);
    this.reason.set(entry.body.reason ?? '');
  }

  private async pollAndQuote(
    op: CommercialOperation,
    body: PrepareBody,
    initialDelayMs: number,
  ): Promise<void> {
    let readyOp = op;
    if (op.state !== 'READY') {
      const result = await this.poller.poll(op.operationId, {
        initialDelayMs,
        maxAttempts: 60,
        onTick: (updated) => {
          this.activeOperation = updated;
          writeChangeJournal({
            operationId: updated.operationId,
            operationRevision: updated.operationRevision,
            body,
          });
        },
      });

      if (result.kind === 'cancelled') return;

      if (result.kind === 'error') {
        if (errorCodeOf(result.error) === 'TENANT_OPERATION_NOT_FOUND') {
          clearChangeJournal();
          this.activeOperation = null;
        }
        this.notify.error(billingErrorMessage(result.error, this.transloco));
        this.step.set(1);
        return;
      }

      if (result.kind === 'timeout') {
        this.notify.warning(this.transloco.translate('bsub.change.toasts.pollTimeout'));
        this.step.set(1);
        return;
      }

      if (result.kind === 'terminal') {
        this.notify.error(billingErrorMessage(result.operation.safeReasonCode ?? '', this.transloco));
        clearChangeJournal();
        this.activeOperation = null;
        this.step.set(1);
        return;
      }

      if (result.kind === 'committed') {
        if (result.operation.relatedPreviewId) {
          try {
            const committedReceipt = await getReceipt(result.operation.relatedPreviewId);
            this.finishWithReceipt(committedReceipt);
            return;
          } catch {
            // Fall through to cleanup.
          }
        }
        clearChangeJournal();
        this.activeOperation = null;
        this.step.set(1);
        return;
      }

      readyOp = result.operation;
    }

    this.activeOperation = readyOp;
    await this.executeQuote(body, readyOp.operationId, false);
  }

  private async executeQuote(
    body: PrepareBody,
    operationId: string,
    isRefresh: boolean,
  ): Promise<void> {
    if (!isRefresh) {
      this.reviewPhase.set('quoting');
    }
    const quoteKey = newIdempotencyKey();

    try {
      const quoted = await this.withSingleNetworkRetry(() =>
        quoteChange({ ...body, preparationId: operationId }, quoteKey),
      );
      this.applyQuotedPreview(quoted, body);
    } catch (error) {
      if (errorCodeOf(error) === 'ADDON_PREPARATION_REQUIRED') {
        const pollOnce = await this.poller.poll(operationId, {
          initialDelayMs: 2000,
          maxAttempts: 1,
        });
        if (pollOnce.kind === 'cancelled') return;
        if (pollOnce.kind === 'terminal') {
          this.notify.error(billingErrorMessage(pollOnce.operation.safeReasonCode ?? '', this.transloco));
          clearChangeJournal();
          this.activeOperation = null;
          this.step.set(1);
          return;
        }
        if (pollOnce.kind === 'ready') {
          this.activeOperation = pollOnce.operation;
          const retryQuoteKey = newIdempotencyKey();
          try {
            const retryQuoted = await this.withSingleNetworkRetry(() =>
              quoteChange({ ...body, preparationId: operationId }, retryQuoteKey),
            );
            this.applyQuotedPreview(retryQuoted, body);
            return;
          } catch (retryError) {
            this.handlePrepareOrQuoteFailure(retryError, body);
            return;
          }
        }
      }
      this.handlePrepareOrQuoteFailure(error, body);
    }
  }

  private applyQuotedPreview(quoted: CommercialPreview, body: PrepareBody): void {
    if (this.destroyed) return;
    this.preview.set(quoted);
    this.reviewPhase.set('quoted');
    if (this.activeOperation) {
      writeChangeJournal({
        operationId: this.activeOperation.operationId,
        operationRevision: this.activeOperation.operationRevision,
        previewId: quoted.previewId,
        body,
      });
    }
    this.startCountdown(quoted.expiresAt);
  }

  private handlePrepareOrQuoteFailure(error: unknown, body: PrepareBody): void {
    if (this.destroyed) return;
    const code = errorCodeOf(error);
    const msg = billingErrorMessage(error, this.transloco);

    if (code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_STALE') {
      this.conflictModal()?.open();
      return;
    }

    if (code === 'SEAT_DOWNGRADE_FREE_UP_REQUIRED') {
      const seatMsg = seatDowngradeMessage(error, this.transloco);
      this.notify.error(seatMsg);
      this.attachFreeSeatsRowError(seatMsg, seatDowngradeDetails(error)?.moduleKey ?? null);
      this.step.set(1);
      return;
    }

    if (code === 'DOWNGRADE_NOT_ALLOWED') {
      this.notify.error(msg);
      this.attachDowngradeRowError(msg, body);
      this.step.set(1);
      return;
    }

    this.notify.error(msg);
    this.step.set(1);
  }

  /**
   * The row is the application seat change for `details.moduleKey` when the error names it; without it, the
   * first application seat change in the cart.
   */
  private attachFreeSeatsRowError(message: string, moduleKey: string | null): void {
    const sub = this.subscription();
    const appKeyOf = (targetId: string) => sub?.baseItems.find((b) => b.id === targetId)?.applicationKey ?? null;

    this.cart.update((rows) => {
      let matchedIndex =
        moduleKey === null
          ? -1
          : rows.findIndex(
              (r) => r.kind === 'change-seats' && r.targetKind === 'APPLICATION' && appKeyOf(r.targetId) === moduleKey,
            );
      if (matchedIndex === -1) {
        matchedIndex = rows.findIndex((r) => r.kind === 'change-seats' && r.targetKind === 'APPLICATION');
      }
      if (matchedIndex === -1) {
        matchedIndex = rows.findIndex((r) => r.kind === 'change-seats');
      }
      if (matchedIndex === -1) return rows;

      return rows.map((row, idx) =>
        idx === matchedIndex && row.kind === 'change-seats'
          ? {
              ...row,
              touched: true,
              serverError: message,
              freeSeatsModuleKey: appKeyOf(row.targetId) ?? moduleKey,
            }
          : row,
      );
    });
  }

  private attachDowngradeRowError(message: string, _body: PrepareBody): void {
    const sub = this.subscription();
    const groups = this.catalogueGroups();
    this.cart.update((rows) => {
      let matchedIndex = rows.findIndex((row) => {
        if (row.kind === 'change-seats' && row.targetKind === 'ADDON') {
          const addon = sub?.addonSelections.find((a) => a.id === row.targetId);
          const parsed = parseSeatInt(row.newSeats);
          return addon !== undefined && parsed !== null && parsed < addon.seats;
        }
        if (row.kind === 'upgrade-tier') {
          const base = sub?.baseItems.find((b) => b.id === row.itemId);
          const group = base ? groups.find((g) => g.applicationId === base.applicationId) : undefined;
          const tier = group?.tiers.find((t) => t.tier.id === row.tierId);
          return base !== undefined && tier !== undefined && tier.tier.rank < base.tierRank;
        }
        return false;
      });
      if (matchedIndex === -1 && rows.length > 0) matchedIndex = 0;
      if (matchedIndex === -1) return rows;

      return rows.map((row, idx) =>
        idx === matchedIndex ? { ...row, touched: true, serverError: message } : row,
      );
    });
  }

  private clearRowErrors(): void {
    this.cart.update((rows) =>
      rows.map((row) =>
        row.kind === 'change-seats'
          ? { ...row, serverError: null, freeSeatsModuleKey: null }
          : { ...row, serverError: null },
      ),
    );
  }

  private async cancelPreparationWithRecovery(
    op: CommercialOperation,
    reasonText: string,
  ): Promise<boolean> {
    return this.cancelPreparationByIds(op.operationId, op.operationRevision, reasonText);
  }

  private async cancelPreparationByIds(
    operationId: string,
    operationRevision: string,
    reasonText: string,
  ): Promise<boolean> {
    const cancelKey = newIdempotencyKey();
    try {
      await this.withSingleNetworkRetry(() =>
        recoverOperation(
          operationId,
          {
            expectedOperationRevision: operationRevision,
            action: 'CANCEL_PREPARATION',
            reason: reasonText,
          },
          cancelKey,
        ),
      );
      return true;
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'TENANT_OPERATION_NOT_FOUND') {
        return true;
      }
      if (code === 'COMMERCIAL_RECOVERY_REVISION_STALE') {
        try {
          const latest = await getOperation(operationId);
          if (latest.state === 'ABORTED' || latest.state === 'COMMITTED') {
            return true;
          }
          const retryCancelKey = newIdempotencyKey();
          await this.withSingleNetworkRetry(() =>
            recoverOperation(
              operationId,
              {
                expectedOperationRevision: latest.operationRevision,
                action: 'CANCEL_PREPARATION',
                reason: reasonText,
              },
              retryCancelKey,
            ),
          );
          return true;
        } catch (retryError) {
          if (errorCodeOf(retryError) === 'TENANT_OPERATION_NOT_FOUND') return true;
          this.notify.error(billingErrorMessage(retryError, this.transloco));
          return false;
        }
      }
      this.notify.error(billingErrorMessage(error, this.transloco));
      return false;
    }
  }

  private finishWithReceipt(applied: AppliedReceipt): void {
    this.stopCountdown();
    this.poller.stop();
    clearChangeJournal();
    this.activeOperation = null;
    this.preparedBody = null;
    this.receipt.set(applied);
    this.step.set(3);
    this.focusAfterRender(() => this.doneHeading() ?? this.pageHeading());
  }

  /** Moves focus to a heading once the view has rendered (on open and after a successful apply). */
  private focusAfterRender(target: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus({ preventScroll: false }), {
      injector: this.injector,
    });
  }

  private filterApplicableRows(
    rows: readonly CartRow[],
    sub: SubscriptionView,
    offers: readonly SubscriptionOffer[],
  ): CartRow[] {
    const groups = buildAppCatalogGroups(offers);
    const cycle = sub.subscription.billingCycle;

    return rows
      .map((row): CartRow | null => {
        switch (row.kind) {
          case 'add-app': {
            if (sub.baseItems.some((b) => b.applicationId === row.applicationId)) return null;
            const group = groups.find((g) => g.applicationId === row.applicationId);
            if (!group) return null;
            const tierOk = group.tiers.some(
              (t) => t.tier.id === row.tierId && isAppTierAvailable(t, cycle),
            );
            return {
              ...row,
              tierId: tierOk ? row.tierId : '',
              serverError: null,
            };
          }
          case 'change-seats': {
            const exists =
              row.targetKind === 'APPLICATION'
                ? sub.baseItems.some((b) => b.id === row.targetId)
                : sub.addonSelections.some((a) => a.id === row.targetId);
            if (!exists) return null;
            return { ...row, serverError: null, freeSeatsModuleKey: null };
          }
          case 'upgrade-tier': {
            const base = sub.baseItems.find((b) => b.id === row.itemId);
            if (!base) return null;
            const group = groups.find((g) => g.applicationId === base.applicationId);
            const higher = (group?.tiers ?? []).filter((t) => t.tier.rank > base.tierRank);
            if (!higher.length) return null;
            const tierOk = higher.some(
              (t) => t.tier.id === row.tierId && isAppTierAvailable(t, cycle),
            );
            return { ...row, tierId: tierOk ? row.tierId : '', serverError: null };
          }
          case 'add-addon': {
            const parentOk = sub.baseItems.some((b) => b.id === row.parentItemId);
            const already = sub.addonSelections.some(
              (a) => a.addonId === row.addonId && a.parentItemId === row.parentItemId,
            );
            if (!parentOk || already) return null;
            return { ...row, serverError: null };
          }
        }
      })
      .filter((row): row is CartRow => row !== null);
  }

  private startCountdown(expiresAt: string): void {
    this.stopCountdown();
    const update = () => {
      const targetMs = Date.parse(expiresAt);
      const secs = Number.isNaN(targetMs) ? 0 : Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
      this.remainingSeconds.set(secs);
      if (secs <= 0) {
        this.stopCountdown();
      }
    };
    update();
    if (this.remainingSeconds() > 0) {
      this.countdownTimer = setInterval(update, 1000);
    }
  }

  private stopCountdown(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private async withSingleNetworkRetry<T>(command: () => Promise<T>): Promise<T> {
    try {
      return await command();
    } catch (error) {
      const isNetwork = (error instanceof ApiError && error.status === 0) || error instanceof TypeError;
      if (!isNetwork) {
        throw error;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      return command();
    }
  }
}
