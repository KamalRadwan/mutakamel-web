import { DestroyRef, type Signal, assertInInjectionContext, inject, signal } from '@angular/core';
import { producerUpdatesAllowed } from '@angular/core/primitives/signals';
import { type TranslocoEvents, TranslocoService } from '@jsverse/transloco';

/**
 * The last Transloco event (language changed, translation loaded) as a signal. Read it inside a
 * `computed` that calls `transloco.translate()` so the text re-translates when it changes.
 *
 * Use this instead of `toSignal(transloco.events$)` or a hand-written tick signal. Why: a loader
 * that answers synchronously (specs, cached translations) emits `translationLoadSuccess` while a
 * template or a `computed` is running, and writing a signal there throws NG0600. When that happens
 * the update waits for the next microtask; otherwise it is written at once, as before.
 *
 * Call it in an injection context (a field initializer or the constructor).
 */
export function translationEvents(
  transloco: TranslocoService = inject(TranslocoService),
): Signal<TranslocoEvents | undefined> {
  assertInInjectionContext(translationEvents);
  const last = signal<TranslocoEvents | undefined>(undefined);
  const subscription = transloco.events$.subscribe((event) => {
    if (producerUpdatesAllowed()) {
      last.set(event);
    } else {
      queueMicrotask(() => last.set(event));
    }
  });
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  return last.asReadonly();
}
