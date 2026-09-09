import { axiosClient } from "@/lib/api/axiosClient";
import { readInvoicePage, readInvoiceSnapshot } from "../model/invoice-readers";
import { readInvoiceCommercialSnapshot } from "../model/invoice-commercial";
import type {
  GenerateInvoiceDto,
  InvoiceListQuery,
  IssueInvoiceDto,
  UpdateInvoiceDto,
} from "../types/invoices";

const BASE_URL = "/api/admin/core/v1/invoices";
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Canonical purpose-based invoice detail through the shared authenticated client. */
export async function getRetainedInvoiceDetail(id: string, signal?: AbortSignal) {
  const response = await axiosClient.get<unknown>(invoiceUrl(id), {
    cache: "no-store", ...(signal ? { signal } : {}),
  });
  return readInvoiceCommercialSnapshot(response, id);
}

export const invoicesApi = {
  list: async (query: InvoiceListQuery, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${BASE_URL}${serializeInvoiceQuery(query)}`,
      { cache: "no-store", ...(signal ? { signal } : {}) },
    );
    return readInvoicePage(response.data);
  },

  get: getRetainedInvoiceDetail,

  generate: async (dto: GenerateInvoiceDto, idempotencyKey: string) => {
    const response = await axiosClient.post<unknown>(
      `${BASE_URL}/generate`,
      dto,
      commandConfig(idempotencyKey),
    );
    return readInvoiceSnapshot(response.data);
  },

  update: async (
    id: string,
    dto: UpdateInvoiceDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.patch<unknown>(
      invoiceUrl(id),
      dto,
      commandConfig(idempotencyKey),
    );
    return readInvoiceForId(response.data, id);
  },

  issue: async (
    id: string,
    dto: IssueInvoiceDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      `${invoiceUrl(id)}/issue`,
      dto,
      commandConfig(idempotencyKey),
    );
    return readInvoiceForId(response.data, id);
  },

  void: async (id: string, idempotencyKey: string) => {
    const response = await axiosClient.post<unknown>(
      `${invoiceUrl(id)}/void`,
      undefined,
      commandConfig(idempotencyKey),
    );
    return readInvoiceForId(response.data, id);
  },
};

export function serializeInvoiceQuery(query: InvoiceListQuery): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      parameters.set(key, String(value));
    }
  }
  const serialized = parameters.toString();
  return serialized ? `?${serialized}` : "";
}

function invoiceUrl(id: string): string {
  if (!UUID_V7.test(id)) throw new Error("INVALID_ADMIN_INVOICE_ID");
  return `${BASE_URL}/${encodeURIComponent(id.toLowerCase())}`;
}

function commandConfig(idempotencyKey: string) {
  if (!UUID_V7.test(idempotencyKey)) {
    throw new Error("INVALID_ADMIN_INVOICE_IDEMPOTENCY_KEY");
  }
  return { headers: { "x-idempotency-key": idempotencyKey.toLowerCase() } };
}

function readInvoiceForId(payload: unknown, expectedId: string) {
  const result = readInvoiceSnapshot(payload);
  if (result.data.id !== expectedId.toLowerCase()) {
    throw new Error("INVALID_ADMIN_INVOICE_RESPONSE");
  }
  return result;
}
