export interface PageRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export function rootZoom(): number {
  return parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
}

export function viewport(): { width: number; height: number } {
  const z = rootZoom();
  return { width: innerWidth / z, height: innerHeight / z };
}

export function rectInPage(el: Element): PageRect {
  const z = rootZoom();
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top / z,
    bottom: rect.bottom / z,
    left: rect.left / z,
    right: rect.right / z,
    width: rect.width / z,
    height: rect.height / z,
  };
}
