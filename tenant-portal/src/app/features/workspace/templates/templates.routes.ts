import { CanDeactivateFn, GuardResult, MaybeAsync, Routes, UrlSegment } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { TEMPLATE_FUNCTIONS_ENABLED } from './functions/functions.flags';
import { TEMPLATE_PAGE_TABS } from './templates.model';

const VALID_TABS = new Set<string>(TEMPLATE_PAGE_TABS);

function isValidTemplateTab(_route: unknown, segments: UrlSegment[]): boolean {
  const tab = segments[2]?.path;
  return tab !== undefined && VALID_TABS.has(tab);
}

interface DeactivatableComponent {
  canDeactivate?: () => MaybeAsync<GuardResult>;
}

const canDeactivateTemplatePage: CanDeactivateFn<DeactivatableComponent> = (component) =>
  component?.canDeactivate ? component.canDeactivate() : true;

export const templatesRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('templates')],
    children: [
      {
        path: 'template-platform',
        loadComponent: () => import('./library/library-page/library-page').then((m) => m.LibraryPage),
      },
      {
        path: 'template-platform/:id/:tab',
        canMatch: [isValidTemplateTab],
        canDeactivate: [canDeactivateTemplatePage],
        loadComponent: () => import('./template-page/template-page/template-page').then((m) => m.TemplatePage),
      },
      {
        path: 'template-platform/:id',
        canDeactivate: [canDeactivateTemplatePage],
        loadComponent: () => import('./template-page/template-page/template-page').then((m) => m.TemplatePage),
      },
      {
        path: 'template-assets',
        loadComponent: () => import('./assets/assets-page/assets-page').then((m) => m.AssetsPage),
      },
      {
        path: 'template-assignments',
        loadComponent: () => import('./assignments/assignments-page/assignments-page').then((m) => m.AssignmentsPage),
      },
      ...(TEMPLATE_FUNCTIONS_ENABLED
        ? [
            {
              path: 'template-functions',
              loadComponent: () =>
                import('./functions/functions-page/functions-page').then((m) => m.FunctionsPage),
            },
          ]
        : []),
    ],
  },
];
