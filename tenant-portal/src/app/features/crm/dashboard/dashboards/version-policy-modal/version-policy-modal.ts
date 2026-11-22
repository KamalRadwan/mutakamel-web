import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowBackUp, tablerExclamationCircle, tablerVersions } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import type { Visualization } from '../../../../../shared/ui/chart/chart.model';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Segmented, type SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { ApiError, errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { getVersionBinding, previewVersionPolicy, setVersionPolicy } from '../dashboards.api';
import type { VersionBinding } from '../dashboards.model';

interface VersionPolicyPreview {
  current: VersionBinding;
  proposed: {
    versionPolicy: string;
    pinnedVersionNumber: number | null;
    selectedVersionNumber: number;
    placement: { x: number; y: number; w: number; h: number };
    visualizationType: Visualization;
    changed: boolean;
    layoutChanged: boolean;
  };
}

let nextPolicyModalId = 0;

function clampVersion(version: number, maxVersion: number): number {
  const upper = Math.max(1, maxVersion);
  return Math.min(Math.max(1, Math.trunc(version)), upper);
}

@Component({
  selector: 'app-version-policy-modal',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal, Segmented],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-dash-edit', alias: 'dashEdit' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerVersions, tablerExclamationCircle, tablerArrowBackUp }),
  ],
  templateUrl: './version-policy-modal.html',
})
export class VersionPolicyModal {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);

  protected readonly uid = `version-policy-modal-${++nextPolicyModalId}`;
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly previewing = signal(false);
  protected readonly saving = signal(false);
  protected readonly binding = signal<VersionBinding | null>(null);
  protected readonly policy = signal<'FOLLOW_ACTIVE' | 'PINNED'>('FOLLOW_ACTIVE');
  protected readonly pinnedVersion = signal<number>(1);
  protected readonly preview = signal<VersionPolicyPreview | null>(null);

  protected readonly activeHint = signal<string | null>(null);
  protected readonly tooltipPlace = signal({ top: 0, start: 0 });

  private dashboardId = '';
  private placementId = '';
  private resolver: ((result: VersionBinding | null) => void) | null = null;
  private loadSeq = 0;
  private previewSeq = 0;

  protected readonly policyOptions = computed<SegmentedOption[]>(() => {
    this.language();
    this.i18n();
    return [
      { value: 'FOLLOW_ACTIVE', label: this.transloco.translate('dashEdit.followActive') },
      { value: 'PINNED', label: this.transloco.translate('dashEdit.pin') },
    ];
  });

  protected readonly versionOptions = computed<DropdownOption<number>[]>(() => {
    this.language();
    this.i18n();
    const active = Math.max(1, this.binding()?.activeVersionNumber ?? 1);
    const list: DropdownOption<number>[] = [];
    for (let n = 1; n <= active; n++) {
      list.push({
        value: n,
        label: this.transloco.translate('dashEdit.versionOption', { n }),
      });
    }
    return list;
  });

  protected readonly dirty = computed(() => {
    const b = this.binding();
    if (!b) return false;
    const currentPolicy = this.policy();
    if (currentPolicy !== b.versionPolicy) return true;
    return currentPolicy === 'PINNED' && this.pinnedVersion() !== b.pinnedVersionNumber;
  });

  protected readonly proposedNewSize = computed(() => {
    const proposed = this.preview()?.proposed;
    return proposed?.layoutChanged ? proposed.placement : null;
  });

  protected readonly canSave = computed(
    () =>
      !this.loading() &&
      !this.loadFailed() &&
      !this.previewing() &&
      !this.saving() &&
      this.dirty() &&
      !!this.preview()?.proposed.changed,
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.loadSeq++;
      this.previewSeq++;
      this.settle(null);
    });
  }

  open(dashboardId: string, placementId: string): Promise<VersionBinding | null> {
    this.settle(null);
    this.dashboardId = dashboardId;
    this.placementId = placementId;
    this.binding.set(null);
    this.policy.set('FOLLOW_ACTIVE');
    this.pinnedVersion.set(1);
    this.preview.set(null);
    this.loadFailed.set(false);
    this.previewing.set(false);
    this.saving.set(false);
    this.activeHint.set(null);

    this.modal().open();
    void this.loadBinding();

    return new Promise<VersionBinding | null>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected retryLoad(): void {
    void this.loadBinding();
  }

  protected onPolicyChange(next: string | null): void {
    if (next !== 'FOLLOW_ACTIVE' && next !== 'PINNED') return;
    if (next === this.policy()) return;
    this.policy.set(next);

    const b = this.binding();
    if (next === 'PINNED' && b) {
      const candidate = b.pinnedVersionNumber ?? b.selectedVersionNumber ?? b.activeVersionNumber;
      this.pinnedVersion.set(clampVersion(candidate, b.activeVersionNumber));
    }

    if (this.dirty()) {
      void this.runPreview();
    } else {
      this.previewSeq++;
      this.preview.set(null);
    }
  }

  protected onPinnedVersionChange(next: number): void {
    if (next === this.pinnedVersion()) return;
    this.pinnedVersion.set(next);
    if (this.dirty()) {
      void this.runPreview();
    } else {
      this.previewSeq++;
      this.preview.set(null);
    }
  }

  protected undo(): void {
    const b = this.binding();
    if (!b || !this.dirty() || this.saving()) return;
    this.previewSeq++;
    this.previewing.set(false);
    this.policy.set(b.versionPolicy);
    this.pinnedVersion.set(
      clampVersion(b.pinnedVersionNumber ?? b.selectedVersionNumber ?? b.activeVersionNumber, b.activeVersionNumber),
    );
    this.preview.set(null);
  }

  protected async save(): Promise<void> {
    const b = this.binding();
    const prev = this.preview();
    if (!b || !prev || !this.canSave()) return;

    const currentPolicy = this.policy();
    const pinnedVersionNumber = currentPolicy === 'PINNED' ? this.pinnedVersion() : null;

    this.saving.set(true);
    try {
      const updated = await setVersionPolicy(this.dashboardId, this.placementId, {
        versionPolicy: currentPolicy,
        pinnedVersionNumber,
        expectedDashboardRevision: b.dashboardRevision,
        expectedWidgetRevision: b.widgetRevision,
        expectedGovernanceRevision: b.governanceRevision,
        expectedSelectedVersionNumber: prev.proposed.selectedVersionNumber,
        expectedPlacement: prev.proposed.placement,
      });
      this.settle(updated);
      this.modal().close();
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
      if (isStalePlacementError(error)) {
        await this.refreshAndRepreview();
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected cancel(): void {
    if (this.saving()) return;
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.loadSeq++;
    this.previewSeq++;
    this.activeHint.set(null);
    this.settle(null);
  }

  protected showHint(key: string, triggerEl: HTMLElement, rowEl: HTMLElement, tipEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const row = rectInPage(rowEl);
    const tip = rectInPage(tipEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tip.width > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tip.width;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tip.width);
    }

    const top = Math.max(8, row.top + (row.height - tip.height) / 2);
    this.tooltipPlace.set({ top, start });
    this.activeHint.set(key);
  }

  protected hideHint(): void {
    this.activeHint.set(null);
  }

  private async loadBinding(): Promise<void> {
    const seq = ++this.loadSeq;
    this.previewSeq++;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.preview.set(null);

    try {
      const loaded = await getVersionBinding(this.dashboardId, this.placementId);
      if (seq !== this.loadSeq) return;
      this.applyBinding(loaded, true);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async runPreview(): Promise<void> {
    const b = this.binding();
    if (!b) return;
    const seq = ++this.previewSeq;
    const currentPolicy = this.policy();
    const pinnedVersionNumber = currentPolicy === 'PINNED' ? this.pinnedVersion() : null;

    this.previewing.set(true);
    try {
      const result = await previewVersionPolicy(this.dashboardId, this.placementId, {
        versionPolicy: currentPolicy,
        pinnedVersionNumber,
        expectedDashboardRevision: b.dashboardRevision,
        expectedWidgetRevision: b.widgetRevision,
        expectedGovernanceRevision: b.governanceRevision,
      });
      if (seq !== this.previewSeq) return;
      this.preview.set(result);
    } catch (error) {
      if (seq !== this.previewSeq) return;
      this.preview.set(null);
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
      if (isStalePlacementError(error)) {
        await this.refreshAndRepreview();
      }
    } finally {
      if (seq === this.previewSeq) {
        this.previewing.set(false);
      }
    }
  }

  private async refreshAndRepreview(): Promise<void> {
    const seq = ++this.loadSeq;
    try {
      const fresh = await getVersionBinding(this.dashboardId, this.placementId);
      if (seq !== this.loadSeq) return;
      this.applyBinding(fresh, false);
      if (this.dirty()) {
        await this.runPreview();
      } else {
        this.preview.set(null);
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    }
  }

  private applyBinding(loaded: VersionBinding, resetDraft: boolean): void {
    this.binding.set(loaded);
    if (resetDraft) {
      this.policy.set(loaded.versionPolicy);
      this.pinnedVersion.set(
        clampVersion(
          loaded.pinnedVersionNumber ?? loaded.selectedVersionNumber ?? loaded.activeVersionNumber,
          loaded.activeVersionNumber,
        ),
      );
      this.preview.set(null);
    } else if (this.policy() === 'PINNED') {
      this.pinnedVersion.set(clampVersion(this.pinnedVersion(), loaded.activeVersionNumber));
    }
  }

  private settle(result: VersionBinding | null): void {
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(result);
  }
}

function isStalePlacementError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === 'CRM_DASHBOARD_PLACEMENT_VERSION_STALE';
}
