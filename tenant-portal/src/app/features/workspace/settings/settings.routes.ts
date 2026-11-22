import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { workspaceSettingsLeaveGuard } from './workspace-settings/workspace-settings-page/workspace-settings-page';

export const workspaceSettingsRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'geography' },
  {
    path: 'workspace',
    providers: [provideTranslocoScope({ scope: 'ws-general', alias: 'wsGeneral' })],
    canDeactivate: [workspaceSettingsLeaveGuard],
    loadComponent: () => import('./workspace-settings/workspace-settings-page/workspace-settings-page').then((m) => m.WorkspaceSettingsPage),
  },
  {
    path: 'currencies',
    providers: [provideTranslocoScope('settings', { scope: 'ws-currencies', alias: 'wsCurrencies' })],
    loadComponent: () => import('./currencies/currencies-page/currencies-page').then((m) => m.CurrenciesPage),
  },
  {
    path: 'taxes',
    providers: [provideTranslocoScope('settings', { scope: 'ws-taxes', alias: 'wsTaxes' })],
    loadComponent: () => import('./taxes/taxes-page/taxes-page').then((m) => m.TaxesPage),
  },
  {
    path: 'numbering',
    providers: [provideTranslocoScope('settings', { scope: 'ws-numbering', alias: 'wsNumbering' })],
    loadComponent: () => import('./numbering/numbering-page/numbering-page').then((m) => m.NumberingPage),
  },
  {
    path: 'email',
    providers: [provideTranslocoScope('settings', { scope: 'ws-email', alias: 'wsEmail' })],
    loadComponent: () => import('./email/email-page/email-page').then((m) => m.EmailPage),
  },
  {
    path: 'branding',
    providers: [provideTranslocoScope({ scope: 'ws-branding', alias: 'wsBranding' })],
    loadComponent: () => import('./branding/branding-page/branding-page').then((m) => m.BrandingPage),
  },
  {
    path: 'updates',
    providers: [provideTranslocoScope('settings', { scope: 'ws-updates', alias: 'wsUpdates' })],
    loadComponent: () => import('./updates/updates-page/updates-page').then((m) => m.UpdatesPage),
  },
  {
    path: 'phone',
    providers: [provideTranslocoScope({ scope: 'ws-phone', alias: 'wsPhone' })],
    loadComponent: () => import('./phone/phone-settings-page/phone-settings-page').then((m) => m.PhoneSettingsPage),
  },
  {
    path: 'geography',
    providers: [provideTranslocoScope('settings', { scope: 'ws-geo', alias: 'wsGeo' })],
    loadComponent: () => import('./geography/geography-page/geography-page').then((m) => m.GeographyPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'countries' },
      {
        path: 'countries',
        loadComponent: () => import('./geography/countries-tab/countries-tab').then((m) => m.CountriesTab),
      },
      {
        path: 'states',
        loadComponent: () => import('./geography/states-tab/states-tab').then((m) => m.StatesTab),
      },
      {
        path: 'cities',
        loadComponent: () => import('./geography/cities-tab/cities-tab').then((m) => m.CitiesTab),
      },
      {
        path: 'districts',
        loadComponent: () => import('./geography/districts-tab/districts-tab').then((m) => m.DistrictsTab),
      },
      {
        path: 'zones',
        loadComponent: () => import('./geography/zones-tab/zones-tab').then((m) => m.ZonesTab),
      },
    ],
  },
];
