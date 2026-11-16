export function quotationDatePickerValue(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

export function quotationDatePickerText(value: Date | undefined): string {
  return value ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}` : "";
}

export function quotationPartyInitials(name: string): string {
  return name.trim().split(/\s+/u).slice(0, 2).map((part) => [...part][0] ?? "").join("").toUpperCase();
}
