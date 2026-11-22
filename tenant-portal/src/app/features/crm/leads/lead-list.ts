import { Signal, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../core/i18n/language';
import { Notify } from '../../../core/notify/notify';
import { ApiError } from '../settings/shared/settings-api';
import type { LeadDisqualify } from './lead-disqualify/lead-disqualify';
import { LeadSearchBody, WireNode } from './lead-search/lead-search.compile';
import { deleteLead, moveLead, searchLeads, updateLead } from './leads.api';
import { CardColor, LeadMoveError, LeadRow, LeadStage, Page, nameIn } from './leads.model';

/** Paged lead list for the Cards and Table views: offset paging per search and stage, plus row actions. */
export function leadList(
  body: Signal<LeadSearchBody>,
  stages: Signal<LeadStage[]>,
  stage: Signal<string> = signal('all'),
  page: Signal<number> = signal(1),
  pageSize: Signal<number> = signal(24),
  onPageChange?: (page: number) => void,
  onChanged?: () => void,
  disqualifyDialog?: () => LeadDisqualify | undefined,
) {
  const notify = inject(Notify);
  const transloco = inject(TranslocoService);
  const language = inject(LanguageState).current;

  const query = computed<LeadSearchBody>(() => {
    const base = body();
    const stageId = stage();
    if (!stageId || stageId === 'all') return base;
    const stageLeaf: WireNode = { field: 'stageId', operator: 'eq', value: stageId };
    const filterTree: WireNode = base.filterTree
      ? { op: 'AND', children: [base.filterTree, stageLeaf] }
      : stageLeaf;
    return { ...base, filterTree };
  });

  let lastPage: Page<LeadRow> | undefined;
  const pageResource = resource({
    params: () => ({ query: query(), page: page(), pageSize: pageSize() }),
    loader: async ({ params }) => {
      try {
        const res = await searchLeads(params.query, params.page, params.pageSize);
        if (res.items.length === 0 && params.page > 1) {
          const target = Math.max(1, Math.min(params.page - 1, res.totalPages || 1));
          if (target !== params.page) {
            onPageChange?.(target);
            const fallback = await searchLeads(params.query, target, params.pageSize);
            lastPage = fallback;
            return fallback;
          }
        }
        lastPage = res;
        return res;
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          notify.error(transloco.translate('leads.search.invalid'));
          return lastPage;
        }
        throw error;
      }
    },
  });
  const pageData = linkedSignal<Page<LeadRow> | undefined>(() => pageResource.value());

  async function move(lead: LeadRow, stageId: string) {
    if (stageId === lead.stageId) return;
    const target = stages().find((stage) => stage.id === stageId);
    if (!target) return;
    const stageName = nameIn(target, language());
    if (target.flag === 'CONVERTED') return notify.warning(transloco.translate('leads.move.convertRequired', { stage: stageName }));
    const dialog = target.flag === 'DISQUALIFIED' ? disqualifyDialog?.() : undefined;
    if (target.flag === 'DISQUALIFIED' && !dialog) return notify.warning(transloco.translate('leads.move.reasonRequired', { stage: stageName }));
    try {
      if (dialog) {
        if (!(await dialog.open(lead, target))) return;
      } else {
        await moveLead(lead.id, stageId);
      }
      onChanged?.();
      notify.success(transloco.translate('leads.move.done', { stage: stageName }));
      pageResource.reload();
    } catch (error) {
      const code = error instanceof LeadMoveError ? error.code : null;
      notify.error(transloco.translate(code ? 'leads.move.errors.' + code : 'leads.move.failed', { stage: stageName }));
    }
  }

  async function rate(lead: LeadRow, rating: number) {
    const before = pageData();
    pageData.update((current) => current && { ...current, items: current.items.map((item) => (item.id === lead.id ? { ...item, rating } : item)) });
    try {
      const saved = await updateLead(lead.id, { rating }, lead.updatedAt);
      pageData.update((current) => current && { ...current, items: current.items.map((item) => (item.id === lead.id ? saved : item)) });
    } catch {
      pageData.set(before);
      notify.error(transloco.translate('leads.rate.failed'));
    }
  }

  async function recolor(lead: LeadRow, cardColor: CardColor | null) {
    const before = pageData();
    pageData.update((current) => current && { ...current, items: current.items.map((item) => (item.id === lead.id ? { ...item, cardColor } : item)) });
    try {
      const saved = await updateLead(lead.id, { cardColor }, lead.updatedAt);
      pageData.update((current) => current && { ...current, items: current.items.map((item) => (item.id === lead.id ? saved : item)) });
    } catch {
      pageData.set(before);
      notify.error(transloco.translate('leads.color.failed'));
    }
  }

  async function remove(lead: LeadRow) {
    const before = pageData();
    pageData.update((current) => current && { ...current, items: current.items.filter((item) => item.id !== lead.id), total: Math.max(0, current.total - 1) });
    try {
      await deleteLead(lead.id);
      onChanged?.();
      notify.success(transloco.translate('leads.delete.done'));
      pageResource.reload();
    } catch {
      pageData.set(before);
      notify.error(transloco.translate('leads.delete.failed'));
    }
  }

  return {
    items: computed(() => pageData()?.items ?? []),
    total: computed(() => pageData()?.total ?? 0),
    loading: pageResource.isLoading,
    failed: computed(() => !!pageResource.error()),
    reload: () => pageResource.reload(),
    move,
    rate,
    recolor,
    remove,
  };
}
