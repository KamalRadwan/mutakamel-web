import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Sparkline, SparklineSpec } from './sparkline';

function rects(spec: SparklineSpec): { x: number; width: number }[] {
  const fixture = TestBed.createComponent(Sparkline);
  fixture.componentRef.setInput('spec', spec);
  fixture.detectChanges();
  return Array.from(fixture.nativeElement.querySelectorAll('rect') as NodeListOf<SVGRectElement>).map((r) => ({
    x: Number(r.getAttribute('x')),
    width: Number(r.getAttribute('width')),
  }));
}

describe('Sparkline segmented', () => {
  it('draws a single neutral track when there are no positive segments', () => {
    expect(rects({ shape: 'segmented', segments: [0, -1] })).toEqual([{ x: 2, width: 80 }]);
  });

  it('gives a tiny positive segment at least the 2-unit minimum width', () => {
    const widths = rects({ shape: 'segmented', segments: [1, 1000] }).map((r) => r.width);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(2);
  });

  it('keeps the row inside the track after applying the minimum', () => {
    const list = rects({ shape: 'segmented', segments: [1, 1000, 1000] });
    const rightEdge = Math.max(...list.map((r) => r.x + r.width));
    expect(rightEdge).toBeLessThanOrEqual(82.01);
  });

  it('ignores zero and non-finite segments', () => {
    expect(rects({ shape: 'segmented', segments: [0, Number.NaN, 5, 5] })).toHaveLength(2);
  });

  it('splits two equal segments evenly', () => {
    expect(rects({ shape: 'segmented', segments: [1, 1] }).map((r) => r.width)).toEqual([39, 39]);
  });
});
