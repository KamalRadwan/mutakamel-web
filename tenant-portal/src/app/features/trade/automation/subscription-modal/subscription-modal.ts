import {
  Component,
  DestroyRef,
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
  tablerCheck,
  tablerCircleOff,
  tablerFileSearch,
  tablerRefresh,
  tablerSend,
  tablerWebhook,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { TagPicker, type TagOption } from '../../../../shared/ui/tag-picker/tag-picker';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf } from '../../shared/trade-api';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { ConflictDialog } from '../automation-shared/conflict-dialog/conflict-dialog';
import { EventPicker, type EventSelection } from '../event-picker/event-picker';
import { SecretPanel } from '../secret-panel/secret-panel';
import { ActionKeys } from '../automation-shared/action-keys';
import {
  createSubscription,
  getSubscription,
  sendTest,
  updateSubscription,
} from '../webhooks.api';
import {
  type CreateSubscriptionInput,
  type RetryPolicyCode,
  type ScopeTarget,
  type SubscriptionStatus,
  type UpdateSubscriptionInput,
  type WebhookEventDefinition,
  type WebhookSubscriptionDetail,
  endpointText,
} from '../webhooks.model';
import { backoffText, endpointProblems } from '../webhooks.registry';

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,79}$/;
const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_RETRY_POLICY: RetryPolicyCode = 'EXPONENTIAL_STANDARD';
const MIN_ATTEMPTS = 1;
const MAX_ATTEMPTS = 10;
const MIN_EVENTS = 1;
const MAX_EVENTS = 30;

interface SubscriptionSnapshot {
  /** Origin and path as the backend projects them; the stored query string is never returned. */
  endpointUri: string;
  retryPolicy: RetryPolicyCode;
  maxAttempts: number;
  branchIds: string[];
  events: EventSelection[];
}

function normalizeEvents(list: readonly EventSelection[]): EventSelection[] {
  return [...list]
    .map((item) => ({
      eventType: item.eventType,
      eventVersion: item.eventVersion,
      fields: [...item.fields].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.eventType.localeCompare(b.eventType));
}

function eventsEqual(a: readonly EventSelection[], b: readonly EventSelection[]): boolean {
  const na = normalizeEvents(a);
  const nb = normalizeEvents(b);
  if (na.length !== nb.length) return false;
  for (let i = 0; i < na.length; i += 1) {
    if (na[i].eventType !== nb[i].eventType || na[i].eventVersion !== nb[i].eventVersion) return false;
    if (na[i].fields.length !== nb[i].fields.length) return false;
    for (let j = 0; j < na[i].fields.length; j += 1) {
      if (na[i].fields[j] !== nb[i].fields[j]) return false;
    }
  }
  return true;
}

function branchesEqual(a: readonly string[], b: readonly string[]): boolean {
  const sa = [...a].sort((x, y) => x.localeCompare(y));
  const sb = [...b].sort((x, y) => x.localeCompare(y));
  if (sa.length !== sb.length) return false;
  for (let i = 0; i < sa.length; i += 1) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

function snapshotFromDetail(detail: WebhookSubscriptionDetail): SubscriptionSnapshot {
  const version = detail.currentVersion;
  return {
    endpointUri: endpointText(version.endpoint),
    retryPolicy: version.retryPolicyCode,
    maxAttempts: version.maxAttempts,
    branchIds: [...version.branches],
    events: version.events.map((item) => ({ ...item, fields: [...item.fields] })),
  };
}

@Component({
  selector: 'app-subscription-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Dropdown,
    Field,
    Modal,
    TagPicker,
    UnsavedDialog,
    AutomationBadge,
    ConflictDialog,
    EventPicker,
    SecretPanel,
  ],
  providers: [
    provideIcons({
      tablerWebhook,
      tablerSend,
      tablerCircleOff,
      tablerCheck,
      tablerRefresh,
      tablerFileSearch,
    }),
  ],
  templateUrl: './subscription-modal.html',
})
export class SubscriptionModal {
  private static nextId = 0;

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly conflictDialog = viewChild.required<ConflictDialog>('conflictDialog');
  private readonly secretPanel = viewChild(SecretPanel);

  protected readonly uid = `webhook-subscription-modal-${++SubscriptionModal.nextId}`;

  readonly subscriptionId = input<string | null>(null);
  readonly eventsCatalogue = input.required<readonly WebhookEventDefinition[]>();
  readonly scopeTarget = input<ScopeTarget>('COMPANY');
  readonly canManage = input(true);
  readonly canTest = input(true);
  readonly openRotateOnLoad = input(false);

  readonly closed = output<void>();
  readonly saved = output<WebhookSubscriptionDetail>();
  readonly openDelivery = output<string>();

  protected readonly detail = signal<WebhookSubscriptionDetail | null>(null);
  protected readonly code = signal('');
  protected readonly endpointUrl = signal('');
  protected readonly retryPolicy = signal<RetryPolicyCode>(DEFAULT_RETRY_POLICY);
  protected readonly maxAttemptsInput = signal(String(DEFAULT_MAX_ATTEMPTS));
  protected readonly branchIds = signal<string[]>([]);
  protected readonly events = signal<EventSelection[]>([]);
  protected readonly baseSnapshot = signal<SubscriptionSnapshot | null>(null);

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly notFound = signal(false);
  protected readonly saving = signal(false);
  protected readonly testing = signal(false);
  protected readonly togglingStatus = signal(false);
  protected readonly guardBusy = signal(false);
  protected readonly lastTestDeliveryId = signal<string | null>(null);

  private readonly attemptedSubmit = signal(false);
  private readonly endpointTouched = signal(false);
  private readonly serverCodeError = signal<string | null>(null);
  private readonly serverEndpointError = signal<string | null>(null);

  private allowClose = false;
  private destroyed = false;
  private readonly keys = new ActionKeys();
  private initializedForKey: string | null | undefined = undefined;
  private loadSeq = 0;
  private rotateConsumedForId: string | null = null;

  protected readonly isCreate = computed(
    () => this.subscriptionId() === null && this.detail() === null,
  );
  protected readonly canEdit = computed(
    () => this.canManage() && (this.isCreate() || this.detail() !== null),
  );
  protected readonly showBranches = computed(() => {
    const current = this.detail();
    return current ? current.currentVersion.scopeTarget === 'COMPANY' : this.scopeTarget() !== 'TENANT';
  });
  protected readonly busy = computed(
    () => this.saving() || this.testing() || this.togglingStatus(),
  );

  protected readonly modalTitle = computed(() => {
    this.i18n();
    if (this.isCreate()) {
      return this.transloco.translate('webhooks.subscription.newTitle');
    }
    return this.detail()?.code ?? this.transloco.translate('webhooks.subscription.newTitle');
  });

  protected readonly statusValue = computed<SubscriptionStatus | null>(() => {
    if (this.isCreate()) return null;
    return this.detail()?.status ?? null;
  });

  protected readonly isSecretPending = computed(
    () => this.detail()?.secretOperation?.status === 'PENDING',
  );

  /** Disable is always allowed; enable needs the current secret ACTIVE and no secret operation pending. */
  protected readonly canToggleStatus = computed(() => {
    const current = this.detail();
    if (!current || !this.canManage()) return false;
    return current.status === 'ACTIVE' || (current.secret?.status === 'ACTIVE' && !this.isSecretPending());
  });

  protected readonly retryPolicyOptions = computed<DropdownOption<RetryPolicyCode>[]>(() => {
    this.i18n();
    return [
      {
        value: 'EXPONENTIAL_STANDARD',
        label: this.transloco.translate('webhooks.subscription.fields.retryPolicy.standard'),
      },
      {
        value: 'EXPONENTIAL_CONSERVATIVE',
        label: this.transloco.translate('webhooks.subscription.fields.retryPolicy.conservative'),
      },
    ];
  });

  protected readonly selectedRetryPolicyLabel = computed(() => {
    const selected = this.retryPolicyOptions().find((opt) => opt.value === this.retryPolicy());
    return selected?.label ?? '';
  });

  protected readonly retryPolicyHint = computed(() => {
    this.i18n();
    const policy = this.retryPolicy();
    return this.transloco.translate('webhooks.subscription.fields.retryPolicy.hint', {
      t1: backoffText(policy, 1),
      t2: backoffText(policy, 2),
      t3: backoffText(policy, 3),
      t4: backoffText(policy, 4),
    });
  });

  protected readonly branchOptions = computed<TagOption[]>(() => {
    const lang = this.language();
    return this.scope.branches().map((branch) => ({
      id: branch.id,
      name: lang === 'ar' ? branch.nameAr : branch.nameEn,
      backgroundColor: null,
      textColor: null,
    }));
  });

  protected readonly dirty = computed(() => {
    if (this.isCreate()) {
      return (
        this.code().trim() !== '' ||
        this.endpointUrl().trim() !== '' ||
        this.retryPolicy() !== DEFAULT_RETRY_POLICY ||
        this.maxAttemptsInput().trim() !== String(DEFAULT_MAX_ATTEMPTS) ||
        this.branchIds().length > 0 ||
        this.events().length > 0
      );
    }

    const base = this.baseSnapshot();
    if (!base) return false;
    const maxAttempts = Number(this.maxAttemptsInput().trim());

    return (
      this.endpointUrl().trim() !== base.endpointUri ||
      this.retryPolicy() !== base.retryPolicy ||
      maxAttempts !== base.maxAttempts ||
      (this.showBranches() && !branchesEqual(this.branchIds(), base.branchIds)) ||
      !eventsEqual(this.events(), base.events)
    );
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    const serverErr = this.serverCodeError();
    if (serverErr) return serverErr;
    if (!this.isCreate() || !this.attemptedSubmit()) return null;

    const trimmed = this.code().trim();
    if (!trimmed) return this.transloco.translate('webhooks.subscription.validation.required');
    if (!CODE_PATTERN.test(trimmed)) {
      return this.transloco.translate('webhooks.subscription.validation.codePattern');
    }
    return null;
  });

  protected readonly endpointError = computed<string | null>(() => {
    this.i18n();
    const serverErr = this.serverEndpointError();
    if (serverErr) return serverErr;

    const trimmed = this.endpointUrl().trim();
    const shouldValidate = this.attemptedSubmit() || this.endpointTouched() || trimmed.length > 0;
    if (!shouldValidate) return null;
    if (!trimmed) return this.transloco.translate('webhooks.subscription.validation.required');

    const problems = endpointProblems(trimmed);
    if (problems.length === 0) return null;
    return problems.map((problem) => this.translateEndpointProblem(problem)).join(' · ');
  });

  protected readonly maxAttemptsError = computed<string | null>(() => {
    this.i18n();
    if (!this.attemptedSubmit()) return null;
    const raw = this.maxAttemptsInput().trim();
    if (!raw) return this.transloco.translate('webhooks.subscription.validation.required');
    const num = Number(raw);
    if (!Number.isInteger(num) || num < MIN_ATTEMPTS || num > MAX_ATTEMPTS) {
      return this.transloco.translate('webhooks.subscription.validation.maxAttemptsRange');
    }
    return null;
  });

  protected readonly eventsError = computed<string | null>(() => {
    this.i18n();
    if (!this.attemptedSubmit()) return null;
    const selected = this.events();
    if (selected.length < MIN_EVENTS || selected.length > MAX_EVENTS) {
      return this.transloco.translate('webhooks.subscription.validation.eventsRequired');
    }
    if (selected.some((item) => item.fields.length < 1)) {
      return this.transloco.translate('webhooks.subscription.validation.atLeastOneField');
    }
    return null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });

    afterNextRender(() => {
      this.modal().open();
    });

    effect(() => {
      const id = this.subscriptionId();
      const currentDetailId = untracked(() => this.detail()?.id ?? null);

      if (id === null) {
        if (this.initializedForKey === null && currentDetailId !== null) {
          return;
        }
        this.initializedForKey = null;
        untracked(() => this.resetForCreate());
        return;
      }

      this.initializedForKey = id;
      if (currentDetailId === id) {
        untracked(() => this.maybeOpenPendingRotate(id));
        return;
      }
      untracked(() => {
        void this.loadSubscription(id);
      });
    });
  }

  isDirty(): boolean {
    return this.dirty();
  }

  forceClose(): void {
    this.allowClose = true;
    this.modal().close();
  }

  async canDeactivate(): Promise<boolean> {
    if (this.busy() || this.guardBusy()) return false;
    return this.confirmLeave();
  }

  protected onCodeInput(event: Event): void {
    if (!this.isCreate() || !this.canManage()) return;
    this.code.set((event.target as HTMLInputElement).value);
    this.serverCodeError.set(null);
  }

  protected onEndpointInput(event: Event): void {
    if (!this.canEdit()) return;
    this.endpointUrl.set((event.target as HTMLInputElement).value);
    this.endpointTouched.set(true);
    this.serverEndpointError.set(null);
  }

  protected onRetryPolicyChange(value: RetryPolicyCode): void {
    if (!this.canEdit()) return;
    this.retryPolicy.set(value);
  }

  protected onMaxAttemptsInput(event: Event): void {
    if (!this.canEdit()) return;
    this.maxAttemptsInput.set((event.target as HTMLInputElement).value);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  protected async submit(): Promise<boolean> {
    if (this.busy() || this.loading() || this.notFound() || this.loadFailed() || !this.canEdit()) {
      return false;
    }

    this.attemptedSubmit.set(true);
    this.serverCodeError.set(null);
    this.serverEndpointError.set(null);

    if (
      this.codeError() ||
      this.endpointError() ||
      this.maxAttemptsError() ||
      this.eventsError()
    ) {
      return false;
    }

    if (this.isCreate()) {
      return this.submitCreate();
    }
    return this.submitEdit();
  }

  protected undo(): void {
    if (this.isCreate() || this.busy()) return;
    const base = this.baseSnapshot();
    if (!base) return;
    this.applySnapshot(base);
    this.attemptedSubmit.set(false);
    this.endpointTouched.set(false);
    this.serverCodeError.set(null);
    this.serverEndpointError.set(null);
  }

  protected async onSendTest(): Promise<void> {
    const current = this.detail();
    if (!current || current.status !== 'ACTIVE' || this.busy() || !this.canTest()) return;

    this.testing.set(true);
    try {
      const action = `test:${current.id}`;
      const accepted = await sendTest(current.id, this.keys.for(action, current.id));
      this.keys.done(action);
      if (this.destroyed) return;
      this.lastTestDeliveryId.set(accepted.deliveryId);
      this.notify.success(this.transloco.translate('webhooks.toast.testSent'));
    } catch (error) {
      if (this.destroyed) return;
      this.notify.error(this.translateError(error));
    } finally {
      this.testing.set(false);
    }
  }

  protected openLastTestDelivery(): void {
    const deliveryId = this.lastTestDeliveryId();
    if (!deliveryId) return;
    this.openDelivery.emit(deliveryId);
  }

  protected async onToggleStatus(): Promise<void> {
    const current = this.detail();
    if (!current || !this.canManage() || this.busy()) return;
    const nextStatus: 'ACTIVE' | 'DISABLED' = current.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';

    this.togglingStatus.set(true);
    try {
      const action = `status:${current.id}`;
      const request = { status: nextStatus, ifMatch: current.version };
      await updateSubscription(current.id, { status: nextStatus }, current.version, this.keys.for(action, request));
      this.keys.done(action);
      const updated = await getSubscription(current.id);
      if (this.destroyed) return;
      this.detail.set(updated);
      this.notify.success(
        this.transloco.translate(
          nextStatus === 'DISABLED' ? 'webhooks.toast.disabled' : 'webhooks.toast.enabled',
        ),
      );
      this.saved.emit(updated);
    } catch (error) {
      if (this.destroyed) return;
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION'
      ) {
        await this.handleConflict();
        return;
      }
      this.notify.error(this.translateError(error));
    } finally {
      this.togglingStatus.set(false);
    }
  }

  protected onSecretUpdated(fresh: WebhookSubscriptionDetail): void {
    const current = this.detail();
    if (!current || fresh.id !== current.id) return;
    this.detail.set(fresh);
    if (!this.dirty()) {
      this.applyLoaded(fresh);
    }
    this.saved.emit(fresh);
  }

  protected async handleConflict(): Promise<void> {
    const current = this.detail();
    if (!current || this.guardBusy()) return;
    this.conflictDialog().open();
  }

  protected async onConflictReload(): Promise<void> {
    const id = this.detail()?.id ?? this.subscriptionId();
    if (!id) return;
    const loaded = await this.loadSubscription(id);
    if (loaded) {
      this.saved.emit(loaded);
    }
  }

  protected async onConflictKeep(): Promise<void> {
    const id = this.detail()?.id ?? this.subscriptionId();
    if (!id) return;
    try {
      const fresh = await getSubscription(id);
      if (this.destroyed) return;
      this.detail.set(fresh);
      this.baseSnapshot.set(snapshotFromDetail(fresh));
    } catch (error) {
      if (!this.destroyed) {
        this.notify.error(this.translateError(error));
      }
    }
  }

  protected retryLoad(): void {
    const id = this.subscriptionId() ?? this.detail()?.id ?? null;
    if (!id) return;
    void this.loadSubscription(id);
  }

  protected async requestClose(): Promise<void> {
    if (this.busy() || this.guardBusy()) return;
    if (!(await this.confirmLeave())) return;
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && (this.guardBusy() || this.busy())) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
    this.loadSeq++;
    this.closed.emit();
  }

  private async confirmModalClose(): Promise<void> {
    if (await this.confirmLeave()) {
      this.allowClose = true;
      this.modal().close();
    }
  }

  private async confirmLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
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
      this.discardChanges();
      return true;
    }
    return this.submit();
  }

  private discardChanges(): void {
    if (this.isCreate()) {
      this.resetForCreate();
    } else {
      this.undo();
    }
  }

  private resetForCreate(): void {
    this.loadSeq++;
    this.detail.set(null);
    this.baseSnapshot.set(null);
    this.code.set('');
    this.endpointUrl.set('');
    this.retryPolicy.set(DEFAULT_RETRY_POLICY);
    this.maxAttemptsInput.set(String(DEFAULT_MAX_ATTEMPTS));
    this.branchIds.set([]);
    this.events.set([]);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.notFound.set(false);
    this.saving.set(false);
    this.testing.set(false);
    this.togglingStatus.set(false);
    this.lastTestDeliveryId.set(null);
    this.attemptedSubmit.set(false);
    this.endpointTouched.set(false);
    this.serverCodeError.set(null);
    this.serverEndpointError.set(null);
    this.rotateConsumedForId = null;
  }

  private async loadSubscription(id: string): Promise<WebhookSubscriptionDetail | null> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.notFound.set(false);
    this.attemptedSubmit.set(false);
    this.endpointTouched.set(false);
    this.serverCodeError.set(null);
    this.serverEndpointError.set(null);

    try {
      const loaded = await getSubscription(id);
      if (seq !== this.loadSeq || this.destroyed) return null;
      this.applyLoaded(loaded);
      this.maybeOpenPendingRotate(loaded.id);
      return loaded;
    } catch (error) {
      if (seq !== this.loadSeq || this.destroyed) return null;
      this.loading.set(false);
      if (error instanceof ApiError && error.status === 404) {
        this.notFound.set(true);
      } else {
        this.loadFailed.set(true);
      }
      return null;
    }
  }

  private maybeOpenPendingRotate(id: string): void {
    if (!this.openRotateOnLoad() || this.rotateConsumedForId === id) return;
    this.rotateConsumedForId = id;
    afterNextRender(() => this.secretPanel()?.openRotateModal(), { injector: this.injector });
  }

  private applyLoaded(loaded: WebhookSubscriptionDetail): void {
    const snap = snapshotFromDetail(loaded);
    this.detail.set(loaded);
    this.code.set(loaded.code);
    this.baseSnapshot.set(snap);
    this.applySnapshot(snap);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.notFound.set(false);
    this.attemptedSubmit.set(false);
    this.endpointTouched.set(false);
    this.serverCodeError.set(null);
    this.serverEndpointError.set(null);
  }

  private applySnapshot(snap: SubscriptionSnapshot): void {
    this.endpointUrl.set(snap.endpointUri);
    this.retryPolicy.set(snap.retryPolicy);
    this.maxAttemptsInput.set(String(snap.maxAttempts));
    this.branchIds.set([...snap.branchIds]);
    this.events.set(snap.events.map((item) => ({ ...item, fields: [...item.fields] })));
  }

  private async submitCreate(): Promise<boolean> {
    const body: CreateSubscriptionInput = {
      code: this.code().trim(),
      scopeTarget: this.scopeTarget() === 'TENANT' ? 'TENANT' : 'COMPANY',
      endpointUri: this.endpointUrl().trim(),
      retryPolicyCode: this.retryPolicy(),
      maxAttempts: Number(this.maxAttemptsInput().trim()),
      events: this.events().map((item) => ({ ...item, fields: [...item.fields] })),
      ...(this.showBranches() ? { branchIds: [...this.branchIds()] } : {}),
    };

    this.saving.set(true);
    try {
      const accepted = await createSubscription(body, this.keys.for('create', body));
      this.keys.done('create');
      // The create answer is the entity plus a version summary; the form needs the detail.
      const created = await getSubscription(accepted.id);
      if (this.destroyed) return false;
      this.applyLoaded(created);
      this.notify.success(this.transloco.translate('webhooks.toast.created'));
      this.saved.emit(created);
      return true;
    } catch (error) {
      if (this.destroyed) return false;
      this.handleWriteError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async submitEdit(): Promise<boolean> {
    const current = this.detail();
    const base = this.baseSnapshot();
    if (!current || !base || !this.dirty()) return true;

    const patch: UpdateSubscriptionInput = {};
    const trimmedUrl = this.endpointUrl().trim();
    if (trimmedUrl !== base.endpointUri) {
      patch.endpointUri = trimmedUrl;
    }
    if (this.retryPolicy() !== base.retryPolicy) {
      patch.retryPolicyCode = this.retryPolicy();
    }
    const maxAttempts = Number(this.maxAttemptsInput().trim());
    if (maxAttempts !== base.maxAttempts) {
      patch.maxAttempts = maxAttempts;
    }
    if (this.showBranches() && !branchesEqual(this.branchIds(), base.branchIds)) {
      patch.branchIds = [...this.branchIds()];
    }
    if (!eventsEqual(this.events(), base.events)) {
      patch.events = this.events().map((item) => ({ ...item, fields: [...item.fields] }));
    }

    if (Object.keys(patch).length === 0) return true;

    this.saving.set(true);
    try {
      const action = `edit:${current.id}`;
      const result = await updateSubscription(
        current.id,
        patch,
        current.version,
        this.keys.for(action, { patch, ifMatch: current.version }),
      );
      this.keys.done(action);
      const updated = await getSubscription(current.id);
      if (this.destroyed) return false;
      this.applyLoaded(updated);
      this.notify.success(
        this.transloco.translate('webhooks.toast.savedVersion', {
          version: result.currentVersion.versionNumber,
        }),
      );
      this.saved.emit(updated);
      return true;
    } catch (error) {
      if (this.destroyed) return false;
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION'
      ) {
        await this.handleConflict();
        return false;
      }
      this.handleWriteError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private handleWriteError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'TRADE.WEBHOOK.ENDPOINT_FORBIDDEN') {
      this.serverEndpointError.set(this.translateError(error));
      return;
    }
    if (code === 'TRADE.WEBHOOK.SUBSCRIPTION_CODE_CONFLICT') {
      this.serverCodeError.set(this.translateError(error));
      return;
    }
    this.notify.error(this.translateError(error));
  }

  private translateEndpointProblem(problem: string): string {
    const key = `webhooks.subscription.endpointProblems.${problem}`;
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : problem;
  }

  private translateError(error: unknown): string {
    if (error instanceof ApiError) {
      const reason = error.details?.['reason']?.[0];
      if (reason) {
        const reasonKey = `webhooks.errors.${error.code}.${reason}`;
        const reasonText = this.transloco.translate(reasonKey);
        if (reasonText !== reasonKey) return reasonText;
      }
      const codeKey = `webhooks.errors.${error.code}`;
      const codeText = this.transloco.translate(codeKey);
      if (codeText !== codeKey) return codeText;

      const shortCode = error.code.split('.').at(-1) ?? error.code;
      const shortKey = `webhooks.errors.${shortCode}`;
      const shortText = this.transloco.translate(shortKey);
      if (shortText !== shortKey) return shortText;

      const autoKey = `automation.errors.${error.code}`;
      const autoText = this.transloco.translate(autoKey);
      if (autoText !== autoKey) return autoText;
    }
    return this.transloco.translate('webhooks.errors.generic');
  }
}
