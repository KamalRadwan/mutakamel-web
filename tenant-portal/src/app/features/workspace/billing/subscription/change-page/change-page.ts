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
  BillingApi,
  BillingSummary,
  QuoteBody,
  RecoveryBody,
  AppliedReceipt,
  CommercialChange,
  CommercialOperation,
  CommercialPreview,
  PrepareBody,
  SubscriptionOffer,
  SubscriptionView,
  billingErrorMessage,
  seatHoldersDetails,
  seatDowngradeMessage,
  correlationIdOf,
  newIdempotencyKey,
} from '../../billing.api';
import { BillingFailed } from '../../shared/billing-failed/billing-failed';
import { BillingForbidden } from '../../shared/billing-forbidden/billing-forbidden';
import { BillingSession } from '../../shared/billing-session';
import { catalogueNames, localizeOffers, localizeSubscription } from '../../shared/catalogue-names';
import { ChangePrefill, parseChangePrefill } from '../../shared/change-link';
import { operationPollDelay } from '../../shared/billing-poll';
import { formatUsd, isGreater } from '../../shared/money';
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
type ReviewPhase =
  'preparing' | 'quoting' | 'quoted' | 'blocked' | 'review' | 'aborted' | 'timeout' | 'quote-error';
interface HeldCommand {
  key: string;
  bodyJson: string;
}

function freezePreparation(body: PrepareBody): PrepareBody {
  body.changes.forEach(Object.freeze);
  Object.freeze(body.changes);
  return Object.freeze(body);
}

function holdCommand(previous: HeldCommand | null, body: unknown): HeldCommand {
  const bodyJson = JSON.stringify(body);
  return previous?.bodyJson === bodyJson ? previous : { key: newIdempotencyKey(), bodyJson };
}

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
    provideTranslocoScope(
      'settings',
      { scope: 'ws-billing', alias: 'bill' },
      { scope: 'ws-billing-subscription', alias: 'bsub' },
    ),
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

  private readonly api = inject(BillingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(BillingSession);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly bsubReady = toSignal(
    this.transloco.selectTranslation('ws-billing-subscription'),
  );
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
  protected readonly catalogueOffers = computed(() =>
    localizeOffers(this.rawOffers(), this.names()),
  );

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
  private applyKeyByPreviewId = new Map<string, HeldCommand>();
  private prepareCommand: HeldCommand | null = null;
  private quoteCommand: HeldCommand | null = null;
  private recoveryCommand: HeldCommand | null = null;
  private frozenBodyJson: string | null = null;
  protected readonly operation = signal<CommercialOperation | null>(null);
  protected readonly noticeKey = signal<string | null>(null);
  protected readonly summary = signal<BillingSummary | null>(null);
  protected readonly receiptState = signal<'idle' | 'checking' | 'failed' | 'missing'>('idle');
  protected readonly receiptError = signal<string | null>(null);
  protected readonly walletRefused = signal(false);
  protected readonly recovering = signal(false);
  protected readonly applyConflict = signal(false);
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
    return this.catalogueGroups().some(
      (g) => !subAppIds.has(g.applicationId) && !cartAppIds.has(g.applicationId),
    );
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
    if (
      !sub ||
      rows.length === 0 ||
      rows.length > 100 ||
      this.summary()?.subscription.accessMode === 'DUNNING'
    )
      return false;
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
      Boolean(p?.financial.canApply) &&
      (p?.financial.walletShortfallUsd == null ||
        !isGreater(p.financial.walletShortfallUsd, '0')) &&
      !this.applyConflict() &&
      (this.receiptState() === 'idle' || this.receiptState() === 'missing')
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
              const offer = offers.find(
                (o) => o.sourceKind === 'ADDON' && o.addon.id === addon.addonId,
              );
              map.set(
                row.selectionKey,
                offer?.sourceKind === 'ADDON' ? offer.addon.name : addon.addonKey,
              );
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
    this.discardFlow();
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
    this.discardFlow();
    this.cart.update((rows) => rows.map((row, idx) => (idx === index ? next : row)));
  }

  protected onReasonInput(event: Event): void {
    this.discardFlow();
    this.reason.set((event.target as HTMLTextAreaElement).value);
    this.reasonTouched.set(true);
  }

  protected async startReview(): Promise<void> {
    this.step1Submitted.set(true);
    const sub = this.subscription();
    if (!sub || !this.canReview() || this.step() !== 1) return;

    const changes: CommercialChange[] = [];
    for (const row of this.cart()) {
      const converted = toCommercialChange(row);
      if (!converted) return;
      changes.push(converted);
    }

    const trimmedReason = this.reason().trim();
    const body =
      this.preparedBody ??
      freezePreparation({
        expectedSubscriptionRevision: sub.subscriptionRevision,
        changes,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      });

    this.clearRowErrors();
    this.stopCountdown();
    this.poller.stop();
    this.activeOperation = null;
    this.step.set(2);
    this.reviewPhase.set('preparing');
    this.preview.set(null);
    this.preparedBody = body;

    this.frozenBodyJson = JSON.stringify(body);
    this.prepareCommand = holdCommand(this.prepareCommand, body);
    const prepareKey = this.prepareCommand.key;
    let op: CommercialOperation;
    try {
      op = await this.withSingleNetworkRetry(() => this.api.prepareChange(body, prepareKey));
    } catch (error) {
      if (this.destroyed || this.preparedBody !== body) return;
      this.handlePrepareOrQuoteFailure(error);
      return;
    }

    if (this.destroyed || this.preparedBody !== body) return;
    this.activeOperation = op;
    writeChangeJournal({
      operationId: op.operationId,
      operationRevision: op.operationRevision,
      body,
    });

    await this.pollAndQuote(op, body, operationPollDelay(0, op.retryAfterSeconds));
  }

  protected async refreshQuote(): Promise<void> {
    if (
      !this.activeOperation ||
      !this.preparedBody ||
      this.refreshingQuote() ||
      this.applying() ||
      this.receiptState() === 'checking' ||
      this.receiptState() === 'failed' ||
      this.applyConflict()
    ) {
      return;
    }
    this.refreshingQuote.set(true);
    try {
      await this.executeQuote(
        this.preparedBody,
        this.activeOperation.operationId,
        this.reviewPhase() !== 'quote-error',
      );
    } finally {
      this.refreshingQuote.set(false);
    }
  }

  protected async confirmApply(): Promise<void> {
    const currentPreview = this.preview();
    if (
      !currentPreview ||
      !this.canConfirmApply() ||
      this.applying() ||
      this.cancelling() ||
      this.refreshingQuote()
    )
      return;
    this.applying.set(true);
    const previewId = currentPreview.previewId;
    const command = holdCommand(this.applyKeyByPreviewId.get(previewId) ?? null, {});
    this.applyKeyByPreviewId.set(previewId, command);
    try {
      // A lost response must be resolved with the receipt before another apply is offered.
      const receipt = await this.api.applyChange(previewId, command.key);
      if (!this.destroyed) this.finishWithReceipt(receipt);
    } catch (error) {
      if (this.destroyed) return;
      const code = errorCodeOf(error);
      if (
        code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_ALREADY_APPLIED' ||
        (error instanceof ApiError && (error.status === 0 || error.status >= 500))
      ) {
        await this.readReceipt(previewId);
      } else if (
        code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED' ||
        code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_STALE' ||
        code === 'SUBSCRIPTION_PLAN_CHANGE_PRICING_CHANGED' ||
        code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_PRICING_CHANGED'
      ) {
        this.noticeKey.set('bsub.preview.pricesChanged');
        this.applying.set(false);
        await this.refreshQuote();
      } else if (
        code === 'SUBSCRIPTION_PLAN_CHANGE_IDEMPOTENCY_REUSED' ||
        code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_IDEMPOTENCY_REUSED' ||
        code === 'GW.IDEM.MISMATCH' ||
        code === 'GW.IDEM.IN_FLIGHT'
      ) {
        this.applyConflict.set(true);
        const messageError =
          code === 'GW.IDEM.IN_FLIGHT' ? error : new ApiError(409, 'GW.IDEM.MISMATCH');
        this.notify.error(billingErrorMessage(messageError, this.transloco, 'write'));
      } else {
        this.walletRefused.set(
          ['WALLET_INSUFFICIENT', 'WALLET_NOT_ACTIVE', 'WALLET_FROZEN'].includes(code ?? ''),
        );
        this.showWriteError(error);
      }
    } finally {
      this.applying.set(false);
    }
  }

  protected async retryReceipt(): Promise<void> {
    const previewId = this.preview()?.previewId ?? this.activeOperation?.relatedPreviewId;
    if (previewId && this.receiptState() !== 'checking') await this.readReceipt(previewId);
  }

  private async readReceipt(previewId: string): Promise<void> {
    this.receiptState.set('checking');
    this.receiptError.set(null);
    try {
      const receipt = await this.api.getReceipt(previewId);
      if (!this.destroyed) this.finishWithReceipt(receipt);
    } catch (error) {
      if (this.destroyed) return;
      this.receiptState.set(
        error instanceof ApiError && error.status === 404 ? 'missing' : 'failed',
      );
      if (this.receiptState() === 'failed')
        this.receiptError.set(billingErrorMessage(error, this.transloco));
    }
  }

  protected async goBackToStep1(): Promise<void> {
    if (
      this.cancelling() ||
      this.applying() ||
      this.recovering() ||
      this.receiptState() === 'checking' ||
      this.receiptState() === 'failed' ||
      this.applyConflict()
    )
      return;
    this.stopCountdown();
    this.poller.stop();

    const op = this.activeOperation;
    if (!op) {
      this.discardFlow();
      return;
    }

    this.cancelling.set(true);
    try {
      const ok = await this.cancelPreparationByIds(
        op.operationId,
        op.operationRevision,
        'Edited before confirming',
      );
      if (this.destroyed) return;
      if (!ok) {
        const current = this.preview();
        if (current) {
          this.startCountdown(current.expiresAt);
        }
        return;
      }
      this.discardFlow();
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
    this.preparedBody = freezePreparation(entry.body);
    this.frozenBodyJson = JSON.stringify(entry.body);
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
      const [sub, offers, summary] = await Promise.all([
        this.api.getSubscription(),
        this.loadAllCatalogue(),
        this.api.getBillingSummary(),
      ]);
      this.rawSubscription.set(sub);
      this.rawOffers.set(offers);
      this.summary.set(summary);
      if (summary.subscription.accessMode === 'DUNNING')
        this.noticeKey.set('bsub.dunning.settleFirst');
      this.cart.update((rows) => this.filterApplicableRows(rows, sub, offers));
      this.discardFlow();
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
    this.discardFlow();
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
      const [sub, offers, summary] = await Promise.all([
        this.api.getSubscription(),
        this.loadAllCatalogue(),
        this.api.getBillingSummary(),
      ]);
      if (seq !== this.loadSeq) return;
      this.rawSubscription.set(sub);
      this.rawOffers.set(offers);
      this.summary.set(summary);
      if (summary.subscription.accessMode === 'DUNNING')
        this.noticeKey.set('bsub.dunning.settleFirst');

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
      if (error instanceof ApiError && error.status === 403) {
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
    while (page <= 20) {
      const res = await this.api.listCatalogue({ page, limit: 100 });
      all.push(...res.data);
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
            : (group.tiers.find((t) => isAppTierAvailable(t, cycle))?.tier.id ?? '');
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
    this.setOperation(op, body);
    if (await this.handleOperation(op, body)) return;
    this.reviewPhase.set('preparing');
    const result = await this.poller.poll(op.operationId, {
      initialDelayMs,
      maxAttempts: 60,
      onTick: (updated) => this.setOperation(updated, body),
    });
    if (result.kind === 'cancelled' || this.destroyed) return;
    if (result.kind === 'error') {
      this.notify.error(billingErrorMessage(result.error, this.transloco));
      this.reviewPhase.set('timeout');
      return;
    }
    if (result.kind === 'timeout') {
      this.reviewPhase.set('timeout');
      return;
    }
    await this.handleOperation(result.operation, body);
  }

  private setOperation(op: CommercialOperation, body: PrepareBody): void {
    this.activeOperation = op;
    this.operation.set(op);
    writeChangeJournal({
      operationId: op.operationId,
      operationRevision: op.operationRevision,
      ...(this.preview() ? { previewId: this.preview()!.previewId } : {}),
      body,
    });
  }

  private async handleOperation(op: CommercialOperation, body: PrepareBody): Promise<boolean> {
    this.setOperation(op, body);
    switch (op.state) {
      case 'READY':
        await this.executeQuote(body, op.operationId, false);
        return true;
      case 'BLOCKED':
        this.reviewPhase.set('blocked');
        return true;
      case 'NEEDS_REVIEW':
        this.reviewPhase.set('review');
        return true;
      case 'ABORTED':
        this.reviewPhase.set('aborted');
        return true;
      case 'COMMITTED':
        if (op.relatedPreviewId) await this.readReceipt(op.relatedPreviewId);
        this.reviewPhase.set('timeout');
        return true;
      default:
        return false;
    }
  }

  protected operationReason(): string {
    return billingErrorMessage(this.operation()?.safeReasonCode ?? '', this.transloco);
  }

  protected async checkOperation(): Promise<void> {
    if (!this.activeOperation || !this.preparedBody || this.recovering()) return;
    this.recovering.set(true);
    try {
      const op = await this.api.getOperation(this.activeOperation.operationId);
      if (this.destroyed) return;
      if (!(await this.handleOperation(op, this.preparedBody))) this.reviewPhase.set('timeout');
    } catch (error) {
      this.notify.error(billingErrorMessage(error, this.transloco));
    } finally {
      this.recovering.set(false);
    }
  }

  protected async recover(): Promise<void> {
    if (
      !this.activeOperation ||
      !this.preparedBody ||
      this.recovering() ||
      this.operation()?.state !== 'BLOCKED'
    )
      return;
    this.recovering.set(true);
    try {
      const body: RecoveryBody = {
        expectedOperationRevision: this.activeOperation.operationRevision,
        action: 'RECONCILE',
        reason: 'Resume blocked plan change',
      };
      this.recoveryCommand = holdCommand(this.recoveryCommand, body);
      const op = await this.withSingleNetworkRetry(() =>
        this.api.recoverOperation(
          this.activeOperation!.operationId,
          body,
          this.recoveryCommand!.key,
        ),
      );
      if (!this.destroyed)
        await this.pollAndQuote(op, this.preparedBody, operationPollDelay(0, op.retryAfterSeconds));
    } catch (error) {
      if (errorCodeOf(error) === 'COMMERCIAL_RECOVERY_REVISION_STALE') {
        try {
          const op = await this.api.getOperation(this.activeOperation!.operationId);
          if (!this.destroyed && !(await this.handleOperation(op, this.preparedBody!)))
            this.reviewPhase.set('timeout');
        } catch (readError) {
          this.notify.error(billingErrorMessage(readError, this.transloco));
        }
      } else this.showWriteError(error);
    } finally {
      this.recovering.set(false);
    }
  }

  protected startAgain(): void {
    this.discardFlow();
    this.step.set(1);
  }

  private async executeQuote(
    body: PrepareBody,
    operationId: string,
    isRefresh: boolean,
  ): Promise<void> {
    this.reviewPhase.set('quoting');
    const quoteBody: QuoteBody = Object.freeze({ ...body, preparationId: operationId });
    if (isRefresh) this.quoteCommand = null;
    this.quoteCommand = holdCommand(this.quoteCommand, quoteBody);
    const key = this.quoteCommand.key;
    try {
      const quoted = await this.withSingleNetworkRetry(() => this.api.quoteChange(quoteBody, key));
      this.applyQuotedPreview(quoted, body);
    } catch (error) {
      if (this.destroyed || this.preparedBody !== body) return;
      const code = errorCodeOf(error);
      if (
        code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_STALE' ||
        code === 'SUBSCRIPTION_PLAN_CHANGE_PRICING_CHANGED' ||
        code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_PRICING_CHANGED' ||
        code === 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED'
      ) {
        this.noticeKey.set('bsub.preview.pricesChanged');
        this.quoteCommand = null;
        this.reviewPhase.set('quote-error');
      } else {
        this.handlePrepareOrQuoteFailure(error);
      }
    }
  }

  private applyQuotedPreview(quoted: CommercialPreview, body: PrepareBody): void {
    if (this.destroyed || this.preparedBody !== body) return;
    this.preview.set(quoted);
    this.receiptState.set('idle');
    this.applyConflict.set(false);
    this.walletRefused.set(false);
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

  private handlePrepareOrQuoteFailure(error: unknown): void {
    if (this.destroyed) return;
    const code = errorCodeOf(error);
    if (code === 'SEAT_DOWNGRADE_FREE_UP_REQUIRED') {
      const details = error instanceof ApiError ? error.details?.['moduleKey'] : null;
      const moduleKey =
        Array.isArray(details) && typeof details[0] === 'string' ? details[0] : null;
      this.attachFreeSeatsRowError(seatDowngradeMessage(error, this.transloco), moduleKey);
    } else if (code === 'SEAT_MODULE_HOLDERS_EXCEED_PURCHASE') {
      const details = seatHoldersDetails(error);
      this.attachFreeSeatsRowError(
        details
          ? this.transloco.translate('bsub.row.holdersExceed', details)
          : billingErrorMessage(error, this.transloco, 'write'),
        details?.moduleKey ?? null,
      );
    } else if (code === 'DOWNGRADE_NOT_ALLOWED') {
      this.attachDowngradeRowError(this.transloco.translate('bsub.row.downgradeNotAllowed'));
    } else if (code === 'ADDON_PREPARATION_STALE') {
      this.showWriteError(error);
      void this.reloadAfterConflict();
    } else {
      this.showWriteError(error);
    }
    if (this.activeOperation && error instanceof ApiError && error.status === 401) {
      this.reviewPhase.set('quote-error');
    } else this.step.set(1);
  }

  private showWriteError(error: unknown): void {
    const code = errorCodeOf(error);
    const notice =
      code === 'ACCESS_POLICY_BLOCKED' || code === 'SUBSCRIPTION_PLAN_CHANGE_PAST_DUE'
        ? 'bsub.dunning.settleFirst'
        : code === 'SUBSCRIPTION_PLAN_CHANGE_CANCELLED'
          ? 'bsub.notice.cancelled'
          : code === 'SUBSCRIPTION_PLAN_CHANGE_PROVISIONING'
            ? 'bsub.notice.provisioning'
            : code === 'SUBSCRIPTION_PLAN_CHANGE_COLLECTION_IN_PROGRESS' ||
                code === 'SUBSCRIPTION_COLLECTION_OPEN'
              ? 'bsub.notice.collection'
              : null;
    this.noticeKey.set(notice);
    this.notify.error(
      notice
        ? this.transloco.translate(notice)
        : billingErrorMessage(error, this.transloco, 'write'),
    );
  }

  private discardFlow(): void {
    this.poller.stop();
    this.stopCountdown();
    clearChangeJournal();
    this.activeOperation = null;
    this.operation.set(null);
    this.preparedBody = null;
    this.frozenBodyJson = null;
    this.prepareCommand = null;
    this.quoteCommand = null;
    this.recoveryCommand = null;
    this.applyKeyByPreviewId.clear();
    this.preview.set(null);
    this.receiptState.set('idle');
    this.receiptError.set(null);
    this.applyConflict.set(false);
    this.walletRefused.set(false);
    this.noticeKey.set(
      this.summary()?.subscription.accessMode === 'DUNNING' ? 'bsub.dunning.settleFirst' : null,
    );
    this.step.set(1);
  }

  /**
   * The row is the application seat change for `details.moduleKey` when the error names it; without it, the
   * first application seat change in the cart.
   */
  private attachFreeSeatsRowError(message: string, moduleKey: string | null): void {
    const sub = this.subscription();
    const appKeyOf = (targetId: string) =>
      sub?.baseItems.find((b) => b.id === targetId)?.applicationKey ?? null;

    this.cart.update((rows) => {
      let matchedIndex =
        moduleKey === null
          ? -1
          : rows.findIndex(
              (r) =>
                r.kind === 'change-seats' &&
                r.targetKind === 'APPLICATION' &&
                appKeyOf(r.targetId) === moduleKey,
            );
      if (matchedIndex === -1) {
        matchedIndex = rows.findIndex(
          (r) => r.kind === 'change-seats' && r.targetKind === 'APPLICATION',
        );
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

  private attachDowngradeRowError(message: string): void {
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
          const group = base
            ? groups.find((g) => g.applicationId === base.applicationId)
            : undefined;
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

  private async cancelPreparationByIds(
    operationId: string,
    operationRevision: string,
    reasonText: string,
  ): Promise<boolean> {
    const body: RecoveryBody = {
      expectedOperationRevision: operationRevision,
      action: 'CANCEL_PREPARATION',
      reason: reasonText,
    };
    this.recoveryCommand = holdCommand(this.recoveryCommand, body);
    const cancelKey = this.recoveryCommand.key;
    try {
      await this.withSingleNetworkRetry(() =>
        this.api.recoverOperation(operationId, body, cancelKey),
      );
      return true;
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'TENANT_OPERATION_NOT_FOUND') {
        return true;
      }
      if (code === 'COMMERCIAL_RECOVERY_REVISION_STALE') {
        try {
          const latest = await this.api.getOperation(operationId);
          if (latest.state === 'ABORTED' || latest.state === 'COMMITTED') {
            return true;
          }
          this.activeOperation = latest;
          this.operation.set(latest);
          this.reviewPhase.set(latest.state === 'BLOCKED' ? 'blocked' : 'timeout');
          return false;
        } catch (retryError) {
          if (errorCodeOf(retryError) === 'TENANT_OPERATION_NOT_FOUND') return true;
          this.showWriteError(retryError);
          return false;
        }
      }
      this.showWriteError(error);
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
      const secs = Number.isNaN(targetMs)
        ? 0
        : Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
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
      const isNetwork =
        (error instanceof ApiError && error.status === 0) || error instanceof TypeError;
      if (!isNetwork) {
        throw error;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      return command();
    }
  }
}
