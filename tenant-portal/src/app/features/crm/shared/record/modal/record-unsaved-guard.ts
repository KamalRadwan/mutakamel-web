import { Signal, signal } from '@angular/core';
import { UnsavedChoice, UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';

export interface UnsavedGuardOptions {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
  discard: () => void;
  dialog: () => UnsavedDialog | undefined;
  isOpen?: () => boolean;
  isBlocked?: () => boolean;
  onLeave?: () => void;
}

export interface UnsavedGuard {
  readonly busy: Signal<boolean>;
  confirmLeave(): Promise<boolean>;
  canDeactivate(): Promise<boolean>;
}

/** Coordinates unsaved-changes confirmation across modal close, item navigation, and route deactivation. */
export function createUnsavedGuard(options: UnsavedGuardOptions): UnsavedGuard {
  const busy = signal(false);

  async function confirmLeave(): Promise<boolean> {
    if (!options.isDirty()) return true;
    if (busy()) return false;
    const dialog = options.dialog();
    if (!dialog) return false;

    busy.set(true);
    let choice: UnsavedChoice = 'cancel';
    try {
      choice = await dialog.open();
    } finally {
      busy.set(false);
    }

    if (choice === 'cancel') return false;
    if (choice === 'discard') {
      options.discard();
      return true;
    }
    return options.save();
  }

  async function canDeactivate(): Promise<boolean> {
    if (options.isOpen && !options.isOpen()) return true;
    if (options.isBlocked?.()) return false;
    const ok = await confirmLeave();
    if (!ok) return false;
    options.onLeave?.();
    return true;
  }

  return {
    busy: busy.asReadonly(),
    confirmLeave,
    canDeactivate,
  };
}
