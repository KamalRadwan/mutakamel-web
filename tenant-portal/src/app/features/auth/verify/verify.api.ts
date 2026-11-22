import { inject } from '@angular/core';
import type { LoginSession, MfaStep } from '../../../core/auth/auth-session.model';
import { AuthTransport } from '../../../core/auth/auth-transport';
import type { MfaResendBody, MfaVerifyBody } from './verify.model';

export function verifyCode(challengeId: string, code: string, transport = inject(AuthTransport)): Promise<LoginSession> {
  const body: MfaVerifyBody = { challengeId, code };
  return transport.requestData('mfa/verify', body);
}

export function resendCode(challengeId: string, transport = inject(AuthTransport)): Promise<MfaStep> {
  const body: MfaResendBody = { challengeId };
  return transport.requestData('mfa/resend', body);
}
