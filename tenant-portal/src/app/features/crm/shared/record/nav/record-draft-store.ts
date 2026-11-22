import { Injectable } from '@angular/core';
import { RecordNavContext } from './record-nav';

export interface RecordDraftEntry<T = unknown> {
  recordType: string;
  draft: T;
  recordId: string | null;
  baseUpdatedAt: string | null;
  nav: RecordNavContext | null;
}

function nextDraftKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const now = Date.now();
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(now / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(now / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Transient store carrying unsaved record drafts when expanding a quick modal into a full page. */
@Injectable({ providedIn: 'root' })
export class RecordDraftStore {
  private readonly entries = new Map<string, RecordDraftEntry>();

  put<T>(entry: Omit<RecordDraftEntry<T>, 'nav'> & { nav?: RecordNavContext | null }): string {
    const key = nextDraftKey();
    this.entries.set(key, { ...entry, nav: entry.nav ?? null });
    return key;
  }

  take<T>(key: string, recordType: string): RecordDraftEntry<T> | null {
    const entry = this.entries.get(key) ?? null;
    if (!entry || entry.recordType !== recordType) return null;
    this.entries.delete(key);
    return entry as RecordDraftEntry<T>;
  }
}
