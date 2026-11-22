/** Strips formatting from a phone number while keeping a leading `+`, digits, `*`, and `#`. */
export function toDialable(raw: string | null | undefined): string {
  if (!raw) return '';
  const kept = raw.replace(/[^+\d*#]/g, '');
  if (!kept) return '';
  const hasLeadingPlus = kept.startsWith('+');
  const body = kept.replace(/\+/g, '');
  return hasLeadingPlus ? `+${body}` : body;
}

/** Builds a SIP URI target from a dialable number, existing `sip:` URI, or `user@domain` address. */
export function toSipTarget(dialable: string, sipDomain: string): string {
  const trimmed = dialable.trim();
  if (!trimmed) return '';
  if (/^sip:/i.test(trimmed)) return `sip:${trimmed.slice(4)}`;
  if (/^sips:/i.test(trimmed)) return `sips:${trimmed.slice(5)}`;
  if (trimmed.includes('@')) return `sip:${trimmed}`;
  const clean = toDialable(trimmed);
  if (!clean) return '';
  const domain = sipDomain.trim();
  return domain ? `sip:${clean}@${domain}` : clean;
}
