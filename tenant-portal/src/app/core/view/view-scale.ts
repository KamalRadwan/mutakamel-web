import { DOCUMENT, Service, computed, effect, inject, signal } from '@angular/core';

export type ViewSize = 'auto' | 'small' | 'balanced' | 'large';

export const VIEW_FACTORS: Record<Exclude<ViewSize, 'auto'>, number> = {
  small: 0.8,
  balanced: 1,
  large: 1.2,
};

const STORAGE_KEY = 'view';

@Service()
export class ViewScale {
  private readonly document = inject(DOCUMENT);
  private readonly width = signal(innerWidth);

  readonly size = signal<ViewSize>(readStored());
  readonly factor = computed(() => {
    const size = this.size();
    return size === 'auto' ? autoFactor(this.width()) : VIEW_FACTORS[size];
  });

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.width.set(innerWidth), 150);
    });

    effect(() => {
      const size = this.size();
      const factor = this.factor();
      this.document.documentElement.style.zoom = factor === 1 ? '' : String(factor);
      // Under CSS zoom, 100dvh is scaled too; layouts divide by this to fill the real window height.
      this.document.documentElement.style.setProperty('--view-zoom', String(factor));
      try {
        localStorage.setItem(STORAGE_KEY, size);
      } catch {
        // Ignore storage errors
      }
    });
  }

  set(size: ViewSize) {
    this.size.set(size);
  }
}

function autoFactor(width: number): number {
  if (width < 1280) return 0.8;
  if (width >= 2200) return 1.2;
  return 1;
}

function readStored(): ViewSize {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'auto' || value === 'small' || value === 'balanced' || value === 'large') return value;
  } catch {
    // Ignore storage errors
  }
  return 'auto';
}
