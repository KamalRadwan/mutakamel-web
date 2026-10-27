/** One serial per line preserves spaces within an identity. */
export function splitSerialInput(value: string): string[] {
  return value.trim() ? value.split(/\r?\n/u).map((key) => key.trim()) : [];
}

export function buildSerialSelection(value: string, quantity?: string): string[] | undefined {
  const keys = splitSerialInput(value);
  if (!keys.length) return undefined;
  // Match inventory-serial.ts, including its reserved balance sentinel.
  if (keys.some((key) => !key || key.length > 120 || key === "none") ||
      new Set(keys).size !== keys.length ||
      (quantity !== undefined && (!/^[1-9]\d*(?:\.0{1,8})?$/u.test(quantity.trim()) ||
        quantity.trim().split(".")[0] !== String(keys.length)))) {
    throw new Error("INVENTORY_FORM_SERIAL_SELECTION");
  }
  return keys;
}
