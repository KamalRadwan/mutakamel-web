import { lookupNumber } from './phone.api';
import { CallSource } from './phone.model';

const DEFAULT_LOOKUP_TIMEOUT_MS = 1000;

/** Looks up a single exact CRM match for a phone number, never delaying beyond `timeoutMs`. */
export async function lookupCaller(phoneNumber: string, timeoutMs = DEFAULT_LOOKUP_TIMEOUT_MS): Promise<CallSource | null> {
  if (!phoneNumber.trim()) return null;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    const res = await Promise.race([
      lookupNumber(phoneNumber).catch(() => null),
      timeoutPromise,
    ]);
    if (!res || res.count !== 1 || !res.match) return null;
    return {
      type: res.match.type,
      id: res.match.id,
      label: res.match.name,
    };
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
