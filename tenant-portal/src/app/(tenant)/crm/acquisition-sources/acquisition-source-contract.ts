export const ACQUISITION_SOURCES_PATH =
  "/api/tenant/crm/v1/acquisition-sources";
export const ACQUISITION_SOURCE_NAME_MAX_LENGTH = 120;

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
