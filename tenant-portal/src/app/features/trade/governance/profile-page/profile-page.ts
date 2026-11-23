import { ChangeDetectorRef, Component, DestroyRef, Injector, computed, inject, signal, viewChild } from '@angular/core';
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
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../shared/ui/date-time/time-field';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { type TradeContext, errorCodeOf, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import {
  PROFILE_PERMISSIONS,
  hasProfileReadGrant,
  hasProfileScopeGrant,
  isActivePointerStaleError,
  isForbiddenError,
  isPublicationUnavailableError,
  profileActorDisplayName,
  resolveProfileErrorMessage,
} from '../document-profiles-page/profile-access';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import {
  type GovernedRow,
  type GovernedRowAction,
  type GovernedRowActionEvent,
  GovernedVersionsTable,
} from '../governance-shared/governed-versions-table/governed-versions-table';
import { ScopeChip } from '../governance-shared/scope-chip/scope-chip';
import type { ScopeTarget } from '../policy.model';
import { formatDateOnly } from '../pricing.service';
import { deleteVersion, getProfile, publishVersion, validateVersion } from '../profiles.api';
import type { DocumentProfile, ProfileVersion } from '../profiles.model';

const PARAM_TO_SCOPE: Readonly<Record<string, ScopeTarget>> = {
  tenant: 'TENANT',
  company: 'COMPANY',
  branch: 'BRANCH',
};

function parseScopeParam(raw: string | null): ScopeTarget {
  if (!raw) return 'COMPANY';
  return PARAM_TO_SCOPE[raw.trim().toLowerCase()] ?? 'COMPANY';
}

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
    FullState,
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
  private readonly injector = inject(Injector);
  private readonly scopeState = inject(ScopeState);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lang = inject(LanguageState).current;

  private readonly newVersionModal = viewChild.required<Modal>('newVersionModal');
  private readonly publishModal = viewChild.required<Modal>('publishModal');
  private readonly deleteDraftDialog = viewChild.required<ConfirmDialog>('deleteDraftDialog');
  private readonly conflictDialog = viewChild.required(ConflictDialog);

  protected readonly profileId = signal('');
  protected readonly scopeParam = signal<ScopeTarget>('COMPANY');
  protected readonly profile = signal<DocumentProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly publicationUnavailable = signal(false);
  protected readonly conflictMode = signal<'versionStale' | 'pointerStale'>('versionStale');

  protected readonly effectiveScopeTarget = computed<ScopeTarget>(
    () => this.profile()?.scopeTarget ?? this.scopeParam(),
  );
  protected readonly ctx = computed<TradeContext>(() =>
    tradeContext(this.scopeState, this.effectiveScopeTarget()),
  );
  protected readonly canRead = computed(() => hasProfileReadGrant(this.injector));
  protected readonly isForbidden = computed(() => !this.canRead() || this.forbidden());
  protected readonly canManage = computed(
    () =>
      !this.isForbidden() &&
      hasProfileScopeGrant(
        this.injector,
        this.scopeState,
        PROFILE_PERMISSIONS.manage,
        this.effectiveScopeTarget(),
      ),
  );
  protected readonly canValidate = computed(
    () =>
      !this.isForbidden() &&
      hasProfileScopeGrant(
        this.injector,
        this.scopeState,
        PROFILE_PERMISSIONS.validate,
        this.effectiveScopeTarget(),
      ),
  );
  protected readonly canPublish = computed(
    () =>
      !this.isForbidden() &&
      hasProfileScopeGrant(
        this.injector,
        this.scopeState,
        PROFILE_PERMISSIONS.publish,
        this.effectiveScopeTarget(),
      ),
  );
  protected readonly currentUserId = computed(() => this.tenantScope.me()?.id ?? '');

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
  private stalePublishVersionId: string | null = null;
  private pendingRefetch: Promise<boolean> | null = null;

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
    const p = this.profile();
    if (!p) return [];
    const me = this.tenantScope.me();
    const currentActor = this.currentUserId();
    const byId = new Map(p.versions.map((v) => [v.id, v]));

    return p.versions.map((ver) => {
      const isSelf = Boolean(currentActor && ver.authorUserId === currentActor);
      const supersededByVersionNumber = ver.supersededByVersionId
        ? (byId.get(ver.supersededByVersionId)?.profileVersion ?? null)
        : null;
      const actions: GovernedRowAction[] = [
        {
          key: 'open',
          title: this.transloco.translate('governance.versionsTable.actionsList.open'),
          icon: 'tablerEye',
          tile: 'bg-icon-blue',
        },
      ];

      if (ver.status === 'DRAFT' && this.canValidate()) {
        actions.push({
          key: 'validate',
          title: this.transloco.translate('profiles.actions.validate'),
          icon: 'tablerCheck',
          tile: 'bg-icon-teal',
          disabled: this.busy(),
        });
      }

      if (ver.status === 'TESTED' && this.canPublish()) {
        actions.push({
          key: 'publish',
          title: this.transloco.translate('governance.versionsTable.actionsList.publish'),
          icon: 'tablerSend',
          tile: isSelf ? 'bg-icon-gray' : 'bg-icon-green',
          disabled: isSelf || this.busy(),
          reason: isSelf ? this.transloco.translate('governance.makerChecker.self') : undefined,
        });
      }

      if (ver.status === 'DRAFT' && this.canManage()) {
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
        supersededByVersionNumber,
        effectiveFrom: ver.effectiveFrom,
        effectiveTo: ver.supersededAt ?? ver.effectiveTo,
        byPrimary: profileActorDisplayName(ver.authorUserId, me),
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
    const author = profileActorDisplayName(target.authorUserId, this.tenantScope.me());
    return this.transloco.translate('profiles.publishModal.makerCheckerAuthor', { author });
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      const nextScope = parseScopeParam(query.get('scope'));
      if (nextScope !== this.scopeParam()) {
        this.scopeParam.set(nextScope);
      }
      if (query.get('newVersion') === '1') {
        this.pendingOpenNewVersion = true;
        if (this.profile() && !this.loading() && !this.loadFailed() && this.canManage()) {
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

  protected goHome(): void {
    void this.router.navigate(['/']);
  }

  protected goBack(): void {
    const scope = this.effectiveScopeTarget() === 'TENANT' ? 'tenant' : undefined;
    void this.router.navigate(['/trade/governance/document-profiles'], {
      ...(scope ? { queryParams: { scope } } : {}),
    });
  }

  protected retryFromUnavailable(): void {
    this.publicationUnavailable.set(false);
    this.reload();
  }

  protected reload(): void {
    const id = this.profileId();
    if (id && this.canRead()) {
      this.forbidden.set(false);
      this.publicationUnavailable.set(false);
      void this.load(id);
    }
  }

  protected openVersion(versionId: string): void {
    const id = this.profileId();
    if (!id) return;
    const scope = this.effectiveScopeTarget() === 'TENANT' ? 'tenant' : undefined;
    void this.router.navigate(['/trade/governance/document-profiles', id, 'versions', versionId], {
      ...(scope ? { queryParams: { scope } } : {}),
    });
  }

  protected openNewVersionModal(): void {
    if (!this.canManage() || !this.profile()) return;
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
    const scope = this.effectiveScopeTarget() === 'TENANT' ? 'tenant' : undefined;
    this.newVersionModal().close();
    void this.router.navigate(['/trade/governance/document-profiles', p.id, 'versions', 'new'], {
      queryParams: {
        ...(fromId ? { from: fromId } : {}),
        effectiveFrom: fromIso,
        ...(toIso ? { effectiveTo: toIso } : {}),
        ...(scope ? { scope } : {}),
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
    if (!p || !target || this.publishing() || !this.canPublish()) return;

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
        this.ctx(),
      );
      this.publishFingerprint = '';
      this.publishIdempotencyKey = '';
      this.publishModal().close();
      const toastKey = result.status === 'SCHEDULED' ? 'profiles.toasts.scheduled' : 'profiles.toasts.published';
      this.notify.success(this.transloco.translate(toastKey, { n: result.profileVersion }));
      await this.load(p.id);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.publishModal().close();
        this.forbidden.set(true);
        return;
      }
      if (isPublicationUnavailableError(error)) {
        this.publishModal().close();
        this.publicationUnavailable.set(true);
        return;
      }
      if (isActivePointerStaleError(error)) {
        // Active-pointer stale: never retry silently; show conflict, refetch, and require confirmation.
        this.publishFingerprint = '';
        this.publishIdempotencyKey = '';
        this.stalePublishVersionId = target.id;
        this.conflictMode.set('pointerStale');
        this.publishModal().close();
        this.conflictDialog().open();
        this.pendingRefetch = this.refetchProfileQuietly(p.id);
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.publishFingerprint = '';
        this.publishIdempotencyKey = '';
        this.conflictMode.set('versionStale');
        this.publishModal().close();
        this.conflictDialog().open();
      } else if (errorCodeOf(error) === 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_CHANGED') {
        this.publishModal().close();
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
        void this.load(p.id);
      } else {
        this.publishModal().close();
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
      }
    } finally {
      this.publishing.set(false);
    }
  }

  protected async onConflictReload(): Promise<void> {
    if (this.conflictMode() === 'pointerStale') {
      this.conflictMode.set('versionStale');
      const targetId = this.stalePublishVersionId;
      this.stalePublishVersionId = null;
      let refreshed = false;
      if (this.pendingRefetch) {
        refreshed = await this.pendingRefetch;
        this.pendingRefetch = null;
      } else if (this.profileId()) {
        refreshed = await this.refetchProfileQuietly(this.profileId());
      }
      if (!refreshed) return;
      const fresh = targetId ? this.profile()?.versions.find((v) => v.id === targetId) : undefined;
      if (
        fresh &&
        fresh.status === 'TESTED' &&
        this.canPublish() &&
        fresh.authorUserId !== this.currentUserId()
      ) {
        this.openPublishModal(fresh);
      }
      return;
    }
    this.reload();
  }

  protected onConflictKeep(): void {
    this.conflictMode.set('versionStale');
    this.stalePublishVersionId = null;
  }

  private openPublishModal(version: ProfileVersion): void {
    const actorId = this.currentUserId();
    if (!this.canPublish() || (actorId && version.authorUserId === actorId)) return;
    this.publishingTarget.set(version);
    this.publishing.set(false);
    this.publishFingerprint = '';
    this.publishIdempotencyKey = '';
    this.cdr.detectChanges();
    this.publishModal().open();
  }

  private async runValidate(version: ProfileVersion): Promise<void> {
    const p = this.profile();
    if (!p || this.busy() || !this.canValidate()) return;

    this.busy.set(true);
    try {
      const result = await validateVersion(version.id, version.version, newIdempotencyKey(), this.ctx());
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
        const scope = this.effectiveScopeTarget() === 'TENANT' ? 'tenant' : undefined;
        void this.router.navigate(['/trade/governance/document-profiles', p.id, 'versions', version.id], {
          queryParams: {
            tab: 'cases',
            ...(scope ? { scope } : {}),
          },
        });
      }
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
      } else if (isPublicationUnavailableError(error)) {
        this.publicationUnavailable.set(true);
      } else if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictMode.set('versionStale');
        this.conflictDialog().open();
      } else if (errorCodeOf(error) === 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_CHANGED') {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
        void this.load(p.id);
      } else {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async runDeleteDraft(version: ProfileVersion): Promise<void> {
    const p = this.profile();
    if (!p || this.busy() || !this.canManage()) return;

    this.deletingTarget.set(version);
    this.cdr.detectChanges();
    const confirmed = await this.deleteDraftDialog().open();
    this.deletingTarget.set(null);
    if (!confirmed) return;

    this.busy.set(true);
    try {
      await deleteVersion(version.id, version.version, newIdempotencyKey(), this.ctx());
      this.notify.success(this.transloco.translate('profiles.toasts.draftDeleted', { n: version.profileVersion }));
      await this.load(p.id);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
      } else if (isPublicationUnavailableError(error)) {
        this.publicationUnavailable.set(true);
      } else if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictMode.set('versionStale');
        this.conflictDialog().open();
      } else if (errorCodeOf(error) === 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_CHANGED') {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
        void this.load(p.id);
      } else {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async refetchProfileQuietly(id: string): Promise<boolean> {
    const seq = ++this.loadSeq;
    try {
      const data = await getProfile(id, this.ctx());
      if (seq !== this.loadSeq) return false;
      this.profile.set(data);
      return true;
    } catch (error) {
      if (seq !== this.loadSeq) return false;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
      } else if (isPublicationUnavailableError(error)) {
        this.publicationUnavailable.set(true);
      } else {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
      }
      return false;
    }
  }

  private async load(id: string): Promise<void> {
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const data = await getProfile(id, this.ctx());
      if (seq !== this.loadSeq) return;
      this.profile.set(data);
      if (this.pendingOpenNewVersion && this.canManage()) {
        this.consumePendingNewVersion();
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (isPublicationUnavailableError(error)) {
        this.publicationUnavailable.set(true);
        return;
      }
      this.loadFailed.set(true);
      this.notify.error(resolveProfileErrorMessage(this.transloco, error));
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
}
