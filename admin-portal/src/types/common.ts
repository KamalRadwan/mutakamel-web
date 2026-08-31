export type { SuccessResponse, PaginationMeta } from "../shared/api/core-envelope";
import type { PaginationMeta } from "../shared/api/core-envelope";

export type SortDirection = "ASC" | "DESC";

/** A list-page wrapper composing an `items` array with the shared pagination metadata. */
export type PageResult<T> = { items: T[] } & PaginationMeta;
