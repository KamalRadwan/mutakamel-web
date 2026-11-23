import type { TemplateDocumentV1 } from '../templates.model';
import { isValidSafeColor, normalizeSafeColor } from './fields/field-helpers';

/** Snapshot the saved document palette, followed by the current brand/neutral palette. */
export function designerColorSwatches(doc: TemplateDocumentV1 | null): readonly string[] | null {
  const colors = new Set<string>();
  const add = (value: string): void => {
    if (isValidSafeColor(value)) colors.add(normalizeSafeColor(value));
  };
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (
        typeof child === 'string' &&
        /^(color|backgroundColor|textColor|accentColor|surfaceColor)$/.test(key)
      ) {
        add(child);
      } else if (typeof child === 'object') {
        visit(child);
      }
    }
  };
  if (doc) {
    visit(doc.page);
    visit(doc.canvasPages);
    visit(doc.email);
    visit(doc.nodes);
    visit(doc.theme);
  }

  const styles = getComputedStyle(document.documentElement);
  for (const token of [
    '--brand',
    '--accent',
    '--brand-soft',
    '--text',
    '--text-muted',
    '--border-field',
    '--border',
    '--neutral-soft',
    '--surface',
  ]) {
    add(styles.getPropertyValue(token));
  }
  return colors.size > 0 ? [...colors] : null;
}
