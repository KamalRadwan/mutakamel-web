export const ACQUISITION_SOURCES_PATH =
  "/api/tenant/crm/v1/acquisition-sources";
export const ACQUISITION_SOURCE_REORDER_PATH =
  "/api/tenant/crm/v1/acquisition-sources/reorder";
export const ACQUISITION_SOURCE_NAME_MAX_LENGTH = 120;

// Icon upload bounds, from @mutakamel/storage's BUCKETS.CRM_SOURCE_ICONS entry
// (MAX_SIZE_BYTES 2 * MB, ALLOWED_MIME png/jpeg/x-icon/vnd.microsoft.icon) as
// re-asserted in acquisition-sources.controller.ts's requireIconUpload.
export const ACQUISITION_SOURCE_ICON_MAX_BYTES = 2 * 1024 * 1024;
export const ACQUISITION_SOURCE_ICON_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/x-icon",
  "image/vnd.microsoft.icon",
] as const;
// The controller also rejects a file whose EXTENSION does not match its type,
// with 415 CRM_ACQUISITION_SOURCE_ICON_EXTENSION_UNSUPPORTED.
const ACQUISITION_SOURCE_ICON_EXTENSIONS: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpeg", ".jpg"],
  "image/x-icon": [".ico"],
  "image/vnd.microsoft.icon": [".ico"],
};
/** The multipart field name the FileInterceptor binds to. */
export const ACQUISITION_SOURCE_ICON_FIELD = "file";

const MAX_ACQUISITION_SOURCES = 500;
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface AcquisitionSource {
  id: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  iconUrl: string | null;
}

export interface CreateAcquisitionSourceInput {
  nameAr: string;
  nameEn: string;
}

export function acquisitionSourcePath(id: string): string {
  if (!UUID_V7_PATTERN.test(id)) invalidResponse();
  return `${ACQUISITION_SOURCES_PATH}/${encodeURIComponent(id)}`;
}

export function acquisitionSourceIconPath(id: string): string {
  return `${acquisitionSourcePath(id)}/icon`;
}

/**
 * The complete ordered id list `PATCH /acquisition-sources/reorder` replaces
 * the dense one-based display order with.
 *
 * The payload must contain **every non-deleted source exactly once**
 * (`ReorderAcquisitionSourcesDto` plus the service's own check), so this is
 * built from the unfiltered catalogue — never from a searched subset.
 */
export function moveAcquisitionSourceOrder(
  sources: readonly AcquisitionSource[],
  sourceId: string,
  direction: -1 | 1,
): string[] | null {
  const ordered = [...sources].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const index = ordered.findIndex(({ id }) => id === sourceId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return null;
  const ids = ordered.map(({ id }) => id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}

/**
 * Classifies an icon file before it is sent.
 *
 * The three failures the controller answers with distinct statuses — 400 for a
 * missing or empty file, 413 for one over 2 MB, 415 for an unsupported type or
 * a mismatched extension — are three different messages, and checking size and
 * type here means the two that can be known locally cost no round trip. The
 * server still re-checks all of them, including the magic-byte test this
 * cannot do.
 */
export type IconRejection = "empty" | "tooLarge" | "unsupportedType" | "extensionMismatch";

export function classifyIconFile(file: File): IconRejection | null {
  if (file.size <= 0) return "empty";
  if (file.size > ACQUISITION_SOURCE_ICON_MAX_BYTES) return "tooLarge";
  const mimeType = file.type.trim().toLowerCase();
  const extensions = ACQUISITION_SOURCE_ICON_EXTENSIONS[mimeType];
  if (!extensions) return "unsupportedType";
  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  return extensions.includes(extension) ? null : "extensionMismatch";
}

export function buildCreateAcquisitionSourceRequest(
  input: CreateAcquisitionSourceInput,
): CreateAcquisitionSourceInput {
  return {
    nameAr: normalizedName(input.nameAr),
    nameEn: normalizedName(input.nameEn),
  };
}

export function parseAcquisitionSourcesResponse(
  payload: unknown,
): AcquisitionSource[] {
  if (!Array.isArray(payload) || payload.length > MAX_ACQUISITION_SOURCES) {
    invalidResponse();
  }
  const sources = payload.map(parseAcquisitionSourceResponse);
  if (
    new Set(sources.map(({ id }) => id)).size !== sources.length ||
    new Set(sources.map(({ sortOrder }) => sortOrder)).size !== sources.length
  ) {
    invalidResponse();
  }
  return sources;
}

export function parseAcquisitionSourceResponse(
  payload: unknown,
): AcquisitionSource {
  const source = record(payload);
  if (
    !source ||
    typeof source.id !== "string" ||
    !UUID_V7_PATTERN.test(source.id) ||
    typeof source.nameAr !== "string" ||
    !validName(source.nameAr) ||
    typeof source.nameEn !== "string" ||
    !validName(source.nameEn) ||
    typeof source.isActive !== "boolean" ||
    !Number.isSafeInteger(source.sortOrder) ||
    (source.sortOrder as number) < 1 ||
    !validTimestamp(source.createdAt) ||
    !validTimestamp(source.updatedAt) ||
    !validIconUrl(source.iconUrl, source.id)
  ) {
    invalidResponse();
  }

  return {
    id: source.id,
    nameAr: source.nameAr,
    nameEn: source.nameEn,
    isActive: source.isActive,
    sortOrder: source.sortOrder as number,
    createdAt: source.createdAt as string,
    updatedAt: source.updatedAt as string,
    iconUrl: source.iconUrl as string | null,
  };
}

function normalizedName(value: string): string {
  const normalized = value.trim();
  if (!validName(normalized)) {
    throw new Error(
      `Acquisition-source names must contain 1-${ACQUISITION_SOURCE_NAME_MAX_LENGTH} characters.`,
    );
  }
  return normalized;
}

function validName(value: string): boolean {
  return (
    value.trim() === value &&
    value.length > 0 &&
    value.length <= ACQUISITION_SOURCE_NAME_MAX_LENGTH
  );
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function validIconUrl(value: unknown, id: string): boolean {
  const iconPath = `${acquisitionSourcePath(id)}/icon`;
  return (
    value === null ||
    (typeof value === "string" &&
      (value === iconPath || value.startsWith(`${iconPath}?`)))
  );
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function invalidResponse(): never {
  throw new Error("Invalid CRM acquisition-sources response.");
}
