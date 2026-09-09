import { z } from "zod";
import { commercialReadMoney, commercialReadUuid } from "./subscription-pricing";

// Exact Core commercial request/receipt grammars. Stored selectors retain the owner's historical UUID grammar.
export const commercialSelector = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
export const commercialUuid = commercialReadUuid;
export const commercialUuid7 = commercialReadUuid.refine((value) => value[14] === "7");
export const commercialRevision = z.string().regex(/^[1-9][0-9]{0,18}$/u)
  .refine((value) => /^[1-9][0-9]{0,18}$/u.test(value) && BigInt(value) <= BigInt("9223372036854775807"));
export const commercialInstant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)
  .refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
export const commercialMoney = commercialReadMoney;
export const commercialSignedMoney = z.string().regex(/^-?(?:0|[1-9][0-9]{0,13})\.[0-9]{4}$/u);
export const commercialSeats = z.number().int().min(1).max(100_000);
export const commercialEnvelope = { success: z.literal(true), correlationId: z.string().max(128), timestamp: z.iso.datetime().max(30) };
export function invalidCommercialRead(): never { throw new Error("The retained commercial response could not be verified."); }
