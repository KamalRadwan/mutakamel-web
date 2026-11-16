/** Canonical browser origin used by the tenant FQDN guard and exact Core response receipts. */
export function salesQuotationTenantOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password && value === url.origin ? url.origin : null;
  } catch { return null; }
}
