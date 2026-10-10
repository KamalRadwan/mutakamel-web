/**
 * Operator text for a provisioning code, or `null` when it has none so the
 * caller shows the code itself.
 *
 * Codes come from Core, CRM, Trade, the Worker and the Gateway, and a release
 * can ship one this build has never seen, so they are not an enum the browser
 * can exhaust. `hasOwnProperty` keeps a code such as `constructor` from
 * resolving to an `Object.prototype` member.
 */
export function provisioningCodeText(
  texts: Readonly<Record<string, string>>,
  code: string | null | undefined,
): string | null {
  if (!code || !Object.prototype.hasOwnProperty.call(texts, code)) return null;
  return texts[code] ?? null;
}
