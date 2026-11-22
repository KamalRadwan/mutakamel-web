import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NavigationEnd, Params, Route, Router, RouterLink, Routes } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerFileInvoice, tablerLock, tablerPlus } from '@ng-icons/tabler-icons';
import { filter } from 'rxjs';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { errorCodeOf } from '../../../settings/shared/settings-api';
import { listLinkedQuotations } from '../../opportunities.api';
import { LinkedQuotation, formatMoney } from '../../opportunities.model';
import { formatShortDate } from '../../opportunity-card/opportunity-card';

type RouteWithLoadedChildren = Route & { _loadedRoutes?: Routes };
type LinkedQuotationWithOwner = LinkedQuotation & {
  ownerDisplayName?: string | null;
  ownerName?: string | null;
};

const PAGE_SIZE = 20;
const SKELETON_ROWS = [1, 2, 3, 4];

const STATUS_BADGE_CLASSES: Record<string, string> = {
  ACCEPTED: 'bg-success-soft text-on-success-soft',
  CONVERTED: 'bg-success-soft text-on-success-soft',
  SENT: 'bg-brand-soft text-on-brand-soft',
  REJECTED: 'bg-danger-soft text-on-danger-soft',
  EXPIRED: 'bg-danger-soft text-on-danger-soft',
  DRAFT: 'bg-neutral-soft text-on-neutral-soft',
  CANCELLED: 'bg-neutral-soft text-on-neutral-soft',
};

function splitSegments(raw: string): string[] {
  return raw
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isRouteRegistered(routes: Routes, commands: readonly string[]): boolean {
  const targetSegments = commands.flatMap((part) => splitSegments(part));
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
      if (tail.length === 0) return true;

      if (route.children && walk(route.children, tail, nextConsumed)) {
        return true;
      }

      const loadedChildren = (route as RouteWithLoadedChildren)._loadedRoutes;
      if (loadedChildren) {
        if (walk(loadedChildren, tail, nextConsumed)) return true;
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

function errorStatusOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return null;
}

/** Linked Trade quotations table for an opportunity with create shortcut and pagination. */
@Component({
  selector: 'app-opportunity-quotations-tab',
  imports: [RouterLink, NgIcon, TranslocoPipe, Button, Pagination],
  providers: [provideIcons({ tablerFileInvoice, tablerLock, tablerPlus })],
  templateUrl: './opportunity-quotations-tab.html',
  host: { class: 'block' },
})
export class OpportunityQuotationsTab {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly navTick = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    { initialValue: null },
  );

  readonly opportunityId = input.required<string>();
  readonly customerProfileId = input<string | null>(null);
  readonly canCreate = input(true);

  protected readonly gridCols =
    'minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1fr) minmax(0,1fr)';
  protected readonly pageSize = PAGE_SIZE;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly page = signal(1);
  protected readonly items = signal<LinkedQuotation[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly denied = signal(false);
  protected readonly loadFailed = signal(false);

  private loadSeq = 0;
  private loadedOpportunityId: string | null = null;

  protected readonly canShowNew = computed(() => {
    this.navTick();
    return (
      this.canCreate() &&
      !this.denied() &&
      !this.loadFailed() &&
      isRouteRegistered(this.router.config, ['/trade/documents/quotations/new'])
    );
  });

  protected readonly canOpenRow = computed(() => {
    this.navTick();
    return isRouteRegistered(this.router.config, ['/trade/documents/quotations', '_id']);
  });

  protected readonly newQueryParams = computed<Params>(() => {
    const params: Record<string, string> = { crmOpportunityId: this.opportunityId().trim() };
    const custId = this.customerProfileId()?.trim();
    if (custId) params['customerProfileId'] = custId;
    return params;
  });

  constructor() {
    effect(() => {
      const id = this.opportunityId().trim();
      if (!id) return;
      const currentPage = this.page();

      untracked(() => {
        if (this.loadedOpportunityId !== id) {
          this.loadedOpportunityId = id;
          if (currentPage !== 1) {
            this.page.set(1);
            return;
          }
        }
        void this.loadPage(id, currentPage);
      });
    });
  }

  protected retry(): void {
    const id = this.opportunityId().trim();
    if (!id) return;
    void this.loadPage(id, this.page());
  }

  protected onPageChange(nextPage: number): void {
    if (nextPage === this.page()) return;
    this.page.set(nextPage);
  }

  protected rowNumber(row: LinkedQuotation): string {
    return row.documentNumber?.trim() || row.draftReference?.trim() || '—';
  }

  protected statusLabel(status: string): string {
    this.i18n();
    const key = `oppPage.quotations.status.${status}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : status;
  }

  protected statusClass(status: string): string {
    return STATUS_BADGE_CLASSES[status] ?? 'bg-neutral-soft text-on-neutral-soft';
  }

  protected dateText(raw: string): string {
    return formatShortDate(raw, this.language()) ?? '—';
  }

  protected amountText(row: LinkedQuotation): string {
    return formatMoney(row.grandTotal, row.currencyCode, this.language());
  }

  protected ownerText(row: LinkedQuotation): string {
    const withOwner = row as LinkedQuotationWithOwner;
    return withOwner.ownerDisplayName?.trim() || withOwner.ownerName?.trim() || '—';
  }

  private async loadPage(id: string, page: number): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.denied.set(false);
    this.loadFailed.set(false);

    try {
      const res = await listLinkedQuotations(id, page, PAGE_SIZE);
      if (seq !== this.loadSeq || this.opportunityId().trim() !== id) return;
      this.items.set(res.items);
      this.total.set(res.total);
    } catch (error) {
      if (seq !== this.loadSeq || this.opportunityId().trim() !== id) return;
      const status = errorStatusOf(error);
      const code = errorCodeOf(error);
      if (status === 403 || code === 'CRM_SCOPED_PERMISSION_DENIED') {
        this.denied.set(true);
        this.items.set([]);
        this.total.set(0);
      } else {
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
