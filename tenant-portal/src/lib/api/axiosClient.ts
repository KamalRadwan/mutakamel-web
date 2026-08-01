export interface ApiEnvelope<T = any> {
  success: boolean;
  status: string;
  statusCode: number;
  code?: string;
  message?: string;
  data: T;
  meta?: any;
  correlationId?: string;
  timestamp?: string;
}

class AxiosClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  }

  private async request<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T; status: number }> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
      headers.set("Content-Type", "application/json");
    }

    // Attach UUID idempotency key for mutating HTTP methods
    const method = (options.method || "GET").toUpperCase();
    if (["POST", "PATCH", "PUT", "DELETE"].includes(method) && !headers.has("x-idempotency-key")) {
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      headers.set("x-idempotency-key", idempotencyKey);
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: options.credentials || "include",
    });

    let data: any;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const error: any = new Error(
        (data && typeof data === "object" && data.message) ||
          `Request failed with status ${response.status}`
      );
      error.response = { data, status: response.status, headers: response.headers };
      throw error;
    }

    return { data, status: response.status };
  }

  public async get<T = any>(path: string, options: RequestInit = {}) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  public async post<T = any>(path: string, body?: any, options: RequestInit = {}) {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async patch<T = any>(path: string, body?: any, options: RequestInit = {}) {
    return this.request<T>(path, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async delete<T = any>(path: string, options: RequestInit = {}) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

export const axiosClient = new AxiosClient();
