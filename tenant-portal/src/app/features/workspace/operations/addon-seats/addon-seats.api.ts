import { inject, Service } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import {
  AddonAssignment, AddonListResponse, AddonOption, AddonSeatWriteReceipt,
  AssignAddonBody, RemoveAddonQuery,
} from './addon-seats.model';

const USERS_PATH = '/api/tenant/core/v1/users';
const ADDON_SEATS_QUERY_KEY = 'workspace-addon-seats';

@Service()
export class AddonSeatsApi {
  private readonly http = inject(CoreHttp);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  listAddonOptions(userId: string, page = 1, limit = 20): Promise<AddonListResponse<AddonOption>> {
    return this.queries.fetchQuery({
      queryKey: [ADDON_SEATS_QUERY_KEY, userId, 'options', page, limit],
      queryFn: () => this.http.readPage(`${this.userPath(userId)}/addon-assignment-options`, { page, limit }),
    });
  }

  listAddonAssignments(userId: string, page = 1, limit = 20): Promise<AddonListResponse<AddonAssignment>> {
    return this.queries.fetchQuery({
      queryKey: [ADDON_SEATS_QUERY_KEY, userId, 'assignments', page, limit],
      queryFn: () => this.http.readPage(`${this.userPath(userId)}/addon-assignments`, { page, limit }),
    });
  }

  async assignAddon(userId: string, body: AssignAddonBody, key = newIdempotencyKey()): Promise<AddonSeatWriteReceipt> {
    const { data } = await this.http.write<AddonSeatWriteReceipt>('POST', `${this.userPath(userId)}/addon-assignments`, {
      addonSelectionId: body.addonSelectionId,
      expectedAllowanceRevision: body.expectedAllowanceRevision,
      expectedParentAssignmentRevision: body.expectedParentAssignmentRevision,
    }, { key });
    await this.invalidateUser(userId);
    return data;
  }

  async removeAddon(userId: string, assignmentId: string, query: RemoveAddonQuery,
    key = newIdempotencyKey()): Promise<AddonSeatWriteReceipt> {
    const { data } = await this.http.write<AddonSeatWriteReceipt>('DELETE',
      `${this.userPath(userId)}/addon-assignments/${encodeURIComponent(assignmentId)}`, undefined, {
        key,
        query: {
          expectedAssignmentRevision: query.expectedAssignmentRevision,
          expectedAllowanceRevision: query.expectedAllowanceRevision,
        },
      });
    await this.invalidateUser(userId);
    return data;
  }

  private userPath(userId: string): string {
    return `${USERS_PATH}/${encodeURIComponent(userId)}`;
  }

  private async invalidateUser(userId: string): Promise<void> {
    // Seat routes are tenant-wide, independent of the selected company or branch.
    const filters = { queryKey: [ADDON_SEATS_QUERY_KEY, userId] };
    await this.queries.cancelQueries(filters);
    await this.queries.invalidateQueries({ ...filters, refetchType: 'none' });
  }
}
