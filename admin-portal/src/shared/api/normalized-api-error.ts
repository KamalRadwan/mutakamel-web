export type ErrorCategory =
  | "VALIDATION"
  | "AUTH"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "SERVER_ERROR";

export interface CoreErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  errorCategory: ErrorCategory;
  message: string;
  details?: Record<string, string[]>;
  correlationId: string;
  timestamp: string;
  path: string;
}

export interface GatewayProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  correlationId: string;
  errors?: Record<string, string[]>;
}

export interface NormalizedApiError {
  isNormalized: true;
  httpStatus: number;
  errorCode: string; // Map Gateway `code` or Core `errorCode` here
  errorCategory?: ErrorCategory;
  message: string; // Map Gateway `title`/`detail` or Core `message` here
  details?: Record<string, string[]>;
  correlationId?: string;
  originalType?: string; // For Gateway problem details type
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (isNormalizedApiError(error)) {
    return error;
  }

  const response =
    typeof error === "object" && error !== null && "response" in error
      ? (error as {
          response?: {
            status?: unknown;
            statusCode?: unknown;
            data?: unknown;
            headers?: unknown;
          };
        }).response
      : undefined;
  const data = plainRecord(response?.data);
  const responseStatus = firstHttpStatus(
    response?.status,
    response?.statusCode,
  );
  const headerCorrelationId = readCorrelationHeader(response?.headers);

  if (data) {
    // Is it a CoreErrorResponse?
    const coreErrorCode = readErrorCode(data.errorCode);
    const coreMessage = readMessage(data.message);
    if (data.success === false && coreErrorCode && coreMessage) {
      return {
        isNormalized: true,
        httpStatus:
          firstHttpStatus(responseStatus, data.statusCode) ?? 500,
        errorCode: coreErrorCode,
        errorCategory: readErrorCategory(data.errorCategory),
        message: coreMessage,
        details: readDetails(data.details),
        correlationId:
          readCorrelationId(data.correlationId) ?? headerCorrelationId,
      };
    }

    // Is it a GatewayProblemDetails?
    const gatewayCode = readErrorCode(data.code);
    const gatewayTitle = readMessage(data.title);
    if (gatewayCode && gatewayTitle) {
      const gatewayDetail = readMessage(data.detail);
      return {
        isNormalized: true,
        httpStatus:
          firstHttpStatus(responseStatus, data.status) ?? 500,
        errorCode: gatewayCode,
        message: gatewayDetail
          ? `${gatewayTitle}: ${gatewayDetail}`
          : gatewayTitle,
        details: readDetails(data.errors),
        correlationId:
          readCorrelationId(data.correlationId) ?? headerCorrelationId,
        originalType: readBoundedString(data.type, 500),
      };
    }

    // Nest/Worker errors may contain a string message or a structured message
    // object, but do not use the Core/Gateway envelopes above.
    const workerStatus = firstHttpStatus(
      responseStatus,
      data.statusCode,
      data.status,
    );
    if (workerStatus) {
      const nestedMessage = plainRecord(data.message);
      const nestedCode = readSpecificErrorCode(
        nestedMessage?.code ?? nestedMessage?.errorCode,
      );
      const topLevelCode = readSpecificErrorCode(
        data.code ?? data.errorCode,
      );
      const message =
        readMessage(nestedMessage?.message) ??
        readMessage(data.message) ??
        readMessage(data.error) ??
        `Request failed with status ${workerStatus}.`;

      return {
        isNormalized: true,
        httpStatus: workerStatus,
        errorCode: nestedCode ?? topLevelCode ?? `HTTP_${workerStatus}`,
        errorCategory: categoryFromStatus(workerStatus),
        message,
        details:
          readDetails(nestedMessage?.details) ??
          readDetails(nestedMessage?.errors) ??
          readDetails(data.details) ??
          readDetails(data.errors),
        correlationId:
          readCorrelationId(nestedMessage?.correlationId) ??
          readCorrelationId(data.correlationId) ??
          headerCorrelationId,
      };
    }
  }

  // A response with a valid status is still deterministic even when its body
  // is empty or malformed. Only a failure without a response is ambiguous.
  if (responseStatus) {
    return {
      isNormalized: true,
      httpStatus: responseStatus,
      errorCode: `HTTP_${responseStatus}`,
      errorCategory: categoryFromStatus(responseStatus),
      message:
        error instanceof Error && error.message.trim()
          ? error.message
          : `Request failed with status ${responseStatus}.`,
      correlationId: headerCorrelationId,
    };
  }

  // Fallback for unhandled or non-Axios errors
  return {
    isNormalized: true,
    httpStatus: 500,
    errorCode: "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : "An unknown error occurred.",
  };
}

function isNormalizedApiError(error: unknown): error is NormalizedApiError {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as Partial<NormalizedApiError>;
  return (
    candidate.isNormalized === true &&
    typeof candidate.httpStatus === "number" &&
    Number.isInteger(candidate.httpStatus) &&
    candidate.httpStatus >= 100 &&
    candidate.httpStatus <= 599 &&
    typeof candidate.errorCode === "string" &&
    candidate.errorCode.trim().length > 0 &&
    typeof candidate.message === "string" &&
    candidate.message.trim().length > 0 &&
    (candidate.correlationId === undefined ||
      typeof candidate.correlationId === "string")
  );
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? (value as Record<string, unknown>)
    : null;
}

function firstHttpStatus(...values: unknown[]): number | undefined {
  return values.find(
    (value): value is number =>
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 100 &&
      value <= 599,
  );
}

function readBoundedString(
  value: unknown,
  maximumLength = 4_000,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maximumLength);
}

function readMessage(value: unknown): string | undefined {
  const direct = readBoundedString(value);
  if (direct) return direct;
  if (!Array.isArray(value)) return undefined;

  const messages = value
    .slice(0, 20)
    .map((entry) => readBoundedString(entry, 1_000))
    .filter((entry): entry is string => Boolean(entry));
  return messages.length ? messages.join("; ") : undefined;
}

function readErrorCode(value: unknown): string | undefined {
  const code = readBoundedString(value, 200);
  return code && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(code)
    ? code
    : undefined;
}

function readSpecificErrorCode(value: unknown): string | undefined {
  const code = readErrorCode(value);
  return code === "UNKNOWN_ERROR" ? undefined : code;
}

function readCorrelationId(value: unknown): string | undefined {
  const correlationId = readBoundedString(value, 200);
  return correlationId && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(correlationId)
    ? correlationId
    : undefined;
}

function readDetails(value: unknown): Record<string, string[]> | undefined {
  const source = plainRecord(value);
  if (!source) return undefined;

  const details: Record<string, string[]> = {};
  for (const [key, rawMessages] of Object.entries(source).slice(0, 50)) {
    const safeKey = readBoundedString(key, 200);
    if (!safeKey || !Array.isArray(rawMessages)) continue;

    const messages = rawMessages
      .slice(0, 20)
      .map((entry) => readBoundedString(entry, 1_000))
      .filter((entry): entry is string => Boolean(entry));
    if (messages.length) details[safeKey] = messages;
  }

  return Object.keys(details).length ? details : undefined;
}

function readErrorCategory(value: unknown): ErrorCategory | undefined {
  return [
    "VALIDATION",
    "AUTH",
    "AUTHORIZATION",
    "NOT_FOUND",
    "CONFLICT",
    "RATE_LIMIT",
    "SERVER_ERROR",
  ].includes(value as ErrorCategory)
    ? (value as ErrorCategory)
    : undefined;
}

function categoryFromStatus(status: number): ErrorCategory | undefined {
  if (status === 400 || status === 422) return "VALIDATION";
  if (status === 401) return "AUTH";
  if (status === 403) return "AUTHORIZATION";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "SERVER_ERROR";
  return undefined;
}

function readCorrelationHeader(headers: unknown): string | undefined {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return (
      readCorrelationId(headers.get("x-correlation-id")) ??
      readCorrelationId(headers.get("correlation-id"))
    );
  }

  if (typeof headers !== "object" || headers === null) return undefined;
  for (const name of Object.getOwnPropertyNames(headers)) {
    const normalizedName = name.toLowerCase();
    if (
      normalizedName !== "x-correlation-id" &&
      normalizedName !== "correlation-id"
    ) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(headers, name);
    const correlationId = readCorrelationId(descriptor?.value);
    if (correlationId) return correlationId;
  }

  return undefined;
}
