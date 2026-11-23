import {
  Component,
  DestroyRef,
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
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertOctagon,
  tablerCheck,
  tablerCircleCheck,
  tablerCopy,
  tablerExternalLink,
  tablerFileSearch,
  tablerInfoCircle,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../shared/ui/modal/modal';
import {
  TradeReasonPicker,
  type ReasonPickerValue,
} from '../../shared/pickers/reason-picker/reason-picker';
import { ApiError, type TradeContext, errorCodeOf, newIdempotencyKey } from '../../shared/trade-api';
import { listReasons } from '../../shared/trade-foundation.api';
import type { ReasonCode } from '../../shared/trade-foundation.model';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { ConflictDialog } from '../automation-shared/conflict-dialog/conflict-dialog';
import {
  contextForException,
  isIdempotencyMismatch,
  isTowerForbiddenError,
  isTowerNotReadyError,
  isTowerTargetStaleError,
} from '../control-tower-page/tower-access';
import { EvidenceEditor } from '../evidence-editor/evidence-editor';
import {
  formatTowerDateTime,
  formatTowerSafeErrorCode,
  resolveTowerSourceLink,
  towerSourceLabel,
  translateTowerError,
} from '../tower.util';
import { getException, resolve } from '../tower.api';
import {
  type TowerAttempt,
  type TowerException,
  type TowerResolutionCode,
  type TowerSourceRoute,
  allowedCodesFor,
  isResolvableStatus,
} from '../tower.model';

const RESOLVE_REASON_KIND = 'CONTROL_TOWER_RESOLVE';

function initialEvidenceFor(ex: TowerException): Record<string, string> {
  if (ex.category === 'RESULT_CONFLICT' && allowedCodesFor(ex).includes('RESULT_ACCEPTED')) {
    return { keptArtifactId: '' };
  }
  return {};
}

@Component({
  selector: 'app-exception-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    FullState,
    Modal,
    TradeReasonPicker,
    AutomationBadge,
    ConflictDialog,
    EvidenceEditor,
  ],
  providers: [
    provideIcons({
      tablerAlertOctagon,
      tablerCheck,
      tablerCircleCheck,
      tablerCopy,
      tablerExternalLink,
      tablerFileSearch,
      tablerInfoCircle,
      tablerRefresh,
    }),
  ],
  templateUrl: './exception-modal.html',
})
export class ExceptionModal {
  private static nextSeq = 0;

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('exceptionModal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly conflictDialog = viewChild.required<ConflictDialog>('conflictDialog');
  private readonly reasonPicker = viewChild(TradeReasonPicker);
  private readonly evidenceEditor = viewChild(EvidenceEditor);

  protected readonly uid = `tower-exception-modal-${++ExceptionModal.nextSeq}`;

  readonly exceptionId = input.required<string>();
  readonly context = input<TradeContext>({});
  readonly canResolve = input(true);

  readonly closed = output<void>();
  readonly resolved = output<TowerException>();
  readonly refreshed = output<void>();
  readonly forbidden = output<void>();

  protected readonly detail = signal<TowerException | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly notFound = signal(false);
  protected readonly isForbidden = signal(false);
  protected readonly notReadyMessage = signal<string | null>(null);
  protected readonly conflictMessage = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly copiedCorrelation = signal(false);

  protected readonly reasons = signal<ReasonCode[]>([]);
  protected readonly reasonsLoaded = signal(false);

  protected readonly resolutionCode = signal<TowerResolutionCode | null>(null);
  protected readonly reasonValue = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  protected readonly evidence = signal<Record<string, string>>({});
  protected readonly submitted = signal(false);
  protected readonly serverErrors = signal<Partial<Record<'resolutionCode' | 'reason' | 'evidence', string>>>({});

  private initialResolution: TowerResolutionCode | null = null;
  private initialEvidenceJson = '{}';

  private destroyed = false;
  private loadSeq = 0;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingIdemKey: string | null = null;
  private lastPayloadSignature = '';
  private readonly rejectedPayloadSignatures = new Set<string>();

  protected readonly modalTitle = computed(() => {
    this.i18n();
    const current = this.detail();
    if (!current) {
      return this.transloco.translate('tower.modal.fallbackTitle');
    }
    return this.transloco.translate(`tower.categories.${current.category}`);
  });

  protected readonly attempts = computed<readonly TowerAttempt[]>(
    () => this.detail()?.attempts ?? [],
  );

  protected readonly showResolveSection = computed(() => {
    const current = this.detail();
    if (!current || !this.canResolve() || this.isForbidden() || this.notReadyMessage() !== null) {
      return false;
    }
    if (!isResolvableStatus(current.status)) return false;
    return allowedCodesFor(current).length > 0;
  });

  protected readonly resolutionOptions = computed<DropdownOption<TowerResolutionCode | null>[]>(() => {
    this.i18n();
    const current = this.detail();
    const codes = current ? allowedCodesFor(current) : [];
    return codes.map((code) => ({
      value: code,
      label: this.transloco.translate(`tower.resolutions.${code}`),
    }));
  });

  protected readonly resolutionError = computed<string | null>(() => {
    this.i18n();
    if (this.serverErrors().resolutionCode) return this.serverErrors().resolutionCode!;
    if (!this.submitted() || !this.showResolveSection()) return null;
    return this.resolutionCode() ? null : this.transloco.translate('tradeShared.common.required');
  });

  protected readonly hasEmptyReasons = computed(
    () => this.reasonsLoaded() && this.reasons().length === 0,
  );

  protected readonly hasUnsavedChanges = computed(() => {
    if (!this.showResolveSection()) return false;
    const reason = this.reasonValue();
    if (this.resolutionCode() !== this.initialResolution) return true;
    if (reason.reasonCodeId !== null || reason.note.trim().length > 0) return true;
    return JSON.stringify(this.evidence()) !== this.initialEvidenceJson;
  });

  protected readonly resolveButtonDisabled = computed(
    () => this.submitting() || this.hasEmptyReasons(),
  );

  constructor() {
    effect(() => {
      this.resolutionCode();
      this.reasonValue();
      this.evidence();
      this.serverErrors.set({});
    });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
        this.copyTimer = null;
      }
    });

    afterNextRender(() => {
      this.modal().open();
    });

    effect(() => {
      const id = this.exceptionId();
      untracked(() => {
        void this.loadException(id);
      });
    });

    effect(() => {
      if (this.canResolve() && !this.reasonsLoaded()) {
        untracked(() => {
          void this.loadReasonsList();
        });
      }
    });
  }

  protected sourceLabelText(ex: TowerException): string {
    return towerSourceLabel(ex);
  }

  protected sourceText(ex: TowerException): string {
    this.i18n();
    return `${this.transloco.translate(`tower.sourceTypes.${ex.sourceType}`)} ${this.sourceLabelText(ex)}`;
  }

  protected statusText(ex: TowerException): string {
    this.i18n();
    return this.transloco.translate(`automation.badge.exception.${ex.status}`);
  }

  protected sourceLinkFor(ex: TowerException): TowerSourceRoute | null {
    return resolveTowerSourceLink(ex);
  }

  protected sourceHref(link: TowerSourceRoute): string {
    return this.router.serializeUrl(
      this.router.createUrlTree(link.commands, {
        ...(link.queryParams ? { queryParams: link.queryParams } : {}),
      }),
    );
  }

  protected problemText(code: string | null | undefined): string {
    this.i18n();
    return formatTowerSafeErrorCode(code, this.transloco.translate('tower.common.none'));
  }

  protected formatDateTime(iso: string | null | undefined): string {
    return formatTowerDateTime(
      iso,
      this.language(),
      this.transloco.translate('tower.common.none'),
    );
  }

  protected attemptBadgeValue(status: string): string {
    const upper = status.trim().toUpperCase();
    if (upper === 'SUCCEEDED' || upper === 'DELIVERED') return 'DELIVERED';
    if (upper === 'RETRY_SCHEDULED' || upper === 'PENDING') return 'RETRY_SCHEDULED';
    return 'FAILED';
  }

  protected attemptStatusLabel(status: string): string {
    this.i18n();
    const upper = status.trim().toUpperCase();
    const key = `tower.attemptStatuses.${upper}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : status;
  }

  protected resolvedBannerText(ex: TowerException): string {
    this.i18n();
    return this.transloco.translate('tower.modal.resolvedBanner', {
      date: this.formatDateTime(ex.resolvedAt ?? ex.updatedAt),
    });
  }

  protected resolvedWithCodeText(code: TowerResolutionCode): string {
    this.i18n();
    return this.transloco.translate('tower.modal.resolvedWithCode', {
      code: this.transloco.translate(`tower.resolutions.${code}`),
    });
  }

  protected onResolutionChange(next: TowerResolutionCode | null): void {
    this.resolutionCode.set(next);
  }

  protected undoResolveForm(): void {
    const current = this.detail();
    if (!current) return;
    this.resetFormFor(current);
  }

  protected async copyCorrelationId(): Promise<void> {
    const correlationId = this.detail()?.correlationId;
    if (!correlationId) return;
    try {
      await navigator.clipboard.writeText(correlationId);
      this.copiedCorrelation.set(true);
      this.notify.success(this.transloco.translate('tower.toast.copied'));
      if (this.copyTimer !== null) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => {
        if (!this.destroyed) this.copiedCorrelation.set(false);
      }, 2000);
    } catch {
      this.notify.error(this.transloco.translate('tower.errors.generic'));
    }
  }

  protected async onSourceLinkClick(event: MouseEvent, link: TowerSourceRoute): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (this.submitting()) return;
    if (this.hasUnsavedChanges()) {
      const confirmed = await this.discardDialog().open();
      if (!confirmed || this.destroyed) return;
      this.undoResolveForm();
    }
    void this.router.navigate(link.commands, {
      ...(link.queryParams ? { queryParams: link.queryParams } : {}),
    });
  }

  protected retryLoad(): void {
    void this.loadException(this.exceptionId());
  }

  protected async requestClose(): Promise<void> {
    if (this.submitting()) return;
    if (this.hasUnsavedChanges()) {
      const confirmed = await this.discardDialog().open();
      if (!confirmed || this.destroyed) return;
      this.undoResolveForm();
    }
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.loadSeq++;
    this.closed.emit();
  }

  protected async submitResolve(): Promise<void> {
    if (this.submitting() || !this.showResolveSection()) return;
    this.submitted.set(true);

    const current = this.detail();
    const resCode = this.resolutionCode();
    if (!current || !resCode || this.hasEmptyReasons()) return;

    const rPicker = this.reasonPicker();
    if (rPicker && !rPicker.valid()) return;

    const eEditor = this.evidenceEditor();
    if (eEditor && !eEditor.valid()) return;

    const pickedReasonId = this.reasonValue().reasonCodeId;
    if (!pickedReasonId) return;

    // The backend accepts only a reason code here (never the id).
    const reasonCode = this.reasons().find((r) => r.id === pickedReasonId)?.code;
    if (!reasonCode) return;
    const note = this.reasonValue().note.trim() || null;
    const evidencePayload = { ...this.evidence() };
    const ctx = contextForException(current);

    const signature = JSON.stringify({
      id: current.id,
      version: current.version,
      resCode,
      reasonCode,
      note,
      evidencePayload,
    });
    if (this.rejectedPayloadSignatures.has(signature)) return;
    if (!this.pendingIdemKey || signature !== this.lastPayloadSignature) {
      this.pendingIdemKey = newIdempotencyKey();
      this.lastPayloadSignature = signature;
    }

    this.submitting.set(true);
    this.serverErrors.set({});
    try {
      const updated = await resolve(
        current.id,
        {
          resolutionCode: resCode,
          reasonCode,
          ...(note ? { note } : {}),
          evidence: evidencePayload,
        },
        current.version,
        this.pendingIdemKey,
        ctx,
      );
      if (this.destroyed) return;

      this.pendingIdemKey = null;
      this.lastPayloadSignature = '';
      this.detail.set(updated);
      this.resetFormFor(updated);
      this.notify.success(this.transloco.translate('tower.toast.resolved'));
      this.resolved.emit(updated);
      this.modal().close();
    } catch (error) {
      if (this.destroyed) return;
      const code = errorCodeOf(error);
      if (isIdempotencyMismatch(code)) {
        this.rejectedPayloadSignatures.add(signature);
        this.pendingIdemKey = null;
        this.lastPayloadSignature = '';
      }

      if (isTowerForbiddenError(error)) {
        this.isForbidden.set(true);
        this.forbidden.emit();
        return;
      }

      if (isTowerNotReadyError(error)) {
        this.notReadyMessage.set(translateTowerError(this.transloco, error));
        return;
      }

      if (isTowerTargetStaleError(error)) {
        this.conflictMessage.set(translateTowerError(this.transloco, error));
        this.conflictDialog().open();
        void this.refetchForConflict(current.id, ctx);
        this.refreshed.emit();
        return;
      }

      if (
        error instanceof ApiError &&
        error.status === 409 &&
        code === 'TRADE.CONCURRENCY.STALE_VERSION'
      ) {
        this.conflictMessage.set(null);
        this.conflictDialog().open();
        return;
      }

      if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
        const details = error.details;
        const message = (keys: string[]): string | undefined => {
          const messages = keys.flatMap((key) => details?.[key] ?? []);
          return messages.length ? messages.join(' ') : undefined;
        };
        const errors = {
          resolutionCode: message(['resolutionCode']),
          reason: message(['reasonCode', 'note']),
          evidence: message(Object.keys(details ?? {}).filter(
            (key) => key === 'evidence' || key.startsWith('evidence.'),
          )),
        };
        if (Object.values(errors).some(Boolean)) {
          this.serverErrors.set(errors);
          return;
        }
      }
      this.notify.error(translateTowerError(this.transloco, error));
      if (error instanceof ApiError && code === 'TRADE.CONTROL_TOWER.RESOLUTION_CONFLICT') {
        void this.loadException(current.id);
        this.resolved.emit(current);
      }
    } finally {
      this.submitting.set(false);
    }
  }

  protected onConflictReload(): void {
    void this.loadException(this.exceptionId());
  }

  protected async onConflictKeep(): Promise<void> {
    const current = this.detail();
    const id = current?.id ?? this.exceptionId();
    const ctx = current ? contextForException(current) : this.context();
    try {
      const fresh = await getException(id, ctx);
      if (this.destroyed) return;
      this.detail.set(fresh);
      this.pendingIdemKey = null;
      this.lastPayloadSignature = '';
      if (!isResolvableStatus(fresh.status)) {
        this.resetFormFor(fresh);
        this.notify.warning(
          this.transloco.translate('tower.errors.TRADE_CONTROL_TOWER_RESOLUTION_CONFLICT'),
        );
        this.resolved.emit(fresh);
      }
    } catch (error) {
      if (this.destroyed) return;
      if (isTowerForbiddenError(error)) {
        this.isForbidden.set(true);
        this.forbidden.emit();
        return;
      }
      this.notify.error(translateTowerError(this.transloco, error));
    }
  }

  private async refetchForConflict(id: string, ctx: TradeContext): Promise<void> {
    try {
      const fresh = await getException(id, ctx);
      if (this.destroyed) return;
      this.detail.set(fresh);
      this.pendingIdemKey = null;
      this.lastPayloadSignature = '';
      if (!isResolvableStatus(fresh.status)) {
        this.resetFormFor(fresh);
        this.resolved.emit(fresh);
      }
    } catch (error) {
      if (!this.destroyed && isTowerForbiddenError(error)) {
        this.isForbidden.set(true);
        this.forbidden.emit();
      }
    }
  }

  private async loadException(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.notFound.set(false);
    this.isForbidden.set(false);
    this.notReadyMessage.set(null);
    this.conflictMessage.set(null);

    try {
      const loaded = await getException(id, this.context());
      if (seq !== this.loadSeq || this.destroyed) return;
      this.detail.set(loaded);
      this.resetFormFor(loaded);
      this.loading.set(false);
    } catch (error) {
      if (seq !== this.loadSeq || this.destroyed) return;
      this.loading.set(false);
      if (isTowerForbiddenError(error)) {
        this.isForbidden.set(true);
        this.forbidden.emit();
      } else if (isTowerNotReadyError(error)) {
        this.notReadyMessage.set(translateTowerError(this.transloco, error));
      } else if (error instanceof ApiError && error.status === 404) {
        this.notFound.set(true);
      } else {
        this.loadFailed.set(true);
      }
    }
  }

  private async loadReasonsList(): Promise<void> {
    try {
      const list = await listReasons(RESOLVE_REASON_KIND, undefined, this.context());
      if (!this.destroyed) {
        this.reasons.set(list);
        this.reasonsLoaded.set(true);
      }
    } catch {
      if (!this.destroyed) {
        this.reasons.set([]);
        this.reasonsLoaded.set(true);
      }
    }
  }

  private resetFormFor(ex: TowerException): void {
    const defaultResolution = allowedCodesFor(ex)[0] ?? null;
    const defaultEvidence = initialEvidenceFor(ex);
    this.initialResolution = defaultResolution;
    this.initialEvidenceJson = JSON.stringify(defaultEvidence);
    this.resolutionCode.set(defaultResolution);
    this.reasonValue.set({ reasonCodeId: null, note: '' });
    this.evidence.set(defaultEvidence);
    this.submitted.set(false);
    this.pendingIdemKey = null;
    this.lastPayloadSignature = '';
  }
}
