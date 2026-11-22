import type { ActionItem } from '../../../../shared/ui/actions-menu/actions-menu';
import type { AnyDocument, DocumentKind } from '../shared/document.model';

export type DocumentRowActionId = 'open' | 'edit' | 'print' | 'convert' | 'createPo';

export interface DocumentRowMenuPerms {
  readonly canPrint?: boolean;
  readonly canConvert?: boolean;
}

export const DEFAULT_DOCUMENT_ROW_PERMS: DocumentRowMenuPerms = {
  canPrint: true,
  canConvert: true,
}; // later from the session permissions

export function isDocumentRowPrintable(kind: DocumentKind, lifecycleStatus: string): boolean {
  switch (kind) {
    case 'quotation':
      return (
        lifecycleStatus === 'SENT' ||
        lifecycleStatus === 'ACCEPTED' ||
        lifecycleStatus === 'REJECTED' ||
        lifecycleStatus === 'CONVERTED'
      );
    case 'sales-order':
    case 'purchase-order':
      return lifecycleStatus === 'CONFIRMED' || lifecycleStatus === 'CLOSED';
    case 'purchase-quotation':
      return lifecycleStatus === 'ISSUED';
  }
}

/** Build the row and card Actions menu items for a trade document. */
export function rowMenu(
  kind: DocumentKind,
  row: AnyDocument,
  perms: DocumentRowMenuPerms = DEFAULT_DOCUMENT_ROW_PERMS,
  translate: (key: string) => string = (key) => key,
): ActionItem[] {
  const items: ActionItem[] = [
    {
      id: 'open',
      title: translate('tdl.menu.open'),
      icon: 'tablerExternalLink',
      tile: 'bg-icon-blue',
    },
    {
      id: 'edit',
      title: translate('tdl.menu.edit'),
      icon: 'tablerPencil',
      tile: 'bg-icon-teal',
    },
  ];

  if (perms.canPrint !== false) {
    const printable = isDocumentRowPrintable(kind, row.lifecycleStatus);
    items.push({
      id: 'print',
      title: translate('tdl.menu.print'),
      icon: 'tablerPrinter',
      tile: 'bg-icon-navy',
      disabled: !printable,
      ...(printable ? {} : { reason: translate('tdl.menu.printDisabled') }),
    });
  }

  if (perms.canConvert !== false) {
    if (kind === 'quotation' && row.lifecycleStatus === 'ACCEPTED') {
      items.push({
        id: 'convert',
        title: translate('tdl.menu.convert'),
        icon: 'tablerTransform',
        tile: 'bg-icon-green',
      });
    } else if (kind === 'purchase-quotation' && row.lifecycleStatus === 'ISSUED') {
      items.push({
        id: 'createPo',
        title: translate('tdl.menu.createPo'),
        icon: 'tablerTransform',
        tile: 'bg-icon-orange',
      });
    }
  }

  return items;
}
