import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { guestGuard } from '../../core/auth/auth.guards';

export const authRoutes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    providers: [provideTranslocoScope('auth')],
    loadChildren: () => import('./login/login.routes').then((m) => m.loginRoutes),
  },
  {
    path: 'verify',
    providers: [provideTranslocoScope('auth', { scope: 'auth-verify', alias: 'authVerify' })],
    loadChildren: () => import('./verify/verify.routes').then((m) => m.verifyRoutes),
  },
  {
    path: 'reset-password',
    providers: [provideTranslocoScope('auth', { scope: 'auth-reset', alias: 'authReset' })],
    loadChildren: () => import('./reset-password/reset-password.routes').then((m) => m.resetPasswordRoutes),
  },
  // The reset email links to /tenant/reset-password#token=… (core TenantPublicUrlService). Same page.
  {
    path: 'tenant/reset-password',
    providers: [provideTranslocoScope('auth', { scope: 'auth-reset', alias: 'authReset' })],
    loadChildren: () => import('./reset-password/reset-password.routes').then((m) => m.resetPasswordRoutes),
  },
  // The invitation email links to /tenant/accept-invite#token=….
  {
    path: 'tenant/accept-invite',
    providers: [provideTranslocoScope('auth', { scope: 'auth-invite', alias: 'authInvite' })],
    loadChildren: () => import('./invitation/invitation.routes').then((m) => m.invitationRoutes),
  },
];
