import { useRef, useCallback } from "react";
import { generateUUIDv7 } from "@/lib/utils/uuid";

/**
 * A hook to manage UUIDv7 idempotency keys for API mutations.
 */
export function useIdempotency() {
  const keyRef = useRef<string>(generateUUIDv7());
  const hashRef = useRef<string | null>(null);

  const hashPayload = (payload: unknown) => {
    let str = "";
    try {
      str = JSON.stringify(payload);
    } catch {
      str = String(payload);
    }
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  };

  const getIdempotencyKey = useCallback((intentParts: unknown) => {
    const currentHash = hashPayload(intentParts);

    if (hashRef.current !== null && hashRef.current !== currentHash) {
      keyRef.current = generateUUIDv7();
    }

    hashRef.current = currentHash;
    return keyRef.current;
  }, []);

  const resetKey = useCallback(() => {
    keyRef.current = generateUUIDv7();
    hashRef.current = null;
  }, []);

  return { getIdempotencyKey, resetKey };
}
