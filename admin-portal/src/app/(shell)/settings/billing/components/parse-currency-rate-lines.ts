export interface CurrencyRateLine {
  currencyCode: string;
  currencyUnitsPerUsd: string;
  isActive: boolean;
}

export interface CurrencyRateLineMessages {
  lineFormatInvalid: string;
  activeFlagInvalid: string;
}

/**
 * Parses the `CODE,RATE[,ACTIVE]` batch box into rate rows.
 *
 * FE-B04. Two things used to pass silently here, on a surface that sets billing
 * exchange rates:
 *
 *   - `active.toLowerCase() !== "false"` made every value that was not
 *     literally "false" mean active, so "flase", "0", "no" and "inactive" each
 *     switched a rate ON with no warning;
 *   - surplus cells were dropped by destructuring, so a mistyped line was
 *     accepted with its extra field ignored.
 *
 * Extracted so both refusals can be asserted without mounting the section.
 */
export function parseCurrencyRateLines(
  text: string,
  messages: CurrencyRateLineMessages,
): CurrencyRateLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(",").map((part) => part.trim());
      if (cells.length > 3) throw new Error(messages.lineFormatInvalid);
      const [currencyCode, currencyUnitsPerUsd, active = "true"] = cells;
      if (!currencyCode || !currencyUnitsPerUsd) {
        throw new Error(messages.lineFormatInvalid);
      }
      const normalizedActive = active.toLowerCase();
      if (normalizedActive !== "true" && normalizedActive !== "false") {
        throw new Error(messages.activeFlagInvalid);
      }
      return {
        currencyCode,
        currencyUnitsPerUsd,
        isActive: normalizedActive === "true",
      };
    });
}
