type TenantApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: any;
  errorMessage?: boolean | string;
  successMessage?: boolean | string;
};

export async function tenantApiFetch<T = any>(url: string, options?: TenantApiFetchOptions): Promise<T> {
  const { body, ...restOptions } = options || {};
  
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

  const res = await fetch(url, requestInit);
  
  if (!res.ok) {
    let message = "API Error";
    try {
      const errJson = await res.json();
      message = errJson.message || message;
    } catch (e) {
      // Ignore JSON parse error
    }
    throw new Error(message);
  }
  
  try {
    return await res.json();
  } catch (e) {
    return {} as T;
  }
}
