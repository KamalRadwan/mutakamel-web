import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { provideIcons } from '@ng-icons/core';
import { tablerPin } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../../../../shared/widgets/dashboard/analytics-api';
import type { Panel } from '../../../../../shared/widgets/dashboard/analytics.model';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { listPinTargets, pinPanel } from '../report.api';
import type { PinTarget } from '../report.model';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';
import { fieldErrorsOf } from '../../../../../core/api/api-errors';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { reportErrorMessage, reportIdempotencyMismatch, reportWriteReadOnly, reportWriteRetryable } from '../report-errors';

let nextPinModalId = 0;

@Component({
  selector: 'app-report-pin-modal',
  imports: [TranslocoPipe, Button, Dropdown, Field, Modal, ConflictDialog],
  providers: [provideIcons({ tablerPin })],
  templateUrl: './pin-modal.html',
})
export class PinModal {
  readonly becameReadOnly = output<void>();
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly reportScope = toSignal(selectScopeTranslation(this.transloco, 'crm-rep-report', 'repReport'));
  private readonly modal = viewChild.required<Modal>('modal');

  protected readonly uid = `rep-pin-${++nextPinModalId}`;
  protected readonly reportKey = signal('');
  protected readonly pinnablePanels = signal<Panel[]>([]);
  protected readonly selectedPanelKey = signal('');
  protected readonly targets = signal<PinTarget[]>([]);
  protected readonly selectedDashboardId = signal('');
  protected readonly loadingTargets = signal(false);
  protected readonly submitting = signal(false);
  protected readonly attemptedSubmit = signal(false);
  protected readonly conflictOpen = signal(false);
  protected readonly readOnly = signal(false);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly canPin = computed(() => can('crm.dashboards.update') && can('crm.widgets.create') && !this.readOnly());

  private targetSeq = 0;
  private lastFingerprint: string | null = null;
  private lastIdemKey: string | null = null;

  protected readonly panelOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.pinnablePanels().map((panel) => ({
      value: panel.panelKey,
      label: lang === 'ar' ? panel.title.ar : panel.title.en,
    }));
  });

  protected readonly dashboardOptions = computed<DropdownOption<string>[]>(() =>
    this.targets().map((target) => ({
      value: target.id,
      label: target.name,
    })),
  );

  protected readonly panelError = computed<string | null>(() => {
    this.i18n();
    this.reportScope();
    if (!this.attemptedSubmit()) return null;
    return this.fieldErrors()['panelKey']?.join(' ') || (this.selectedPanelKey() ? null : this.transloco.translate('repReport.panelRequired'));
  });

  protected readonly dashboardError = computed<string | null>(() => {
    this.i18n();
    this.reportScope();
    if (!this.attemptedSubmit()) return null;
    return this.fieldErrors()['dashboardId']?.join(' ') || (this.selectedDashboardId() ? null : this.transloco.translate('repReport.dashboardRequired'));
  });

  open(reportKey: string, panels: readonly Panel[], preselectedPanelKey?: string | null): void {
    if (!this.canPin()) return;
    const pinnable = panels.filter((p) => Boolean(p.pinnable));
    const initialPanel =
      preselectedPanelKey && pinnable.some((p) => p.panelKey === preselectedPanelKey)
        ? preselectedPanelKey
        : (pinnable[0]?.panelKey ?? '');

    this.reportKey.set(reportKey);
    this.pinnablePanels.set(pinnable);
    this.selectedPanelKey.set(initialPanel);
    this.attemptedSubmit.set(false);
    this.fieldErrors.set({});
    this.conflictOpen.set(false);
    this.submitting.set(false);
    this.lastFingerprint = null;
    this.lastIdemKey = null;

    this.modal().open();
    void this.loadTargets();
  }

  protected close(): void {
    if (this.submitting()) return;
    this.modal().close();
  }

  protected onClosed(): void {
    this.targetSeq++;
    this.attemptedSubmit.set(false);
    this.submitting.set(false);
    this.loadingTargets.set(false);
    this.lastFingerprint = null;
    this.lastIdemKey = null;
  }

  protected async submit(): Promise<void> {
    if (this.submitting() || this.loadingTargets() || !this.canPin() || this.conflictOpen()) return;
    this.attemptedSubmit.set(true);
    this.fieldErrors.set({});

    const reportKey = this.reportKey();
    const panelKey = this.selectedPanelKey();
    const dashboardId = this.selectedDashboardId();
    const target = this.targets().find((t) => t.id === dashboardId);
    if (!reportKey || !panelKey || !target) return;

    const fingerprint = `${reportKey}:${panelKey}:${target.id}:${target.revision}`;
    if (fingerprint !== this.lastFingerprint || !this.lastIdemKey) {
      this.lastFingerprint = fingerprint;
      this.lastIdemKey = newIdempotencyKey();
    }

    this.submitting.set(true);
    try {
      await pinPanel(
        reportKey,
        panelKey,
        { dashboardId: target.id, revision: target.revision },
        this.lastIdemKey,
      );
      this.lastFingerprint = null;
      this.lastIdemKey = null;
      this.notify.success(this.transloco.translate('repReport.pinned', { name: target.name }));
      this.modal().close();
    } catch (err) {
      if (!reportWriteRetryable(err)) {
        this.lastFingerprint = null;
        this.lastIdemKey = null;
      }
      if (reportWriteReadOnly(err)) {
        this.readOnly.set(true);
        this.becameReadOnly.emit();
      }
      if (reportIdempotencyMismatch(err)) {
        this.notify.error(reportErrorMessage(this.transloco, err, 'repReport'));
        await this.loadTargets();
      } else if (err instanceof ApiError && err.status === 409 && /_(STALE|CONFLICT)$/.test(err.code)) {
        this.conflictOpen.set(true);
      } else {
        this.fieldErrors.set(fieldErrorsOf(err));
        if (!this.fieldErrors()['dashboardId'] && !this.fieldErrors()['panelKey']) {
          this.notify.error(reportErrorMessage(this.transloco, err, 'repReport'));
        }
      }
    } finally {
      this.submitting.set(false);
    }
  }

  protected async resolveConflict(keepChanges: boolean): Promise<void> {
    this.conflictOpen.set(false);
    if (!keepChanges) {
      this.selectedDashboardId.set('');
      this.selectedPanelKey.set(this.pinnablePanels()[0]?.panelKey ?? '');
    }
    await this.loadTargets();
  }

  private async loadTargets(): Promise<void> {
    const seq = ++this.targetSeq;
    this.loadingTargets.set(true);
    try {
      const list = await listPinTargets();
      if (seq !== this.targetSeq) return;
      this.targets.set(list);
      const currentId = this.selectedDashboardId();
      if (!currentId || !list.some((t) => t.id === currentId)) {
        this.selectedDashboardId.set(list[0]?.id ?? '');
      }
    } catch (err) {
      if (seq !== this.targetSeq) return;
      this.targets.set([]);
      this.selectedDashboardId.set('');
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(err))));
    } finally {
      if (seq === this.targetSeq) {
        this.loadingTargets.set(false);
      }
    }
  }
}
