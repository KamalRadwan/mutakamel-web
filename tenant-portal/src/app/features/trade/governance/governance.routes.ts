import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const governanceRoutes: Routes = [
  {
    path: '',
    providers: [
      provideTranslocoScope(
        { scope: 'trade-governance', alias: 'governance' },
        { scope: 'trade-shared', alias: 'tradeShared' },
      ),
    ],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'price-books' },
      {
        path: 'price-books',
        loadComponent: () => import('./price-books-page/price-books-page').then((m) => m.PriceBooksPage),
      },
      {
        path: 'price-books/:id',
        loadComponent: () => import('./price-book-page/price-book-page').then((m) => m.PriceBookPage),
      },
      {
        path: 'price-books/:id/versions/:versionId',
        loadComponent: () => import('./price-version-page/price-version-page').then((m) => m.PriceVersionPage),
      },
      {
        path: 'price-evaluation',
        loadComponent: () =>
          import('./price-evaluation-page/price-evaluation-page').then((m) => m.PriceEvaluationPage),
      },
      {
        path: 'policy-studio',
        loadComponent: () => import('./policy-studio-page/policy-studio-page').then((m) => m.PolicyStudioPage),
      },
      {
        path: 'policy-studio/decisions/:id',
        data: { decisionModal: true },
        loadComponent: () => import('./policy-studio-page/policy-studio-page').then((m) => m.PolicyStudioPage),
      },
      {
        path: 'policy-studio/:id',
        loadComponent: () => import('./policy-page/policy-page').then((m) => m.PolicyPage),
      },
      {
        path: 'policy-studio/:id/versions/:versionId',
        loadComponent: () => import('./policy-version-page/policy-version-page').then((m) => m.PolicyVersionPage),
      },
      {
        path: 'workflows',
        loadComponent: () => import('./workflows-page/workflows-page').then((m) => m.WorkflowsPage),
      },
      {
        path: 'workflows/:id',
        loadComponent: () => import('./workflow-page/workflow-page').then((m) => m.WorkflowPage),
      },
      {
        path: 'workflows/:id/versions/:versionId',
        loadComponent: () =>
          import('./workflow-version-page/workflow-version-page').then((m) => m.WorkflowVersionPage),
      },
      {
        path: 'document-profiles',
        loadComponent: () =>
          import('./document-profiles-page/document-profiles-page').then((m) => m.DocumentProfilesPage),
      },
      {
        path: 'document-profiles/:id',
        loadComponent: () => import('./profile-page/profile-page').then((m) => m.ProfilePage),
      },
      {
        path: 'document-profiles/:id/versions/:versionId',
        loadComponent: () =>
          import('./profile-version-page/profile-version-page').then((m) => m.ProfileVersionPage),
      },
    ],
  },
];
