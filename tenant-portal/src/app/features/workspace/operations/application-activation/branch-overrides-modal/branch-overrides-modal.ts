import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuildingStore, tablerExclamationCircle, tablerLock, tablerRefresh } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import type { WorkspaceBranch } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { ActivationApi } from '../activation.api';
import { BranchOverrideMode, BranchOverrideResource } from '../activation.model';
import { ReasonModal } from '../reason-modal/reason-modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { ApiError, correlationIdOf, errorCodeOf, errorMessage, writeErrorMessage } from '../../../../../core/api/api-errors';

export interface BranchOverridesContext {
  companyId: string;
  companyName: string;
  appKey: string;
  addonKey: string;
  addonName: string;
  companyAddonExists: boolean;
  companyApplicationExists: boolean;
}

interface BranchOverrideRow {
  branch: WorkspaceBranch;
  resource: BranchOverrideResource | null;
  failed: boolean;
  forbidden: boolean;
}

const SKELETON_ROWS = [1, 2, 3, 4] as const;
const MAX_CONCURRENT_READS = 6;

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        const value = await worker(items[index]);
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };

  const count = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: count }, () => runWorker()));
  return results;
}

/** Per-branch authority refusals remain visible on their own row. */
function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && !error.code.startsWith('TENANT_MAINTENANCE_');
}

@Component({
  selector: 'app-branch-overrides-modal',
  imports: [TranslocoPipe, NgIcon, Button, Modal, Segmented, ReasonModal],
  providers: [provideIcons({ tablerBuildingStore, tablerExclamationCircle, tablerLock, tablerRefresh })],
  viewProviders: [provideTranslocoScope('settings', { scope: 'ws-app-activation', alias: 'wsActivation' })],
  templateUrl: './branch-overrides-modal.html',
})
export class BranchOverridesModal {
  private static nextId = 0;
  protected readonly uid = `branch-overrides-${++BranchOverridesModal.nextId}`;

  /** One "!" hint per column header; every row's control points at it with aria-describedby. */
  protected readonly colTip = signal<string | null>(null);
  protected readonly colTipPlace = signal({ top: 0, start: 0 });

  protected showColTip(key: string, trigger: HTMLElement, tip: HTMLElement): void {
    const rect = rectInPage(trigger);
    const box = rectInPage(tip);
    const { width } = viewport();
    const rtl = getComputedStyle(trigger).direction === 'rtl';
    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + box.width > width - 8) {
      const alt = (rtl ? width - rect.right : rect.left) - 6 - box.width;
      start = alt >= 8 ? alt : Math.max(8, width - 8 - box.width);
    }
    this.colTipPlace.set({ top: Math.max(8, rect.bottom - box.height), start });
    this.colTip.set(key);
  }

  protected hideColTip(): void {
    this.colTip.set(null);
  }

  // WCAG 1.4.13: Escape dismisses an open hint without closing the surrounding page or modal.
  protected onColTipEscape(event: Event): void {
    if (this.colTip() === null) return;
    event.stopPropagation();
    this.colTip.set(null);
  }
  private readonly notify = inject(Notify);
  private readonly api = inject(ActivationApi);
  private readonly lookups = inject(WorkspaceLookups);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly reasonModal = viewChild.required(ReasonModal);

  readonly canManageBranch = input<(branchId: string) => boolean>(() => false);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly context = signal<BranchOverridesContext | null>(null);
  protected readonly rows = signal<BranchOverrideRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly correlationId = signal<string | null>(null);
  protected readonly busyBranchIds = signal<ReadonlySet<string>>(new Set());

  protected readonly modalTitle = computed(() => {
    this.i18n();
    const ctx = this.context();
    if (!ctx) return '';
    return this.transloco.translate('wsActivation.branchModal.title', {
      addon: ctx.addonName,
      company: ctx.companyName,
    });
  });

  private loadSeq = 0;

  open(context: BranchOverridesContext): void {
    this.context.set(context);
    this.rows.set([]);
    this.forbidden.set(false);
    this.loadFailed.set(false);
    this.correlationId.set(null);
    this.modal().open();
    void this.load();
  }

  close(): void {
    this.modal().close();
  }

  protected reload(): void {
    void this.load();
  }

  protected effectiveMode(row: BranchOverrideRow): BranchOverrideMode {
    return row.resource?.mode === 'DISABLED' ? 'DISABLED' : 'INHERIT';
  }

  /**
   * DISABLED needs the Company Application and Addon bindings to exist; INHERIT also needs the Company
   * Application and Addon both on (branch-addon-restriction / branch-addon-inheritance services, else 409).
   */
  protected canSelect(row: BranchOverrideRow, mode: BranchOverrideMode): boolean {
    const resource = row.resource;
    if (!this.canManageBranch()(row.branch.id) || !resource || this.busyBranchIds().has(row.branch.id)) return false;
    if (!this.context()?.companyAddonExists || !this.context()?.companyApplicationExists) return false;
    return mode === 'DISABLED' || (resource.companyApplicationEnabled && resource.companyAddonEnabled);
  }

  /** Why the setting cannot change, for the row tooltip; null when it can. */
  protected blockedReason(row: BranchOverrideRow): string | null {
    this.i18n();
    if (!row.resource?.companyAddonEnabled) return this.transloco.translate('wsActivation.branchModal.companyAddonOff');
    if (!row.resource.companyApplicationEnabled) return this.transloco.translate('wsActivation.branchModal.companyAppOff');
    return null;
  }

  protected segmentOptions(row: BranchOverrideRow): SegmentedOption[] {
    this.i18n();
    return [
      {
        value: 'INHERIT',
        label: this.transloco.translate('wsActivation.branchModal.followCompany'),
        disabled: !this.canSelect(row, 'INHERIT'),
      },
      {
        value: 'DISABLED',
        label: this.transloco.translate('wsActivation.branchModal.off'),
        disabled: !this.canSelect(row, 'DISABLED'),
      },
    ];
  }

  protected onModeSelect(row: BranchOverrideRow, next: string | null, seg: Segmented): void {
    const current = this.effectiveMode(row);
    seg.value.set(current);
    if (next !== 'INHERIT' && next !== 'DISABLED') return;
    if (next === current || !this.canSelect(row, next)) return;

    this.openReasonForBranch(row, next);
  }

  protected onModalClosed(): void {
    this.loadSeq += 1;
    this.loading.set(false);
  }

  private openReasonForBranch(row: BranchOverrideRow, nextMode: BranchOverrideMode): void {
    const ctx = this.context();
    const resource = row.resource;
    if (!ctx || !resource) return;

    const isDisabling = nextMode === 'DISABLED';
    const title = this.transloco.translate(
      isDisabling
        ? 'wsActivation.branchModal.turnDisabledTitle'
        : 'wsActivation.branchModal.turnInheritTitle',
      { addon: ctx.addonName, branch: row.branch.name },
    );
    const confirmLabel = this.transloco.translate(
      isDisabling
        ? 'wsActivation.branchModal.turnDisabledConfirm'
        : 'wsActivation.branchModal.turnInheritConfirm',
    );

    let revision = resource.revision;
    this.reasonModal().open(
      {
        title,
        confirmLabel,
        danger: isDisabling,
        icon: 'tablerBuildingStore',
        tile: isDisabling ? 'bg-icon-red' : 'bg-icon-green',
      },
      async (reason, idempotencyKey) => {
        this.setBranchBusy(row.branch.id, true);
        try {
          const result = await this.api.setBranchOverride(
            row.branch.id,
            ctx.appKey,
            ctx.addonKey,
            {
              expectedOverrideRevision: revision,
              mode: nextMode,
              reason,
            },
            idempotencyKey,
          );
          if (!result.changed) this.notify.info(this.transloco.translate('wsActivation.toast.alreadyInState'));
          else this.notify.success(this.transloco.translate('wsActivation.branchModal.toastSaved'));
          await this.refreshBranchRow(row.branch.id, ctx.appKey, ctx.addonKey);
          return true;
        } catch (error) {
          this.reasonModal().retainKeyFor(error);
          const code = errorCodeOf(error);
          if (code === 'ADDON_REVISION_STALE' || code === 'APPLICATION_ACTIVATION_REVISION_STALE') {
            this.reasonModal().showConflict(async (keep) => {
              if (!keep) { await this.load(); return; }
              const fresh = await this.api.getBranchAddon(row.branch.id, ctx.appKey, ctx.addonKey);
              revision = fresh.resource.revision;
            });
          } else {
            this.notify.error(writeErrorMessage(error, 'wsActivation', this.transloco));
          }
          return false;
        } finally {
          this.setBranchBusy(row.branch.id, false);
        }
      },
    );
  }

  protected async refreshBranchRow(branchId: string, appKey: string, addonKey: string): Promise<void> {
    try {
      const singleton = await this.api.getBranchAddon(branchId, appKey, addonKey);
      this.rows.update((current) =>
        current.map((item) =>
          item.branch.id === branchId
            ? { branch: item.branch, resource: singleton.resource, failed: false, forbidden: false }
            : item,
        ),
      );
    } catch (error) {
      this.rows.update((rows) => rows.map((row) => row.branch.id === branchId
        ? { ...row, resource: null, failed: !isForbiddenError(error), forbidden: isForbiddenError(error) } : row));
    }
  }

  private async load(): Promise<void> {
    const ctx = this.context();
    if (!ctx) return;

    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.forbidden.set(false);
    this.loadFailed.set(false);
    this.correlationId.set(null);

    try {
      const branches = await this.lookups.allBranches({ companyId: ctx.companyId });
      if (seq !== this.loadSeq) return;

      if (branches.length === 0) {
        this.rows.set([]);
        return;
      }

      const settled = await mapWithConcurrency(branches, MAX_CONCURRENT_READS, (branch) =>
        this.api.getBranchAddon(branch.id, ctx.appKey, ctx.addonKey),
      );
      if (seq !== this.loadSeq) return;

      const nextRows: BranchOverrideRow[] = branches.map((branch, idx) => {
        const res = settled[idx];
        if (res.status === 'fulfilled') {
          return { branch, resource: res.value.resource, failed: false, forbidden: false };
        }
        return { branch, resource: null, failed: !isForbiddenError(res.reason), forbidden: isForbiddenError(res.reason) };
      });
      this.rows.set(nextRows);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
      } else if (error instanceof ApiError && error.status !== 0 && error.status < 500) {
        this.notify.error(errorMessage(error, 'wsActivation', this.transloco));
      } else {
        this.loadFailed.set(true);
        this.correlationId.set(correlationIdOf(error));
      }
      this.rows.set([]);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private setBranchBusy(branchId: string, busy: boolean): void {
    this.busyBranchIds.update((current) => {
      const next = new Set(current);
      if (busy) next.add(branchId);
      else next.delete(branchId);
      return next;
    });
  }
}
