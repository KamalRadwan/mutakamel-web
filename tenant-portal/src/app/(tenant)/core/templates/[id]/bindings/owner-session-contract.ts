import type { TemplateOwnerAdmission, TemplateOwnerAdmissionHost } from "../../template-owner-admission";
import type { DataBridge, DataCatalogue, DataNative, FunctionVersion } from "./binding-contract";
import type { InspectorDataPortHost } from "./inspector-data-contract";

/** A stable live snapshot supplied by the independently qualified T01/T12 loader.
 * The browser hash is separate from the server root entrypoint hash in host.pins.
 * Shape checks below cannot establish package provenance or qualify this snapshot.
 */
export interface DataNativeQualification {
  readonly key: string;
  readonly publicEntry: "@mutakamel/template-schema/browser-safe";
  readonly browserEntrypointSha256: string;
  readonly host: TemplateOwnerAdmissionHost;
  readonly native: unknown;
}

/** Separate authorized function/identity owner observation; descriptor transport
 * grants none of these memberships. An empty versions list must be owner-proven.
 * Replace this stable snapshot or retire isCurrent when any membership changes.
 */
export interface DataFunctionOwner {
  readonly key: string;
  readonly tenantId: string;
  readonly companyId: string | null;
  readonly versions: readonly FunctionVersion[];
  readonly identityAuthority?: DataCatalogue["identityAuthority"];
  isCurrent(): boolean;
}

export interface DataOwnerSessionInput {
  bridge: DataBridge;
  readQualification(): DataNativeQualification | null;
  readFunctionOwner(): DataFunctionOwner | null;
  /** Bind the captured source/scope to T04 fetchTemplateOwnerAdmission. Preserve
   * its HTTP errors; do not construct an admission from projected API fields.
   */
  readOwnerAdmission(host: TemplateOwnerAdmissionHost): Promise<TemplateOwnerAdmission | null>;
}

export type DataOwnerSessionResult =
  | { status: "ready"; host: InspectorDataPortHost; admission: TemplateOwnerAdmission }
  | { status: "unavailable"; reason: "CONTEXT_UNAVAILABLE" | "NATIVE_PROVIDER_INCOMPLETE" | "FUNCTION_OWNER_UNAVAILABLE" | "OWNER_ADMISSION_UNAVAILABLE" | "NATIVE_DESCRIPTOR_REJECTED" | "CONTEXT_RETIRED" };

export type QualifiedDataNative = DataNative & { canonicalJson(value: unknown): string };
