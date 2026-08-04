import { useRef, useCallback } from "react";
import { v7 as uuidv7 } from "uuid";

/**
 * A hook to manage UUIDv7 idempotency keys for API mutations.
 */
export function useIdempotency() {
  const keyRef = useRef<string>(uuidv7());
  const hashRef = useRef<string | null>(null);

  const hashPayload = (payload: unknown) => {
    try {
      return JSON.stringify(payload);
    } catch {
      return String(payload);
    }
  };

  const getIdempotencyKey = useCallback((currentPayload: unknown) => {
    const currentHash = hashPayload(currentPayload);

    if (hashRef.current !== null && hashRef.current !== currentHash) {
      keyRef.current = uuidv7();
    }

    hashRef.current = currentHash;
    return keyRef.current;
  }, []);

  const resetKey = useCallback(() => {
    keyRef.current = uuidv7();
    hashRef.current = null;
  }, []);

  return { getIdempotencyKey, resetKey };
}
