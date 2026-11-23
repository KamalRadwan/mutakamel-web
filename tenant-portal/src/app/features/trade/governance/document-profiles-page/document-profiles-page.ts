import { Component, DestroyRef, Injector, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCloudOff,
  tablerFileSettings,
  tablerInbox,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { type TradeContext, tradeContext } from '../../shared/trade-api';
import { ScopeChip } from '../governance-shared/scope-chip/scope-chip';
import { VersionStatusBadge } from '../governance-shared/version-status-badge/version-status-badge';
import type { ScopeTarget } from '../policy.model';
import { formatDateOnly } from '../pricing.service';
import { ProfileModal } from '../profile-modal/profile-modal';
import { getProfileCounts, listProfiles } from '../profiles.api';
import type { DocumentProfile, DocumentProfileRecord, ProfileCounts, ProfileVersion } from '../profiles.model';
import { DOCUMENT_TYPES, type DocumentType } from '../profiles.registry';
import {
  PROFILE_PERMISSIONS,
  hasProfileReadGrant,
  hasProfileScopeGrant,
  isForbiddenError,
  isPublicationUnavailableError,
  resolveProfileErrorMessage,
} from './profile-access';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZES: readonly number[] = [12, 24, 48, 96];

const PARAM_TO_SCOPE: Readonly<Record<string, ScopeTarget>> = {
  tenant: 'TENANT',
  company: 'COMPANY',
  branch: 'BRANCH',
};

function parseTypeParam(raw: string | null): DocumentType | 'all' {
  if (raw && (DOCUMENT_TYPES as readonly string[]).includes(raw)) {
    return raw as DocumentType;
  }
  return 'all';
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function parseScopeParam(raw: string | null): ScopeTarget {
  if (!raw) return 'COMPANY';
  return PARAM_TO_SCOPE[raw.trim().toLowerCase()] ?? 'COMPANY';
}

@Component({
  selector: 'app-document-profiles-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Badge,
    Button,
    FullState,
    Pagination,
    StepFilter,
    ScopeChip,
    VersionStatusBadge,
    ProfileModal,
  ],
  providers: [
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-profiles', alias: 'profiles' }),
    provideIcons({
      tablerPlus,
      tablerSearch,
      tablerX,
      tablerRefresh,
      tablerFileSettings,
      tablerInbox,
      tablerCloudOff,
    }),
  ],
  templateUrl: './document-profiles-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class DocumentProfilesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lang = inject(LanguageState).current;

  private readonly profileModal = viewChild.required(ProfileModal);

  protected readonly pageSizes = [...PAGE_SIZES];
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly selectedType = signal<DocumentType | 'all'>('all');
  protected readonly search = signal('');
  protected readonly page = signal(DEFAULT_PAGE);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly scopeTarget = signal<ScopeTarget>('COMPANY');
  private readonly pendingVersionId = signal<string | null>(null);

  protected readonly forbidden = signal(false);
  protected readonly publicationUnavailable = signal(false);
  protected readonly canRead = computed(() => hasProfileReadGrant(this.injector));
  protected readonly isForbidden = computed(() => !this.canRead() || this.forbidden());
  protected readonly canManage = computed(
    () =>
      !this.isForbidden() &&
      hasProfileScopeGrant(this.injector, this.scopeState, PROFILE_PERMISSIONS.manage, this.scopeTarget()),
  );
  protected readonly ctx = computed<TradeContext>(() => tradeContext(this.scopeState, this.scopeTarget()));

  protected readonly profiles = signal<DocumentProfile[]>([]);
  protected readonly counts = signal<ProfileCounts | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);

  private loadSeq = 0;
  private resolvedDeepLinkVersion: string | null = null;

  protected readonly tableColumnsTrack =
    'grid-cols-trade-doc-profile-row-actions';

  protected readonly hasActiveFilters = computed(
    () => this.selectedType() !== 'all' || this.search().trim().length > 0,
  );

  protected readonly stepOptions = computed<StepOption[]>(() => {
    this.i18n();
    const c = this.counts();
    return [
      {
        id: 'all',
        label: this.transloco.translate('profiles.types.ALL'),
        count: c ? c.total : null,
      },
      ...DOCUMENT_TYPES.map((type) => ({
        id: type,
        label: this.transloco.translate(`profiles.types.${type}`),
        count: c ? (c.byDocumentType[type] ?? 0) : null,
      })),
    ];
  });

  protected readonly filteredProfiles = computed<DocumentProfile[]>(() => {
    const type = this.selectedType();
    const needle = this.search().trim().toLowerCase();
    return this.profiles().filter((profile) => {
      if (type !== 'all' && profile.documentType !== type) return false;
      if (needle && !profile.code.toLowerCase().includes(needle)) return false;
      return true;
    });
  });

  protected readonly currentPage = computed(() => {
    const total = this.filteredProfiles().length;
    const totalPages = Math.max(1, Math.ceil(total / Math.max(1, this.pageSize())));
    return Math.min(Math.max(1, this.page()), totalPages);
  });

  protected readonly pagedProfiles = computed<DocumentProfile[]>(() => {
    const list = this.filteredProfiles();
    const size = this.pageSize();
    const start = (this.currentPage() - 1) * size;
    return list.slice(start, start + size);
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      this.selectedType.set(parseTypeParam(query.get('type')));
      this.search.set(query.get('q') ?? '');
      this.page.set(parsePositiveInt(query.get('page'), DEFAULT_PAGE));
      const parsedSize = parsePositiveInt(query.get('size'), DEFAULT_PAGE_SIZE);
      this.pageSize.set(PAGE_SIZES.includes(parsedSize) ? parsedSize : DEFAULT_PAGE_SIZE);
      this.scopeTarget.set(parseScopeParam(query.get('scope')));

      const versionId = query.get('version')?.trim() || null;
      this.pendingVersionId.set(versionId);
      if (versionId && !this.loading() && !this.loadFailed() && !this.isForbidden()) {
        this.resolveVersionDeepLink(versionId);
      }
    });

    effect(() => {
      const canRead = this.canRead();
      const target = this.scopeTarget();
      const ctx = this.ctx();
      void target;
      untracked(() => {
        this.forbidden.set(false);
        this.publicationUnavailable.set(false);
        if (!canRead) {
          this.loading.set(false);
          this.profiles.set([]);
          this.counts.set(null);
          return;
        }
        void this.load(ctx);
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.loadSeq += 1;
    });
  }

  protected goHome(): void {
    void this.router.navigate(['/']);
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
  }

  protected onPublicationUnavailable(): void {
    this.publicationUnavailable.set(true);
  }

  protected retryFromUnavailable(): void {
    this.publicationUnavailable.set(false);
    this.reload();
  }

  protected reload(): void {
    if (!this.canRead()) return;
    this.forbidden.set(false);
    this.publicationUnavailable.set(false);
    void this.load(this.ctx());
  }

  protected openCreate(): void {
    if (!this.canManage()) return;
    const type = this.selectedType();
    this.profileModal().open(type === 'all' ? undefined : type);
  }

  protected onProfileCreated(_created: DocumentProfileRecord): void {
    this.reload();
  }

  protected onSearchInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.search.set(next);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: next || null, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected clearSearch(): void {
    if (!this.search()) return;
    this.search.set('');
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected clearFilters(): void {
    this.selectedType.set('all');
    this.search.set('');
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type: null, q: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onTypeChange(nextType: string): void {
    const resolved = parseTypeParam(nextType);
    if (resolved === this.selectedType()) return;
    this.selectedType.set(resolved);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type: resolved === 'all' ? null : resolved, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageChange(nextPage: number): void {
    const safePage = Math.max(DEFAULT_PAGE, nextPage);
    if (safePage === this.page()) return;
    this.page.set(safePage);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: safePage === DEFAULT_PAGE ? null : safePage },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageSizeChange(nextSize: number): void {
    if (!PAGE_SIZES.includes(nextSize) || nextSize === this.pageSize()) return;
    this.pageSize.set(nextSize);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: nextSize === DEFAULT_PAGE_SIZE ? null : nextSize,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected openProfile(profile: DocumentProfile): void {
    const scopeParam = this.scopeParamFor(profile.scopeTarget);
    void this.router.navigate(['/trade/governance/document-profiles', profile.id], {
      ...(scopeParam ? { queryParams: { scope: scopeParam } } : {}),
    });
  }

  protected onRowKeydown(event: KeyboardEvent, profile: DocumentProfile): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openProfile(profile);
    }
  }

  protected liveVersionOf(profile: DocumentProfile): ProfileVersion | null {
    if (profile.currentPublishedVersionId) {
      const matched = profile.versions.find((v) => v.id === profile.currentPublishedVersionId);
      if (matched) return matched;
    }
    return profile.versions.find((v) => v.status === 'PUBLISHED') ?? null;
  }

  protected liveVersionText(profile: DocumentProfile): string {
    this.i18n();
    const live = this.liveVersionOf(profile);
    if (!live) return '—';
    return this.transloco.translate('profiles.list.liveVersion', {
      n: live.profileVersion,
      date: formatDateOnly(live.effectiveFrom, this.lang()),
    });
  }

  protected nextVersionOf(profile: DocumentProfile): ProfileVersion | null {
    const candidates = profile.versions.filter(
      (v) => v.status === 'SCHEDULED' || v.status === 'TESTED' || v.status === 'DRAFT',
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((best, item) => (item.profileVersion > best.profileVersion ? item : best));
  }

  protected nextStartsText(version: ProfileVersion): string {
    this.i18n();
    return this.transloco.translate('profiles.list.startsOn', {
      date: formatDateOnly(version.effectiveFrom, this.lang()),
    });
  }

  protected rowActions(_profile: DocumentProfile): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('profiles.list.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];
    if (this.canManage()) {
      items.push({
        id: 'newVersion',
        title: this.transloco.translate('profiles.list.actions.newVersion'),
        icon: 'tablerPlus',
        tile: 'bg-icon-green',
      });
    }
    return items;
  }

  protected onRowAction(profile: DocumentProfile, selection: ActionSelection): void {
    const scopeParam = this.scopeParamFor(profile.scopeTarget);
    if (selection.id === 'open') {
      this.openProfile(profile);
    } else if (selection.id === 'newVersion') {
      void this.router.navigate(['/trade/governance/document-profiles', profile.id], {
        queryParams: {
          newVersion: '1',
          ...(scopeParam ? { scope: scopeParam } : {}),
        },
      });
    }
  }

  private scopeParamFor(target: ScopeTarget): string | undefined {
    return target === 'TENANT' ? 'tenant' : undefined;
  }

  private async load(ctx: TradeContext): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const [list, counts] = await Promise.all([
        listProfiles({ limit: 100 }, ctx),
        getProfileCounts({}, ctx),
      ]);
      if (seq !== this.loadSeq) return;
      this.profiles.set(list.items);
      this.counts.set(counts);
      const pendingVersion = this.pendingVersionId();
      if (pendingVersion) {
        this.resolveVersionDeepLink(pendingVersion);
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

  private resolveVersionDeepLink(versionId: string): void {
    if (this.resolvedDeepLinkVersion === versionId) return;
    this.resolvedDeepLinkVersion = versionId;

    const owner = this.profiles().find((profile) => profile.versions.some((v) => v.id === versionId));
    if (owner) {
      const scopeParam = this.scopeParamFor(owner.scopeTarget);
      void this.router.navigate(['/trade/governance/document-profiles', owner.id, 'versions', versionId], {
        ...(scopeParam ? { queryParams: { scope: scopeParam } } : {}),
        replaceUrl: true,
      });
      return;
    }

    this.notify.warning(this.transloco.translate('profiles.list.versionNotInScope'));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { version: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
