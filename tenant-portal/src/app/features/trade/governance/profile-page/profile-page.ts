import { ChangeDetectorRef, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowLeft,
  tablerCloudOff,
  tablerFileSettings,
  tablerPlus,
  tablerRefresh,
  tablerSend,
  tablerUser,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../shared/ui/date-time/time-field';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../shared/trade-api';
import { actorDisplayName, getFakeActor, governanceErrorKey } from '../governance-fake-actors';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import {
  type GovernedRow,
  type GovernedRowAction,
  type GovernedRowActionEvent,
  GovernedVersionsTable,
} from '../governance-shared/governed-versions-table/governed-versions-table';
import { ScopeChip } from '../governance-shared/scope-chip/scope-chip';
import { formatDateOnly } from '../pricing.service';
import { deleteVersion, getProfile, publishVersion, validateVersion } from '../profiles.api';
import type { DocumentProfile, ProfileVersion } from '../profiles.model';

const CAN = { manage: true, test: true, approve: true, publish: true }; // later from the session

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function localTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function localPartsToUtcIso(dateStr: string | null, timeStr: string | null): string | null {
  if (!dateStr || !timeStr) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const dt = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day ||
    dt.getHours() !== hours ||
    dt.getMinutes() !== minutes
  ) {
    return null;
  }
  return dt.toISOString();
}

@Component({
  selector: 'app-profile-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Badge,
    Button,
    ConfirmDialog,
    DateField,
    Field,
    Modal,
    Segmented,
    TimeField,
    ConflictDialog,
    GovernedVersionsTable,
    ScopeChip,
  ],
  providers: [
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-profiles', alias: 'profiles' }),
    provideIcons({
      tablerArrowLeft,
      tablerFileSettings,
      tablerPlus,
      tablerRefresh,
      tablerCloudOff,
      tablerSend,
      tablerUser,
      tablerX,
    }),
  ],
  templateUrl: './profile-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class ProfilePage {
  private static nextId = 0;
  protected readonly uid = `gov-profile-page-${++ProfilePage.nextId}`;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lang = inject(LanguageState).current;

  private readonly newVersionModal = viewChild.required<Modal>('newVersionModal');
  private readonly publishModal = viewChild.required<Modal>('publishModal');
  private readonly deleteDraftDialog = viewChild.required<ConfirmDialog>('deleteDraftDialog');
  private readonly conflictDialog = viewChild.required(ConflictDialog);

  protected readonly can = CAN;
  protected readonly profileId = signal('');
  protected readonly profile = signal<DocumentProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);

  // New version modal state
  protected readonly fromDate = signal<string | null>(null);
  protected readonly fromTime = signal<string | null>(null);
  protected readonly toDate = signal<string | null>(null);
  protected readonly toTime = signal<string | null>(null);
  protected readonly startFrom = signal<'live' | 'empty'>('empty');
  protected readonly newVersionSubmitted = signal(false);

  // Action targets
  protected readonly publishingTarget = signal<ProfileVersion | null>(null);
  protected readonly publishing = signal(false);
  protected readonly deletingTarget = signal<ProfileVersion | null>(null);

  private pendingOpenNewVersion = false;
  private loadSeq = 0;
  private publishFingerprint = '';
  private publishIdempotencyKey = '';

  protected readonly liveVersion = computed<ProfileVersion | null>(() => {
    const p = this.profile();
    if (!p) return null;
    if (p.currentPublishedVersionId) {
      const matched = p.versions.find((v) => v.id === p.currentPublishedVersionId);
      if (matched) return matched;
    }
    return p.versions.find((v) => v.status === 'PUBLISHED') ?? null;
  });

  protected readonly versionRows = computed<GovernedRow[]>(() => {
    this.i18n();
    const language = this.lang();
    const p = this.profile();
    if (!p) return [];
    const currentActor = getFakeActor();

    return p.versions.map((ver) => {
      const isSelf = ver.authorUserId === currentActor;
      const actions: GovernedRowAction[] = [
        {
          key: 'open',
          title: this.transloco.translate('governance.versionsTable.actionsList.open'),
          icon: 'tablerEye',
          tile: 'bg-icon-blue',
        },
      ];

      if (ver.status === 'DRAFT' && this.can.test) {
        actions.push({
          key: 'validate',
          title: this.transloco.translate('profiles.actions.validate'),
          icon: 'tablerCheck',
          tile: 'bg-icon-teal',
          disabled: this.busy(),
        });
      }

      if (ver.status === 'TESTED' && this.can.publish) {
        actions.push({
          key: 'publish',
          title: this.transloco.translate('governance.versionsTable.actionsList.publish'),
          icon: 'tablerSend',
          tile: isSelf ? 'bg-icon-gray' : 'bg-icon-green',
          disabled: isSelf || this.busy(),
          reason: isSelf ? this.transloco.translate('governance.makerChecker.self') : undefined,
        });
      }

      if (ver.status === 'DRAFT' && this.can.manage) {
        actions.push({
          key: 'deleteDraft',
          title: this.transloco.translate('governance.versionsTable.actionsList.deleteDraft'),
          icon: 'tablerTrash',
          tile: 'bg-icon-red',
          danger: true,
          disabled: this.busy(),
        });
      }

      return {
        id: ver.id,
        versionNumber: ver.profileVersion,
        status: ver.status,
        effectiveFrom: ver.effectiveFrom,
        effectiveTo: ver.effectiveTo,
        byPrimary: actorDisplayName(ver.authorUserId, language),
        byIsMe: isSelf,
        actions,
      };
    });
  });

  protected readonly startFromOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const hasLive = Boolean(this.liveVersion());
    return [
      {
        value: 'live',
        label: this.transloco.translate('profiles.detail.newVersionModal.startFromLive'),
        disabled: !hasLive,
      },
      {
        value: 'empty',
        label: this.transloco.translate('profiles.detail.newVersionModal.startFromEmpty'),
      },
    ];
  });

  protected readonly fromError = computed<string | null>(() => {
    this.i18n();
    if (!this.newVersionSubmitted()) return null;
    if (!this.fromDate() || !this.fromTime()) {
      return this.transloco.translate('profiles.detail.newVersionModal.dateRequired');
    }
    if (!localPartsToUtcIso(this.fromDate(), this.fromTime())) {
      return this.transloco.translate('profiles.detail.newVersionModal.invalidDate');
    }
    return null;
  });

  protected readonly toError = computed<string | null>(() => {
    this.i18n();
    if (!this.newVersionSubmitted()) return null;
    const td = this.toDate();
    const tt = this.toTime();
    if (!td && !tt) return null;
    const toIso = localPartsToUtcIso(td, tt);
    if (!toIso) {
      return this.transloco.translate('profiles.detail.newVersionModal.invalidDate');
    }
    const fromIso = localPartsToUtcIso(this.fromDate(), this.fromTime());
    if (fromIso && Date.parse(toIso) <= Date.parse(fromIso)) {
      return this.transloco.translate('profiles.detail.newVersionModal.endAfterStart');
    }
    return null;
  });

  protected readonly fromDescribedBy = computed(() => {
    const base = `${this.uid}-from-hint`;
    return this.fromError() ? `${base} ${this.uid}-from-error` : base;
  });

  protected readonly toDescribedBy = computed(() => {
    const base = `${this.uid}-to-hint`;
    return this.toError() ? `${base} ${this.uid}-to-error` : base;
  });

  protected readonly hasEnd = computed(() => Boolean(this.toDate() || this.toTime()));

  protected readonly publishScheduled = computed(() => {
    const target = this.publishingTarget();
    if (!target) return false;
    return Date.parse(target.effectiveFrom) > Date.now();
  });

  protected readonly publishBodyText = computed(() => {
    this.i18n();
    const target = this.publishingTarget();
    if (!target) return '';
    const live = this.liveVersion();
    const date = formatDateOnly(target.effectiveFrom, this.lang());
    if (this.publishScheduled()) {
      return live
        ? this.transloco.translate('profiles.publishModal.scheduledWithLive', {
            date,
            live: live.profileVersion,
          })
        : this.transloco.translate('profiles.publishModal.scheduledNoLive', { date });
    }
    return live
      ? this.transloco.translate('profiles.publishModal.liveWithLive', { live: live.profileVersion })
      : this.transloco.translate('profiles.publishModal.liveNoLive');
  });

  protected readonly publishAuthorText = computed(() => {
    this.i18n();
    const target = this.publishingTarget();
    if (!target) return '';
    const author = actorDisplayName(target.authorUserId, this.lang());
    return this.transloco.translate('profiles.publishModal.makerCheckerAuthor', { author });
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      if (query.get('newVersion') === '1') {
        this.pendingOpenNewVersion = true;
        if (this.profile() && !this.loading() && !this.loadFailed() && this.can.manage) {
          this.consumePendingNewVersion();
        }
      }
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id') ?? '';
      if (id === this.profileId() && this.profile()) return;
      this.profileId.set(id);
      if (id) {
        void this.load(id);
      }
    });

    inject(DestroyRef).onDestroy(() => {
      this.loadSeq += 1;
    });
  }

  protected goBack(): void {
    void this.router.navigate(['/trade/governance/document-profiles']);
  }

  protected reload(): void {
    const id = this.profileId();
    if (id) {
      void this.load(id);
    }
  }

  protected openVersion(versionId: string): void {
    const id = this.profileId();
    if (!id) return;
    void this.router.navigate(['/trade/governance/document-profiles', id, 'versions', versionId]);
  }

  protected openNewVersionModal(): void {
    if (!this.can.manage || !this.profile()) return;
    this.fromDate.set(localTodayStr());
    this.fromTime.set('00:00');
    this.toDate.set(null);
    this.toTime.set(null);
    this.startFrom.set(this.liveVersion() ? 'live' : 'empty');
    this.newVersionSubmitted.set(false);
    this.newVersionModal().open();
  }

  protected closeNewVersionModal(): void {
    this.newVersionModal().close();
  }

  protected onToDateChange(nextDate: string | null): void {
    this.toDate.set(nextDate);
    if (nextDate && !this.toTime()) {
      this.toTime.set('23:59');
    } else if (!nextDate) {
      this.toTime.set(null);
    }
  }

  protected onToTimeChange(nextTime: string | null): void {
    this.toTime.set(nextTime);
    if (nextTime && !this.toDate()) {
      this.toDate.set(this.fromDate() ?? localTodayStr());
    } else if (!nextTime) {
      this.toDate.set(null);
    }
  }

  protected clearEnd(): void {
    this.toDate.set(null);
    this.toTime.set(null);
  }

  protected onStartFromChange(value: string | null): void {
    if (value !== 'live' && value !== 'empty') return;
    if (value === 'live' && !this.liveVersion()) return;
    this.startFrom.set(value);
  }

  protected continueToNewVersion(): void {
    const p = this.profile();
    if (!p) return;
    this.newVersionSubmitted.set(true);

    const fromIso = localPartsToUtcIso(this.fromDate(), this.fromTime());
    if (!fromIso) return;

    let toIso: string | null = null;
    if (this.hasEnd()) {
      toIso = localPartsToUtcIso(this.toDate(), this.toTime());
      if (!toIso || Date.parse(toIso) <= Date.parse(fromIso)) return;
    }

    const live = this.liveVersion();
    const fromId = this.startFrom() === 'live' && live ? live.id : null;
    this.newVersionModal().close();
    void this.router.navigate(['/trade/governance/document-profiles', p.id, 'versions', 'new'], {
      queryParams: {
        ...(fromId ? { from: fromId } : {}),
        effectiveFrom: fromIso,
        ...(toIso ? { effectiveTo: toIso } : {}),
      },
    });
  }

  protected onVersionAction(event: GovernedRowActionEvent): void {
    const p = this.profile();
    if (!p) return;
    const version = p.versions.find((v) => v.id === event.row.id);
    if (!version) return;

    switch (event.key) {
      case 'open':
        this.openVersion(version.id);
        break;
      case 'validate':
        void this.runValidate(version);
        break;
      case 'publish':
        this.openPublishModal(version);
        break;
      case 'deleteDraft':
        void this.runDeleteDraft(version);
        break;
    }
  }

  protected closePublishModal(): void {
    if (this.publishing()) return;
    this.publishModal().close();
  }

  protected onPublishModalClosed(): void {
    this.publishingTarget.set(null);
    this.publishing.set(false);
  }

  protected async confirmPublish(): Promise<void> {
    const p = this.profile();
    const target = this.publishingTarget();
    if (!p || !target || this.publishing() || !this.can.publish) return;

    const fingerprint = `${target.id}:${target.version}:${p.pointerVersion}`;
    if (fingerprint !== this.publishFingerprint || !this.publishIdempotencyKey) {
      this.publishFingerprint = fingerprint;
      this.publishIdempotencyKey = newIdempotencyKey();
    }

    this.publishing.set(true);
    try {
      const result = await publishVersion(
        target.id,
        p.pointerVersion,
        target.version,
        this.publishIdempotencyKey,
      );
      this.publishFingerprint = '';
      this.publishIdempotencyKey = '';
      this.publishModal().close();
      const toastKey = result.status === 'SCHEDULED' ? 'profiles.toasts.scheduled' : 'profiles.toasts.published';
      this.notify.success(this.transloco.translate(toastKey, { n: result.profileVersion }));
      await this.load(p.id);
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.publishModal().close();
        this.conflictDialog().open();
      } else {
        this.publishModal().close();
        this.notify.error(this.resolveErrorMessage(error));
      }
    } finally {
      this.publishing.set(false);
    }
  }

  private openPublishModal(version: ProfileVersion): void {
    if (!this.can.publish || version.authorUserId === getFakeActor()) return;
    this.publishingTarget.set(version);
    this.publishing.set(false);
    this.publishFingerprint = '';
    this.publishIdempotencyKey = '';
    this.cdr.detectChanges();
    this.publishModal().open();
  }

  private async runValidate(version: ProfileVersion): Promise<void> {
    const p = this.profile();
    if (!p || this.busy() || !this.can.test) return;

    this.busy.set(true);
    try {
      const result = await validateVersion(version.id, version.version, newIdempotencyKey());
      if (result.passed) {
        this.notify.success(this.transloco.translate('profiles.toasts.validated'));
        await this.load(p.id);
      } else {
        const failedCount = result.results.filter((r) => !r.passed).length;
        const msg =
          failedCount === 1
            ? this.transloco.translate('profiles.toasts.validationFailedOne')
            : this.transloco.translate('profiles.toasts.validationFailed', { count: failedCount });
        this.notify.warning(msg);
        void this.router.navigate(['/trade/governance/document-profiles', p.id, 'versions', version.id], {
          queryParams: { tab: 'cases' },
        });
      }
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog().open();
      } else {
        this.notify.error(this.resolveErrorMessage(error));
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async runDeleteDraft(version: ProfileVersion): Promise<void> {
    const p = this.profile();
    if (!p || this.busy() || !this.can.manage) return;

    this.deletingTarget.set(version);
    this.cdr.detectChanges();
    const confirmed = await this.deleteDraftDialog().open();
    this.deletingTarget.set(null);
    if (!confirmed) return;

    this.busy.set(true);
    try {
      await deleteVersion(version.id, version.version, newIdempotencyKey());
      this.notify.success(this.transloco.translate('profiles.toasts.draftDeleted', { n: version.profileVersion }));
      await this.load(p.id);
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog().open();
      } else {
        this.notify.error(this.resolveErrorMessage(error));
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const data = await getProfile(id);
      if (seq !== this.loadSeq) return;
      this.profile.set(data);
      if (this.pendingOpenNewVersion && this.can.manage) {
        this.consumePendingNewVersion();
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      this.notify.error(this.resolveErrorMessage(error));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private consumePendingNewVersion(): void {
    this.pendingOpenNewVersion = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { newVersion: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.openNewVersionModal();
  }

  private resolveErrorMessage(error: unknown): string {
    const key = governanceErrorKey(error, 'governance');
    const translated = this.transloco.translate(key);
    if (translated !== key) return translated;
    if (error instanceof ApiError) {
      const codeKey = `governance.errors.${error.code}`;
      const codeTranslated = this.transloco.translate(codeKey);
      if (codeTranslated !== codeKey) return codeTranslated;
    }
    return this.transloco.translate('tradeShared.errors.generic');
  }
}
