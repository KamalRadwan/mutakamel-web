import { Routes } from '@angular/router';
import { verifyPendingGuard } from './verify-pending.guard';

export const verifyRoutes: Routes = [
  {
    path: '',
    canActivate: [verifyPendingGuard],
    loadComponent: () => import('./verify-page/verify-page').then((m) => m.VerifyPage),
  },
];
