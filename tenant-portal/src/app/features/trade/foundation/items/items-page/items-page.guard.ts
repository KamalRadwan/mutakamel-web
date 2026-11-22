import type { CanDeactivateFn } from '@angular/router';
import type { ItemsPage } from './items-page';

export const itemsPageCanDeactivate: CanDeactivateFn<ItemsPage> = (component) => {
  return component.canLeave();
};
