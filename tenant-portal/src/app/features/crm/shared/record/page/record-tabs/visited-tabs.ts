import { Signal, WritableSignal, effect, linkedSignal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

export interface SyncTabOptions {
  onBeforeNavigate?: () => void;
  onAfterNavigate?: () => void;
}

/** Tracks the set of tab ids visited at least once so mounted panels stay alive across tab switches. */
export function createVisitedTabs<T extends string = string>(
  active: Signal<T>,
  initial: readonly T[] = [],
): Signal<ReadonlySet<T>> {
  return linkedSignal<T, ReadonlySet<T>>({
    source: active,
    computation: (tab, previous) => {
      const prev = previous?.value ?? new Set<T>(initial);
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    },
  });
}

/** Keeps an active tab signal synchronized with the `?tab=` URL query parameter using merge navigation. */
export function syncTabWithQuery<T extends string>(
  route: ActivatedRoute,
  router: Router,
  active: WritableSignal<T>,
  allowed: readonly T[] | Signal<readonly T[]>,
  fallback: T,
  options?: SyncTabOptions,
): void {
  const allowedList = (): readonly T[] => (typeof allowed === 'function' ? allowed() : allowed);
  const parse = (raw: string | null): T =>
    raw && (allowedList() as readonly string[]).includes(raw) ? (raw as T) : fallback;

  // Apply the initial deep-link query param before the write effect runs.
  active.set(parse(route.snapshot.queryParamMap.get('tab')));

  route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
    const parsed = parse(query.get('tab'));
    if (parsed !== untracked(active)) {
      active.set(parsed);
    }
  });

  effect(() => {
    const current = active();
    const list = allowedList();
    const resolved = (list as readonly string[]).includes(current) ? current : fallback;
    if (resolved !== current) {
      untracked(() => active.set(resolved));
    }
    const targetParam = resolved === fallback ? null : resolved;
    const currentParam = route.snapshot.queryParamMap.get('tab') ?? null;
    if (currentParam !== targetParam) {
      options?.onBeforeNavigate?.();
      void router
        .navigate([], {
          relativeTo: route,
          queryParams: { tab: targetParam },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        })
        .finally(() => {
          options?.onAfterNavigate?.();
        });
    }
  });
}
