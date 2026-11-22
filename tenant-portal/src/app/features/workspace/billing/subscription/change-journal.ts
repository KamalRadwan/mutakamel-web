import { PrepareBody } from '../billing.model';

export const CHANGE_JOURNAL_KEY = 'billing.change';

export interface ChangeJournalEntry {
  operationId: string;
  operationRevision: string;
  previewId?: string;
  body: PrepareBody;
}

function isValidEntry(raw: unknown): raw is ChangeJournalEntry {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as Record<string, unknown>;
  if (typeof rec['operationId'] !== 'string' || !rec['operationId'].trim()) return false;
  if (typeof rec['operationRevision'] !== 'string') return false;
  if (rec['previewId'] !== undefined && typeof rec['previewId'] !== 'string') return false;

  const body = rec['body'];
  if (!body || typeof body !== 'object') return false;
  const bodyRec = body as Record<string, unknown>;
  if (typeof bodyRec['expectedSubscriptionRevision'] !== 'string') return false;
  if (!Array.isArray(bodyRec['changes']) || bodyRec['changes'].length === 0) return false;
  if (bodyRec['reason'] !== undefined && typeof bodyRec['reason'] !== 'string') return false;
  return true;
}

export function readChangeJournal(): ChangeJournalEntry | null {
  try {
    const raw = sessionStorage.getItem(CHANGE_JOURNAL_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidEntry(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeChangeJournal(entry: ChangeJournalEntry): void {
  try {
    sessionStorage.setItem(CHANGE_JOURNAL_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage quota or disabled sessionStorage errors.
  }
}

export function clearChangeJournal(): void {
  try {
    sessionStorage.removeItem(CHANGE_JOURNAL_KEY);
  } catch {
    // Ignore disabled sessionStorage errors.
  }
}

export function hasChangeJournal(): boolean {
  return readChangeJournal() !== null;
}
