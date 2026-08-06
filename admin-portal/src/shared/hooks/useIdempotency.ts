import { useRef, useCallback } from "react";
import { generateUUIDv7 } from "@/lib/utils/uuid";

function serializeIdempotencyIntent(payload: unknown): string {
  try {
    return JSON.stringify(payload) ?? String(payload);
  } catch {
    return String(payload);
  }
}

/**
 * A hook to manage UUIDv7 idempotency keys for API mutations.
 */
export function useIdempotency() {
  const keyRef = useRef<string>(generateUUIDv7());
  const intentRef = useRef<string | null>(null);

  const getIdempotencyKey = useCallback((intentParts: unknown) => {
    const currentIntent = serializeIdempotencyIntent(intentParts);

    if (intentRef.current !== null && intentRef.current !== currentIntent) {
      keyRef.current = generateUUIDv7();
    }

    intentRef.current = currentIntent;
    return keyRef.current;
  }, []);

  const resetKey = useCallback(() => {
    keyRef.current = generateUUIDv7();
    intentRef.current = null;
  }, []);

  return { getIdempotencyKey, resetKey };
}
