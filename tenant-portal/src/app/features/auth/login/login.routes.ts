import { Routes } from '@angular/router';

export const loginRoutes: Routes = [
  { path: '', loadComponent: () => import('./login-page/login-page').then((m) => m.LoginPage) },
];
