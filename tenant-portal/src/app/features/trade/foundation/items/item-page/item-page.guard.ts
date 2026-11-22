import type { CanDeactivateFn } from '@angular/router';
import type { ItemPage } from './item-page';

export const itemPageCanDeactivate: CanDeactivateFn<ItemPage> = (component) => {
  return component.confirmLeave();
};
