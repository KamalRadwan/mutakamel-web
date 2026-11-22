import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { StaffAccessPage } from './staff-access-page';
import { staffReadGuard } from './staff-read-access';

const staffRead: Pick<Routes[number], 'canActivate' | 'runGuardsAndResolvers'> = {
  canActivate: [staffReadGuard],
  runGuardsAndResolvers: 'paramsOrQueryParamsChange',
};

export const staffRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('settings', { scope: 'staff', alias: 'staff' })],
    children: [
      { path: '', pathMatch: 'full', component: StaffAccessPage, ...staffRead },
      {
        path: 'organization',
        ...staffRead,
        loadComponent: () => import('./organization/organization-page').then((m) => m.OrganizationPage),
      },
      {
        path: 'companies',
        ...staffRead,
        loadComponent: () => import('./companies/companies-page').then((m) => m.CompaniesPage),
      },
      {
        path: 'branches',
        ...staffRead,
        loadComponent: () => import('./branches/branches-page').then((m) => m.BranchesPage),
      },
      {
        path: 'departments',
        ...staffRead,
        loadComponent: () => import('./departments/departments-page').then((m) => m.DepartmentsPage),
      },
      {
        path: 'teams',
        ...staffRead,
        loadComponent: () => import('./teams/teams-page').then((m) => m.TeamsPage),
      },
      {
        path: 'users',
        ...staffRead,
        loadComponent: () => import('./users/users-page/users-page').then((m) => m.UsersPage),
      },
      {
        path: 'roles',
        ...staffRead,
        loadComponent: () => import('./roles/roles-page/roles-page').then((m) => m.RolesPage),
      },
    ],
  },
];
