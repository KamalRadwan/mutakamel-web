import type { ComponentType } from "react";
import type { TemplateDataSchema } from "../../template-design-api";
import type { DataBridge, DataCatalogue, DataNative, DataValue } from "./binding-contract";

/** Exact structural props published by T02 successor-r3; no peer source import is needed. */
export interface InspectorDataPickerProps {
  value: unknown;
  fields: TemplateDataSchema["fields"];
  onValue(value: DataValue): void;
  disabled: boolean;
}
export interface InspectorDataPortHost {
  bridge: DataBridge;
  readCatalogue(): DataCatalogue | null;
  readNative(): DataNative | null;
  /** R6 admission.fingerprint, only after T04 parsing and actual owner/package qualification. */
  readSourceFingerprint(): string | null;
}
export interface InspectorDataPorts {
  BindingPicker: ComponentType<InspectorDataPickerProps>;
  CellValuePicker: ComponentType<InspectorDataPickerProps>;
}
