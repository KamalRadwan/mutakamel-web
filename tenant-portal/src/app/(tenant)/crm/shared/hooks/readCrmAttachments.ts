import { axiosClient } from "@/lib/api/axiosClient";
import {
  buildCrmAttachmentsListPath, parseCrmAttachmentsPageResponse,
  type CrmAttachment, type CrmAttachmentSourceType,
} from "../attachments-contract";

const PAGE_SIZE = 50;

export async function readAllCrmAttachments(source: {
  branchId: string; sourceType: CrmAttachmentSourceType; sourceId: string;
}, signal?: AbortSignal): Promise<CrmAttachment[]> {
  const attachments: CrmAttachment[] = [];
  const ids = new Set<string>();
  for (let page = 1; ; page += 1) {
    signal?.throwIfAborted();
    const response = await axiosClient.get<unknown>(
      buildCrmAttachmentsListPath({ ...source, page, limit: PAGE_SIZE }),
      { signal, cache: "no-store", maxResponseBytes: 1024 * 1024 },
    );
    signal?.throwIfAborted();
    const result = parseCrmAttachmentsPageResponse(response.data, source);
    if (result.page !== page || result.limit !== PAGE_SIZE || result.total < 0 ||
      result.totalPages !== Math.ceil(result.total / PAGE_SIZE) ||
      page > Math.max(1, result.totalPages) || result.hasNext !== (page < result.totalPages) ||
      result.hasPrev !== (page > 1) || (result.hasNext && result.items.length === 0)) {
      throw new Error("Invalid attachment pagination.");
    }
    for (const attachment of result.items) {
      if (ids.has(attachment.id)) throw new Error("Attachment pagination changed during read.");
      ids.add(attachment.id);
      attachments.push(attachment);
    }
    if (!result.hasNext) return attachments;
  }
}
