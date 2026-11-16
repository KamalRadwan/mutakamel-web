import { dataRecord, type DataValue } from "./binding-contract";

export const operandKinds = ["ADD", "SUBTRACT", "MULTIPLY", "SUM", "MIN", "MAX", "COALESCE", "CONCAT"];
export const unaryKinds = ["ABS", "NEGATE", "IS_NULL", "TRIM", "ROUND"];
export const formulaKinds = ["DECIMAL_LITERAL", "STRING_LITERAL", "DATE_LITERAL", "BOOLEAN_LITERAL", "NULL_LITERAL", "BINDING", "ROOT_BINDING", "ROW_BINDING", "FORMULA_REF", "FUNCTION_CALL", ...operandKinds, "DIVIDE", ...unaryKinds, "DATE_ADD_DAYS", "DATE_DIFF_DAYS", "COMPARE", "IF", "SUM_ROWS"];
const empty = () => ({ kind: "NULL_LITERAL" });
export function newFormula(kind: string): DataValue {
  if (operandKinds.includes(kind)) return { kind, operands: [empty(), empty()] };
  if (unaryKinds.includes(kind)) return { kind, value: empty(), ...(kind === "ROUND" ? { scale: 2, rounding: "HALF_UP" } : {}) };
  if (["STRING_LITERAL", "DATE_LITERAL", "DECIMAL_LITERAL"].includes(kind)) return { kind, value: "" };
  if (kind === "BOOLEAN_LITERAL") return { kind, value: false };
  if (["BINDING", "ROOT_BINDING", "ROW_BINDING"].includes(kind)) return { kind, path: "" };
  if (kind === "FORMULA_REF") return { kind, formulaId: "" };
  if (kind === "FUNCTION_CALL") return { kind, functionVersionId: "", arguments: [] };
  if (kind === "DIVIDE") return { kind, dividend: empty(), divisor: empty(), scale: 2, rounding: "HALF_UP" };
  if (kind === "COMPARE" || kind === "DATE_DIFF_DAYS") return { kind, left: empty(), right: empty(), ...(kind === "COMPARE" ? { operator: "EQ" } : {}) };
  if (kind === "DATE_ADD_DAYS") return { kind, date: empty(), days: empty() };
  if (kind === "IF") return { kind, condition: empty(), whenTrue: empty(), whenFalse: empty() };
  if (kind === "SUM_ROWS") return { kind, sourcePath: "", item: empty() };
  return empty();
}
export function formulaChildrenForEditor(value: DataValue): string[] {
  if (unaryKinds.includes(String(value.kind))) return ["value"];
  const names: Record<string, string[]> = { DIVIDE: ["dividend", "divisor"], COMPARE: ["left", "right"], DATE_DIFF_DAYS: ["left", "right"], DATE_ADD_DAYS: ["date", "days"], IF: ["condition", "whenTrue", "whenFalse"], SUM_ROWS: ["item"] };
  return names[String(value.kind)] ?? [];
}
export function replaceFormulaOperand(value: DataValue, index: number, replacement?: DataValue): DataValue {
  const operands = Array.isArray(value.operands) ? value.operands.map(dataRecord) : [];
  return { ...value, operands: replacement ? operands.map((item, at) => at === index ? replacement : item) : operands.filter((_, at) => at !== index) };
}
