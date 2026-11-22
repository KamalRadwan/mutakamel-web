import type { CanDeactivateFn, Routes } from '@angular/router';
import { provideBulkJobModules } from '../../../shared/bulk-jobs';
import { TRADE_DOCUMENT_BULK_MODULES } from './document-bulk/documents-bulk.descriptor';
import { kindFromSegment } from './shared/document-kinds';

export interface CanLeaveDocumentPage {
  canLeave(): Promise<boolean> | boolean;
}

const unsavedGuard: CanDeactivateFn<CanLeaveDocumentPage> = (component) => {
  return component?.canLeave() ?? true;
};

const DOCUMENT_SEGMENTS = [
  'quotations',
  'sales-orders',
  'purchase-orders',
  'purchase-quotations',
] as const;

export const DOCUMENTS_ROUTES: Routes = [
  {
    path: '',
    providers: [provideBulkJobModules(TRADE_DOCUMENT_BULK_MODULES)],
    children: [
      ...DOCUMENT_SEGMENTS.flatMap((segment) => {
        const kind = kindFromSegment(segment)!;
        return [
          {
            path: segment,
            data: { kind },
            loadComponent: () => import('./document-list/document-list').then((m) => m.DocumentList),
          },
          {
            path: `${segment}/new`,
            data: { kind },
            loadComponent: () => import('./document-page/document-page').then((m) => m.DocumentPage),
            canDeactivate: [unsavedGuard],
          },
          {
            path: `${segment}/:id`,
            data: { kind },
            loadComponent: () => import('./document-page/document-page').then((m) => m.DocumentPage),
            canDeactivate: [unsavedGuard],
          },
        ];
      }),
      { path: '', pathMatch: 'full', redirectTo: 'quotations' },
    ],
  },
];
