import type { TemplateOwnerAdmission, TemplateOwnerAdmissionHost, TemplateOwnerPins } from "./template-owner-admission";
import type { DesignerNativeSource } from "./designer-native-context";
import type { DesignerInteractionTicket } from "./designer-interaction-exit";
import type { TemplateDraftDocument } from "./template-design-api";
import type { TemplateScope } from "./templates-contract";
import type { DataBridge } from "./[id]/bindings/binding-contract";

export interface DesignerNativeLoadInput {
  readonly draft: TemplateDraftDocument;
  readonly scope: TemplateScope;
  readonly bridge: Omit<DataBridge, "context"> & {
    context(): { readonly key: string; readonly canRead: boolean; readonly readOnly: boolean };
  };
  readonly signal: AbortSignal;
  isCurrent(): boolean;
}

/** T12-qualified loader input; producer pins never come from the fetched response. */
export interface DesignerNativeRuntime {
  readonly pins: TemplateOwnerPins;
  readonly canonicalJson: TemplateOwnerAdmissionHost["canonicalJson"];
  isCurrent(): boolean;
  createSource(admission: TemplateOwnerAdmission, currentAdmission: () => TemplateOwnerAdmission | null, lifetime: DesignerInteractionTicket,
    input?: DesignerNativeLoadInput): DesignerNativeSource | null | Promise<DesignerNativeSource | null>;
}
