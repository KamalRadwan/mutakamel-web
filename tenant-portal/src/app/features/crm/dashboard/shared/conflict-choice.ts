import { signal } from '@angular/core';

/** Bridges the shared conflict dialog's outputs to an action waiting for the user's choice. */
export class ConflictChoice {
  readonly visible = signal(false);
  private resolve: ((keep: boolean) => void) | null = null;
  open(): Promise<boolean> {
    this.choose(false);
    this.visible.set(true);
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
  choose(keep: boolean): void {
    const resolve = this.resolve;
    this.resolve = null;
    this.visible.set(false);
    resolve?.(keep);
  }
  dismissed(open: boolean): void {
    if (open) return;
    const pending = this.resolve;
    // Native close can precede the dialog's choice output; let that choice settle first.
    queueMicrotask(() => {
      if (this.resolve === pending) this.choose(false);
    });
  }
}
