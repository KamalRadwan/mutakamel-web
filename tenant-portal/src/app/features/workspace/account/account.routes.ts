import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const accountRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'preferences' },
  {
    path: 'notifications',
    providers: [provideTranslocoScope({ scope: 'ws-account-notifications', alias: 'wsAccNotif' })],
    loadComponent: () => import('./notifications/notifications-page/notifications-page').then((m) => m.NotificationsPage),
  },
  {
    path: 'preferences',
    providers: [provideTranslocoScope({ scope: 'ws-account-preferences', alias: 'wsAccPrefs' })],
    loadComponent: () => import('./preferences/preferences-page/preferences-page').then((m) => m.PreferencesPage),
  },
  {
    path: 'security',
    providers: [
      provideTranslocoScope(
        { scope: 'ws-account-security', alias: 'wsAccSec' },
        { scope: 'ws-account-sessions', alias: 'wsAccSessions' },
      ),
    ],
    loadComponent: () => import('./security/security-page/security-page').then((m) => m.SecurityPage),
  },
];
