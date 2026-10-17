import { formatTemplate } from "@/lib/format/template";

export interface UploadScreeningLabels {
  /** e.g. "{name} is {size}, over the {max} limit". */
  tooLarge: string;
  /** e.g. "{name} is not an accepted file type". */
  wrongType: string;
  /** e.g. "Only {max} files can be attached". Needed only when `maxFiles` is set. */
  tooMany?: string;
}

export interface UploadScreeningOptions {
  /** MIME allowlist, exact values. */
  accept: readonly string[];
  maxSizeBytes: number;
  maxFiles?: number;
  /** Files already queued, counted against `maxFiles`. */
  queuedCount?: number;
  formatBytes: (bytes: number) => string;
  labels: UploadScreeningLabels;
}

/**
 * The MIME allowlist, size cap and count cap every upload control enforces
 * before a file reaches its caller. One implementation, so `FileUpload` and
 * `ImageUploadTile` can never disagree about what they admit.
 */
export function screenUploadFiles(
  candidates: readonly File[],
  { accept, maxSizeBytes, maxFiles, queuedCount = 0, formatBytes, labels }: UploadScreeningOptions,
): { accepted: File[]; rejected: string[] } {
  const accepted: File[] = [];
  const rejected: string[] = [];

  for (const file of candidates) {
    if (!accept.includes(file.type)) {
      rejected.push(formatTemplate(labels.wrongType, { name: file.name }));
      continue;
    }
    if (file.size > maxSizeBytes) {
      rejected.push(
        formatTemplate(labels.tooLarge, {
          name: file.name,
          size: formatBytes(file.size),
          max: formatBytes(maxSizeBytes),
        }),
      );
      continue;
    }
    if (maxFiles !== undefined && queuedCount + accepted.length >= maxFiles) {
      rejected.push(formatTemplate(labels.tooMany ?? "", { max: maxFiles }));
      continue;
    }
    accepted.push(file);
  }

  return { accepted, rejected };
}
