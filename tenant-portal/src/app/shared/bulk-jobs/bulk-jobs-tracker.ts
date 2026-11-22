import { DOCUMENT } from '@angular/common';
import { pluralKey } from '../../core/i18n/plural';
import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Notify } from '../../core/notify/notify';
import { ApiError, newIdempotencyKey } from '../../features/crm/settings/shared/settings-api';
import { BULK_JOB_MODULES, BulkJobActionDescriptor, BulkJobModuleDescriptor } from './bulk-job-modules';
import { cancelBulkJob, getBulkJob, listBulkJobs, retryBulkJob, submitBulkJob } from './bulk-jobs.api';
import {
  BULK_JOB_LIMITS,
  BulkJob,
  BulkJobApp,
  BulkJobSubmit,
  BulkJobSubmitResult,
  isBulkJobActive,
} from './bulk-jobs.model';

const RECENT_STORAGE_KEY = 'bulkJobs.recent';
const MAX_FINISHED = 10;
const FAST_POLL_MS = 2000;
const SLOW_POLL_MS = 10_000;
const MAX_POLL_BACKOFF_MS = 60_000;
const NUMBER_GROUPING_FMT = new Intl.NumberFormat('en-US', { useGrouping: true });

function extractDetailString(details: Record<string, unknown> | undefined, key: string): string | null {
  const raw = details?.[key];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    const trimmed = raw[0].trim();
    return trimmed || null;
  }
  return null;
}

function formatMaxItems(raw: unknown): string {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const parsed =
    typeof candidate === 'number'
      ? candidate
      : typeof candidate === 'string' && candidate.trim()
        ? Number(candidate.trim())
        : NaN;
  const value = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : BULK_JOB_LIMITS.maxItems;
  return NUMBER_GROUPING_FMT.format(value);
}

interface StoredRecentRef {
  app: BulkJobApp;
  id: string;
}

export interface BulkJobSubmitOptions {
  /** Reuse the same key when the same action is resent after a network failure; omit for a new action. */
  idempotencyKey?: string;
}

export interface ReportTarget {
  app: BulkJobApp;
  jobId: string;
  seq: number;
}

const VALID_APPS = new Set<BulkJobApp>(['core', 'crm', 'trading', 'accounting']);

function isValidApp(value: unknown): value is BulkJobApp {
  return typeof value === 'string' && VALID_APPS.has(value as BulkJobApp);
}

function readRecentRefs(): StoredRecentRef[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is StoredRecentRef => !!entry && isValidApp(entry.app) && typeof entry.id === 'string')
      .slice(0, MAX_FINISHED);
  } catch {
    return [];
  }
}

function writeRecentRefs(refs: readonly StoredRecentRef[]): void {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(refs.slice(0, MAX_FINISHED)));
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

function firstKeySegment(key: string): string | null {
  const dot = key.indexOf('.');
  return dot > 0 ? key.slice(0, dot) : null;
}

function remainingKeyPath(key: string): string {
  const dot = key.indexOf('.');
  return dot > 0 ? key.slice(dot + 1) : key;
}

function hasPathInObject(obj: Record<string, unknown>, path: string): boolean {
  if (Object.prototype.hasOwnProperty.call(obj, path)) return true;
  if (Object.keys(obj).some((key) => key.startsWith(`${path}.`))) return true;
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return false;
  let curr: unknown = obj;
  for (const part of parts) {
    if (!curr || typeof curr !== 'object' || !(part in (curr as Record<string, unknown>))) {
      return false;
    }
    curr = (curr as Record<string, unknown>)[part];
  }
  return true;
}

@Injectable({ providedIn: 'root' })
export class BulkJobsTracker {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly descriptors = (inject(BULK_JOB_MODULES, { optional: true }) ?? []).flat();

  private readonly jobsByKey = signal<Map<string, BulkJob>>(new Map());
  private readonly finishedSignal = signal<BulkJob | null>(null);
  private readonly reportTargetSignal = signal<ReportTarget | null>(null);
  private readonly popoverOpen = signal(false);
  private readonly scopesVersionSignal = signal(0);

  private readonly descriptorByModule = new Map<string, BulkJobModuleDescriptor>();
  private readonly activeScopes = new Set<string>(['bulk-jobs']);
  private readonly scopeLoading = new Map<string, Promise<void>>();
  private readonly notifiedTerminalKeys = new Set<string>();

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollingInFlight = false;
  private pollErrorStreak = 0;
  private reportSeq = 0;
  private destroyed = false;

  readonly jobs: Signal<BulkJob[]> = computed(() => {
    const all = Array.from(this.jobsByKey().values());
    const active = all
      .filter((job) => isBulkJobActive(job.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const finished = all
      .filter((job) => !isBulkJobActive(job.status))
      .sort((a, b) => (b.finishedAt ?? b.createdAt).localeCompare(a.finishedAt ?? a.createdAt))
      .slice(0, MAX_FINISHED);
    return [...active, ...finished];
  });

  readonly activeCount: Signal<number> = computed(
    () => this.jobs().filter((job) => isBulkJobActive(job.status)).length,
  );

  readonly finished: Signal<BulkJob | null> = this.finishedSignal.asReadonly();
  readonly reportTarget: Signal<ReportTarget | null> = this.reportTargetSignal.asReadonly();
  readonly scopesVersion: Signal<number> = this.scopesVersionSignal.asReadonly();

  constructor() {
    for (const descriptor of this.descriptors) {
      this.descriptorByModule.set(descriptor.module, descriptor);
    }

    this.transloco._setScopeAlias('bulk-jobs', 'bulkJobs');
    void this.ensureScopesLoaded(['bulk-jobs']);

    const langSub = this.transloco.langChanges$.subscribe(() => {
      const scopes = Array.from(this.activeScopes);
      if (scopes.length > 0) {
        void this.ensureScopesLoaded(scopes);
      }
    });

    const onVisibility = () => {
      if (this.activeCount() > 0 && !this.pollingInFlight) {
        this.schedulePoll();
      }
    };
    this.document.addEventListener('visibilitychange', onVisibility);

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      langSub.unsubscribe();
      this.document.removeEventListener('visibilitychange', onVisibility);
      this.clearPollTimer();
    });

    void this.restoreOnStart();
  }

  hasActive(app: BulkJobApp, module?: string): boolean {
    for (const job of this.jobsByKey().values()) {
      if (job.app !== app) continue;
      if (module && job.module !== module) continue;
      if (isBulkJobActive(job.status)) return true;
    }
    return false;
  }

  descriptorFor(moduleName: string): BulkJobModuleDescriptor | undefined {
    return this.descriptorByModule.get(moduleName);
  }

  actionDescriptorFor(job: BulkJob): BulkJobActionDescriptor | undefined {
    return this.descriptorByModule.get(job.module)?.actions[job.action];
  }

  registeredApps(): BulkJobApp[] {
    return Array.from(new Set(this.descriptors.map((d) => d.app)));
  }

  setPopoverOpen(open: boolean): void {
    if (this.popoverOpen() === open) return;
    this.popoverOpen.set(open);
    if (open && this.activeCount() > 0 && !this.pollingInFlight) {
      this.schedulePoll();
    }
  }

  async ensureScopesForModule(moduleName: string): Promise<void> {
    const descriptor = this.descriptorFor(moduleName);
    const scopes = descriptor ? ['bulk-jobs', ...descriptor.i18nScopes] : ['bulk-jobs'];
    await this.ensureScopesLoaded(scopes, descriptor);
  }

  async ensureScopesLoaded(scopes: readonly string[], descriptor?: BulkJobModuleDescriptor): Promise<void> {
    const lang = this.transloco.getActiveLang();
    const unique = Array.from(new Set(scopes));
    for (const scope of unique) {
      this.activeScopes.add(scope);
    }

    await Promise.all(
      unique.map((scope) => {
        const cacheKey = `${scope}/${lang}`;
        const existing = this.scopeLoading.get(cacheKey);
        if (existing) return existing;

        const task = this.loadSingleScope(scope, lang, descriptor).finally(() => {
          this.scopeLoading.delete(cacheKey);
        });
        this.scopeLoading.set(cacheKey, task);
        return task;
      }),
    );
  }

  async submit(app: BulkJobApp, body: BulkJobSubmit, options: BulkJobSubmitOptions = {}): Promise<BulkJobSubmitResult> {
    const descriptor = this.descriptorFor(body.module);
    const scopesToLoad = descriptor ? ['bulk-jobs', ...descriptor.i18nScopes] : ['bulk-jobs'];
    await this.ensureScopesLoaded(scopesToLoad, descriptor);

    const key = options.idempotencyKey ?? newIdempotencyKey();
    try {
      const res = await submitBulkJob(app, body, key);
      await this.adoptSubmittedJob(app, { module: body.module, action: body.action, scope: body.scope }, res);
      return res;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'BULK_JOB_ACTIVE') {
        await this.handleActiveConflict(app, body.module, error);
      }
      throw error;
    }
  }

  async cancel(job: BulkJob): Promise<void> {
    const updated = await cancelBulkJob(job.app, job.id);
    this.upsertJob(updated, true);
    if (isBulkJobActive(updated.status)) {
      this.schedulePoll();
    }
  }

  async retry(job: BulkJob, overrides: unknown | null): Promise<string> {
    await this.ensureScopesForModule(job.module);
    const key = newIdempotencyKey();
    let res: BulkJobSubmitResult;
    try {
      res = await retryBulkJob(job.app, job.id, overrides, key);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'BULK_JOB_ACTIVE') {
        await this.handleActiveConflict(job.app, job.module, error);
      }
      throw error;
    }
    await this.adoptSubmittedJob(
      job.app,
      { module: job.module, action: job.action, scope: job.scope, paramsSummary: job.paramsSummary },
      res,
    );
    return res.jobId;
  }

  openReport(app: BulkJobApp, jobId: string): void {
    this.reportTargetSignal.set({ app, jobId, seq: ++this.reportSeq });
  }

  clearReportTarget(): void {
    this.reportTargetSignal.set(null);
  }

  async loadRecent(): Promise<void> {
    const apps = Array.from(
      new Set<BulkJobApp>([
        ...this.registeredApps(),
        ...Array.from(this.jobsByKey().values()).map((job) => job.app),
      ]),
    );
    if (apps.length === 0) return;

    const results = await Promise.allSettled(
      apps.map((app) => listBulkJobs(app, { scope: 'recent', page: 1, limit: 20 })),
    );
    const loaded: BulkJob[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled') {
        loaded.push(...res.value.items);
      }
    }
    if (loaded.length === 0) return;

    for (const job of loaded) {
      if (!isBulkJobActive(job.status)) {
        this.notifiedTerminalKeys.add(this.jobKey(job.app, job.id));
      }
      this.upsertJob(job, false);
    }
    this.persistRecentRefs();
    if (this.activeCount() > 0) {
      this.schedulePoll();
    }
  }

  reasonText(code: string | undefined, job: BulkJob | null, params?: Record<string, unknown>): string {
    this.scopesVersionSignal();
    const mergedParams: Record<string, unknown> = { ...params, max: formatMaxItems(params?.['max']) };
    if (code) {
      const descriptor = job ? this.descriptorFor(job.module) : undefined;
      if (descriptor) {
        for (const prefix of descriptor.codeKeyPrefixes) {
          const key = prefix.endsWith('.') ? `${prefix}${code}` : `${prefix}.${code}`;
          const translated = this.transloco.translate(key, mergedParams);
          if (translated && translated !== key) return translated;
        }
      }
      const genericCodeKey = `bulkJobs.codes.${code}`;
      const genericCodeTranslated = this.transloco.translate(genericCodeKey, mergedParams);
      if (genericCodeTranslated && genericCodeTranslated !== genericCodeKey) return genericCodeTranslated;
    }

    return this.translateOrFallback('bulkJobs.codes.generic', 'Something went wrong.', mergedParams);
  }

  jobTitle(job: BulkJob): string {
    this.scopesVersionSignal();
    const actionDesc = this.actionDescriptorFor(job);
    if (actionDesc?.titleKey) {
      const translated = this.transloco.translate(actionDesc.titleKey, this.titleParamsFor(actionDesc, job));
      if (translated && translated !== actionDesc.titleKey && !translated.includes('{{')) return translated;
    }
    return this.translateOrFallback('bulkJobs.genericTitle', 'Batch operation');
  }

  private titleParamsFor(actionDesc: BulkJobActionDescriptor, job: BulkJob): Record<string, unknown> {
    const keys = actionDesc.titleParams?.(job.paramsSummary ?? {});
    if (!keys) return job.paramsSummary;
    const translated: Record<string, string> = {};
    for (const [name, key] of Object.entries(keys)) {
      const value = this.transloco.translate(key);
      if (value && value !== key) translated[name] = value;
    }
    return { ...job.paramsSummary, ...translated };
  }

  syncExternalJob(job: BulkJob): void {
    if (!isBulkJobActive(job.status)) {
      this.notifiedTerminalKeys.add(this.jobKey(job.app, job.id));
    }
    this.upsertJob(job, false);
    if (isBulkJobActive(job.status)) {
      this.schedulePoll();
    }
  }

  private async restoreOnStart(): Promise<void> {
    const apps = this.registeredApps();
    const recentRefs = readRecentRefs();

    const activePromises = apps.map((app) =>
      listBulkJobs(app, { scope: 'active', page: 1, limit: 100 })
        .then((page) => page.items)
        .catch(() => [] as BulkJob[]),
    );
    const recentPromises = recentRefs.map((ref) => getBulkJob(ref.app, ref.id).catch(() => null));

    const [activeLists, recentJobs] = await Promise.all([
      Promise.all(activePromises),
      Promise.all(recentPromises),
    ]);
    if (this.destroyed) return;

    for (const list of activeLists) {
      for (const job of list) {
        this.upsertJob(job, false);
      }
    }

    for (const job of recentJobs) {
      if (!job) continue;
      if (!isBulkJobActive(job.status)) {
        this.notifiedTerminalKeys.add(this.jobKey(job.app, job.id));
      }
      this.upsertJob(job, false);
    }

    this.persistRecentRefs();
    if (this.activeCount() > 0) {
      this.schedulePoll();
    }
  }

  private schedulePoll(): void {
    this.clearPollTimer();
    if (this.destroyed) return;
    const hasActive = Array.from(this.jobsByKey().values()).some((job) => isBulkJobActive(job.status));
    if (!hasActive) {
      this.pollErrorStreak = 0;
      return;
    }

    const fast = this.popoverOpen() || this.isDocumentVisible();
    const base = fast ? FAST_POLL_MS : SLOW_POLL_MS;
    const delay = Math.min(base * 2 ** this.pollErrorStreak, MAX_POLL_BACKOFF_MS);
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.pollOnce();
    }, delay);
  }

  private clearPollTimer(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private isDocumentVisible(): boolean {
    return this.document.visibilityState !== 'hidden';
  }

  private async pollOnce(): Promise<void> {
    if (this.destroyed || this.pollingInFlight) return;
    const active = Array.from(this.jobsByKey().values()).filter((job) => isBulkJobActive(job.status));
    if (active.length === 0) return;

    this.pollingInFlight = true;
    try {
      const results = await Promise.allSettled(
        active.map(async (job) => ({
          ref: job,
          fresh: await getBulkJob(job.app, job.id),
        })),
      );
      if (this.destroyed) return;

      let failed = false;
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status === 'fulfilled') {
          this.upsertJob(res.value.fresh, true);
        } else if (res.reason instanceof ApiError && res.reason.status === 404) {
          this.removeJob(active[i].app, active[i].id);
        } else {
          failed = true;
        }
      }
      // Back off while the server or network fails, so a broken backend is not polled every 2 s.
      this.pollErrorStreak = failed ? this.pollErrorStreak + 1 : 0;
    } finally {
      this.pollingInFlight = false;
      if (!this.destroyed) {
        const stillActive = Array.from(this.jobsByKey().values()).some((job) => isBulkJobActive(job.status));
        if (stillActive) {
          this.schedulePoll();
        }
      }
    }
  }

  private seedFromSubmitResult(
    app: BulkJobApp,
    meta: {
      module: string;
      action: string;
      scope: { branchId?: string; companyId?: string };
      paramsSummary?: Record<string, string | number | null>;
    },
    res: BulkJobSubmitResult,
  ): BulkJob {
    const now = new Date().toISOString();
    const terminal = !isBulkJobActive(res.status);
    return {
      id: res.jobId,
      app,
      module: meta.module,
      action: meta.action,
      scope: { ...meta.scope },
      status: res.status,
      total: res.total,
      processed: res.skippedAtSubmit + res.failedAtSubmit,
      counts: {
        succeeded: 0,
        unchanged: 0,
        skipped: res.skippedAtSubmit,
        failed: res.failedAtSubmit,
        cancelled: 0,
      },
      chunkCount: res.chunkCount,
      chunksDone: 0,
      paramsSummary: meta.paramsSummary ? { ...meta.paramsSummary } : {},
      ...(res.summary ? { summary: { ...res.summary } } : {}),
      createdAt: now,
      ...(terminal ? { startedAt: now, finishedAt: now } : {}),
      revision: 0,
    };
  }

  private async adoptSubmittedJob(
    app: BulkJobApp,
    meta: {
      module: string;
      action: string;
      scope: { branchId?: string; companyId?: string };
      paramsSummary?: Record<string, string | number | null>;
    },
    res: BulkJobSubmitResult,
  ): Promise<void> {
    const seeded = this.seedFromSubmitResult(app, meta, res);
    if (isBulkJobActive(res.status)) {
      this.upsertJob(seeded, false);
      const generic = this.translateOrFallback('bulkJobs.toast.started', 'Batch operation started. You can keep working.');
      this.notify.info(this.moduleText(this.descriptorFor(meta.module)?.toasts?.startedKey, generic));
      this.schedulePoll();
      try {
        const fresh = await getBulkJob(app, res.jobId);
        this.upsertJob(fresh, !isBulkJobActive(fresh.status));
        if (isBulkJobActive(fresh.status)) {
          this.schedulePoll();
        }
      } catch {
        // Seeded state is already in place; polling will synchronize.
      }
      return;
    }

    try {
      const fresh = await getBulkJob(app, res.jobId);
      this.upsertJob(fresh, true);
    } catch {
      this.upsertJob(seeded, true);
    }
  }

  // TODO(bulk-backend): shared exception filter drops non-array details; support string, string[], or fallback active lookup.
  private async handleActiveConflict(app: BulkJobApp, module: string, error: ApiError): Promise<void> {
    await this.ensureScopesLoaded(['bulk-jobs']);
    const toasts = this.descriptorFor(module)?.toasts;
    const generic = this.translateOrFallback('bulkJobs.toast.active', 'You already have a batch operation running here.');
    const title = this.moduleText(toasts?.activeKey, generic);
    const detail = this.moduleText(toasts?.activeDetailKey, '');
    if (detail) {
      this.notify.warning(title, detail);
    } else {
      this.notify.warning(title);
    }
    let activeJobId = extractDetailString(error.details, 'activeJobId');
    if (!activeJobId) {
      try {
        const page = await listBulkJobs(app, { scope: 'active', module, page: 1, limit: 100 });
        let firstActive = page.items[0];
        if (!firstActive) {
          const appPage = await listBulkJobs(app, { scope: 'active', page: 1, limit: 100 });
          firstActive = appPage.items[0];
        }
        if (firstActive) {
          this.upsertJob(firstActive, false);
          activeJobId = firstActive.id;
        }
      } catch {
        // Toast was already shown; ignore active lookup failure.
      }
    }
    if (activeJobId) {
      this.openReport(app, activeJobId);
    }
  }

  private upsertJob(job: BulkJob, notifyOnTerminal: boolean): void {
    const key = this.jobKey(job.app, job.id);
    const prev = this.jobsByKey().get(key);
    if (prev && prev.revision > 0 && job.revision > 0 && job.revision < prev.revision) {
      return;
    }
    const wasActive = prev ? isBulkJobActive(prev.status) : false;
    const isTerminal = !isBulkJobActive(job.status);

    this.jobsByKey.update((map) => {
      const next = new Map(map);
      next.set(key, job);
      return next;
    });

    if (notifyOnTerminal && isTerminal && (wasActive || !prev) && !this.notifiedTerminalKeys.has(key)) {
      this.notifiedTerminalKeys.add(key);
      this.finishedSignal.set(job);
      this.persistRecentRefs();
      void this.showTerminalToast(job);
    }
  }

  private removeJob(app: BulkJobApp, id: string): void {
    const key = this.jobKey(app, id);
    this.jobsByKey.update((map) => {
      if (!map.has(key)) return map;
      const next = new Map(map);
      next.delete(key);
      return next;
    });
  }

  private persistRecentRefs(): void {
    const finishedRefs: StoredRecentRef[] = this.jobs()
      .filter((job) => !isBulkJobActive(job.status))
      .slice(0, MAX_FINISHED)
      .map((job) => ({ app: job.app, id: job.id }));
    writeRecentRefs(finishedRefs);
  }

  private async showTerminalToast(job: BulkJob): Promise<void> {
    await this.ensureScopesForModule(job.module);
    if (this.destroyed) return;

    const actionDesc = this.actionDescriptorFor(job);
    switch (job.status) {
      case 'COMPLETED': {
        const count = job.counts.succeeded;
        const msg = actionDesc?.succeededKey
          ? this.translateOrFallback(actionDesc.succeededKey, `${count} done.`, { n: count, count })
          : this.translateOrFallback(pluralKey('bulkJobs.toast.completedGenericPlural', count, this.transloco.getActiveLang()), `${count} done.`, { n: count });
        this.notify.success(msg);
        break;
      }
      case 'COMPLETED_WITH_ERRORS': {
        const ok = job.counts.succeeded + job.counts.unchanged;
        const failed = job.counts.failed;
        this.notify.warning(
          this.translateOrFallback('bulkJobs.toast.partial', `${ok} done, ${failed} failed.`, { ok, failed }),
        );
        break;
      }
      case 'CANCELLED': {
        this.notify.info(this.translateOrFallback('bulkJobs.toast.stopped', 'Batch operation stopped.'));
        break;
      }
      case 'FAILED': {
        const reason = this.reasonText(job.failureCode, job);
        this.notify.error(
          this.translateOrFallback('bulkJobs.toast.failed', `The batch operation failed: ${reason}`, { reason }),
        );
        break;
      }
      default:
        break;
    }
  }

  private async loadSingleScope(scope: string, lang: string, explicitDescriptor?: BulkJobModuleDescriptor): Promise<void> {
    if (scope === 'bulk-jobs') {
      this.transloco._setScopeAlias('bulk-jobs', 'bulkJobs');
    }

    let raw: Record<string, unknown> | null = null;
    try {
      const loaded = await firstValueFrom(this.transloco.load(`${scope}/${lang}`));
      if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
        raw = loaded as Record<string, unknown>;
      }
    } catch {
      return;
    }

    if (raw && scope !== 'bulk-jobs') {
      this.bindDescriptorAliasIfMatched(scope, lang, raw, explicitDescriptor);
    }
    this.scopesVersionSignal.update((v) => v + 1);
  }

  private bindDescriptorAliasIfMatched(
    scope: string,
    lang: string,
    raw: Record<string, unknown>,
    explicitDescriptor?: BulkJobModuleDescriptor,
  ): void {
    const candidates = explicitDescriptor ? [explicitDescriptor] : this.descriptors.filter((d) => d.i18nScopes.includes(scope));
    if (candidates.length === 0) return;

    const aliasSubpaths = new Map<string, Set<string>>();
    for (const desc of candidates) {
      for (const action of Object.values(desc.actions)) {
        for (const key of [action.titleKey, action.succeededKey]) {
          const alias = firstKeySegment(key);
          if (!alias) continue;
          const set = aliasSubpaths.get(alias) ?? new Set<string>();
          set.add(remainingKeyPath(key));
          aliasSubpaths.set(alias, set);
        }
      }
      for (const prefix of desc.codeKeyPrefixes) {
        const alias = firstKeySegment(prefix);
        if (!alias) continue;
        const set = aliasSubpaths.get(alias) ?? new Set<string>();
        const rest = remainingKeyPath(prefix).replace(/\.+$/, '');
        if (rest) set.add(rest);
        aliasSubpaths.set(alias, set);
      }
    }

    const matchedAliases: string[] = [];
    for (const [alias, subpaths] of aliasSubpaths) {
      if (Array.from(subpaths).some((path) => hasPathInObject(raw, path))) {
        matchedAliases.push(alias);
      }
    }

    if (matchedAliases.length === 0) return;
    const primaryAlias = matchedAliases[0];
    this.transloco._setScopeAlias(scope, primaryAlias);

    const currentLangMap = this.transloco.getTranslation(lang);
    for (const alias of matchedAliases) {
      const prefix = `${alias}.`;
      const alreadyPresent = Object.keys(currentLangMap).some((key) => key.startsWith(prefix));
      if (!alreadyPresent) {
        this.transloco.setTranslation({ [alias]: raw }, lang, { merge: true, emitChange: false });
      }
    }
  }

  private translateOrFallback(key: string, fallback: string, params?: Record<string, unknown>): string {
    const translated = this.transloco.translate(key, params);
    return translated && translated !== key ? translated : fallback;
  }

  private moduleText(key: string | undefined, generic: string): string {
    return key ? this.translateOrFallback(key, generic) : generic;
  }

  private jobKey(app: BulkJobApp, id: string): string {
    return `${app}:${id}`;
  }
}
