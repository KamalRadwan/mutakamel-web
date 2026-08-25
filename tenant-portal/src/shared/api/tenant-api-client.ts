type TenantApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  errorMessage?: boolean | string;
  successMessage?: boolean | string;
};

export async function tenantApiFetch<T = unknown>(url: string, options?: TenantApiFetchOptions): Promise<T> {
  const {
    body,
    errorMessage,
    successMessage,
    ...restOptions
  } = options || {};
  void errorMessage;
  void successMessage;

  const requestInit: RequestInit = { ...restOptions };
  
  if (body !== undefined) {
    if (typeof body === "object" && !(body instanceof FormData)) {
      requestInit.body = JSON.stringify(body);
      requestInit.headers = {
        ...requestInit.headers,
        "Content-Type": "application/json",
      };
    } else {
      requestInit.body = body as BodyInit;
    }
  }

  const response = await customTenantFetch<T>(url, requestInit);
  return response.data;
}
import { customTenantFetch } from "@/lib/api/axiosClient";
