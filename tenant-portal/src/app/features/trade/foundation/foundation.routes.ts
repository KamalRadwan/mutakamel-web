import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { itemPageCanDeactivate } from './items/item-page/item-page.guard';
import { itemsPageCanDeactivate } from './items/items-page/items-page.guard';

export const foundationRoutes: Routes = [
  {
    path: '',
    // 'settings' is needed by app-settings-frame (Units uses it); trade-shared by every Foundation page.
    providers: [provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' })],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'items' },
      { path: 'items/new', canDeactivate: [itemPageCanDeactivate], loadComponent: () => import('./items/item-page/item-page').then((m) => m.ItemPage) },
      { path: 'items/:id', canDeactivate: [itemPageCanDeactivate], loadComponent: () => import('./items/item-page/item-page').then((m) => m.ItemPage) },
      { path: 'items', canDeactivate: [itemsPageCanDeactivate], loadComponent: () => import('./items/items-page/items-page').then((m) => m.ItemsPage) },
      { path: 'units', loadComponent: () => import('./units/units-page').then((m) => m.UnitsPage) },
      { path: 'categories', loadComponent: () => import('./categories/categories-page').then((m) => m.CategoriesPage) },
      { path: 'channels', loadComponent: () => import('./channels/channels-page').then((m) => m.ChannelsPage) },
      { path: 'commercial-accounts', loadComponent: () => import('./commercial-accounts/accounts-page').then((m) => m.AccountsPage) },
      { path: 'configuration', loadComponent: () => import('./configuration/configuration-page').then((m) => m.ConfigurationPage) },
    ],
  },
];
