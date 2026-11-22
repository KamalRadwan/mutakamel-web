import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Sends the active Transloco language (en | ar) as Accept-Language on every request:
 * the server derives the response locale from it. A header the caller set is kept.
 */
export const acceptLanguageInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('Accept-Language')) return next(req);
  const lang = inject(TranslocoService).getActiveLang() === 'ar' ? 'ar' : 'en';
  return next(req.clone({ setHeaders: { 'Accept-Language': lang } }));
};
