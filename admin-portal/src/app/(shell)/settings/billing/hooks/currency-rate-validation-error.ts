/** Only locally validated, translated currency-rate messages may be displayed verbatim. */
export class CurrencyRateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurrencyRateValidationError";
  }
}
