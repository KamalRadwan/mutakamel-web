import { useEffect, useRef, useState, type FormEvent } from "react";
import { array, uuid, uuid7 } from "@/shared/api/commercial-contract";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { applicationsApi } from "../api/applications.api";
import type { TierView } from "../types";
import { addonKey as readKey, bindingInput, bindingsBody, compatibilityBody, createBody, dependency, draftBody, grantsBody, lifecycleBody,
  publishBody, schemaBody, updateBody, type AddonCommand, type AddonDetail, type AddonVersion } from "../lib/addon-contract";
import type { AddonCopy } from "../lib/addon-copy";
import type { useAddonMutation } from "./useAddonMutation";

export type AddonAction = AddonCommand["kind"];
export interface AddonDialogOptions {
  applicationKey: string; action: AddonAction; detail?: AddonDetail; version?: AddonVersion;
  canReadTiers?: boolean;
  mutation: ReturnType<typeof useAddonMutation>; copy: AddonCopy;
  onAccepted: (key: string, receipt: { noChange: boolean; affectedOperationId?: string | null }) => Promise<void>; onClose: () => void;
}
const lines = (value: string) => value.split(/\r?\n/u).map(item => item.trim()).filter(Boolean);
function unique(values: string[]) { if (new Set(values).size !== values.length) throw new Error("Duplicate IDs"); return values; }

export function useAddonDefinitionDialog(options: AddonDialogOptions) {
  const { applicationKey, action, detail, version, mutation, copy, onAccepted, onClose } = options;
  // The dialog owns one reviewed snapshot. Background reads never silently replace its fences.
  const [snapshot] = useState(detail);
  const draft = snapshot?.draft;
  const [fields, setFields] = useState({ key: `${applicationKey}.`, name: draft?.name ?? "", description: draft?.description ?? "", reason: "",
    mode: draft?.mode ?? "ALL_ACTIVE", tierIds: draft?.tierIds.join("\n") ?? "", featureIds: draft?.grants.map(item => item.featureId).join("\n") ?? "",
    bindings: draft?.bindings.map(item => `${item.componentId}, ${item.releaseId}, ${item.capabilityKey}`).join("\n") ?? "",
    dependencies: draft?.dependencies.map(item => [item.applicationId, item.addonId ?? "", item.minimumDefinitionVersionId ?? ""].join(", ")).join("\n") ?? "",
    schemaOwner: draft?.schemaRef?.ownerApplicationId ?? snapshot?.applicationId ?? "", schemaKey: draft?.schemaRef?.key ?? "",
    schemaVersion: String(draft?.schemaRef?.version ?? ""), checksum: draft?.schemaRef?.checksum ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tierRequest, setTierRequest] = useState(0);
  const [tierLookup, setTierLookup] = useState<{ request: number; items: TierView[] | null; error: NormalizedApiError | null } | null>(null);
  const needsTiers = action === "COMPATIBILITY_REPLACE" && fields.mode === "ALLOWLIST" && options.canReadTiers === true;
  const [tierContext, setTierContext] = useState(needsTiers);
  if (tierContext !== needsTiers) {
    setTierContext(needsTiers);
    setTierLookup(null);
  }
  const applicationId = snapshot?.applicationId;
  useEffect(() => {
    if (!needsTiers || !applicationId) return;
    const controller = new AbortController();
    void applicationsApi.listTiers(applicationId, controller.signal).then(items => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(items) || items.length > 100 || new Set(items.map(item => item.id)).size !== items.length
        || items.some(item => item.moduleId !== applicationId || typeof item.name !== "string" || typeof item.key !== "string"
          || typeof item.isActive !== "boolean" || !(item.deletedAt === null || typeof item.deletedAt === "string"))) throw new Error("ADDON_TIER_OWNER_MISMATCH");
      items.forEach(item => uuid(item.id));
      setTierLookup({ request: tierRequest, items, error: null });
    }).catch(cause => {
      if (!controller.signal.aborted) setTierLookup({ request: tierRequest, items: null, error: normalizeApiError(cause) });
    });
    return () => controller.abort();
  }, [applicationId, needsTiers, tierRequest]);
  const tiersLoading = needsTiers && tierLookup?.request !== tierRequest;
  const tiers = needsTiers && !tiersLoading ? tierLookup?.items ?? null : null;
  const tiersError = needsTiers && !tiersLoading ? tierLookup?.error ?? null : null;
  const activeTiers = tiers?.filter(tier => tier.isActive && tier.deletedAt === null) ?? [];
  const selectedTierIds = lines(fields.tierIds);
  const unavailableTierIds = tiers ? [...new Set(selectedTierIds.filter(id => !activeTiers.some(tier => tier.id === id)))] : [];
  const tiersBlocked = needsTiers && (tiersLoading || unavailableTierIds.length > 0);
  const errorRef = useRef<HTMLDivElement>(null);
  const focusOrigin = useRef<{ launcher: HTMLButtonElement; dialog: HTMLElement } | null>(null);
  const captureReturnFocus = (event: Event) => {
    const launcher = document.activeElement, dialog = event.currentTarget;
    if (launcher instanceof HTMLButtonElement && dialog instanceof HTMLElement && !dialog.contains(launcher)) {
      focusOrigin.current = { launcher, dialog };
    }
  };
  const restoreReturnFocus = (event: Event) => {
    event.preventDefault();
    const origin = focusOrigin.current;
    if (!origin || !origin.launcher.isConnected || origin.launcher.disabled || !origin.launcher.getClientRects().length
      || origin.launcher.closest("[inert]") || getComputedStyle(origin.launcher).visibility !== "visible") return;
    // A permission/scope change or another dialog may already own focus.
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement && !origin.dialog.contains(active)) return;
    origin.launcher.focus({ preventScroll: true });
  };
  useEffect(() => {
    // The first async failure mounts the summary; focus only after that commit.
    if (mutation.error) errorRef.current?.focus();
  }, [mutation.error]);
  const setField = (key: keyof typeof fields, value: string) => setFields(previous => ({ ...previous, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mutation.isSubmitting || tiersBlocked) return;
    const failures: Record<string, string> = {};
    const check = <T,>(field: string, parse: () => T): T | undefined => {
      try { return parse(); } catch { failures[field] = field === "key" ? copy.keyInvalid : copy.invalid; return undefined; }
    };
    const revision = { expectedCatalogueRevision: snapshot?.catalogueRevision ?? "" };
    const draftRevision = { ...revision, draftVersionId: draft?.id ?? "", expectedDefinitionRevision: draft?.definitionRevision ?? "" };
    const reason = fields.reason.trim();
    if (!["CREATE", "UPDATE"].includes(action) && (!reason || reason.length > 256)) failures.reason = copy.required;
    let command: AddonCommand | undefined;
    switch (action) {
      case "CREATE": {
        const key = fields.key.trim();
        check("key", () => { readKey(key); if (!key.startsWith(`${applicationKey}.`)) throw new Error("Owner mismatch"); });
        if (!fields.name.trim() || fields.name.trim().length > 128) failures.name = copy.required;
        const body = check("description", () => createBody({ key, name: fields.name.trim(), description: fields.description.trim() || undefined }));
        if (body) command = { kind: action, body }; break;
      }
      case "UPDATE": {
        if (!fields.name.trim()) failures.name = copy.required;
        const body = check("name", () => updateBody({ ...draftRevision, name: fields.name.trim(), description: fields.description.trim() || null }));
        if (body) command = { kind: action, body }; break;
      }
      case "DRAFT_CREATE": {
        const body = check("reason", () => draftBody({ ...revision, reason, sourceDefinitionVersionId: snapshot?.publishedVersionId }));
        if (body) command = { kind: action, body }; break;
      }
      case "PUBLISH": {
        const body = check("reason", () => publishBody({ ...draftRevision, reason }));
        if (body) command = { kind: action, body }; break;
      }
      case "DEPRECATE": case "DISABLE": case "VERSION_REVOKE": case "DELETE": {
        const body = check("reason", () => lifecycleBody({ ...revision, reason }));
        if (body) command = action === "VERSION_REVOKE" ? { kind: action, versionId: uuid7(version?.id), body }
          : action === "DELETE" ? { kind: action, body: { expectedCatalogueRevision: body.expectedCatalogueRevision, reason } } : { kind: action, body };
        break;
      }
      case "COMPATIBILITY_REPLACE": {
        const tierIds = check("tierIds", () => {
          const values = fields.mode === "ALL_ACTIVE" ? [] : unique(array(uuid)(lines(fields.tierIds)));
          if (fields.mode === "ALLOWLIST" && values.length === 0) throw new Error("Empty allowlist"); return values;
        });
        const body = tierIds && check("tierIds", () => compatibilityBody({ ...draftRevision, reason, mode: fields.mode, tierIds }));
        if (body) command = { kind: action, body }; break;
      }
      case "FEATURE_GRANTS_REPLACE": {
        const featureIds = check("featureIds", () => {
          if (draft?.grants.some(item => item.config !== undefined || item.configSchemaRef !== undefined)) throw new Error("Typed owner editor required");
          return unique(array(uuid)(lines(fields.featureIds)));
        });
        const body = featureIds && check("featureIds", () => grantsBody({ ...draftRevision, reason, grants: featureIds.map(featureId => ({ featureId })) }));
        if (body) command = { kind: action, body }; break;
      }
      case "COMPONENT_BINDINGS_REPLACE": {
        const bindings = check("bindings", () => array(bindingInput)(lines(fields.bindings).map(line => {
          const parts = line.split(",").map(item => item.trim());
          if (parts.length !== 3) throw new Error("Binding requires three fields");
          return { componentId: parts[0], releaseId: parts[1], capabilityKey: parts[2] };
        })));
        const dependencies = check("dependencies", () => array(dependency)(lines(fields.dependencies).map(line => {
          const parts = line.split(",").map(item => item.trim());
          if (parts.length > 3) throw new Error("Dependency has extra fields");
          return { applicationId: parts[0], addonId: parts[1] || undefined, minimumDefinitionVersionId: parts[2] || undefined };
        })));
        const body = bindings && dependencies && check("bindings", () => bindingsBody({ ...draftRevision, reason, bindings, dependencies }));
        if (body) command = { kind: action, body }; break;
      }
      case "CONFIGURATION_SCHEMA_REPLACE": {
        const body = check("schemaKey", () => schemaBody({ ...draftRevision, reason, schemaRef: { ownerApplicationId: fields.schemaOwner.trim(),
          key: fields.schemaKey.trim(), version: /^\d+$/u.test(fields.schemaVersion) ? Number(fields.schemaVersion) : null, checksum: fields.checksum.trim() } }));
        if (body) command = { kind: action, body }; break;
      }
    }
    setErrors(failures);
    if (Object.keys(failures).length || !command) { queueMicrotask(() => errorRef.current?.focus()); return; }
    const key = action === "CREATE" ? fields.key.trim() : snapshot!.key;
    const receipt = await mutation.submit({ type: "definition", addonKey: key, command });
    if (receipt) { await onAccepted(key, receipt); onClose(); }
  };
  const toggleTier = (id: string, checked: boolean) => {
    if (mutation.isSubmitting || tiersLoading) return;
    setFields(previous => {
      const current = lines(previous.tierIds);
      return { ...previous, tierIds: (checked ? current.includes(id) ? current : [...current, id] : current.filter(value => value !== id)).join("\n") };
    });
  };
  return { fields, setField, errors, errorRef, captureReturnFocus, restoreReturnFocus, submit, snapshot, tiers, activeTiers, selectedTierIds, unavailableTierIds,
    tiersLoading, tiersError, tiersBlocked, toggleTier, refreshTiers: () => setTierRequest(value => value + 1) };
}
