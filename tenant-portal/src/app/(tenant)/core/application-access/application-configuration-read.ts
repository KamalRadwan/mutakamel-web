import { z } from "zod";

// Core addon-configuration-read.registry.ts returns reviewed safe output, never an editable input schema.
export const configurationSafeValues = z.custom<Record<string, unknown>>((value) => {
  let nodes = 0;
  const encoder = new TextEncoder();
  const bytes = (text: string) => encoder.encode(text).byteLength;
  const visit = (node: unknown, depth: number): boolean => {
    if (++nodes > 65_536 || depth > 10) return false;
    if (node === null || typeof node === "boolean") return true;
    if (typeof node === "string") return bytes(node) <= 65_536;
    if (typeof node === "number") return Number.isFinite(node);
    if (!node || typeof node !== "object" || (!Array.isArray(node) && Object.getPrototypeOf(node) !== Object.prototype)) return false;
    const keys = Reflect.ownKeys(node);
    if (Array.isArray(node) && keys.length !== node.length + 1) return false;
    for (const key of keys) {
      if (Array.isArray(node) && key === "length") continue;
      if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key) || bytes(key) > 65_536) return false;
      const field = Object.getOwnPropertyDescriptor(node, key);
      if (!field?.enumerable || !Object.hasOwn(field, "value") || !visit(field.value, depth + 1)) return false;
    }
    return true;
  };
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype || !visit(value, 1)) return false;
  return bytes(JSON.stringify(value)) <= 65_536;
});

export const configurationSchemaRef = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_.]{0,128}$/u), version: z.number().int().min(1).max(2_147_483_647),
  checksum: z.string().regex(/^[0-9a-f]{64}$/u),
}).strict();
