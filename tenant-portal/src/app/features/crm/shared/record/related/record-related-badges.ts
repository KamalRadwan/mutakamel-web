import { LocationStrategy } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, input, output, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NavigationEnd, Route, Router, Routes, UrlTree } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerFileDescription,
  tablerFileInvoice,
  tablerShoppingCart,
  tablerTargetArrow,
  tablerUserSearch,
} from '@ng-icons/tabler-icons';
import { filter } from 'rxjs';
import { relatedCounts, relatedCountsRevision } from './related-records.api';
import {
  DEFAULT_RELATED_KINDS,
  RELATED_KIND_META,
  RELATED_LIST_LINKS,
  RelatedBadgeClickEvent,
  RelatedCounts,
  RelatedKind,
  RelatedLinkFn,
  RelatedLinkTarget,
  RelatedHostType,
} from './related-records.model';

interface RelatedBadgeItem {
  kind: RelatedKind;
  icon: string;
  label: string;
  count: number;
  ariaLabel: string;
  target: RelatedLinkTarget;
  urlTree: UrlTree;
  href: string;
  isLink: boolean;
  unavailableTitle: string | null;
}

type RouteWithLoadedChildren = Route & { _loadedRoutes?: Routes };

function splitSegments(raw: string): string[] {
  return raw
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function normalizeCommands(commands: readonly string[]): string[] {
  return commands.flatMap((part) => splitSegments(part));
}

function isRouteRegistered(routes: Routes, commands: readonly string[]): boolean {
  const targetSegments = normalizeCommands(commands);
  if (targetSegments.length === 0) return false;

  const walk = (list: Routes, remaining: readonly string[], consumed: number): boolean => {
    for (const route of list) {
      if (route.path === '**') continue;
      const routeSegments = splitSegments(route.path ?? '');
      if (routeSegments.length > remaining.length) continue;

      let matched = true;
      for (let i = 0; i < routeSegments.length; i++) {
        const seg = routeSegments[i];
        if (!seg.startsWith(':') && seg !== remaining[i]) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;

      const nextConsumed = consumed + routeSegments.length;
      const tail = remaining.slice(routeSegments.length);
      if (tail.length === 0) {
        return true;
      }

      if (route.children && walk(route.children, tail, nextConsumed)) {
        return true;
      }

      const loadedChildren = (route as RouteWithLoadedChildren)._loadedRoutes;
      if (loadedChildren) {
        if (walk(loadedChildren, tail, nextConsumed)) {
          return true;
        }
        continue;
      }

      if (route.loadChildren && nextConsumed >= 2) {
        return true;
      }
    }
    return false;
  };

  return walk(routes, targetSegments, 0);
}

@Component({
  selector: 'app-record-related-badges',
  imports: [NgIcon, TranslocoPipe],
  providers: [
    provideTranslocoScope({ scope: 'record-related', alias: 'recordRelated' }),
    provideIcons({
      tablerUserSearch,
      tablerTargetArrow,
      tablerFileDescription,
      tablerShoppingCart,
      tablerFileInvoice,
    }),
  ],
  templateUrl: './record-related-badges.html',
  host: {
    class: 'block max-w-full',
    '[hidden]': '!visible()',
  },
})
export class RecordRelatedBadges {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  private readonly locationStrategy = inject(LocationStrategy, { optional: true });
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly navTick = toSignal(this.router.events.pipe(filter((event) => event instanceof NavigationEnd)), {
    initialValue: null,
  });

  /**
   * LEAD and CUSTOMER_PROFILE read the related-counts endpoint. OPPORTUNITY hosts
   * must pass `loadCounts` (their counts come from the opportunities API).
   */
  readonly recordType = input.required<RelatedHostType>();
  readonly recordId = input.required<string>();
  readonly branchId = input('');
  readonly partyLabel = input<string | null>(null);
  readonly layout = input<'modal' | 'page'>('page');
  readonly kinds = input<readonly RelatedKind[]>(DEFAULT_RELATED_KINDS);
  readonly loadCounts = input<((recordId: string) => Promise<Partial<RelatedCounts> | null>) | null>(null);
  readonly links = input<Partial<Record<RelatedKind, RelatedLinkFn>>>({});

  readonly badgeClick = output<RelatedBadgeClickEvent>();

  private readonly countsResource = resource({
    params: () => {
      const id = this.recordId().trim();
      if (!id) return undefined;
      return {
        recordType: this.recordType(),
        recordId: id,
        branchId: this.branchId(),
        loader: this.loadCounts(),
        rev: relatedCountsRevision(),
      };
    },
    loader: async ({ params }) => {
      if (params.loader) return params.loader(params.recordId);
      if (params.recordType === 'OPPORTUNITY') return null;
      return relatedCounts(params.branchId, params.recordType, params.recordId);
    },
  });

  protected readonly loading = computed(() => this.countsResource.isLoading());

  private readonly loadedCounts = computed<Partial<RelatedCounts> | null>(() => {
    if (this.countsResource.error() || !this.countsResource.hasValue()) return null;
    return this.countsResource.value() ?? null;
  });

  protected readonly items = computed<RelatedBadgeItem[]>(() => {
    this.i18n();
    this.navTick();
    const data = this.loadedCounts();
    if (!data) return [];

    const recordId = this.recordId().trim();
    const recordType = this.recordType();
    const partyId = data.partyId ?? null;
    const partyLabel = this.partyLabel();
    const customLinks = this.links();
    const unavailableText = this.transloco.translate('recordRelated.unavailable');

    const result: RelatedBadgeItem[] = [];
    for (const kind of this.kinds()) {
      const rawCount = data[kind];
      if (typeof rawCount !== 'number' || !Number.isFinite(rawCount)) continue;

      const meta = RELATED_KIND_META[kind];
      const label = this.transloco.translate(meta.labelKey);
      const ariaLabel = this.transloco.translate('recordRelated.badgeAria', {
        label,
        count: rawCount,
      });

      const linkFn = customLinks[kind] ?? RELATED_LIST_LINKS[kind];
      const target = linkFn({ recordId, partyId, partyLabel, recordType });
      const routeAvailable = isRouteRegistered(this.router.config, target.commands);
      const isLink = rawCount > 0 && routeAvailable;
      const urlTree = this.router.createUrlTree(target.commands, { queryParams: target.queryParams });
      const serialized = this.router.serializeUrl(urlTree);
      const href = this.locationStrategy ? this.locationStrategy.prepareExternalUrl(serialized) : serialized;

      result.push({
        kind,
        icon: meta.icon,
        label,
        count: rawCount,
        ariaLabel,
        target,
        urlTree,
        href,
        isLink,
        unavailableTitle: routeAvailable ? null : unavailableText,
      });
    }

    return result;
  });

  protected readonly visible = computed(() => this.loading() || this.items().length > 0);

  constructor() {
    effect((onCleanup) => {
      const el = this.host.nativeElement;
      const isVisible = this.visible();
      const parent = el.parentElement;
      if (!parent?.classList.contains('empty:hidden')) return;
      const hasVisibleSibling = Array.from(parent.children).some(
        (child) => child !== el && !(child as HTMLElement).hidden,
      );
      parent.hidden = !isVisible && !hasVisibleSibling;
      onCleanup(() => {
        parent.hidden = false;
      });
    });
  }

  protected onLinkClick(item: RelatedBadgeItem, event: MouseEvent): void {
    if (!item.isLink) return;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    this.badgeClick.emit({ kind: item.kind, target: item.target, event });
    if (event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    void this.router.navigateByUrl(item.urlTree);
  }
}
