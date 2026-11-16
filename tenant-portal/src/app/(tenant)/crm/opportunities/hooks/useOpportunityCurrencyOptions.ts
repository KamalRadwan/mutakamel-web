"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { readCoreData } from "@/lib/api/envelope";

/** Advisory catalogue only; missing permission still permits explicit ISO codes. */
export function useOpportunityCurrencyOptions(enabled: boolean) {
  const { user } = useTenantAuth();
  const canRead = user?.permissions.includes("currencies.currency.read") ?? false;
  const [codes, setCodes] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled || !canRead) return;
    const controller = new AbortController();
    void (async () => {
      const loaded: string[] = [];
      try {
        for (let page = 1; page <= 100; page++) {
          const payload = await readCoreData(`/api/tenant/core/v1/currencies?status=ACTIVE&limit=100&sortBy=code&sortDir=ASC&page=${page}`, { signal: controller.signal, maxResponseBytes: 200_000 });
          const items: unknown = Array.isArray(payload) ? payload : payload && typeof payload === "object" && "items" in payload ? payload.items : null;
          if (!Array.isArray(items)) throw new Error("Invalid currency list");
          for (const item of items as unknown[]) {
            if (!item || typeof item !== "object" || !("code" in item) || typeof item.code !== "string" || !/^[A-Z]{3}$/.test(item.code)) throw new Error("Invalid currency code");
            loaded.push(item.code);
          }
          if (controller.signal.aborted) return;
          if (items.length < 100) { setCodes([...new Set(loaded)]); return; }
        }
        throw new Error("Invalid currency pagination");
      } catch {
        if (!controller.signal.aborted) setCodes([]);
      }
    })();
    return () => controller.abort();
  }, [enabled, canRead]);
  return enabled && canRead ? codes : [];
}
