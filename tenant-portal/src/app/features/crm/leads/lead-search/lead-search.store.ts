import { DestroyRef, Injectable, WritableSignal, inject, signal, resource } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  ParamMap,
  Router,
} from '@angular/router';
import { skip } from 'rxjs';
import { CurrentUser } from '../../../../core/auth/current-user';
import { FieldOption, rememberFieldOptions } from '../../../../shared/query-builder/query.model';
import { SearchFacet } from '../../../../shared/ui/facet-search/facet-search.model';
import { RecordSearchStore } from '../../shared/record/search/record-search-store';
import { defaultLeadQuery, emptyLeadQuery, facetsToQuery, queryToFacets } from './lead-search.chips';
import { LeadSearchBody, compileLeadQuery } from './lead-search.compile';
import { leadSearchFields } from './lead-search.fields';
import { settingsTimeZone } from '../../settings/shared/settings-time-zone';
import { runInCrm } from '../../shared/crm-runtime';

export const PARTY_FACET_FIELD = 'partyId';

export type LeadListSearchBody = LeadSearchBody & {
  partyId?: string;
  excludeId?: string;
};

export type LeadSearchInitContext = Omit<Parameters<typeof leadSearchFields>[0], 't' | 'language'> & {
  /** Current CRM branch (the page's branch context). Kept when a later init omits it. */
  branchId?: string;
};

interface PartyFilter {
  partyId: string;
  excludeId: string | null;
  partyLabel: string | null;
}

function readPartyFilter(params: ParamMap | null | undefined): PartyFilter | null {
  const partyId = params?.get('partyId')?.trim();
  if (!partyId) return null;
  const excludeId = params?.get('excludeId')?.trim() || null;
  const partyLabel = params?.get('partyLabel')?.trim() || null;
  return { partyId, excludeId, partyLabel };
}

function samePartyFilter(a: PartyFilter | null, b: PartyFilter | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.partyId === b.partyId && a.excludeId === b.excludeId && a.partyLabel === b.partyLabel;
}

@Injectable()
export class LeadSearchStore extends RecordSearchStore<LeadSearchInitContext, LeadListSearchBody> {
  private readonly loadedOwners: WritableSignal<FieldOption[]>;
  private readonly partyFilter: WritableSignal<PartyFilter | null>;
  private readonly branchId: WritableSignal<string>;
  private readonly leadRoute: ActivatedRoute | null;
  private readonly leadRouter: Router | null;
  private ownersLoadSeq = 0;
  private partyNavId: number | null = null;
  private pendingPartyDrop = false;
  private flushingPartyDrop = false;
  private partyDropSeq = 0;
  private storeDestroyed = false;

  constructor() {
    const currentUser = inject(CurrentUser, { optional: true });
    const route = inject(ActivatedRoute, { optional: true });
    const router = inject(Router, { optional: true });
    const destroyRef = inject(DestroyRef, { optional: true });
    const loadedOwners = signal<FieldOption[]>([]);
    const partyFilter = signal<PartyFilter | null>(readPartyFilter(route?.snapshot.queryParamMap));
    const branchId = signal('');
    const zone = resource({ params: () => branchId() || undefined,
      loader: () => runInCrm(() => settingsTimeZone()).catch(() => null) });

    super({
      fields: (ctx, { language, t }) =>
        leadSearchFields({
          ...ctx,
          ownerOptions: loadedOwners(),
          language,
          t,
          timeZone: zone.value() ?? null,
        }),
      compile: (query, _ctx, { currentUserId, timeZone }) => {
        const compiled = compileLeadQuery(query, {
          branchId: branchId(),
          meUserId: currentUserId,
          timeZone,
        });
        const body: LeadListSearchBody = { ...compiled };
        const party = partyFilter();
        if (party) {
          body.partyId = party.partyId;
          if (party.excludeId) {
            body.excludeId = party.excludeId;
          }
        }
        return {
          body,
          rejected: [],
        };
      },
      defaultQuery: () => (partyFilter() ? emptyLeadQuery() : defaultLeadQuery()),
      emptyQuery: () => emptyLeadQuery(),
      facetsToQuery: (facets, _ctx, { prev, fields }) => {
        const { query, rejected } = facetsToQuery(prev, facets, fields);
        return {
          query,
          rejected: rejected.map((item) => ({ field: item.field, reasonKey: item.code })),
        };
      },
      queryToFacets: (query, _ctx, { fields, language, t }) => {
        const base = queryToFacets(query, fields, t);
        const party = partyFilter();
        if (!party) return base;
        const translated = t('leads.sameParty');
        const label =
          translated && translated !== 'leads.sameParty'
            ? translated
            : language === 'ar'
              ? 'نفس الجهة'
              : 'Same party';
        return [
          {
            field: PARTY_FACET_FIELD,
            label,
            values: [{ value: party.partyId, label: party.partyLabel || party.partyId }],
          },
          ...base,
        ];
      },
      rejectedKeyPrefix: 'leadSearch.rejected.',
      currentUserId: () => currentUser?.userId() ?? '',
      timeZone: () => zone.value() ?? 'UTC',
      initialCtx: {
        stages: [],
        sources: [],
        tags: [],
        owners: async () => [],
      },
    });

    this.loadedOwners = loadedOwners;
    this.partyFilter = partyFilter;
    this.branchId = branchId;
    this.leadRoute = route;
    this.leadRouter = router;

    destroyRef?.onDestroy(() => {
      this.storeDestroyed = true;
    });

    if (router) {
      const events$ = destroyRef ? router.events.pipe(takeUntilDestroyed(destroyRef)) : router.events;
      events$.subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.partyNavId = event.id;
        } else if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError ||
          event instanceof NavigationSkipped
        ) {
          if (this.partyNavId === event.id) {
            this.partyNavId = null;
          }
          if (this.partyNavId === null && this.pendingPartyDrop) {
            queueMicrotask(() => void this.flushPartyDrop());
          }
        }
      });
    }

    if (route) {
      const qp$ = destroyRef
        ? route.queryParamMap.pipe(skip(1), takeUntilDestroyed(destroyRef))
        : route.queryParamMap.pipe(skip(1));
      qp$.subscribe((params) => {
        if (this.pendingPartyDrop || this.flushingPartyDrop) {
          if (!params.get('partyId')?.trim()) {
            this.pendingPartyDrop = false;
          }
          return;
        }
        const next = readPartyFilter(params);
        const prev = this.partyFilter();
        if (samePartyFilter(prev, next)) return;
        this.partyFilter.set(next);
        if (next && next.partyId !== prev?.partyId && !params.get('q')) {
          super.clear();
        }
      });
    }
  }

  override init(ctx: LeadSearchInitContext): void {
    if (ctx.branchId !== undefined && ctx.branchId !== this.branchId()) this.loadedOwners.set([]);
    if (ctx.branchId !== undefined) this.branchId.set(ctx.branchId.trim());
    const seq = ++this.ownersLoadSeq;
    const cacheOwners = (list: FieldOption[]) => {
      if (list.length === 0) return;
      rememberFieldOptions('owner', list);
      rememberFieldOptions('createdBy', list);
      this.loadedOwners.update((prev) => {
        const merged = new Map(prev.map((item) => [item.value, item]));
        let added = false;
        for (const item of list) {
          const existing = merged.get(item.value);
          if (!existing || existing.label !== item.label) {
            merged.set(item.value, item);
            added = true;
          }
        }
        return added ? Array.from(merged.values()) : prev;
      });
    };
    const wrappedOwners = async (term: string): Promise<FieldOption[]> => {
      const results = await ctx.owners(term);
      if (seq === this.ownersLoadSeq) cacheOwners(results);
      return results;
    };
    super.init({ ...ctx, owners: wrappedOwners });
    void wrappedOwners('').catch(() => {});
  }

  override setFacets(facets: SearchFacet[]): void {
    const hadParty = this.partyFilter() !== null;
    const hasParty = facets.some((item) => item.field === PARTY_FACET_FIELD);
    const rest = facets.filter((item) => item.field !== PARTY_FACET_FIELD);
    const prevRest = this.facets().filter((item) => item.field !== PARTY_FACET_FIELD);
    const restChanged =
      JSON.stringify(rest.map((f) => [f.field, f.values.map((v) => v.value)])) !==
      JSON.stringify(prevRest.map((f) => [f.field, f.values.map((v) => v.value)]));

    if (hadParty && !hasParty) {
      this.partyFilter.set(null);
      this.schedulePartyDrop();
    }

    if (restChanged || !hadParty) {
      super.setFacets(rest);
    }
  }

  override clear(): void {
    if (this.partyFilter() !== null) {
      this.partyFilter.set(null);
      this.schedulePartyDrop();
    }
    super.clear();
  }

  private schedulePartyDrop(): void {
    if (!this.leadRouter || !this.leadRoute) return;
    this.pendingPartyDrop = true;
    const seq = ++this.partyDropSeq;
    queueMicrotask(() => {
      if (seq === this.partyDropSeq) {
        void this.flushPartyDrop();
      }
    });
  }

  private async flushPartyDrop(): Promise<void> {
    if (
      this.storeDestroyed ||
      !this.pendingPartyDrop ||
      this.flushingPartyDrop ||
      !this.leadRouter ||
      !this.leadRoute ||
      this.partyNavId !== null ||
      this.leadRouter.currentNavigation() !== null
    ) {
      return;
    }
    this.pendingPartyDrop = false;
    this.flushingPartyDrop = true;
    try {
      await this.leadRouter.navigate([], {
        relativeTo: this.leadRoute,
        queryParams: { partyId: null, excludeId: null, partyLabel: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } catch {
      // Ignore navigation failures when route is torn down.
    } finally {
      this.flushingPartyDrop = false;
    }
  }
}
