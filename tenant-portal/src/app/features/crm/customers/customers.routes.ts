import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { recordCanDeactivate } from '../shared/record/nav/record-page.guard';

function customerPageScopes() {
  return provideTranslocoScope(
    'customers',
    { scope: 'customer-page', alias: 'customerPage' },
    { scope: 'customer-form', alias: 'customerForm' },
    { scope: 'customer-modal', alias: 'customerModal' },
    { scope: 'record-form', alias: 'recordForm' },
    { scope: 'record-fields', alias: 'recordFields' },
    { scope: 'record-dup', alias: 'recordDup' },
    { scope: 'record-page', alias: 'recordPage' },
    { scope: 'record-attachments', alias: 'recordAttachments' },
    { scope: 'record-history', alias: 'recordHistory' },
    { scope: 'record-activities-tab', alias: 'recordActivitiesTab' },
    { scope: 'record-related', alias: 'recordRelated' },
  );
}

export const customersRoutes: Routes = [
  {
    path: '',
    providers: [
      provideTranslocoScope(
        'customers',
        { scope: 'customer-form', alias: 'customerForm' },
        { scope: 'customer-modal', alias: 'customerModal' },
        { scope: 'record-form', alias: 'recordForm' },
        { scope: 'record-fields', alias: 'recordFields' },
        { scope: 'record-dup', alias: 'recordDup' },
        { scope: 'record-modal', alias: 'recordModal' },
        { scope: 'record-list', alias: 'recordList' },
        { scope: 'record-related', alias: 'recordRelated' },
      ),
    ],
    canDeactivate: [recordCanDeactivate],
    loadComponent: () => import('./customers-page/customers-page').then((m) => m.CustomersPage),
  },
  {
    path: 'new',
    providers: [customerPageScopes()],
    canDeactivate: [recordCanDeactivate],
    loadComponent: () => import('./customer-page/customer-page').then((m) => m.CustomerPage),
  },
  {
    path: ':id',
    providers: [customerPageScopes()],
    canDeactivate: [recordCanDeactivate],
    loadComponent: () => import('./customer-page/customer-page').then((m) => m.CustomerPage),
  },
];
