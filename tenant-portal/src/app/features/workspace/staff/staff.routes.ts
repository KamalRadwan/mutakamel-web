import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const staffRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('settings', { scope: 'staff', alias: 'staff' })],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'organization' },
      {
        path: 'organization',
        loadComponent: () => import('./organization/organization-page').then((m) => m.OrganizationPage),
      },
      {
        path: 'companies',
        loadComponent: () => import('./companies/companies-page').then((m) => m.CompaniesPage),
      },
      {
        path: 'branches',
        loadComponent: () => import('./branches/branches-page').then((m) => m.BranchesPage),
      },
      {
        path: 'departments',
        loadComponent: () => import('./departments/departments-page').then((m) => m.DepartmentsPage),
      },
      {
        path: 'teams',
        loadComponent: () => import('./teams/teams-page').then((m) => m.TeamsPage),
      },
      {
        path: 'users',
        loadComponent: () => import('./users/users-page/users-page').then((m) => m.UsersPage),
      },
      {
        path: 'roles',
        loadComponent: () => import('./roles/roles-page/roles-page').then((m) => m.RolesPage),
      },
    ],
  },
];
