import { inject } from '@angular/core';
import { AuthTransport } from '../../../core/auth/auth-transport';
import type { LoginBody, LoginResult } from './login.model';

export function login(body: LoginBody, remember: boolean, transport = inject(AuthTransport)): Promise<LoginResult> {
  return transport.requestData('login', body, remember);
}
