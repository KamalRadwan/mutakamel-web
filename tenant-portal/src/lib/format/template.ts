// Fills {placeholder} tokens in a dictionary string. Numbers are not passed
// through Intl here — callers that need locale-formatted numbers format
// them first and pass the resulting string.
export function formatTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
