import { Component, Injector, computed, inject, input, linkedSignal, resource, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus, tablerRefresh } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { Segmented, SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { type TradeContext, tradeContext } from '../../shared/trade-api';
import type { Page } from '../../shared/trade-foundation.model';
import {
  canCreateConfigDefinition,
  hasConfigReadGrant,
  hasConfigScopeGrant,
  isForbiddenError,
} from './configuration-access';
import { listDefinitions } from './configuration.api';
import {
  type ConfigDefinition,
  type ConfigDefinitionDetail,
  SCOPE_TARGETS,
  type ScopeTarget,
} from './configuration.model';
import { DefinitionCreateModal } from './definition-create-modal/definition-create-modal';
import { DefinitionModal } from './definition-modal/definition-modal';
import { DefinitionsTable } from './definitions-table/definitions-table';
import { VersionModal } from './version-modal/version-modal';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZES: readonly number[] = [12, 24, 48, 96];

const PARAM_TO_SCOPE: Record<string, ScopeTarget> = {
  tenant: 'TENANT',
  company: 'COMPANY',
  branch: 'BRANCH',
};

const SCOPE_TO_PARAM: Record<ScopeTarget, string> = {
  TENANT: 'tenant',
  COMPANY: 'company',
  BRANCH: 'branch',
};

function parseScopeParam(raw: string | undefined): ScopeTarget {
  const normalized = raw?.trim().toLowerCase() ?? '';
  return PARAM_TO_SCOPE[normalized] ?? 'COMPANY';
}

function parsePage(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parsePageSize(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function ctxKey(ctx: TradeContext, target: ScopeTarget): string {
  return `${target}:${ctx.companyId ?? ''}:${ctx.branchId ?? ''}`;
}

@Component({
  selector: 'app-trade-configuration-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Field,
    Segmented,
    Button,
    FullState,
    Pagination,
    DefinitionsTable,
    DefinitionModal,
    VersionModal,
    DefinitionCreateModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-config', alias: 'tradeConfig' }),
    provideIcons({ tablerPlus, tablerRefresh }),
  ],
  templateUrl: './configuration-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class ConfigurationPage {
  private static nextId = 0;
  protected readonly uid = `trade-config-page-${++ConfigurationPage.nextId}`;

  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scopeState = inject(ScopeState);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly definitionModal = viewChild.required(DefinitionModal);
  private readonly versionModal = viewChild.required(VersionModal);
  private readonly createModal = viewChild.required(DefinitionCreateModal);

  readonly scopeParam = input<string | undefined>(undefined, { alias: 'scope' });
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => hasConfigReadGrant(this.injector));
  protected readonly canCreateDefinition = computed(
    () => !this.isForbidden() && canCreateConfigDefinition(this.injector),
  );
  protected readonly canManageAtScope = computed(
    () =>
      !this.isForbidden() &&
      hasConfigScopeGrant(this.injector, this.scopeState, 'trade.configuration.manage', this.scopeTarget()),
  );
  protected readonly canPublishAtScope = computed(
    () =>
      !this.isForbidden() &&
      hasConfigScopeGrant(this.injector, this.scopeState, 'trade.policy.publish', this.scopeTarget()),
  );
  protected readonly pageSizes = [...PAGE_SIZES];

  protected readonly scopeTarget = linkedSignal<string | undefined, ScopeTarget>({
    source: () => this.scopeParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parseScopeParam(param);
      return previous?.value ?? parseScopeParam(param);
    },
  });

  protected readonly page = linkedSignal<string | undefined, number>({
    source: () => this.pageParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parsePage(param);
      return previous?.value ?? parsePage(param);
    },
  });

  protected readonly pageSize = linkedSignal<string | undefined, number>({
    source: () => this.sizeParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parsePageSize(param);
      return previous?.value ?? parsePageSize(param);
    },
  });

  protected readonly ctx = computed<TradeContext>(() => tradeContext(this.scopeState, this.scopeTarget()));
  private readonly reloadTick = signal(0);

  private readonly definitionsResource = resource({
    params: () => {
      if (!this.canRead() || this.forbidden()) return undefined;
      return {
        ctx: this.ctx(),
        target: this.scopeTarget(),
        page: this.page(),
        limit: this.pageSize(),
        tick: this.reloadTick(),
      };
    },
    loader: ({ params }) => listDefinitions(params.ctx, { page: params.page, limit: params.limit }),
  });

  private readonly resourceForbidden = computed(
    () => this.definitionsResource.status() === 'error' && isForbiddenError(this.definitionsResource.error()),
  );

  protected readonly isForbidden = computed(
    () => !this.canRead() || this.forbidden() || this.resourceForbidden(),
  );

  private readonly cachedPage = linkedSignal<
    { key: string; loading: boolean; hasValue: boolean; value: Page<ConfigDefinition> | undefined },
    Page<ConfigDefinition> | null
  >({
    source: () => ({
      key: ctxKey(this.ctx(), this.scopeTarget()),
      loading: this.definitionsResource.isLoading(),
      hasValue: this.definitionsResource.hasValue(),
      value: this.definitionsResource.hasValue() ? this.definitionsResource.value() : undefined,
    }),
    computation: (src, previous) => {
      if (src.hasValue && src.value) {
        return src.value;
      }
      if (previous && src.key === previous.source.key) {
        return previous.value;
      }
      return null;
    },
  });

  protected readonly items = computed<ConfigDefinition[]>(() => this.cachedPage()?.items ?? []);
  protected readonly total = computed<number>(() => this.cachedPage()?.total ?? 0);
  protected readonly initialLoading = computed(
    () => this.definitionsResource.isLoading() && this.cachedPage() === null,
  );
  protected readonly loadFailed = computed(
    () =>
      this.definitionsResource.status() === 'error' &&
      !this.resourceForbidden() &&
      this.cachedPage() === null,
  );

  protected readonly scopeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return SCOPE_TARGETS.map((value) => ({
      value,
      label: this.transloco.translate(`tradeConfig.scope.${value}`),
    }));
  });

  protected readonly showingLabel = computed(() => this.showingLabelFor(this.scopeTarget()));

  protected readonly scopeSubtitle = computed(() => this.scopeSubtitleFor(this.scopeTarget()));

  protected onScopeChange(nextValue: string | null): void {
    if (nextValue !== 'TENANT' && nextValue !== 'COMPANY' && nextValue !== 'BRANCH') return;
    if (nextValue === this.scopeTarget()) return;
    this.scopeTarget.set(nextValue);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      queryParams: {
        scope: SCOPE_TO_PARAM[nextValue],
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageChange(nextPage: number): void {
    const clamped = Math.max(DEFAULT_PAGE, nextPage);
    if (clamped === this.page()) return;
    this.page.set(clamped);
    void this.router.navigate([], {
      queryParams: { page: clamped === DEFAULT_PAGE ? null : clamped },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageSizeChange(nextSize: number): void {
    if (!PAGE_SIZES.includes(nextSize) || nextSize === this.pageSize()) return;
    this.pageSize.set(nextSize);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      queryParams: {
        size: nextSize === DEFAULT_PAGE_SIZE ? null : nextSize,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
  }

  protected reload(): void {
    if (this.isForbidden()) return;
    this.reloadTick.update((n) => n + 1);
  }

  protected openCreateDefinition(): void {
    if (!this.canCreateDefinition()) return;
    this.onScopeChange('TENANT');
    this.createModal().open();
  }

  protected openDefinition(def: ConfigDefinition): void {
    this.definitionModal().open(def);
  }

  protected openCreateVersion(
    def: ConfigDefinition | ConfigDefinitionDetail,
    scopeOverride?: ScopeTarget,
  ): void {
    const target = scopeOverride ?? this.scopeTarget();
    const canManageTarget = hasConfigScopeGrant(
      this.injector,
      this.scopeState,
      'trade.configuration.manage',
      target,
    );
    if (this.isForbidden() || !canManageTarget || !def.allowedScopes.includes(target)) return;
    this.versionModal().open(def, {
      scopeTarget: target,
      ctx: tradeContext(this.scopeState, target),
      scopeLabel: this.scopeSubtitleFor(target),
    });
  }

  protected onModalNewVersionRequested(ev: {
    definition: ConfigDefinitionDetail;
    scopeTarget: ScopeTarget;
  }): void {
    this.openCreateVersion(ev.definition, ev.scopeTarget);
  }

  protected onDefinitionCreated(): void {
    this.reload();
  }

  protected onVersionCreated(): void {
    this.reload();
    this.definitionModal().refresh();
  }

  protected onVersionReloadRequested(): void {
    this.reload();
    this.definitionModal().refresh();
  }

  protected onDefinitionChanged(): void {
    this.reload();
  }

  private showingLabelFor(target: ScopeTarget): string {
    this.i18n();
    if (target === 'TENANT') {
      return this.transloco.translate('tradeConfig.scope.TENANT');
    }
    const lang = this.language();
    const company = this.scopeState.company();
    const companyName = lang === 'ar' ? (company?.nameAr ?? '') : (company?.nameEn ?? '');
    if (target === 'COMPANY') {
      return companyName;
    }
    const branch = this.scopeState.branch();
    const branchName = lang === 'ar' ? (branch?.nameAr ?? '') : (branch?.nameEn ?? '');
    return this.transloco.translate('tradeConfig.page.showingPair', {
      company: companyName,
      branch: branchName,
    });
  }

  private scopeSubtitleFor(target: ScopeTarget): string {
    this.i18n();
    const scopeName = this.transloco.translate(`tradeConfig.scope.${target}`);
    if (target === 'TENANT') return scopeName;
    return `${scopeName} · ${this.showingLabelFor(target)}`;
  }
}
