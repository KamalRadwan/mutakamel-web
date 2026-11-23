import { DestroyRef, Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { QueryClient, QueryKey } from '@tanstack/angular-query';
import { ApiError, errorMessage } from '../api/api-errors';
import { AuthSession } from '../auth/auth-session';
import { hasScopedPermission } from '../auth/scoped-permission';
import { Notify } from '../notify/notify';
import { TenantScopeState } from '../scope/tenant-scope';
import { RealtimeClient } from './realtime-client';
import type { RealtimeEventData, RealtimeRecovery } from './realtime-client.model';
import { RealtimeError } from './realtime-errors';

type LeadChange = RealtimeEventData<'crm.leads.changed.v1'>['payload'];
const MAX_REVISIONS = 512;
const MAX_PENDING_LEADS = 128;
const MAX_FALLBACK_ATTEMPTS = 6;
const FALLBACK_INTERVAL_MS = 60_000;

/** Each tab refreshes its own cache from the one app socket's validated TabBus feed. */
@Service()
export class CrmEvents {
  private readonly realtime = inject(RealtimeClient);
  private readonly session = inject(AuthSession);
  private readonly scope = inject(TenantScopeState);
  private readonly notify = inject(Notify);
  private readonly translator = inject(TranslocoService);
  private readonly queries = signal<QueryClient | null>(null);
  private readonly refreshError = signal<unknown>(null);
  private readonly refreshing = signal(false);
  readonly stale = computed(() => this.realtime.stale() || this.refreshing() || this.refreshError() !== null);
  readonly error = this.refreshError.asReadonly();

  private generation = 0;
  private destroyed = false;
  private running = false;
  private fullResync = false;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly pending = new Map<string, LeadChange>();
  private readonly revisions = new Map<string, bigint>();
  private readonly recoveries = new Map<string, RealtimeRecovery['scope']>();
  private readonly completedRecoveries = new Set<string>();
  private notice: { title: string; text: string } | null = null;

  constructor() {
    const offChange = this.realtime.on('crm.leads.changed.v1', ({ payload }) => this.changed(payload));
    const offRecovery = this.realtime.onRecovery((recovery) => this.recover(recovery));

    effect(() => {
      const client = this.queries();
      const me = this.session.status() === 'signed-in' ? this.session.me() : null;
      // Authorization and selection changes invalidate requests started under the old context.
      this.scope.selection();
      untracked(() => {
        this.generation++;
        this.clearTimer();
        this.pending.clear();
        this.revisions.clear();
        this.recoveries.clear();
        this.completedRecoveries.clear();
        this.fullResync = false;
        this.attempts = 0;
        this.refreshError.set(null);
        if (client) {
          // Removing cancels old requests before another identity can reuse their results.
          client.removeQueries({ predicate: ({ queryKey }) => isLeadCache(queryKey) });
        }
        if (client && me && this.canRead()) {
          for (const recovery of this.realtime.recoveries()) this.recover(recovery);
        }
      });
    });

    effect(() => {
      this.queries();
      this.session.me();
      this.session.status();
      const connection = this.realtime.connection();
      const recoveries = this.realtime.recoveries();
      untracked(() => {
        if (!this.active()) return;
        for (const recovery of recoveries) this.recover(recovery);
        if (connection.status === 'connected' && !this.fullResync && this.refreshError() === null) {
          this.clearTimer();
          this.attempts = 0;
        } else if (connection.status !== 'idle' && connection.status !== 'connecting') {
          this.scheduleFallback();
        }
      });
    });

    effect(() => {
      const active = this.queries() !== null && this.session.status() === 'signed-in' && this.canRead();
      const connection = this.realtime.connection();
      const error = this.refreshError();
      const exhausted = this.attempts >= MAX_FALLBACK_ATTEMPTS;
      // Existing bilingual, always-loaded messages and the approved lost-connection toast.
      const translate = (key: string, params?: Record<string, unknown>) => this.translator.translate(key, params);
      untracked(() => {
        if (active && (error !== null || ['stale', 'failed', 'unavailable'].includes(connection.status))) {
          const cause = error ?? (connection.failure ? new RealtimeError(connection.failure) : null);
          const title = translate('session.connectionLost.title');
          const text = cause ? errorMessage(cause, 'realtime', translate)
            : translate(exhausted ? 'session.loadFailed.text' : 'session.connectionLost.text');
          this.notify.connectionLost(title, text);
          this.notice = { title, text };
        } else if (!active || connection.status === 'connected') {
          this.clearNotice();
        }
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.generation++;
      this.clearTimer();
      offChange();
      offRecovery();
      this.clearNotice();
    });
  }

  bind(client: QueryClient): void {
    if (this.queries() !== client) this.queries.set(client);
  }

  /** Explicit user retry starts a fresh bounded HTTP fallback window. */
  retry(): void {
    if (!this.active()) return;
    this.attempts = 0;
    this.clearTimer();
    this.fullResync = true;
    this.realtime.retry();
    this.enqueue();
  }

  private canRead(): boolean {
    return hasScopedPermission(this.session.me()?.permissions ?? [], 'crm.leads.read');
  }

  private active(): boolean {
    return !this.destroyed && this.queries() !== null && this.session.status() === 'signed-in' && this.canRead();
  }

  private allowedBranch(branchId: string): boolean {
    // Tenant/owner routing is server-derived. Never invent a tenant ID from /auth/me.
    const me = this.session.me();
    return Boolean(me?.accessibleBranches.includes(branchId) || this.scope.branchCompanies().has(branchId));
  }

  private changed(change: LeadChange): void {
    if (!this.active() || !this.allowedBranch(change.branchId)) return;
    const key = `${change.tenantId}:${change.leadId}`;
    const revision = BigInt(change.revision);
    if (revision <= (this.revisions.get(key) ?? 0n)) return;
    this.revisions.delete(key);
    this.revisions.set(key, revision);
    if (this.revisions.size > MAX_REVISIONS) {
      const oldest = this.revisions.keys().next().value;
      if (oldest !== undefined) this.revisions.delete(oldest);
    }
    this.pending.set(key, change);
    if (this.pending.size > MAX_PENDING_LEADS) {
      this.pending.clear();
      this.fullResync = true;
    }
    this.enqueue();
  }

  private recover(recovery: RealtimeRecovery): void {
    if (!this.active() || (recovery.scope !== 'CRM_LEADS' && recovery.scope !== 'ALL') ||
        this.recoveries.has(recovery.id) || this.completedRecoveries.has(recovery.id)) return;
    this.recoveries.set(recovery.id, recovery.scope);
    this.fullResync = true;
    this.enqueue();
  }

  private enqueue(): void {
    queueMicrotask(() => { if (!this.running && this.active()) void this.refresh(); });
  }

  private async refresh(): Promise<void> {
    const client = this.queries();
    if (!client || !this.active() || (!this.fullResync && this.pending.size === 0)) return;
    const generation = this.generation;
    const full = this.fullResync;
    const changes = [...this.pending.values()];
    const recoveryIds = [...this.recoveries];
    this.fullResync = false;
    this.pending.clear();
    this.running = true;
    this.refreshing.set(true);
    const filters = { predicate: ({ queryKey }: { queryKey: QueryKey }) =>
      isLeadCache(queryKey) && (full || changes.some((change) => matchesChange(queryKey, change))) };
    try {
      await client.cancelQueries(filters);
      if (generation !== this.generation || !this.active()) return;
      client.removeQueries({ predicate: ({ queryKey }) => {
        if (!isLeadCache(queryKey)) return false;
        const branch = queryKey[1] === 'detail' && typeof queryKey[2] === 'string' ? queryKey[2]
          : branchOf(queryKey[0] === 'crm-related-records' ? queryKey[5] : queryKey[2]);
        return (branch !== null && !this.allowedBranch(branch)) || changes.some((change) =>
          change.changeKind === 'DELETED' && matchesChange(queryKey, change) &&
          (queryKey[1] === 'detail' || queryKey[0] === 'crm-related-records'));
      } });
      const targets = client.getQueryCache().findAll(filters);
      // Scope resync can revoke ownership: discard cached rows before refetching.
      if (full) {
        for (const query of targets) query.reset();
      }
      await client.invalidateQueries({ ...filters, refetchType: 'none' });
      // These APIs use fetchQuery, without observers. A reset query is considered
      // disabled by refetchQueries; explicitly fetch its existing HTTP queryFn.
      // Wait for every request so partial failures cannot acknowledge recovery.
      const failures: unknown[] = [];
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(4, targets.length) }, async () => {
        while (next < targets.length && generation === this.generation && this.active()) {
          const query = targets[next++];
          if (!query) continue;
          try {
            await query.fetch({ ...query.options, retry: false }, { cancelRefetch: true });
          } catch (error: unknown) {
            failures.push(error);
          }
        }
      }));
      if (failures.length) throw failures[0];
      if (generation !== this.generation || !this.active()) return;
      this.refreshError.set(null);
      for (const [id, recoveryScope] of recoveryIds) {
        this.recoveries.delete(id);
        this.completedRecoveries.add(id);
        if (this.completedRecoveries.size > MAX_REVISIONS) {
          const oldest = this.completedRecoveries.values().next().value;
          if (oldest !== undefined) this.completedRecoveries.delete(oldest);
        }
        // ALL also includes Notifications/Presence. The shared owner must split
        // that token or coordinate domain confirmations; CRM cannot clear it alone.
        if (recoveryScope === 'CRM_LEADS') this.realtime.completeRecovery(id);
      }
    } catch (error: unknown) {
      if (generation !== this.generation || !this.active()) return;
      this.refreshError.set(error ?? new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR'));
      this.fullResync = true;
      this.scheduleFallback(error);
    } finally {
      this.running = false;
      this.refreshing.set(false);
      if (generation === this.generation && this.active()) {
        if (this.pending.size || (this.fullResync && this.refreshError() === null)) this.enqueue();
        else this.scheduleFallback();
      } else if (this.active() && (this.pending.size || this.fullResync)) this.enqueue();
    }
  }

  private scheduleFallback(error?: unknown): void {
    if (!this.active()) return;
    const connection = this.realtime.connection();
    const cause = error ?? this.refreshError();
    if ((cause instanceof ApiError && [400, 401, 403, 404, 422].includes(cause.status)) ||
        connection.failure?.code.includes('.AUTH.') || connection.failure?.code === 'REALTIME.CLIENT.REPLACED') {
      this.clearTimer();
      return;
    }
    if (this.timer !== undefined || this.attempts >= MAX_FALLBACK_ATTEMPTS) return;
    if (connection.status === 'connected' && this.refreshError() === null) return;
    if (connection.status === 'stale' && connection.failure === null && this.refreshError() === null &&
        !this.fullResync && !this.realtime.recoveries().some((recovery) => recovery.scope === 'CRM_LEADS' || recovery.scope === 'ALL')) return;
    const retryAfter = cause instanceof ApiError ? cause.details?.['retryAfterSeconds'] : null;
    const seconds = Array.isArray(retryAfter) ? Number(retryAfter[0]) : 0;
    const delay = Math.max(FALLBACK_INTERVAL_MS, Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : 0);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.active()) return;
      this.attempts++;
      this.fullResync = true;
      this.enqueue();
    }, delay);
  }

  private clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private clearNotice(): void {
    const notice = this.notice;
    if (notice && this.notify.toasts().some((toast) => toast.pinned && toast.title === notice.title && toast.text === notice.text)) {
      this.notify.connectionRestored();
    }
    this.notice = null;
  }
}

function isLeadCache(key: QueryKey): boolean {
  return key[0] === 'crm-leads' ||
    (key[0] === 'crm-related-records' && key[3] === 'LEAD') ||
    (key[0] === 'crm-lookups' && key[1] === 'assignable-owners' && key[3] === 'leads');
}

function branchOf(value: unknown): string | null {
  return typeof value === 'object' && value !== null && 'branchId' in value && typeof value.branchId === 'string'
    ? value.branchId : null;
}

function matchesChange(key: QueryKey, change: LeadChange): boolean {
  if (key[0] === 'crm-related-records') return key[4] === change.leadId && branchOf(key[5]) === change.branchId;
  if (key[0] !== 'crm-leads') return false;
  if (key[1] === 'detail') return key[2] === change.branchId && key[3] === change.leadId;
  return branchOf(key[2]) === change.branchId;
}
