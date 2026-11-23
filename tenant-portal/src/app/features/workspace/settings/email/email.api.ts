import { Service, computed, inject, signal } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { z } from 'zod';
import { CoreHttp } from '../../../../core/api/core-http';
import { ApiError } from '../../../../core/api/api-errors';
import { AuthSession } from '../../../../core/auth/auth-session';
import {
  emailGates,
  type EmailResult,
  type PatchEmailConfigRequest,
  type SuppressionLookup,
  type SuppressionLift,
} from './email.model';

const BASE = '/api/tenant/core/v1';
const configSchema = z.object({
  revision: z.number().int().nonnegative(),
  fromAddress: z.string(),
  fromName: z.string(),
  replyTo: z.string().nullable(),
  senderDomain: z.string(),
  providerDriver: z.enum(['smtp', 'ses', 'sendgrid', 'platform-shared']),
  credentialsMode: z.enum(['TENANT_VERSIONED_REF', 'TENANT_ENCRYPTED_SMTP', 'PLATFORM_SHARED']),
  providerCredentialsConfigured: z.boolean(),
  providerCredentialsVersion: z.number().nullable(),
  providerCredentialsRefFingerprint: z.string().nullable(),
  smtpHost: z.string().nullable(),
  smtpPort: z.union([z.literal(25), z.literal(465), z.literal(587), z.literal(2525)]).nullable(),
  smtpSecure: z.boolean().nullable(),
  smtpProtocol: z.enum(['smtp', 'smtps']).nullable(),
  smtpUsername: z.string().nullable(),
  smtpPasswordConfigured: z.boolean(),
  feedbackProfile: z.literal('CRM_FEEDBACK_V1').nullable(),
  dkimSelector: z.string().nullable(),
  dkimVerified: z.boolean(),
  verifiedAt: z.string().nullable(),
  planDailyQuota: z.number(),
  planRateLimitPerMin: z.number(),
  planQuotaRevision: z.number(),
  dailyQuota: z.number().nullable(),
  rateLimitPerMin: z.number().nullable(),
  effectiveDailyQuota: z.number(),
  effectiveRateLimitPerMin: z.number(),
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  updatedAt: z.string(),
});

@Service()
export class EmailApi {
  private readonly http = inject(CoreHttp);
  readonly me = inject(AuthSession).me;
  private readonly deniedUser = signal<string | null>(null);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });
  readonly gates = computed(() => {
    const gates = emailGates(this.me());
    return { ...gates, manage: gates.manage && this.deniedUser() !== this.me()?.id };
  });

  getEmailConfig(): Promise<EmailResult> {
    if (!this.gates().entitled) return Promise.reject(new ApiError(403, 'ACCESS_POLICY_BLOCKED'));
    if (!this.gates().readable)
      return Promise.reject(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    return this.queries.fetchQuery({
      queryKey: ['ws-email', this.me()?.id, 'config'],
      queryFn: async () => {
        const { data, etag } = await this.http.readWithEtag<unknown>(`${BASE}/email-config`);
        return this.configResult(data, etag);
      },
    });
  }

  patchEmailConfig(body: PatchEmailConfigRequest, etag: string, key: string): Promise<EmailResult> {
    return this.writeConfig('PATCH', '', body, etag, key);
  }

  verifyEmailDomain(etag: string, key: string): Promise<EmailResult> {
    return this.writeConfig('POST', '/verify', undefined, etag, key);
  }

  async verifySmtpConnection(key: string): Promise<{ verified: true }> {
    const result = await this.write<{ verified: true }>(
      '/email-config/verify-connection',
      undefined,
      key,
      true,
    );
    if (result?.verified !== true) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    return result;
  }

  async sendTestEmail(key: string): Promise<void> {
    await this.write('/email-config/send-test', undefined, key, true);
  }

  lookupSuppression(address: string): Promise<SuppressionLookup> {
    return this.write('/email-suppressions/lookup', { address });
  }

  liftSuppression(address: string, key: string): Promise<SuppressionLift> {
    return this.write('/email-suppressions/lift', { address }, key);
  }

  private async writeConfig(
    method: 'PATCH' | 'POST',
    suffix: string,
    body: PatchEmailConfigRequest | undefined,
    etag: string,
    key: string,
  ): Promise<EmailResult> {
    try {
      const result = await this.http.write<unknown>(method, `${BASE}/email-config${suffix}`, body, {
        key,
        ifMatch: etag,
        noBody: method === 'POST',
      });
      const config = this.configResult(result.data, result.etag);
      const queryKey = ['ws-email', this.me()?.id, 'config'];
      this.queries.setQueryData(queryKey, config);
      await this.queries.invalidateQueries({ queryKey, refetchType: 'none' });
      return config;
    } catch (error) {
      this.checkWriteAccess(error);
      throw error;
    }
  }

  private async write<T>(path: string, body?: unknown, key?: string, noBody = false): Promise<T> {
    try {
      return (await this.http.write<T>('POST', `${BASE}${path}`, body, { key, noBody })).data;
    } catch (error) {
      this.checkWriteAccess(error);
      throw error;
    }
  }

  private checkWriteAccess(error: unknown): void {
    if (
      error instanceof ApiError &&
      error.status === 403 &&
      error.code === 'TENANT_WIDE_PERMISSION_REQUIRED'
    ) {
      this.deniedUser.set(this.me()?.id ?? null);
    }
  }

  private configResult(data: unknown, etag: string | null): EmailResult {
    const parsed = configSchema.safeParse(data);
    if (!parsed.success) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    return { config: parsed.data, etag: etag ?? `"${parsed.data.revision}"` };
  }
}
