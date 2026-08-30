const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Match the email syntax already accepted by Admin Portal configuration forms.
 * This deliberately avoids provider-specific restrictions so plus-addressing,
 * subdomains, and non-ASCII mailbox characters are not rejected client-side.
 */
export function isValidEmailAddress(value: string): boolean {
  return EMAIL_ADDRESS_PATTERN.test(value.trim());
}
