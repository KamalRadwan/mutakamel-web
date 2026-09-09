import { z } from "zod";
import { commercialRevision } from "./commercial-command-fields";

// Core purchase/commercial-recovery.request.ts; this is a mutation, never a status refresh.
export const commercialRecoveryRequestSchema = z.object({
  expectedOperationRevision: commercialRevision, action: z.enum(["RECONCILE", "CANCEL_PREPARATION"]),
  reason: z.string().min(1).max(256).refine((value) => value === value.trim()),
}).strict();
export type CommercialRecoveryRequest = z.infer<typeof commercialRecoveryRequestSchema>;
