import { readCoreData, readCorePage, writeCoreData, type CorePath } from "@/lib/api/envelope";
import type { CorePage } from "../../contracts/core-page";
import {
  NUMBERING_PATH,
  numberingListQuery,
  numberingPath,
  parseNumberingPeekResponse,
  parseNumberingSequenceResponse,
  parseNumberingSequencesResponse,
  type CreateNumberingSequenceRequest,
  type NumberingListOptions,
  type NumberingPeek,
  type NumberingSequence,
  type UpdateNumberingSequenceRequest,
} from "./numbering-contract";

const LIST_RESPONSE_LIMIT_BYTES = 400_000;
const ROW_RESPONSE_LIMIT_BYTES = 20_000;
const PEEK_RESPONSE_LIMIT_BYTES = 10_000;

/**
 * Raised only after transport succeeds and a Core numbering payload fails
 * client runtime validation, keeping unreadable responses distinct from
 * status-0 offline transport errors without inventing backend error codes.
 */
export class NumberingResponseValidationError extends Error {
  constructor() {
    super("Invalid Core numbering response.");
    this.name = "NumberingResponseValidationError";
  }
}

export async function fetchNumberingSequences(
  options: NumberingListOptions,
): Promise<CorePage<NumberingSequence>> {
  const envelope = await readCorePage(NUMBERING_PATH, numberingListQuery(options), {
    signal: options.signal,
    cache: "no-store",
    maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
    suppressForbiddenToast: true,
  });
  try {
    return parseNumberingSequencesResponse(envelope);
  } catch {
    throw new NumberingResponseValidationError();
  }
}

export async function fetchNumberingPeek(
  path: CorePath,
  signal?: AbortSignal,
): Promise<NumberingPeek> {
  const payload = await readCoreData(path, {
    signal,
    cache: "no-store",
    maxResponseBytes: PEEK_RESPONSE_LIMIT_BYTES,
  });
  try {
    return parseNumberingPeekResponse(payload);
  } catch {
    throw new NumberingResponseValidationError();
  }
}

export async function createNumberingSequence(
  request: CreateNumberingSequenceRequest,
): Promise<NumberingSequence> {
  const payload = await writeCoreData("post", NUMBERING_PATH, request, {
    cache: "no-store",
    maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
  });
  try {
    return parseNumberingSequenceResponse(payload);
  } catch {
    throw new NumberingResponseValidationError();
  }
}

export async function updateNumberingSequence(
  id: string,
  request: UpdateNumberingSequenceRequest,
): Promise<NumberingSequence> {
  const payload = await writeCoreData("patch", numberingPath(id), request, {
    cache: "no-store",
    maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
  });
  try {
    return parseNumberingSequenceResponse(payload);
  } catch {
    throw new NumberingResponseValidationError();
  }
}
