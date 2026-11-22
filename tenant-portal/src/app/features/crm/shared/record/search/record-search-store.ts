import { DestroyRef, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import {
  ActivatedRoute,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
} from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { skip } from 'rxjs';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import {
  Condition,
  Group,
  Operator,
  QUERY_LIMITS,
  Query,
  QueryField,
  Value,
} from '../../../../../shared/query-builder/query.model';
import { SearchFacet } from '../../../../../shared/ui/facet-search/facet-search.model';
import {
  RecordSearchConfig,
  RecordSearchFacetsResult,
  RecordSearchRejected,
} from './record-search.model';

interface CompactCondition {
  f: string;
  o: Operator | null;
  v?: Value;
}

interface CompactGroup {
  op: 'AND' | 'OR';
  c: (CompactCondition | CompactGroup)[];
}

interface CompactQuery {
  r?: CompactGroup;
  x?: CompactCondition[];
}

const VALID_OPERATORS = new Set<Operator>([
  'contains',
  'eq',
  'neq',
  'in',
  'nin',
  'gte',
  'lte',
  'between',
  'ilike',
  'ilikeAny',
  'startsWith',
  'endsWith',
  'isNull',
  'isNotNull',
  'on',
  'before',
  'after',
  'relative',
  'is',
  'hasAny',
]);

const MAX_ENCODED_LEN = 16_384;
const MAX_DECODE_DEPTH = QUERY_LIMITS.depth + 3;
const MAX_DECODE_NODES = 200;
const BASE64_URL_RE = /^[A-Za-z0-9_-]+$/;

function defaultEmptyQuery(): Query {
  return {
    root: { kind: 'group', id: 'root', op: 'AND', children: [] },
    fixed: [],
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasOnlyKeys(rec: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(rec).every((key) => allowed.includes(key));
}

function isValidQueryValue(value: unknown): value is Value {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    if (value.length > QUERY_LIMITS.listMax + 10) return false;
    return (
      value.every((item) => typeof item === 'string') ||
      value.every((item) => typeof item === 'number' && Number.isFinite(item))
    );
  }
  return false;
}

function compactCondition(cond: Condition): CompactCondition {
  const out: CompactCondition = { f: cond.field, o: cond.operator };
  if (cond.value !== undefined) {
    out.v = cond.value;
  }
  return out;
}

function compactGroup(group: Group): CompactGroup {
  return {
    op: group.op,
    c: group.children.map((child) => (child.kind === 'group' ? compactGroup(child) : compactCondition(child))),
  };
}

function toCompactQuery(query: Query): CompactQuery {
  const compact: CompactQuery = {};
  if (query.root.op !== 'AND' || query.root.children.length > 0) {
    compact.r = compactGroup(query.root);
  }
  if (query.fixed.length > 0) {
    compact.x = query.fixed.map(compactCondition);
  }
  return compact;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(raw: string): Uint8Array | null {
  if (!raw || raw.length > MAX_ENCODED_LEN || !BASE64_URL_RE.test(raw)) return null;
  const mod = raw.length % 4;
  if (mod === 1) return null;
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + (mod === 0 ? '' : '='.repeat(4 - mod));
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function encodeSearchQuery(query: Query): string {
  const json = JSON.stringify(toCompactQuery(query));
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

export function decodeSearchQuery(raw: string | null | undefined): Query | null {
  if (!raw) return null;
  const bytes = base64UrlToBytes(raw);
  if (!bytes) return null;

  let parsed: unknown;
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!isPlainRecord(parsed) || !hasOnlyKeys(parsed, ['r', 'x'])) return null;

  let seq = 0;
  let nodes = 0;
  const nextId = () => `url-${++seq}`;

  const decodeCond = (rawCond: unknown): Condition | null => {
    nodes += 1;
    if (nodes > MAX_DECODE_NODES || !isPlainRecord(rawCond) || !hasOnlyKeys(rawCond, ['f', 'o', 'v'])) {
      return null;
    }
    const field = rawCond['f'];
    const op = rawCond['o'];
    const val = rawCond['v'];
    if (typeof field !== 'string') return null;
    if (op !== null && (typeof op !== 'string' || !VALID_OPERATORS.has(op as Operator))) return null;
    if (val !== undefined && !isValidQueryValue(val)) return null;
    return {
      kind: 'condition',
      id: nextId(),
      field,
      operator: op as Operator | null,
      value: val,
    };
  };

  const decodeGroup = (rawGroup: unknown, depth: number, id: string): Group | null => {
    nodes += 1;
    if (
      nodes > MAX_DECODE_NODES ||
      depth > MAX_DECODE_DEPTH ||
      !isPlainRecord(rawGroup) ||
      !hasOnlyKeys(rawGroup, ['op', 'c'])
    ) {
      return null;
    }
    const op = rawGroup['op'];
    const childrenRaw = rawGroup['c'];
    if ((op !== 'AND' && op !== 'OR') || !Array.isArray(childrenRaw)) return null;

    const children: (Condition | Group)[] = [];
    for (const childRaw of childrenRaw) {
      if (!isPlainRecord(childRaw)) return null;
      if ('op' in childRaw) {
        const subGroup = decodeGroup(childRaw, depth + 1, nextId());
        if (!subGroup) return null;
        children.push(subGroup);
      } else {
        const cond = decodeCond(childRaw);
        if (!cond) return null;
        children.push(cond);
      }
    }
    return { kind: 'group', id, op, children };
  };

  let root: Group = { kind: 'group', id: 'root', op: 'AND', children: [] };
  if ('r' in parsed && parsed['r'] !== undefined) {
    const decodedRoot = decodeGroup(parsed['r'], 1, 'root');
    if (!decodedRoot) return null;
    root = decodedRoot;
  }

  const fixed: Condition[] = [];
  if ('x' in parsed && parsed['x'] !== undefined) {
    const fixedRaw = parsed['x'];
    if (!Array.isArray(fixedRaw)) return null;
    for (const item of fixedRaw) {
      const cond = decodeCond(item);
      if (!cond) return null;
      fixed.push(cond);
    }
  }

  return { root, fixed };
}

function isFacetsResult(value: Query | RecordSearchFacetsResult): value is RecordSearchFacetsResult {
  return 'query' in value && 'rejected' in value;
}

function normalizeRejectedKey(prefix: string, reasonKey: string): string {
  if (reasonKey.includes('.') && reasonKey.startsWith(prefix)) return reasonKey;
  if (!prefix) return reasonKey;
  return prefix.endsWith('.') ? `${prefix}${reasonKey}` : `${prefix}.${reasonKey}`;
}

export class RecordSearchStore<TCtx, TBody> {
  private readonly transloco = inject(TranslocoService, { optional: true });
  private readonly i18n = this.transloco ? translationEvents(this.transloco) : signal(null);
  private readonly languageState = inject(LanguageState, { optional: true });
  private readonly notify = inject(Notify, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly destroyRef = inject(DestroyRef, { optional: true });

  private readonly urlParam: string;
  private readonly ctxState: WritableSignal<TCtx>;
  private readonly appliedState: WritableSignal<Query>;

  private initialized = false;
  private restoredFromUrl = false;
  private userMutated = false;
  private lastSeenParam: string | null = null;
  private activeNavId: number | null = null;
  private pendingUrlWrite = false;
  private urlWriteSeq = 0;
  private destroyed = false;

  readonly applied: Signal<Query>;
  readonly draftDirty: WritableSignal<boolean> = signal(false);

  readonly fields: Signal<QueryField[]> = computed(() => {
    this.i18n();
    const ctx = this.ctxState();
    const language = this.languageState?.current() ?? 'en';
    return this.config.fields(ctx, {
      language,
      t: (key, params) => this.translate(key, params),
    });
  });

  private readonly compiled = computed(() =>
    this.config.compile(this.appliedState(), this.ctxState(), {
      currentUserId: this.config.currentUserId(),
      timeZone: this.config.timeZone(),
    }),
  );

  readonly body: Signal<TBody> = computed(() => this.compiled().body);

  readonly facets: Signal<SearchFacet[]> = computed(() => {
    this.i18n();
    const language = this.languageState?.current() ?? 'en';
    return this.config.queryToFacets(this.appliedState(), this.ctxState(), {
      fields: this.fields(),
      language,
      t: (key, params) => this.translate(key, params),
    });
  });

  constructor(private readonly config: RecordSearchConfig<TCtx, TBody>) {
    this.urlParam = config.urlParam ?? 'q';
    const initialCtx = (config.initialCtx ?? ({} as TCtx)) as TCtx;
    this.ctxState = signal<TCtx>(initialCtx);

    const rawInitial = this.route?.snapshot.queryParamMap.get(this.urlParam) ?? null;
    this.lastSeenParam = rawInitial;
    const decoded = decodeSearchQuery(rawInitial);

    if (decoded !== null) {
      this.restoredFromUrl = true;
      this.appliedState = signal<Query>(decoded);
    } else if ('initialCtx' in config) {
      this.appliedState = signal<Query>(config.defaultQuery(initialCtx));
    } else {
      this.appliedState = signal<Query>(defaultEmptyQuery());
    }

    this.applied = this.appliedState.asReadonly();

    this.destroyRef?.onDestroy(() => {
      this.destroyed = true;
    });

    if (this.router) {
      const events$ = this.destroyRef
        ? this.router.events.pipe(takeUntilDestroyed(this.destroyRef))
        : this.router.events;
      events$.subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.activeNavId = event.id;
        } else if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError ||
          event instanceof NavigationSkipped
        ) {
          if (this.activeNavId === event.id) {
            this.activeNavId = null;
          }
          if (this.activeNavId === null && this.pendingUrlWrite) {
            queueMicrotask(() => void this.flushUrlWrite());
          }
        }
      });
    }

    if (this.route) {
      const qp$ = this.destroyRef
        ? this.route.queryParamMap.pipe(skip(1), takeUntilDestroyed(this.destroyRef))
        : this.route.queryParamMap.pipe(skip(1));
      qp$.subscribe((params) => {
        const raw = params.get(this.urlParam) ?? null;
        if (raw === this.lastSeenParam || this.pendingUrlWrite) return;
        this.lastSeenParam = raw;
        if (raw === null) {
          this.appliedState.set(this.config.defaultQuery(this.ctxState()));
          this.draftDirty.set(false);
          return;
        }
        const nextQuery = decodeSearchQuery(raw);
        this.appliedState.set(nextQuery ?? this.config.defaultQuery(this.ctxState()));
        this.draftDirty.set(false);
      });
    }
  }

  init(ctx: TCtx): void {
    this.ctxState.set(ctx);
    if (!this.initialized) {
      this.initialized = true;
      if (!this.restoredFromUrl && !this.userMutated) {
        const raw = this.route?.snapshot.queryParamMap.get(this.urlParam) ?? null;
        const decoded = decodeSearchQuery(raw);
        if (decoded !== null) {
          this.restoredFromUrl = true;
          this.lastSeenParam = raw;
          this.appliedState.set(decoded);
        } else if (!('initialCtx' in this.config)) {
          this.appliedState.set(this.config.defaultQuery(ctx));
        }
      }
    }
  }

  setApplied(q: Query): void {
    this.userMutated = true;
    this.appliedState.set(q);
    this.draftDirty.set(false);
    this.scheduleUrlWrite();
    this.notifyRejected(this.compiled().rejected);
  }

  clear(): void {
    this.userMutated = true;
    const empty = this.config.emptyQuery ? this.config.emptyQuery(this.ctxState()) : defaultEmptyQuery();
    this.appliedState.set(empty);
    this.draftDirty.set(false);
    this.scheduleUrlWrite();
  }

  setFacets(f: SearchFacet[]): void {
    this.userMutated = true;
    const res = this.config.facetsToQuery(f, this.ctxState(), {
      prev: this.appliedState(),
      fields: this.fields(),
      t: (key, params) => this.translate(key, params),
    });
    const isWrapped = isFacetsResult(res);
    const query = isWrapped ? res.query : res;
    const facetRejected = isWrapped ? res.rejected : [];

    this.appliedState.set(query);
    this.scheduleUrlWrite();
    this.notifyRejected(facetRejected);
    this.notifyRejected(this.compiled().rejected);
  }

  protected translate(key: string, params?: Record<string, unknown>): string {
    if (!this.transloco) return key;
    return this.transloco.translate(key, params);
  }

  private notifyRejected(rejected: readonly RecordSearchRejected[]): void {
    if (!this.notify || rejected.length === 0) return;
    const currentFields = this.fields();
    for (const item of rejected) {
      const fieldLabel = currentFields.find((field) => field.id === item.field)?.label ?? item.field;
      const key = normalizeRejectedKey(this.config.rejectedKeyPrefix, item.reasonKey);
      this.notify.warning(this.translate(key, { field: fieldLabel }));
    }
  }

  private encodeParamFor(query: Query): string | null {
    const encoded = encodeSearchQuery(query);
    const defaultEncoded = encodeSearchQuery(this.config.defaultQuery(this.ctxState()));
    return encoded === defaultEncoded ? null : encoded;
  }

  private scheduleUrlWrite(): void {
    if (!this.router || !this.route) return;
    this.pendingUrlWrite = true;
    const seq = ++this.urlWriteSeq;
    queueMicrotask(() => {
      if (seq === this.urlWriteSeq) {
        void this.flushUrlWrite();
      }
    });
  }

  private async flushUrlWrite(): Promise<void> {
    if (this.destroyed || !this.pendingUrlWrite || !this.router || !this.route || this.activeNavId !== null) {
      return;
    }
    this.pendingUrlWrite = false;
    const nextParam = this.encodeParamFor(this.appliedState());
    const currentParam = this.route.snapshot.queryParamMap.get(this.urlParam) ?? null;
    this.lastSeenParam = nextParam;
    if (currentParam === nextParam) return;
    try {
      await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { [this.urlParam]: nextParam },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } catch {
      // Ignore navigation failures when route is torn down.
    }
  }
}

export function createRecordSearchStore<TCtx, TBody>(
  config: RecordSearchConfig<TCtx, TBody>,
): RecordSearchStore<TCtx, TBody> {
  return new RecordSearchStore(config);
}
