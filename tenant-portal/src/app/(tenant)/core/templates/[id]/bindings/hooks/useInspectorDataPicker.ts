"use client";
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { canStageInspectorData, captureInspectorData } from "../inspector-data-admission";
import type { InspectorDataPickerProps, InspectorDataPortHost } from "../inspector-data-contract";
import type { DataValue } from "../binding-contract";

export function useInspectorDataPicker(host: InspectorDataPortHost, props: InspectorDataPickerProps, cell = false) {
  useSyncExternalStore(host.bridge.subscribe, host.bridge.read, host.bridge.read);
  const authoritySnapshot = () => JSON.stringify([host.bridge.context(), host.bridge.selection(), host.bridge.canEdit(), host.readSourceFingerprint()]);
  useSyncExternalStore(host.bridge.subscribe, authoritySnapshot, authoritySnapshot);
  const capture = captureInspectorData(host, props.fields, cell);
  const lease = useMemo(() => ({ pin: capture?.pin, value: props.value, fields: props.fields, onValue: props.onValue, disabled: props.disabled }), [capture?.pin, props.value, props.fields, props.onValue, props.disabled]);
  const active = useRef<object | null>(null);
  useLayoutEffect(() => { active.current = lease; return () => { active.current = null; }; }, [lease]);
  const stage = (value: DataValue) => {
    if (active.current === lease && capture && canStageInspectorData(host, capture, props, cell)) props.onValue(value);
  };
  return { capture, disabled: !capture || !canStageInspectorData(host, capture, props, cell), stage };
}
