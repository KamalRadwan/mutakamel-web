import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const notificationsRoutes: Routes = [
  {
    path: '',
    title: 'notifications.title',
    providers: [provideTranslocoScope({ scope: 'ws-notifications', alias: 'wsNotif' })],
    loadComponent: () => import('./notifications-page/notifications-page').then((m) => m.NotificationsPage),
    children: [
      {
        path: ':id',
        loadComponent: () =>
          import('./notification-detail/notification-detail').then((m) => m.NotificationDetail),
      },
    ],
  },
];
