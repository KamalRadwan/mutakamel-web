"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { inspectorRecord } from "./inspector-contract";
import type { InspectorCurrencyResult } from "./inspector-currency";
import { useInspectorPorts } from "./useInspectorPorts";

export function useInspectorCurrency(value: unknown, onValue: (value: Record<string, unknown>) => void, disabled: boolean) {
  const { currency } = useInspectorPorts();
  const [result, setResult] = useState<{ qualifier: typeof currency; binding: unknown; result: InspectorCurrencyResult | { status: "checking" } } | null>(null);
  const active = useRef<AbortController | null>(null);
  const latest = useRef({ currency, value, onValue, disabled, mounted: true });
  useLayoutEffect(() => { latest.current = { currency, value, onValue, disabled, mounted: true }; });
  useLayoutEffect(() => { active.current?.abort(); active.current = null; }, [currency, value, onValue, disabled]);
  useLayoutEffect(() => () => { active.current?.abort(); latest.current = { ...latest.current, mounted: false }; }, []);
  const current = () => latest.current.mounted && !latest.current.disabled && latest.current.currency === currency && latest.current.value === value && latest.current.onValue === onValue;
  const candidate = !disabled && result !== null && result.qualifier === currency && result.binding === value ? result.result : null;
  const visible = candidate?.status === "ready" && (!candidate.current() || !candidate.writable()) ? null : candidate;
  return { state: visible?.status ?? "unavailable", paths: visible?.status === "ready" ? visible.paths : [], allowContextCurrency: visible?.status === "ready" && visible.allowContextCurrency,
    qualify: async () => {
      if (!currency || !current()) return;
      active.current?.abort(); const operation = new AbortController(); active.current = operation;
      setResult({ qualifier: currency, binding: value, result: { status: "checking" } });
      let qualified: InspectorCurrencyResult;
      try { qualified = await currency.qualify(value, operation.signal); } catch { qualified = { status: "unavailable" }; }
      if (!operation.signal.aborted && active.current === operation && current()) setResult({ qualifier: currency, binding: value, result: qualified });
    },
    choose: (path: string) => {
      if (!currency || !current() || visible?.status !== "ready" || !visible.current() || !visible.writable() ||
        (path === "INHERIT" ? !visible.allowContextCurrency : !visible.paths.includes(path))) return;
      const selected = path === "INHERIT" ? undefined : path;
      if (!currency.admit(value, selected)) { setResult(null); return; }
      const binding = inspectorRecord(value), format = { ...inspectorRecord(binding.format) };
      if (selected === undefined) delete format.currencyCodePath;
      else format.currencyCodePath = selected;
      onValue({ ...binding, format });
    },
    canQualify: !!currency && !disabled && visible?.status !== "checking",
  };
}
