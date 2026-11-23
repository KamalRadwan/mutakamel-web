import { inject, Service } from '@angular/core';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import type {
  CreateStaffPhoneExtensionBody,
  ListUserCallLogsQuery,
  ListUserCallLogsResponse,
  PhoneSeats,
  PutStaffPhoneServersBody,
  StaffPhoneChainLink,
  StaffPhoneExtension,
  StaffPhoneServer,
  UpdateStaffPhoneExtensionBody,
} from './staff-phone.model';

export { toCallLogTypeParam } from './staff-phone.model';

const PHONE_PATH = '/api/tenant/webphone/v1';

@Service()
export class StaffPhoneApi {
  private readonly http = inject(CoreHttp);

  getExtensionByOwner(ownerId: string): Promise<StaffPhoneExtension> {
    return this.http.read(`${PHONE_PATH}/extensions/by-owner/${encodeURIComponent(ownerId)}`);
  }

  async createExtension(body: CreateStaffPhoneExtensionBody, key: string): Promise<StaffPhoneExtension> {
    return (await this.http.write<StaffPhoneExtension>('POST', `${PHONE_PATH}/extensions`, body, { key })).data;
  }

  async updateExtension(id: string, patch: UpdateStaffPhoneExtensionBody, key: string): Promise<StaffPhoneExtension> {
    return (await this.http.write<StaffPhoneExtension>(
      'PATCH', `${PHONE_PATH}/extensions/${encodeURIComponent(id)}`, patch, { key },
    )).data;
  }

  getExtensionServers(id: string): Promise<StaffPhoneChainLink[]> {
    return this.http.read(`${PHONE_PATH}/extensions/${encodeURIComponent(id)}/servers`);
  }

  async putExtensionServers(id: string, body: PutStaffPhoneServersBody, key: string): Promise<StaffPhoneChainLink[]> {
    return (await this.http.write<StaffPhoneChainLink[]>(
      'PUT', `${PHONE_PATH}/extensions/${encodeURIComponent(id)}/servers`, body, { key },
    )).data;
  }

  listPhoneServers(): Promise<StaffPhoneServer[]> {
    return this.http.read(`${PHONE_PATH}/servers`);
  }

  getPhoneSeats(): Promise<PhoneSeats> {
    return this.http.read(`${PHONE_PATH}/seats`);
  }

  async listUserCallLogs(userId: string, query: ListUserCallLogsQuery = {}): Promise<ListUserCallLogsResponse> {
    // Webphone returns a nested { data, meta: { page, limit, total } } inside the
    // success envelope. It is not a CorePage and must not go through readPage.
    const page = await this.http.read<ListUserCallLogsResponse>(
      `${PHONE_PATH}/users/${encodeURIComponent(userId)}/call-logs`, {
        page: query.page ?? 1,
        limit: query.limit,
        type: query.type,
        from: query.from,
        to: query.to,
        q: query.q,
      },
    );
    if (!page || !Array.isArray(page.data) || !page.meta ||
        !Number.isSafeInteger(page.meta.page) || page.meta.page < 1 ||
        !Number.isSafeInteger(page.meta.limit) || page.meta.limit < 1 ||
        !Number.isSafeInteger(page.meta.total) || page.meta.total < 0) {
      throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    }
    return { data: page.data, meta: page.meta };
  }
}
