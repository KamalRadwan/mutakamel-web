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

/** The owners that classify a failed step through one shared rule. */
export type ProvisioningCodeOwner = "CORE" | "CRM" | "TRADE";

/**
 * Each owner's prefix on the codes of `classifyTenantProvisioningOwnerFailure`
 * (`@mutakamel/core-app-database`): the same failure carries the same suffix
 * in Core, CRM and Trade, so one hint per suffix serves all three.
 */
const OWNER_CODE_PREFIXES: ReadonlyArray<readonly [string, ProvisioningCodeOwner]> = [
  ["CORE_PROVISIONING_", "CORE"],
  ["CRM.PROVISIONING.", "CRM"],
  ["TRADE.PROVISIONING.", "TRADE"],
];

/**
 * `classifyDatabaseFailure` codes of kind `transient` (`@mutakamel/database`
 * `DATABASE_FAILURE_CODES`). An owner waits such an outage out for up to 25
 * minutes in the infrastructure lane, then answers FAILED_RETRYABLE with the
 * code behind its prefix, so they share one hint.
 */
const TRANSIENT_DATABASE_CODES: ReadonlySet<string> = new Set([
  "CONNECTION_EXCEPTION",
  "CONNECTION_REFUSED",
  "CONNECTION_RESET",
  "CONNECTION_ABORTED",
  "CONNECTION_TIMEOUT",
  "CONNECTION_BROKEN_PIPE",
  "CONNECTION_TERMINATED",
  "POOL_CONNECT_TIMEOUT",
  "NETWORK_UNREACHABLE",
  "DNS_TEMPORARY_FAILURE",
  "SERIALIZATION_FAILURE",
  "DEADLOCK_DETECTED",
  "STATEMENT_TIMEOUT",
  "LOCK_NOT_AVAILABLE",
  "INSUFFICIENT_RESOURCES",
  "TOO_MANY_CONNECTIONS",
  "ADMIN_SHUTDOWN",
  "CRASH_SHUTDOWN",
  "CANNOT_CONNECT_NOW",
]);

/** The dictionary entries {@link provisioningSafeCodeHint} reads. */
export interface ProvisioningSafeCodeCopy {
  /** Hints for one exact code. */
  safeCodeHints: Readonly<Record<string, string>>;
  /** Hints for a shared owner code, keyed by the part after the owner prefix. */
  ownerSafeCodeHints: Readonly<Record<string, (owner: string) => string>>;
  /** The hint for every transient database code behind an owner prefix. */
  ownerDatabaseOutageHint: (owner: string) => string;
  provisioningOwners: Readonly<Record<ProvisioningCodeOwner, string>>;
}

/**
 * Operator guidance for a step's or operation's safe error code, or `null`
 * when there is none and the code is shown on its own. An exact hint wins;
 * otherwise a Core, CRM or Trade code is read as its owner's prefix plus the
 * suffix the shared classification gives the same failure everywhere.
 */
export function provisioningSafeCodeHint(
  copy: ProvisioningSafeCodeCopy,
  code: string | null | undefined,
): string | null {
  const exact = provisioningCodeText(copy.safeCodeHints, code);
  if (exact !== null || !code) return exact;
  for (const [prefix, owner] of OWNER_CODE_PREFIXES) {
    if (!code.startsWith(prefix)) continue;
    const suffix = code.slice(prefix.length);
    const name = copy.provisioningOwners[owner];
    if (Object.prototype.hasOwnProperty.call(copy.ownerSafeCodeHints, suffix)) {
      return copy.ownerSafeCodeHints[suffix]?.(name) ?? null;
    }
    return TRANSIENT_DATABASE_CODES.has(suffix)
      ? copy.ownerDatabaseOutageHint(name)
      : null;
  }
  return null;
}
