import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { normalizeApiError } from "@/lib/api/errors";
import { requiresSameKeyRecovery } from "@/lib/api/outcomes";
import { generateUUIDv7 } from "@/lib/uuid";
import { ASSET_CHECKSUM_MISMATCH_CODE, ASSET_FILE_MAX_BYTES, ASSET_MIME_TYPES, ASSET_UPLOAD_INVALID_CODE,
  fetchUploadedTemplateAsset, sha256Hex, uploadTemplateAsset, type AssetUploadMetadata, type TemplateAsset } from "../../template-assets-contract";

export interface QuotationImageUploadPort {
  readonly ownerKey: string;
  readonly definitionId: string;
  readonly draftRevision: number;
  readonly disabled: boolean;
  isCurrent(): boolean;
  accept(asset: TemplateAsset): boolean;
}

interface UploadIntent {
  readonly file: File;
  readonly metadata: AssetUploadMetadata;
  readonly mutationId: string;
}

type UploadFeedback = "assetUploaded" | "assetUploadFailed" | "assetUploadInvalid" | "assetTooLarge" | "assetChecksumMismatch";

export function useQuotationImageUpload(port: QuotationImageUploadPort | null) {
  const currentPort = useRef<QuotationImageUploadPort | null>(null);
  useLayoutEffect(() => {
    currentPort.current = port;
    return () => { currentPort.current = null; };
  }, [port]);
  const [selection, setSelection] = useState<{ ownerKey: string; draftRevision: number; file: File | null } | null>(null);
  const [unresolved, setUnresolved] = useState<{ ownerKey: string; intent: UploadIntent } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ownerKey: string; value: UploadFeedback | null } | null>(null);
  const working = useRef(false);
  const [selectionVersion, resetSelection] = useState(0);
  const ownerKey = port?.ownerKey;
  const definitionId = port?.definitionId;
  const draftRevision = port?.draftRevision;
  const file = selection && selection.ownerKey === ownerKey && selection.draftRevision === draftRevision ? selection.file : null;
  const pending = unresolved && unresolved.ownerKey === ownerKey ? unresolved.intent : null;
  const feedback = message && message.ownerKey === ownerKey ? message.value : null;

  const currentOwner = () => {
    const current = currentPort.current;
    return ownerKey && current?.ownerKey === ownerKey && current.definitionId === definitionId ? current : null;
  };
  const active = () => {
    const current = currentOwner();
    return current && current.draftRevision === draftRevision && current.isCurrent() ? current : null;
  };

  function select(event: ChangeEvent<HTMLInputElement>) {
    if (!port || !active() || working.current || pending) return;
    setSelection({ ownerKey: port.ownerKey, draftRevision: port.draftRevision, file: event.currentTarget.files?.[0] ?? null });
    setMessage(null);
  }

  async function submit() {
    if (!port || !active() || working.current || (!file && !pending)) return;
    const setFeedback = (value: UploadFeedback | null) => setMessage({ ownerKey: port.ownerKey, value });
    const fileName = file?.name.normalize("NFC").trim().slice(0, 255);
    const mime = ASSET_MIME_TYPES.find(candidate => candidate === file?.type);
    if (!pending && (!file || !fileName || !mime || !file.size || /[\\/\0\r\n]/u.test(fileName) || [".", ".."].includes(fileName))) {
      setFeedback("assetUploadInvalid");
      return;
    }
    if (!pending && file && file.size > ASSET_FILE_MAX_BYTES) { setFeedback("assetTooLarge"); return; }

    let intent = pending;
    let dispatched = false;
    working.current = true;
    setBusy(true);
    setFeedback(null);
    const assertCurrent = () => { if (!active()) throw new Error("Stale quotation image upload"); };
    try {
      if (!intent && file && fileName && mime) {
        const expectedRawSha256 = await sha256Hex(file);
        if (!active()) return;
        intent = { file, mutationId: generateUUIDv7(), metadata: {
          definitionId: port.definitionId, assetType: "IMAGE", deliveryClass: "PRIVATE_ONLY", fileName,
          declaredMimeType: mime, expectedRawSha256,
        } };
      }
      if (!intent || !active()) return;
      let asset = pending ? await fetchUploadedTemplateAsset(intent.mutationId, assertCurrent) : null;
      if (!asset) {
        if (!active()) return;
        dispatched = true;
        asset = await uploadTemplateAsset(intent.metadata, intent.file, { mutationId: intent.mutationId, assertCurrent });
      }
      const current = active();
      if (!current) {
        if (currentOwner()) setUnresolved({ ownerKey: port.ownerKey, intent });
        return;
      }
      if (asset.id !== intent.mutationId || asset.definitionId !== intent.metadata.definitionId ||
          asset.status !== "ACTIVE" || asset.assetType !== "IMAGE" || asset.deliveryClass !== "PRIVATE_ONLY" ||
          asset.originalFileName !== intent.metadata.fileName || asset.mimeType !== intent.metadata.declaredMimeType || !current.accept(asset)) {
        setUnresolved({ ownerKey: port.ownerKey, intent });
        return;
      }
      setUnresolved(null);
      setSelection(null);
      resetSelection(version => version + 1);
      setFeedback("assetUploaded");
    } catch (error) {
      if (!active()) {
        if (intent && dispatched && currentOwner()) setUnresolved({ ownerKey: port.ownerKey, intent });
        return;
      }
      const problem = normalizeApiError(error);
      if (intent && (pending || (dispatched && (requiresSameKeyRecovery(problem) ||
          problem.code === "CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT" || problem.code === "RESPONSE_TARGET_UNCONFIRMED")))) {
        setUnresolved({ ownerKey: port.ownerKey, intent });
        return;
      }
      setFeedback(problem.code === ASSET_UPLOAD_INVALID_CODE ? "assetUploadInvalid" :
        problem.code === ASSET_CHECKSUM_MISMATCH_CODE ? "assetChecksumMismatch" : "assetUploadFailed");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return port ? { key: `${port.ownerKey}:${port.draftRevision}:${selectionVersion}`, file, pending: !!pending, busy, feedback, select, submit, disabled: port.disabled } : null;
}
