import { Injectable } from '@angular/core';
import type { ItemDraft } from './item-draft';

export interface ItemDraftEntry {
  draft: ItemDraft;
  file: File | null;
}

@Injectable({ providedIn: 'root' })
export class ItemDraftStore {
  private entry: ItemDraftEntry | null = null;

  put(draft: ItemDraft, file?: File | null): void {
    this.entry = {
      draft: structuredClone(draft),
      file: file ?? null,
    };
  }

  take(): ItemDraftEntry | null {
    const current = this.entry;
    this.entry = null;
    return current;
  }
}
