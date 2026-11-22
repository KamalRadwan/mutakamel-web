import { Routes } from '@angular/router';

export const invitationRoutes: Routes = [
  { path: '', loadComponent: () => import('./invitation-page/invitation-page').then((m) => m.InvitationPage) },
];
