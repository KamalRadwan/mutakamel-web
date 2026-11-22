import { Routes } from '@angular/router';

export const resetPasswordRoutes: Routes = [
  { path: '', loadComponent: () => import('./reset-password-page/reset-password-page').then((m) => m.ResetPasswordPage) },
];
