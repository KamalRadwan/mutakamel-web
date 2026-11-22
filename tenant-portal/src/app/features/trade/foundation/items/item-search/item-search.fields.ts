import type { SearchField } from '../../../../../shared/ui/facet-search/facet-search.model';
import type { CategoryOption } from '../../../shared/trade-foundation.model';
import { ITEM_KIND_KEY } from '../../../shared/trade-labels';
import { ITEM_KINDS, type ItemListScope } from '../items.model';

export const ITEM_FACET_FIELDS = {
  text: 'text',
  kind: 'kind',
  purpose: 'purpose',
  category: 'category',
  image: 'image',
} as const;

export interface ItemSearchFieldsContext {
  scope: ItemListScope;
  categories: readonly CategoryOption[];
  translate: (key: string) => string;
}

export function categoryBreadcrumb(path: readonly { name: string }[]): string {
  return path.map((part) => part.name).join(' › ');
}

export function itemSearchFields(ctx: ItemSearchFieldsContext): SearchField[] {
  const fields: SearchField[] = [
    {
      id: ITEM_FACET_FIELDS.text,
      label: ctx.translate('tradeItems.facets.text'),
    },
    {
      id: ITEM_FACET_FIELDS.kind,
      label: ctx.translate('tradeItems.facets.kind'),
      options: ITEM_KINDS.map((kind) => ({
        value: kind,
        label: ctx.translate(ITEM_KIND_KEY[kind]),
      })),
    },
  ];

  if (ctx.scope === 'company') {
    fields.push({
      id: ITEM_FACET_FIELDS.purpose,
      label: ctx.translate('tradeItems.facets.purpose'),
      options: [
        { value: 'SALES', label: ctx.translate('tradeItems.facets.purposeSales') },
        { value: 'PURCHASE', label: ctx.translate('tradeItems.facets.purposePurchase') },
      ],
    });
  }

  fields.push(
    {
      id: ITEM_FACET_FIELDS.category,
      label: ctx.translate('tradeItems.facets.category'),
      options: ctx.categories.map((cat) => ({
        value: cat.id,
        label: categoryBreadcrumb(cat.path) || cat.name,
      })),
    },
    {
      id: ITEM_FACET_FIELDS.image,
      label: ctx.translate('tradeItems.facets.image'),
      options: [
        { value: 'yes', label: ctx.translate('tradeItems.facets.imageYes') },
        { value: 'no', label: ctx.translate('tradeItems.facets.imageNo') },
      ],
    },
  );

  return fields;
}
