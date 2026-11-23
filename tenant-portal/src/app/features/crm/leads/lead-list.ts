import { Signal, computed, effect, inject, linkedSignal, resource, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../core/i18n/language';
import { Notify } from '../../../core/notify/notify';
import { ApiError, crmSettingsError } from '../settings/shared/settings-api';
import type { LeadDisqualify } from './lead-disqualify/lead-disqualify';
import { LeadSearchBody, WireNode } from './lead-search/lead-search.compile';
import { deleteLead, moveLead, searchLeads, updateLead } from './leads.api';
import { CardColor, LeadsCapabilities, LeadRow, LeadStage, Page, nameIn, leadActionAllowed } from './leads.model';

/** Optional domain codes must fall through without issuing missing-translation warnings. */
export function leadErrorState(transloco: TranslocoService, error: unknown) {
  return crmSettingsError((key, params) => Object.hasOwn(transloco.getTranslation(), key)
    ? transloco.translate(key, params) : key, error, 'leads');
}

/** Shared list-action state. A stale edit is kept locally only after reading a new token. */
export function leadWriteState(
  capabilities: Signal<LeadsCapabilities | null>,
  reload: () => void,
  readFresh: (id: string) => Promise<LeadRow | undefined>,
  patch: (row: LeadRow) => void,
) {
  const notify = inject(Notify);
  const transloco = inject(TranslocoService);
  const readOnly = signal(false);
  const conflictOpen = signal(false);
  let pending: { lead: LeadRow; changes: { rating?: number; cardColor?: CardColor | null } } | undefined;
  let actionBranch: string | undefined;
  effect(() => {
    const branchId = capabilities()?.branchId;
    if (branchId && branchId !== actionBranch) {
      actionBranch = branchId;
      pending = undefined;
      readOnly.set(false);
      conflictOpen.set(false);
    }
  });
  return {
    readOnly, conflictOpen,
    canUpdate: (row: LeadRow) => !readOnly() && leadActionAllowed(capabilities()?.leads.update, row),
    canDelete: (row: LeadRow) => !readOnly() && leadActionAllowed(capabilities()?.leads.delete, row),
    async failure(error: unknown, fallbackKey: string, edit?: typeof pending) {
      const mapped = leadErrorState(transloco, error);
      if (mapped.readOnly) readOnly.set(true);
      if (error instanceof ApiError && error.code === 'CRM.LEAD.CONCURRENT_UPDATE' && edit) {
        pending = edit;
        conflictOpen.set(true);
        try {
          const fresh = await readFresh(edit.lead.id);
          if (fresh && pending === edit) patch(fresh);
        } catch (readError) {
          notify.error(leadErrorState(transloco, readError).message);
        }
        return;
      }
      if (error instanceof ApiError && (error.code === 'LEAD_ALREADY_CONVERTED' || error.code === 'GW.IDEM.MISMATCH'
        || error.code.endsWith('_IDEMPOTENCY_MISMATCH'))) reload();
      const moveKey = error instanceof ApiError && ['LEAD_CONVERSION_REQUIRED', 'LEAD_STAGE_INVALID',
        'CRM_REASON_REQUIRED', 'CRM_REASON_KIND_MISMATCH', 'CRM_REASON_UNAVAILABLE', 'LEAD_ALREADY_CONVERTED'].includes(error.code)
        ? `leads.move.errors.${error.code}` : '';
      const moveMessage = moveKey ? transloco.translate(moveKey) : '';
      notify.error(error instanceof ApiError && error.status === 401 ? transloco.translate('leads.notSaved')
        : moveMessage && moveMessage !== moveKey ? moveMessage
        : error instanceof ApiError ? mapped.message : transloco.translate(fallbackKey));
    },
    reloadConflict() { pending = undefined; conflictOpen.set(false); reload(); },
    async keepConflict() {
      if (!pending) return;
      try {
        const fresh = await readFresh(pending.lead.id);
        if (fresh) patch({ ...fresh, ...pending.changes });
        pending = undefined;
        conflictOpen.set(false);
      } catch (error) {
        notify.error(leadErrorState(transloco, error).message);
      }
    },
  };
}

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
  capabilities: Signal<LeadsCapabilities | null> = signal(null),
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
  let lastBranch = '';
  const pageResource = resource({
    params: () => query().branchId ? { query: query(), page: page(), pageSize: pageSize() } : undefined,
    loader: async ({ params }) => {
      if (lastBranch !== params.query.branchId) { lastPage = undefined; lastBranch = params.query.branchId; }
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
        if (params.query.branchId === body().branchId) lastPage = res;
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
  const writes = leadWriteState(capabilities, () => { pageResource.reload(); },
    async (id) => (await searchLeads({ branchId: body().branchId, filterTree: { field: 'id', operator: 'eq', value: id } }, 1, 1)).items[0],
    (row) => pageData.update((current) => current && { ...current, items: current.items.map((item) => item.id === row.id ? row : item) }));

  async function move(lead: LeadRow, stageId: string) {
    if (!writes.canUpdate(lead)) return;
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
      await writes.failure(error, 'leads.move.failed');
    }
  }

  async function rate(lead: LeadRow, rating: number) {
    if (!writes.canUpdate(lead)) return;
    const before = pageData();
    pageData.update((current) => current && { ...current, items: current.items.map((item) => (item.id === lead.id ? { ...item, rating } : item)) });
    try {
      const saved = await updateLead(lead.id, { rating }, lead.updatedAt);
      pageData.update((current) => current && { ...current, items: current.items.map((item) => (item.id === lead.id ? saved : item)) });
      onChanged?.();
    } catch (error) {
      pageData.set(before);
      await writes.failure(error, 'leads.rate.failed', { lead, changes: { rating } });
    }
  }

  async function recolor(lead: LeadRow, cardColor: CardColor | null) {
    if (!writes.canUpdate(lead)) return;
    const before = pageData();
    pageData.update((current) => current && { ...current, items: current.items.map((item) => (item.id === lead.id ? { ...item, cardColor } : item)) });
    try {
      const saved = await updateLead(lead.id, { cardColor }, lead.updatedAt);
      pageData.update((current) => current && { ...current, items: current.items.map((item) => (item.id === lead.id ? saved : item)) });
    } catch (error) {
      pageData.set(before);
      await writes.failure(error, 'leads.color.failed', { lead, changes: { cardColor } });
    }
  }

  async function remove(lead: LeadRow) {
    if (!writes.canDelete(lead)) return;
    const before = pageData();
    pageData.update((current) => current && { ...current, items: current.items.filter((item) => item.id !== lead.id), total: Math.max(0, current.total - 1) });
    try {
      await deleteLead(lead.id);
      onChanged?.();
      notify.success(transloco.translate('leads.delete.done'));
      pageResource.reload();
    } catch (error) {
      pageData.set(before);
      await writes.failure(error, 'leads.delete.failed');
    }
  }

  return {
    writes,
    errorState: computed(() => leadErrorState(transloco, pageResource.error())),
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
