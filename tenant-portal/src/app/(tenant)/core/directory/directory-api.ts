import { readCoreData, readCorePage, writeCoreData } from "@/lib/api/envelope";
import {
  CORE_DETAIL_RESPONSE_LIMIT_BYTES,
  CORE_LIST_RESPONSE_LIMIT_BYTES,
  CORE_WRITE_RESPONSE_LIMIT_BYTES,
  buildCoreListQuery,
  parseCorePage,
  type CorePage,
} from "../contracts/core-page";
import {
  PARTIES_PATH,
  parseParty,
  partyImageRoute,
  partyPath,
  type Party,
  type PartyFilters,
  type PartySortField,
} from "./directory-contract";

// Every party request the screens make. Split from `directory-contract.ts` so
// neither file carries both the response contract and the transport calls —
// see docs/architecture/file-architecture.md#the-300-line-rule-and-its-three-exemptions.

export async function fetchParties(options: {
  page: number;
  search: string;
  sortBy: PartySortField;
  sortDir: "ASC" | "DESC";
  filters: PartyFilters;
  signal?: AbortSignal;
}): Promise<CorePage<Party>> {
  const query = buildCoreListQuery({
    page: options.page,
    search: options.search,
    sortBy: options.sortBy,
    sortDir: options.sortDir,
    filters: { ...options.filters },
  });
  const envelope = await readCorePage(PARTIES_PATH, query, {
    signal: options.signal,
    cache: "no-store",
    maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
  });
  return parseCorePage(envelope, parseParty);
}

export async function fetchParty(id: string, signal?: AbortSignal): Promise<Party> {
  return parseParty(
    await readCoreData(partyPath(id), {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function createParty(body: Record<string, unknown>): Promise<Party> {
  return parseParty(
    await writeCoreData("post", PARTIES_PATH, body, {
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function updateParty(
  id: string,
  body: Record<string, unknown>,
): Promise<Party> {
  return parseParty(
    await writeCoreData("patch", partyPath(id), body, {
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function deleteParty(id: string): Promise<void> {
  await writeCoreData("delete", partyPath(id), undefined, {
    maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
  });
}

/**
 * The server re-decodes and re-normalises the bytes with sharp before storing,
 * so a file can carry the right MIME and the right size and still come back as
 * `PARTY_IMAGE_INVALID` (415). The three failures stay distinct: 400 for a
 * missing part, 415 for an undecodable image, 413 for one that is too large.
 */
export async function uploadPartyImage(id: string, file: File): Promise<Party> {
  const body = new FormData();
  body.append("file", file, file.name);
  return parseParty(
    await writeCoreData("post", partyImageRoute(id), body, {
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
      // A duplicate upload would store a second object; the write is not
      // naturally idempotent, so it must never be replayed after a refresh.
      nonReplayable: true,
    }),
  );
}

export async function deletePartyImage(id: string): Promise<void> {
  await writeCoreData("delete", partyImageRoute(id), undefined, {
    maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
  });
}
