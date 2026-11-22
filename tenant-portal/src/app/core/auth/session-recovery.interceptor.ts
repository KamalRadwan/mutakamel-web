import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, defer, from, lastValueFrom, of, switchMap, throwError } from 'rxjs';
import { ApiError } from '../api/api-errors';
import { AuthSession } from './auth-session';

const TENANT_API = /^\/api\/tenant\/[a-z][a-z0-9-]*\/v\d+(?:\/|$)/u;
const AUTH_API = /^\/api\/tenant\/core\/v\d+\/auth(?:\/|$)/u;
const AUTH_ACTIVITY = '/api/tenant/core/v1/auth/activity';
const AUTH_ISSUES_SESSION = /^\/api\/tenant\/core\/v\d+\/auth\/(?:login|mfa\/verify|accept-invite|change-password)$/u;
const PUBLIC_BRANDING = /^\/api\/tenant\/core\/v\d+\/branding\/public$/u;

function issuedSession(event: unknown): boolean {
  if (!(event instanceof HttpResponse)) return false;
  const body = event.body as { success?: unknown; data?: { tokenType?: unknown; session?: unknown } } | null;
  return body?.success === true && body.data?.tokenType === 'Bearer' && Boolean(body.data.session);
}

export const sessionRecoveryInterceptor: HttpInterceptorFn = (request, next) => {
  const origin = inject(DOCUMENT).location?.origin;
  if (!origin || origin === 'null') return next(request);

  const url = new URL(request.url, origin);
  if (url.origin !== origin || !TENANT_API.test(url.pathname) || PUBLIC_BRANDING.test(url.pathname)) return next(request);
  if (AUTH_API.test(url.pathname)) {
    if (request.method === 'POST' && AUTH_ISSUES_SESSION.test(url.pathname)) {
      const session = inject(AuthSession);
      const response = next(request);
      return defer(() => session.completeSignInRequest(() => lastValueFrom(response), issuedSession));
    }
    // AuthSession issues this dedicated request only after trusted human input.
    return next(request.method === 'POST' && url.pathname === AUTH_ACTIVITY
      ? request.clone({ setHeaders: { 'x-auth-user-activity': '1' } })
      : request);
  }

  const session = inject(AuthSession);
  const version = session.requestVersion();
  const safeRead = request.method === 'GET' || request.method === 'HEAD';
  return next(request).pipe(catchError((error: unknown) => {
    const original = () => throwError(() => error);
    const failure = error instanceof HttpErrorResponse
      ? ApiError.fromResponse(error.status, error.error)
      : error;
    if (!(failure instanceof ApiError) || (failure.status !== 401 && failure.status !== 403)) return original();

    return from(session.recoverRequest(failure, version)).pipe(
      catchError(() => of(false)),
      // Only a safe read is replayed. A write still returns its original failure.
      switchMap((recovered) => recovered && safeRead ? next(request) : original()),
    );
  }));
};
