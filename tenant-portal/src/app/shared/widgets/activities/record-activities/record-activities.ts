import { Component, DestroyRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlarm,
  tablerArrowLeft,
  tablerCalendarEvent,
  tablerCheck,
  tablerCircleDot,
  tablerEdit,
  tablerMail,
  tablerMap2,
  tablerPhone,
  tablerSquareCheck,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../ui/button/button';
import { ConfirmDialog } from '../../../ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../ui/modal/modal';
import { ActivitiesApi } from '../activities.api';
import { ApiError, errorMessage, fieldErrorsOf, isValidationError, isRetryableWriteError, writeErrorMessage } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { ConflictDialog } from '../../../ui/conflict-dialog/conflict-dialog';
import {
  Activity,
  ActivitySummary,
  ActivityType,
  DueState,
  MEETING_URL,
  TYPE_LOOK,
  TargetApp,
  dueState,
  isOpen,
} from '../activities.model';
import { ActivityForm } from '../activity-form/activity-form';
import { ActivityOutcome } from '../activity-outcome/activity-outcome';

export interface RecordTarget {
  app: TargetApp;
  type: string;
  id: string;
  label: string;
}

const DUE_BADGE: Record<DueState, string> = {
  OVERDUE: 'bg-danger text-on-danger',
  TODAY: 'bg-warning text-on-warning',
  UPCOMING: 'bg-success text-on-success',
};

const DUE_EDGE: Record<DueState, string> = {
  OVERDUE: 'bg-danger',
  TODAY: 'bg-warning',
  UPCOMING: 'bg-success',
};

@Component({
  selector: 'app-record-activities',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, ConflictDialog, Modal, ActivityForm, ActivityOutcome],
  viewProviders: [
    provideTranslocoScope('activities'),
  ],
  providers: [
    provideIcons({
      tablerCalendarEvent,
      tablerSquareCheck,
      tablerPhone,
      tablerUsers,
      tablerMail,
      tablerMap2,
      tablerAlarm,
      tablerCircleDot,
      tablerCheck,
      tablerEdit,
      tablerX,
      tablerArrowLeft,
    }),
  ],
  templateUrl: './record-activities.html',
})
export class RecordActivities {
  private static nextId = 0;
  protected readonly uid = `record-activities-${++RecordActivities.nextId}`;

  private readonly api = inject(ActivitiesApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly outcomeModal = viewChild.required(ActivityOutcome);
  protected readonly conflictOpen = signal(false);
  private conflictChoice: ((reload: boolean) => void) | null = null;
  private pendingAction: { key: string; bodyJson: string } | null = null;
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly activityForm = viewChild(ActivityForm);

  readonly changed = output<void>();

  protected readonly typeLook = TYPE_LOOK;
  protected readonly dueState = dueState;
  protected readonly isOpen = isOpen;

  protected readonly record = signal<RecordTarget | null>(null);
  protected readonly screen = signal<'open' | 'new' | 'edit'>('open');
  protected readonly initialType = signal<ActivityType>('TODO');
  protected readonly editingActivity = signal<Activity | null>(null);
  protected readonly summary = signal<ActivitySummary>({
    overdue: 0,
    today: 0,
    upcoming: 0,
    completedToday: 0,
    byStatus: [],
  });
  protected readonly openActivities = signal<Activity[]>([]);
  protected readonly openCount = signal(0);
  protected readonly totalCount = signal(0);
  protected readonly loading = signal(false);
  protected readonly actionBusy = signal(false);
  protected readonly outcomeBusy = signal(false);

  protected readonly formDirty = computed(() => this.activityForm()?.dirty() ?? false);
  protected readonly formSaving = computed(() => this.activityForm()?.saving() ?? false);
  protected readonly formStatus = computed(() => this.activityForm()?.status() ?? 'PLANNED');

  private allowClose = false;
  private confirmingDiscard = false;
  private loadSeq = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.resolveConflict(false));
  }

  open(
    record: RecordTarget,
    options?: { screen?: 'open' | 'new' | 'edit'; type?: ActivityType; activityId?: string },
  ): void {
    this.record.set(record);
    this.screen.set('open');
    this.editingActivity.set(null);
    this.initialType.set('TODO');
    this.summary.set({ overdue: 0, today: 0, upcoming: 0, completedToday: 0, byStatus: [] });
    this.openActivities.set([]);
    this.openCount.set(0);
    this.totalCount.set(0);
    this.allowClose = false;
    this.modal().open();
    void this.refreshData();
    if (options?.screen === 'new') {
      this.initialType.set(options.type ?? 'TODO');
      this.screen.set('new');
    } else if (options?.screen === 'edit' && options.activityId) {
      void this.openActivity({ id: options.activityId } as Activity);
    }
  }

  protected dueOf(activity: Activity): DueState {
    return dueState(activity) ?? 'UPCOMING';
  }

  protected dueBadgeClass(state: DueState): string {
    return DUE_BADGE[state];
  }

  protected dueEdgeClass(state: DueState): string {
    return DUE_EDGE[state];
  }

  protected formatSchedule(activity: Activity): string {
    const start = new Date(activity.dueAt);
    if (Number.isNaN(start.getTime())) return activity.dueAt;
    const locale = `${this.language()}-u-nu-latn`;
    const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false });

    if (!activity.endsAt) {
      return `${dateFmt.format(start)} · ${timeFmt.format(start)}`;
    }
    const end = new Date(activity.endsAt);
    if (Number.isNaN(end.getTime())) {
      return `${dateFmt.format(start)} · ${timeFmt.format(start)}`;
    }
    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();
    if (sameDay) {
      return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
    }
    return `${dateFmt.format(start)} ${timeFmt.format(start)} – ${dateFmt.format(end)} ${timeFmt.format(end)}`;
  }

  protected safeMeetingUrl(activity: Activity): string | null {
    const raw = activity.meetingUrl?.trim() ?? '';
    if (!raw || !MEETING_URL.test(raw)) return null;
    try {
      const parsed = new URL(raw);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
    } catch {
      return null;
    }
  }

  protected showViewAllSoon(): void {
    this.notify.info(this.transloco.translate('activities.viewAllSoon'));
  }

  protected async switchToOpen(): Promise<void> {
    if (this.screen() === 'open') return;
    if (!(await this.canLeaveCurrentScreen())) return;
    this.editingActivity.set(null);
    this.initialType.set('TODO');
    this.screen.set('open');
  }

  protected async switchToNew(type: ActivityType = 'TODO'): Promise<void> {
    if (this.screen() === 'new' && this.initialType() === type) return;
    if (!(await this.canLeaveCurrentScreen())) return;
    this.editingActivity.set(null);
    this.initialType.set(type);
    this.screen.set('new');
  }

  protected async openActivity(activity: Activity): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    try {
      const fresh = await this.api.getActivity(activity.id);
      this.editingActivity.set(fresh);
      this.screen.set('edit');
    } catch (error) {
      this.showErrorToast(error);
      await this.refreshData();
    } finally {
      this.actionBusy.set(false);
    }
  }

  protected async saveNew(addAnother: boolean): Promise<void> {
    const form = this.activityForm();
    if (!form) return;
    try {
      const created = await form.save();
      if (!created) return;
      this.notify.success(this.transloco.translate('activities.toasts.created'));
      await this.refreshData();
      this.changed.emit();
      if (addAnother) {
        form.resetForAnother();
      } else {
        this.initialType.set('TODO');
        this.screen.set('open');
      }
    } catch (error) {
      this.showErrorToast(error, true);
      await this.refreshData();
    }
  }

  protected async saveEdit(): Promise<void> {
    const form = this.activityForm();
    const current = this.editingActivity();
    if (!form || !current) return;
    try {
      const updated = await form.save();
      if (!updated) return;
      this.editingActivity.set(updated);
      this.notify.success(this.transloco.translate('activities.toasts.saved'));
      await this.refreshData();
      this.changed.emit();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ACTIVITY_VERSION_CONFLICT') {
        const reloadChosen = await this.chooseConflict();
        try {
          const fresh = await this.api.getActivity(current.id);
          this.editingActivity.set(fresh);
          if (reloadChosen) {
            form.reload(fresh);
          } else {
            form.rebase(fresh);
          }
        } catch (err) {
          this.showErrorToast(err);
        }
        await this.refreshData();
        return;
      }
      this.showErrorToast(error, true);
      if (error instanceof ApiError && (error.code === 'ACTIVITY_TERMINAL' || error.code === 'ACTIVITY_NOT_FOUND')) {
        this.screen.set('open');
        this.editingActivity.set(null);
      }
      await this.refreshData();
    }
  }

  protected async changeStatus(activity: Activity, nextStatus: 'PLANNED' | 'IN_PROGRESS'): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    try {
      const updated = await this.writeAction({ id: activity.id, version: activity.version, status: nextStatus }, (key) =>
        this.api.setActivityStatus(activity.id, activity.version, nextStatus, key));
      this.editingActivity.set(updated);
      const form = this.activityForm();
      if (form) {
        if (form.dirty()) form.rebase(updated);
        else form.reload(updated);
      }
      this.notify.success(
        this.transloco.translate(
          nextStatus === 'IN_PROGRESS' ? 'activities.toasts.started' : 'activities.toasts.movedBack',
        ),
      );
      await this.refreshData();
      this.changed.emit();
    } catch (error) {
      await this.reloadOrExitEdit(activity.id, error);
      await this.refreshData();
    } finally {
      this.actionBusy.set(false);
    }
  }

  protected async finishActivity(activity: Activity, mode: 'complete' | 'cancel'): Promise<void> {
    if (this.actionBusy() || this.outcomeBusy()) return;
    await this.outcomeModal().open(activity, mode, async (note) => {
      this.outcomeBusy.set(true);
      this.actionBusy.set(true);
      try {
        if (mode === 'complete') {
          await this.writeAction({ id: activity.id, version: activity.version, outcome: note }, (key) =>
            this.api.completeActivity(activity.id, activity.version, note, key));
        } else {
          await this.writeAction({ id: activity.id, version: activity.version, reason: note }, (key) =>
            this.api.cancelActivity(activity.id, activity.version, note, key));
        }
        this.notify.success(this.transloco.translate(mode === 'complete' ? 'activities.toasts.completed' : 'activities.toasts.cancelled'));
        if (this.editingActivity()?.id === activity.id) {
          this.screen.set('open');
          this.editingActivity.set(null);
        }
        await this.refreshData();
        this.changed.emit();
        return true;
      } catch (error) {
        const fields = fieldErrorsOf(error);
        if (isValidationError(error) && (fields['outcome'] || fields['reason'])) {
          this.outcomeModal().setServerError(this.transloco.translate('activities.errors.CORE_VALIDATION_FAILED'));
          return false;
        }
        if (error instanceof ApiError && error.code === 'ACTIVITY_VERSION_CONFLICT') {
          const reload = await this.chooseConflict();
          try {
            activity = await this.api.getActivity(activity.id);
            if (this.editingActivity()?.id === activity.id) {
              this.editingActivity.set(activity);
              if (reload) this.activityForm()?.reload(activity);
              else this.activityForm()?.rebase(activity);
            }
            if (reload) {
              this.outcomeModal().clearNote();
              await this.refreshData();
              return true;
            }
          } catch (freshError) {
            this.showErrorToast(freshError);
          }
          return false;
        }
        this.showErrorToast(error, true);
        if (error instanceof ApiError && (error.code === 'ACTIVITY_TERMINAL' || error.status === 404)) {
          this.screen.set('open');
          this.editingActivity.set(null);
          await this.refreshData();
          return true;
        }
        return false;
      } finally {
        this.outcomeBusy.set(false);
        this.actionBusy.set(false);
      }
    });
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.formDirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
    this.screen.set('open');
    this.editingActivity.set(null);
    this.initialType.set('TODO');
  }

  private async confirmModalClose(): Promise<void> {
    if (await this.canLeaveCurrentScreen()) {
      this.allowClose = true;
      this.modal().close();
    }
  }

  private async canLeaveCurrentScreen(): Promise<boolean> {
    if (!this.formDirty()) return true;
    if (this.confirmingDiscard) return false;
    this.confirmingDiscard = true;
    try {
      return await this.discardDialog().open();
    } finally {
      this.confirmingDiscard = false;
    }
  }

  private async reloadOrExitEdit(id: string, error: unknown): Promise<void> {
    if (error instanceof ApiError && error.code === 'ACTIVITY_VERSION_CONFLICT') {
      const reload = await this.chooseConflict();
      try {
        const fresh = await this.api.getActivity(id);
        this.editingActivity.set(fresh);
        const form = this.activityForm();
        if (form) {
          if (reload) form.reload(fresh);
          else form.rebase(fresh);
        }
        return;
      } catch (err) {
        this.showErrorToast(err);
      }
    }
    this.showErrorToast(error, true);
    if (error instanceof ApiError && (error.code === 'ACTIVITY_TERMINAL' || error.status === 404)) {
      this.screen.set('open');
      this.editingActivity.set(null);
    }
  }

  private async refreshData(): Promise<void> {
    const targetRecord = this.record();
    if (!targetRecord) return;
    const seq = ++this.loadSeq;
    this.loading.set(true);
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    try {
      const [summary, openPage, total] = await Promise.all([
        this.api.activitySummary(targetRecord, dayStart, dayEnd),
        this.api.listActivities({
          targetApp: targetRecord.app,
          targetType: targetRecord.type,
          targetId: targetRecord.id,
          statuses: ['PLANNED', 'IN_PROGRESS'],
          page: 1,
          limit: 100,
        }),
        this.api.listActivities({
          targetApp: targetRecord.app, targetType: targetRecord.type, targetId: targetRecord.id, limit: 1,
        }),
      ]);
      if (seq !== this.loadSeq || this.record()?.id !== targetRecord.id) return;
      const sorted = [...openPage.data].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
      this.summary.set(summary);
      this.openActivities.set(sorted);
      this.openCount.set(openPage.meta.total);
      this.totalCount.set(total.meta.total);
    } catch (error) {
      if (seq === this.loadSeq) {
        this.showErrorToast(error);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected onConflictOpenChange(open: boolean): void {
    this.conflictOpen.set(open);
    if (!open) this.resolveConflict(false);
  }

  protected resolveConflict(reload: boolean): void {
    this.conflictOpen.set(false);
    this.conflictChoice?.(reload);
    this.conflictChoice = null;
  }

  private chooseConflict(): Promise<boolean> {
    this.conflictOpen.set(true);
    return new Promise((resolve) => { this.conflictChoice = resolve; });
  }

  private async writeAction(action: unknown, request: (key: string) => Promise<Activity>): Promise<Activity> {
    const bodyJson = JSON.stringify(action);
    if (this.pendingAction?.bodyJson !== bodyJson) this.pendingAction = { key: newIdempotencyKey(), bodyJson };
    try {
      const result = await request(this.pendingAction.key);
      this.pendingAction = null;
      return result;
    } catch (error) {
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.pendingAction = null;
      throw error;
    }
  }

  private showErrorToast(error: unknown, write = false): void {
    this.notify.error(write
      ? writeErrorMessage(error, 'activities', this.transloco)
      : errorMessage(error, 'activities', this.transloco));
  }
}
