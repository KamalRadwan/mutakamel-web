import { readCoreData, type CorePath } from "@/lib/api/envelope";

/**
 * Core's geography catalogue: the subdivisions of one country, and the cities
 * of one subdivision.
 *
 * `country-data.ts` next door materialises its 250 countries because that list
 * is small, static and needed on first paint. Subdivisions and cities are
 * neither — the same upstream registry carries an 8 MB city dataset — so they
 * are read a country and a state at a time, with the SERVER doing the search.
 * That is also why `search` is a request parameter rather than a filter over a
 * cached page: no page held here is ever the whole answer.
 *
 * Both routes sit under `/public/` because an address form must work for
 * anyone the form is open to, and a reference table exposes no tenant data.
 *
 * Contract source: the Gateway route pair
 * `GET /api/tenant/core/v1/public/geography/countries/{iso2}/states` and
 * `GET /api/tenant/core/v1/public/geography/countries/{iso2}/states/{code}/cities`,
 * whose owning Core controller lands alongside this file.
 */

/** ISO 3166-1 alpha-2 — the only shape the country path parameter takes. */
const COUNTRY_ISO_PATTERN = /^[A-Za-z]{2}$/u;
/**
 * A subdivision `code` as ISO 3166-2 writes the part after the dash: letters
 * and digits, occasionally hyphenated. Pinned because this value comes off the
 * wire and goes straight back out as a PATH SEGMENT of the cities request — a
 * code carrying a slash would silently address a different route.
 */
const STATE_CODE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,15})$/u;

/**
 * How many rows one request asks for.
 *
 * The list renders in a `Combobox` dropdown, which nobody scrolls past a few
 * dozen rows — beyond that the useful move is to type, and `truncated` is what
 * says so. Large enough that no country's subdivisions are ever cut off (the
 * largest national list is under 100), small enough that a city search over a
 * dense state stays one small response.
 */
const GEOGRAPHY_LIST_LIMIT = 50;
/** Core trims the search term itself; this only keeps the URL bounded. */
const GEOGRAPHY_SEARCH_MAX_LENGTH = 120;
const GEOGRAPHY_NAME_MAX_LENGTH = 200;
/** A subdivision type — "Governorate", "Province", "Emirate". */
const GEOGRAPHY_TYPE_MAX_LENGTH = 80;
/** `limit` bounds the row count; this bounds a server that ignores it. */
const GEOGRAPHY_MAX_ITEMS = 1000;
const GEOGRAPHY_RESPONSE_LIMIT_BYTES = 250_000;

export interface GeographyState {
  /** ISO 3166-2 subdivision code — the cities request's path parameter. */
  code: string;
  name: string;
  /** The name in the country's own script, when it differs from `name`. */
  nativeName: string | null;
  type: string | null;
}

export interface GeographyCity {
  id: number;
  name: string;
  nativeName: string | null;
}

export interface GeographyList<T> {
  items: T[];
  /** Matches BEFORE `limit` — so it can exceed `items.length`. */
  total: number;
  /** `total > items.length`: the list on screen is not the whole answer. */
  truncated: boolean;
}

export interface GeographyQuery {
  search?: string;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * The subdivisions of a country.
 *
 * A country the catalogue holds none for answers `200` with an empty list —
 * that is an answer, not a failure, and callers render a free-text box for it.
 * Only an unknown country code is a `404`.
 */
export async function fetchGeographyStates(
  countryIso: string,
  query: GeographyQuery = {},
): Promise<GeographyList<GeographyState>> {
  const payload = await readCoreData(
    statesPath(assertCountryIso(countryIso), buildGeographyQuery(query)),
    requestConfig(query.signal),
  );
  return parseGeographyList(payload, parseGeographyState, (state) => state.code);
}

/** The cities of one subdivision, keyed by the `code` the call above returned. */
export async function fetchGeographyCities(
  countryIso: string,
  stateCode: string,
  query: GeographyQuery = {},
): Promise<GeographyList<GeographyCity>> {
  const payload = await readCoreData(
    citiesPath(
      assertCountryIso(countryIso),
      assertStateCode(stateCode),
      buildGeographyQuery(query),
    ),
    requestConfig(query.signal),
  );
  return parseGeographyList(payload, parseGeographyCity, (city) => String(city.id));
}

// Each route is spelled out as one complete literal rather than assembled from
// a shared prefix: `scripts/docs/verify-called-routes.mjs` matches the literals
// in source against the Gateway contract, and a bare prefix is not a route.
function statesPath(countryIso: string, query: string): CorePath {
  return `/api/tenant/core/v1/public/geography/countries/${countryIso}/states?${query}`;
}

function citiesPath(countryIso: string, stateCode: string, query: string): CorePath {
  return `/api/tenant/core/v1/public/geography/countries/${countryIso}/states/${stateCode}/cities?${query}`;
}

function requestConfig(signal: AbortSignal | undefined) {
  return {
    signal,
    // A reference table changes on a release cadence, not a request cadence,
    // but this is a picker: a stale in-flight page must never win over the one
    // the current query asked for. The browser cache cannot know that.
    cache: "no-store" as const,
    maxResponseBytes: GEOGRAPHY_RESPONSE_LIMIT_BYTES,
  };
}

function buildGeographyQuery({ search, limit }: GeographyQuery): string {
  const query = new URLSearchParams({
    limit: String(Math.min(Math.max(limit ?? GEOGRAPHY_LIST_LIMIT, 1), GEOGRAPHY_MAX_ITEMS)),
  });
  const term = search?.trim() ?? "";
  if (term) query.set("search", term.slice(0, GEOGRAPHY_SEARCH_MAX_LENGTH));
  return query.toString();
}

function assertCountryIso(value: string): string {
  if (!COUNTRY_ISO_PATTERN.test(value)) invalidGeographyResponse();
  return value.toUpperCase();
}

/** The pattern is what makes the value path-safe, so nothing is escaped here. */
function assertStateCode(value: string): string {
  if (!STATE_CODE_PATTERN.test(value)) invalidGeographyResponse();
  return value;
}

function parseGeographyList<T>(
  payload: unknown,
  parseItem: (value: unknown) => T,
  identity: (item: T) => string,
): GeographyList<T> {
  const body = record(payload);
  if (!body || !Array.isArray(body.items) || body.items.length > GEOGRAPHY_MAX_ITEMS) {
    invalidGeographyResponse();
  }
  const items = body.items.map(parseItem);
  const total = body.total;
  if (
    !Number.isSafeInteger(total) ||
    (total as number) < items.length ||
    typeof body.truncated !== "boolean" ||
    // Re-derived rather than trusted, the way `parseCorePageMeta` re-derives a
    // pager: `truncated` is the ONLY thing telling a user their list is
    // partial, so a server that got it backwards would present a cut-off
    // catalogue as the complete one and the user would never think to type.
    body.truncated !== ((total as number) > items.length) ||
    // A duplicate is a React key collision in the picker built on this.
    new Set(items.map(identity)).size !== items.length
  ) {
    invalidGeographyResponse();
  }
  return { items, total: total as number, truncated: body.truncated };
}

function parseGeographyState(value: unknown): GeographyState {
  const state = record(value);
  if (!state) invalidGeographyResponse();
  const code = requiredString(state, "code", GEOGRAPHY_NAME_MAX_LENGTH);
  if (!STATE_CODE_PATTERN.test(code)) invalidGeographyResponse();
  return {
    code,
    name: requiredString(state, "name", GEOGRAPHY_NAME_MAX_LENGTH),
    nativeName: optionalString(state, "nativeName", GEOGRAPHY_NAME_MAX_LENGTH),
    type: optionalString(state, "type", GEOGRAPHY_TYPE_MAX_LENGTH),
  };
}

function parseGeographyCity(value: unknown): GeographyCity {
  const city = record(value);
  if (!city || !Number.isSafeInteger(city.id) || (city.id as number) < 1) {
    invalidGeographyResponse();
  }
  return {
    id: city.id as number,
    name: requiredString(city, "name", GEOGRAPHY_NAME_MAX_LENGTH),
    nativeName: optionalString(city, "nativeName", GEOGRAPHY_NAME_MAX_LENGTH),
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): string {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    invalidGeographyResponse();
  }
  return value;
}

function optionalString(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null {
  const value = source[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) invalidGeographyResponse();
  return value;
}

function invalidGeographyResponse(): never {
  throw new Error("Invalid Core geography response.");
}
