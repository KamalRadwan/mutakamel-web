import { Service, inject } from '@angular/core';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { AuthSession } from '../../../../core/auth/auth-session';
import type { LoginSession, MfaStep } from '../../../../core/auth/auth-session.model';
import type { ChangePasswordBody } from './security.model';

const AUTH = '/api/tenant/core/v1/auth';

@Service()
export class SecurityApi {
  private readonly http = inject(CoreHttp);
  private readonly session = inject(AuthSession);

  async changePassword(body: ChangePasswordBody): Promise<LoginSession | null> {
    const version = this.session.requestVersion();
    const send = async () =>
      (await this.http.write<LoginSession>('POST', `${AUTH}/change-password`, body)).data;
    try {
      return await send();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const recovered = await this.session.recoverRequest(error, version);
      if (!recovered) {
        if (error.code !== 'INVALID_CREDENTIALS') throw error;
        if ((await this.session.refresh()) === 'ended') return null;
      }
      try {
        return await send();
      } catch (retryError) {
        if (
          retryError instanceof ApiError &&
          retryError.status === 401 &&
          retryError.code === 'INVALID_CREDENTIALS'
        ) {
          await this.session.sessionEnded();
          return null;
        }
        throw retryError;
      }
    }
  }

  startMfaChange(enabled: boolean, currentPassword: string): Promise<MfaStep> {
    return this.recoverOnce(
      async () =>
        (
          await this.http.write<MfaStep>('POST', `${AUTH}/mfa/settings/challenge`, {
            enabled,
            currentPassword,
          })
        ).data,
    );
  }

  resendMfaCode(challengeId: string): Promise<MfaStep> {
    return this.recoverOnce(
      async () =>
        (await this.http.write<MfaStep>('POST', `${AUTH}/mfa/settings/resend`, { challengeId }))
          .data,
    );
  }

  confirmMfaChange(challengeId: string, code: string): Promise<void> {
    return this.recoverOnce(async () => {
      await this.http.write<void>('POST', `${AUTH}/mfa/settings/confirm`, { challengeId, code });
    });
  }

  private async recoverOnce<T>(send: () => Promise<T>): Promise<T> {
    const version = this.session.requestVersion();
    try {
      return await send();
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.status !== 401 ||
        error.code === 'AUTH_MFA_INVALID_CHALLENGE'
      )
        throw error;
      if (await this.session.recoverRequest(error, version)) return send();
      throw error;
    }
  }
}
