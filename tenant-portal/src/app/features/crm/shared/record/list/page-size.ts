import { Signal, computed, isSignal, signal } from '@angular/core';

export const DEFAULT_LIST_PAGE_SIZES: readonly number[] = [20, 50, 100];
export const DEFAULT_LIST_PAGE_SIZE = 20;

export interface ListPageSizeOptions {
  storageKey: string;
  sizes?: readonly number[] | Signal<readonly number[]>;
  defaultSize?: number | Signal<number>;
  load?: () => Promise<{ pageSizes?: readonly number[]; defaultPageSize?: number }>;
}

export interface ListPageSize {
  readonly size: Signal<number>;
  readonly sizes: Signal<number[]>;
  readonly defaultSize: Signal<number>;
  set(n: number): void;
}

function readStoredPageSize(storageKey: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredPageSize(storageKey: string, size: number): void {
  try {
    localStorage.setItem(storageKey, String(size));
  } catch {
    // ignore storage errors
  }
}

function resolveDefault(sizes: readonly number[], candidate: number | undefined): number {
  if (candidate !== undefined && sizes.includes(candidate)) return candidate;
  return sizes[0] ?? DEFAULT_LIST_PAGE_SIZE;
}

/** Reactive per-list page size helper backed by static data and localStorage. */
export function createListPageSize(options: ListPageSizeOptions): ListPageSize {
  const initialSizes = isSignal(options.sizes)
    ? [...options.sizes()]
    : options.sizes?.length
      ? [...options.sizes]
      : [...DEFAULT_LIST_PAGE_SIZES];
  const initialDefault = resolveDefault(
    initialSizes,
    isSignal(options.defaultSize) ? options.defaultSize() : options.defaultSize,
  );

  const loadedSizes = signal<number[] | null>(null);
  const loadedDefault = signal<number | null>(null);

  const sizes = computed<number[]>(() => {
    const remote = loadedSizes();
    if (remote?.length) return remote;
    if (isSignal(options.sizes)) {
      const current = options.sizes();
      return current.length ? [...current] : [...DEFAULT_LIST_PAGE_SIZES];
    }
    return initialSizes;
  });

  const defaultSize = computed<number>(() => {
    const allowed = sizes();
    const remote = loadedDefault();
    if (remote !== null) return resolveDefault(allowed, remote);
    const base = isSignal(options.defaultSize) ? options.defaultSize() : options.defaultSize;
    return resolveDefault(allowed, base);
  });

  const storedInitial = readStoredPageSize(options.storageKey);
  const chosen = signal<number>(
    storedInitial !== null && initialSizes.includes(storedInitial) ? storedInitial : initialDefault,
  );

  const size = computed<number>(() => {
    const allowed = sizes();
    const current = chosen();
    return allowed.includes(current) ? current : defaultSize();
  });

  if (options.load) {
    void options
      .load()
      .then((res) => {
        const nextSizes = res.pageSizes?.length ? [...res.pageSizes] : sizes();
        if (res.pageSizes?.length) {
          loadedSizes.set(nextSizes);
        }
        const nextDefault = resolveDefault(nextSizes, res.defaultPageSize ?? defaultSize());
        loadedDefault.set(nextDefault);

        const stored = readStoredPageSize(options.storageKey);
        if (stored !== null && nextSizes.includes(stored)) {
          chosen.set(stored);
        } else if (!nextSizes.includes(chosen())) {
          chosen.set(nextDefault);
        }
      })
      .catch(() => {
        // fallback already set
      });
  }

  return {
    size,
    sizes,
    defaultSize,
    set(n: number) {
      if (!sizes().includes(n)) return;
      chosen.set(n);
      writeStoredPageSize(options.storageKey, n);
    },
  };
}
