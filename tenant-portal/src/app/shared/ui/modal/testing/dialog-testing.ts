import { afterEach, beforeEach } from 'vitest';

export function mockDialogsForTest(): void {
  let showModal: PropertyDescriptor | undefined;
  let close: PropertyDescriptor | undefined;

  beforeEach(() => {
    const prototype = HTMLDialogElement.prototype;
    showModal = Object.getOwnPropertyDescriptor(prototype, 'showModal');
    close = Object.getOwnPropertyDescriptor(prototype, 'close');
    Object.defineProperty(prototype, 'showModal', { configurable: true, writable: true, value(this: HTMLDialogElement) {
      this.open = true;
    } });
    Object.defineProperty(prototype, 'close', { configurable: true, writable: true, value(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    } });
  });

  afterEach(() => {
    const prototype = HTMLDialogElement.prototype;
    if (showModal) Object.defineProperty(prototype, 'showModal', showModal);
    else Reflect.deleteProperty(prototype, 'showModal');
    if (close) Object.defineProperty(prototype, 'close', close);
    else Reflect.deleteProperty(prototype, 'close');
  });
}
