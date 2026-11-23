import { Injectable, computed, signal } from '@angular/core';
import { ApiError } from '../../shared/trade-api';
import { countCategories, getTreeLevel } from './categories.api';
import type { CategoryPathStep, CategorySummary } from './categories.model';

export const ROOT_LEVEL_KEY = '__root__';
const MAX_CONCURRENT_LEVEL_LOADS = 4;

export function levelKey(parentId: string | null): string {
  return parentId ?? ROOT_LEVEL_KEY;
}

export interface CategoryCounts {
  all: number;
  active: number;
  inactive: number;
}

@Injectable()
export class CategoriesService {
  readonly levels = signal<ReadonlyMap<string, CategorySummary[]>>(new Map());
  readonly expandedIds = signal<ReadonlySet<string>>(new Set());
  readonly loadingLevels = signal<ReadonlySet<string>>(new Set());
  readonly treeVersion = signal<number>(0);
  readonly counts = signal<CategoryCounts>({ all: 0, active: 0, inactive: 0 });
  readonly initialLoading = signal(false);
  readonly loadFailed = signal(false);
  readonly forbidden = signal(false);
  readonly expandingAll = signal(false);

  readonly roots = computed<CategorySummary[]>(() => this.levels().get(ROOT_LEVEL_KEY) ?? []);

  readonly nodesById = computed<ReadonlyMap<string, CategorySummary>>(() => {
    const map = new Map<string, CategorySummary>();
    for (const items of this.levels().values()) {
      for (const item of items) {
        map.set(item.id, item);
      }
    }
    return map;
  });

  private readonly inFlightLoads = new Map<string, Promise<CategorySummary[]>>();
  private initialSeq = 0;
  private expandAllSeq = 0;

  observeTreeVersion(version: number): void {
    this.treeVersion.update((curr) => (version > curr ? version : curr));
  }

  isLevelLoaded(parentId: string | null): boolean {
    return this.levels().has(levelKey(parentId));
  }

  isLevelLoading(parentId: string | null): boolean {
    return this.loadingLevels().has(levelKey(parentId));
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  childrenOf(parentId: string | null): CategorySummary[] {
    return this.levels().get(levelKey(parentId)) ?? [];
  }

  async loadInitial(): Promise<void> {
    const seq = ++this.initialSeq;
    this.initialLoading.set(true);
    this.loadFailed.set(false);
    this.forbidden.set(false);
    try {
      await Promise.all([this.loadLevel(null, { force: true }), this.refreshCounts()]);
    } catch (error) {
      if (seq === this.initialSeq) {
        if (error instanceof ApiError && error.status === 403) {
          this.forbidden.set(true);
        } else {
          this.loadFailed.set(true);
        }
      }
    } finally {
      if (seq === this.initialSeq) {
        this.initialLoading.set(false);
      }
    }
  }

  async refreshCounts(): Promise<void> {
    const res = await countCategories();
    this.counts.set({
      all: res.total,
      active: res.ACTIVE,
      inactive: res.INACTIVE,
    });
  }

  async loadLevel(parentId: string | null, opts: { force?: boolean } = {}): Promise<CategorySummary[]> {
    const key = levelKey(parentId);
    if (!opts.force) {
      const cached = this.levels().get(key);
      if (cached !== undefined) return cached;
    }

    const pending = this.inFlightLoads.get(key);
    if (pending && !opts.force) {
      return pending;
    }

    const promise = (async () => {
      this.setLoading(key, true);
      try {
        const first = await getTreeLevel(parentId, 1, 100);
        this.observeTreeVersion(first.treeVersion);
        const items = [...first.items];
        let page = 2;
        while (items.length < first.total) {
          const nextPage = await getTreeLevel(parentId, page, 100);
          this.observeTreeVersion(nextPage.treeVersion);
          if (nextPage.items.length === 0) break;
          items.push(...nextPage.items);
          page += 1;
        }

        this.levels.update((prev) => {
          const next = new Map(prev);
          next.set(key, items);
          return next;
        });
        return items;
      } finally {
        this.inFlightLoads.delete(key);
        this.setLoading(key, false);
      }
    })();

    this.inFlightLoads.set(key, promise);
    return promise;
  }

  async toggleExpand(id: string): Promise<void> {
    if (!this.isLevelLoaded(id)) {
      await this.loadLevel(id);
      this.expand(id);
      return;
    }

    if (this.expandedIds().has(id)) {
      this.expandedIds.update((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    this.expand(id);
  }

  expand(id: string): void {
    this.expandedIds.update((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  async expandPath(path: readonly CategoryPathStep[]): Promise<void> {
    if (!this.isLevelLoaded(null)) {
      await this.loadLevel(null);
    }
    const ancestorSteps = path.slice(0, -1);
    for (const step of ancestorSteps) {
      await this.loadLevel(step.id);
      this.expand(step.id);
    }
  }

  async expandAll(onError: (err: unknown) => void): Promise<void> {
    const seq = ++this.expandAllSeq;
    this.expandingAll.set(true);
    try {
      let wave = this.isLevelLoaded(null) ? this.roots() : await this.loadLevel(null);
      if (seq !== this.expandAllSeq) return;

      while (wave.length > 0) {
        const parentsToExpand = wave.filter((node) => node.hasChildren);
        if (parentsToExpand.length === 0) break;

        const nextWave: CategorySummary[] = [];
        for (let i = 0; i < parentsToExpand.length; i += MAX_CONCURRENT_LEVEL_LOADS) {
          if (seq !== this.expandAllSeq) return;
          const batch = parentsToExpand.slice(i, i + MAX_CONCURRENT_LEVEL_LOADS);
          const results = await Promise.all(
            batch.map(async (node) => {
              try {
                const children = await this.loadLevel(node.id);
                if (seq === this.expandAllSeq) {
                  this.expand(node.id);
                }
                return children;
              } catch (error) {
                onError(error);
                return [] as CategorySummary[];
              }
            }),
          );
          if (seq !== this.expandAllSeq) return;
          for (const children of results) {
            nextWave.push(...children);
          }
        }
        wave = nextWave;
      }
    } finally {
      if (seq === this.expandAllSeq) {
        this.expandingAll.set(false);
      }
    }
  }

  collapseAll(): void {
    this.expandAllSeq += 1;
    this.expandingAll.set(false);
    this.expandedIds.set(new Set());
  }

  async reloadParentChain(parentId: string | null, opts: { forceParent?: boolean } = {}): Promise<void> {
    const targets: (string | null)[] = [];
    if (opts.forceParent || this.isLevelLoaded(parentId)) {
      targets.push(parentId);
    }

    if (parentId !== null) {
      const parentNode = this.nodesById().get(parentId);
      const grandParentId = parentNode?.parentId ?? null;
      if (parentNode && this.isLevelLoaded(grandParentId)) {
        targets.push(grandParentId);
      }
    }

    await Promise.all(targets.map((targetId) => this.loadLevel(targetId, { force: true })));
  }

  async reloadLoadedSubtree(rootId: string): Promise<void> {
    const queue: string[] = [];
    if (this.isLevelLoaded(rootId)) {
      queue.push(rootId);
    }

    while (queue.length > 0) {
      const batch = queue.splice(0, MAX_CONCURRENT_LEVEL_LOADS);
      const results = await Promise.all(batch.map((id) => this.loadLevel(id, { force: true })));
      for (const children of results) {
        for (const child of children) {
          if (this.isLevelLoaded(child.id)) {
            queue.push(child.id);
          }
        }
      }
    }
  }

  async reloadAllLoaded(): Promise<void> {
    await this.loadLevel(null, { force: true });

    const queue = this.roots()
      .filter((node) => this.isLevelLoaded(node.id))
      .map((node) => node.id);
    const liveLoadedKeys = new Set<string>([ROOT_LEVEL_KEY]);

    while (queue.length > 0) {
      const batch = queue.splice(0, MAX_CONCURRENT_LEVEL_LOADS);
      const results = await Promise.all(
        batch.map(async (id) => {
          liveLoadedKeys.add(id);
          return this.loadLevel(id, { force: true });
        }),
      );
      for (const children of results) {
        for (const child of children) {
          if (this.isLevelLoaded(child.id)) {
            queue.push(child.id);
          }
        }
      }
    }

    this.levels.update((prev) => {
      const next = new Map<string, CategorySummary[]>();
      for (const [k, v] of prev.entries()) {
        if (liveLoadedKeys.has(k)) {
          next.set(k, v);
        }
      }
      return next;
    });

    this.expandedIds.update((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (liveLoadedKeys.has(id)) {
          next.add(id);
        }
      }
      return next;
    });

    await this.refreshCounts();
  }

  pruneNode(id: string): void {
    const toRemove = new Set<string>([id]);
    const stack = [id];
    const currentLevels = this.levels();

    while (stack.length > 0) {
      const curr = stack.pop()!;
      const children = currentLevels.get(curr) ?? [];
      for (const child of children) {
        if (!toRemove.has(child.id)) {
          toRemove.add(child.id);
          stack.push(child.id);
        }
      }
    }

    this.levels.update((prev) => {
      const next = new Map(prev);
      for (const removeId of toRemove) {
        next.delete(removeId);
      }
      return next;
    });

    this.expandedIds.update((prev) => {
      const next = new Set(prev);
      for (const removeId of toRemove) {
        next.delete(removeId);
      }
      return next;
    });
  }

  private setLoading(key: string, loading: boolean): void {
    this.loadingLevels.update((prev) => {
      const next = new Set(prev);
      if (loading) next.add(key);
      else next.delete(key);
      return next;
    });
  }
}
