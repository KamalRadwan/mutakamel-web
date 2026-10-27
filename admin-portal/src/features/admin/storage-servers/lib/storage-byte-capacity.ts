const POSTGRES_BIGINT_MAX = "9223372036854775807";

/** Empty form values clear the limit; nonempty values match Core's DTO. */
export function isStorageByteLimit(value: string): boolean {
  return value === "" || (
    /^[1-9][0-9]{0,18}$/u.test(value) &&
    (value.length < POSTGRES_BIGINT_MAX.length || value <= POSTGRES_BIGINT_MAX)
  );
}

export function formatStorageBytes(value: string, lang: "ar" | "en"): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(BigInt(value));
}
