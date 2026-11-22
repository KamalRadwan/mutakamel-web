import type {
  TemplateEmailPreviewResponseDto,
  TemplateHtmlPreviewResponseDto,
  TemplatePdfJobArtifact,
  TemplatePdfJobDto,
  TemplatePreviewSource,
} from '../templates.api';

export type PreviewFormat = 'HTML' | 'EMAIL' | 'TEXT' | 'PDF';

export type PreviewCacheFamily = 'HTML' | 'EMAIL' | 'PDF';

export type CachedPreviewResult =
  | {
      kind: 'HTML';
      response: TemplateHtmlPreviewResponseDto;
      generatedAt: string;
    }
  | {
      kind: 'EMAIL';
      response: TemplateEmailPreviewResponseDto;
      generatedAt: string;
    }
  | {
      kind: 'PDF';
      job: TemplatePdfJobDto;
      artifact: TemplatePdfJobArtifact;
      blob: Blob;
      objectUrl: string;
      generatedAt: string;
    };

/** Maps EMAIL and TEXT formats to one shared EMAIL cache entry so switching views is instant. */
export function cacheFamilyFor(format: PreviewFormat): PreviewCacheFamily {
  if (format === 'TEXT') return 'EMAIL';
  return format;
}

/** Builds a stable cache key for (template, format family, source, fixture). */
export function buildPreviewCacheKey(
  templateId: string,
  format: PreviewFormat,
  source: TemplatePreviewSource,
  fixtureKey: string,
): string {
  const sourcePart = source.kind === 'DRAFT' ? `DRAFT:${source.draftRevision}` : `VERSION:${source.versionId}`;
  return `${templateId}|${cacheFamilyFor(format)}|${sourcePart}|${fixtureKey}`;
}

/** In-memory preview cache per tab lifetime that safely manages PDF object URLs. */
export class PreviewCache {
  private readonly entries = new Map<string, CachedPreviewResult>();

  get(key: string): CachedPreviewResult | undefined {
    return this.entries.get(key);
  }

  set(key: string, entry: CachedPreviewResult): void {
    const prev = this.entries.get(key);
    if (prev && prev.kind === 'PDF' && (entry.kind !== 'PDF' || prev.objectUrl !== entry.objectUrl)) {
      URL.revokeObjectURL(prev.objectUrl);
    }
    this.entries.set(key, entry);
  }

  delete(key: string): void {
    const prev = this.entries.get(key);
    if (prev && prev.kind === 'PDF') {
      URL.revokeObjectURL(prev.objectUrl);
    }
    this.entries.delete(key);
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      if (entry.kind === 'PDF') {
        URL.revokeObjectURL(entry.objectUrl);
      }
    }
    this.entries.clear();
  }
}
