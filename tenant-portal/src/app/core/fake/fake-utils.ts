/** Generic helpers for fake (in-memory) API implementations. Shared by every feature. */

export { newIdempotencyKey as fakeId } from '../api/idempotency';

export function fakeDelay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
