import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerArrowRight, tablerLoader2, tablerPackageImport } from '@ng-icons/tabler-icons';
import { catalogueNames } from '../../../billing/shared/catalogue-names';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import {
  badgeClassForTone,
  eligibilityBadgeClass,
  eligibilityOf,
  riskTone,
  snapshotDiverges,
} from '../updates.logic';
import { ApplyDialogPhase, SnapshotItem, TenantAvailableUpdate } from '../updates.model';

@Component({
  selector: 'app-apply-dialog',
  imports: [NgIcon, TranslocoPipe, Button, Checkbox, Field, Modal, SettingsNotice],
  providers: [provideIcons({ tablerAlertTriangle, tablerArrowRight, tablerLoader2, tablerPackageImport })],
  templateUrl: './apply-dialog.html',
})
export class ApplyDialog {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly names = catalogueNames(this.transloco);

  private readonly modal = viewChild.required(Modal);

  readonly snapshot = input<readonly SnapshotItem[]>([]);
  readonly liveRows = input<readonly TenantAvailableUpdate[]>([]);
  readonly phase = input<ApplyDialogPhase>('confirm');
  readonly errorCode = input<string | null>(null);
  readonly submitting = input(false);

  readonly confirmed = output<void>();
  readonly retry = output<void>();
  readonly reload = output<void>();
  readonly closed = output<void>();
  readonly diverged = output<void>();

  protected readonly consent = signal(false);
  private readonly isOpen = signal(false);

  protected readonly hasDiverged = computed(
    () =>
      this.isOpen() &&
      this.phase() === 'confirm' &&
      !this.submitting() &&
      snapshotDiverges(this.snapshot(), this.liveRows()),
  );

  protected readonly effectivePhase = computed<ApplyDialogPhase>(() =>
    this.hasDiverged() ? 'stale' : this.phase(),
  );

  protected readonly hasRequirements = computed(() =>
    this.snapshot().some((item) => item.requiresBackup || item.requiresMaintenance),
  );

  protected readonly headerIcon = computed(() =>
    this.effectivePhase() === 'confirm' ? 'tablerPackageImport' : 'tablerAlertTriangle',
  );

  protected readonly headerTile = computed(() =>
    this.effectivePhase() === 'confirm' ? 'bg-icon-blue' : 'bg-icon-orange',
  );

  protected readonly headerTitle = computed(() => {
    this.i18n();
    switch (this.effectivePhase()) {
      case 'confirm':
        return this.transloco.translate('wsUpdates.apply.title');
      case 'stale':
        return this.transloco.translate('wsUpdates.apply.staleTitle');
      case 'blocked':
        return this.transloco.translate('wsUpdates.apply.blockedTitle');
      case 'refused':
        return this.transloco.translate('wsUpdates.apply.refusedTitle');
      case 'ambiguous':
        return this.transloco.translate('wsUpdates.ambiguous.title');
    }
  });

  protected readonly staleMessage = computed(() => {
    this.i18n();
    const code = this.hasDiverged()
      ? 'TENANT_PROVISIONING_UPDATE_SELECTION_STALE'
      : (this.errorCode() ?? 'TENANT_PROVISIONING_UPDATE_SELECTION_STALE');
    const key = `wsUpdates.errors.${code}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key
      ? translated
      : this.transloco.translate('wsUpdates.errors.TENANT_PROVISIONING_UPDATE_SELECTION_STALE');
  });

  private readonly liveByKey = computed(() => {
    const map = new Map<string, TenantAvailableUpdate>();
    for (const row of this.liveRows()) {
      map.set(row.componentKey, row);
    }
    return map;
  });

  constructor() {
    effect(() => {
      // Reset consent whenever effective phase changes or dialog opens/closes
      this.effectivePhase();
      this.isOpen();
      this.consent.set(false);
    });

    effect(() => {
      if (this.hasDiverged()) {
        untracked(() => this.diverged.emit());
      }
    });

  }

  open(): void {
    this.consent.set(false);
    this.isOpen.set(true);
    this.modal().open();
  }

  close(): void {
    this.isOpen.set(false);
    this.consent.set(false);
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.isOpen.set(false);
    this.consent.set(false);
    this.closed.emit();
  }

  protected onConsentChange(checked: boolean, cb: Checkbox): void {
    if (this.submitting()) {
      cb.checked.set(this.consent());
      return;
    }
    this.consent.set(checked);
  }

  /** Translated application name (nav.apps.*), falling back to the raw owner app key. */
  protected appName(ownerApp: string): string {
    this.i18n();
    return this.names.app(ownerApp.toLowerCase(), ownerApp);
  }

  protected riskBadgeClass(item: SnapshotItem): string {
    return badgeClassForTone(riskTone(item.riskLevel));
  }

  protected liveEligibility(item: SnapshotItem) {
    const live = this.liveByKey().get(item.selection.componentKey);
    return live ? eligibilityOf(live) : 'INCOMPLETE_EVIDENCE';
  }

  protected liveEligibilityBadge(item: SnapshotItem): string {
    return eligibilityBadgeClass(this.liveEligibility(item));
  }

  protected changedVersion(item: SnapshotItem): string | null {
    const live = this.liveByKey().get(item.selection.componentKey);
    if (!live) return null;
    if (live.availableRelease.releaseVersion !== item.selection.targetReleaseVersion) {
      return live.availableRelease.releaseVersion;
    }
    return null;
  }
}
