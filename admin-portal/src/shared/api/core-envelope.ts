export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  correlationId: string;
  timestamp: string;
}

export function extractCoreData<T>(response: { data: SuccessResponse<T> }): T {
  return response.data.data;
}

export function extractCoreMeta<T>(response: { data: SuccessResponse<T> }): PaginationMeta | undefined {
  return response.data.meta;
}
