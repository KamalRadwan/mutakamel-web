import { describe, expect, it } from 'vitest';
import type { TemplateDocumentV1 } from '../templates.model';
import { checkGraph, insertNodeInDocument, updateFrameInDocument } from './document-ops';
import {
  canResizeFlow,
  enableFixedZone,
  hybridZone,
  moveNodeToPosition,
  positionError,
  reorderFlow,
  resizeFlow,
  setZoneHeight,
  zoneBox,
} from './hybrid-ops';

function document(): TemplateDocumentV1 {
  return {
    schemaVersion: 1,
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'HYBRID_DOCUMENT',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    locale: 'en-US',
    direction: 'LTR',
    page: {
      unit: 'MM',
      preset: 'A4',
      widthMm: 210,
      heightMm: 297,
      orientation: 'PORTRAIT',
      marginMm: { top: 12, end: 10, bottom: 12, start: 14 },
    },
    theme: {
      fontFamilyToken: 'SYSTEM_SANS',
      baseFontSizePx: 12,
      textColor: '#12141c',
      lineHeight: 1.4,
    },
    rootNodeIds: ['body'],
    nodes: {
      body: {
        id: 'body',
        type: 'container',
        parentId: null,
        childIds: [],
        locked: false,
        hidden: false,
        layout: { kind: 'FLOW', order: 0 },
        style: {},
        props: { semanticRole: 'BODY' },
      },
    },
  };
}

describe('Hybrid document operations', () => {
  it('creates ordered root zones with the entered heights and physical RTL origins', () => {
    const doc = document();
    setZoneHeight(doc, 'footer', 20);
    setZoneHeight(doc, 'header', 30);
    expect(doc.rootNodeIds.map((id) => doc.nodes[id].type)).toEqual([
      'header',
      'container',
      'footer',
    ]);
    const footer = hybridZone(doc, 'footer');
    expect(footer && zoneBox(doc, footer)).toEqual({ x: 14, y: 265, width: 186, height: 20 });
    doc.direction = 'RTL';
    expect(footer && zoneBox(doc, footer).x).toBe(10);
    expect(checkGraph(doc)).toBe(true);
    expect(setZoneHeight(doc, 'header', 81)).toBe(false);
    expect(setZoneHeight(doc, 'header', Number.NaN)).toBe(false);
  });

  it('inserts ABSOLUTE text directly into a fixed zone and clamps its complete frame', () => {
    const doc = document();
    setZoneHeight(doc, 'header', 20);
    const zone = hybridZone(doc, 'header');
    if (!zone) throw new Error('Header missing');
    const id = insertNodeInDocument(doc, { type: 'text', props: { text: 'Header' } }, 0, [], {
      parentId: zone.id,
      x: 180,
      y: 18,
    });
    expect(doc.nodes[id].layout).toMatchObject({
      kind: 'ABSOLUTE',
      x: 126,
      y: 12,
      width: 60,
      height: 8,
    });
    updateFrameInDocument(doc, [id], { dx: 100, dy: -100 });
    expect(doc.nodes[id].layout).toMatchObject({ x: 126, y: 0 });
    updateFrameInDocument(doc, [id], { width: 250, height: 100 });
    expect(doc.nodes[id].layout).toMatchObject({ x: 0, y: 0, width: 186, height: 20 });
    expect(checkGraph(doc)).toBe(true);
  });

  it('converts flow ↔ zone using measured sizes and the backend FLOW size fields', () => {
    const doc = document();
    setZoneHeight(doc, 'footer', 20);
    const id = insertNodeInDocument(doc, { type: 'text', props: { text: 'Text' } }, 0, []);
    expect(doc.nodes[id].layout.kind).toBe('FLOW');
    expect(moveNodeToPosition(doc, id, 'footer', { x: 175, y: 19, width: 50, height: 8 })).toBe(
      true,
    );
    expect(doc.nodes[id].layout).toMatchObject({
      kind: 'ABSOLUTE',
      x: 136,
      y: 12,
      width: 50,
      height: 8,
    });
    expect(doc.nodes['body'].childIds).toEqual([]);
    expect(moveNodeToPosition(doc, id, 'FLOW', { x: 0, y: 0, width: 1, height: 1 })).toBe(true);
    expect(doc.nodes[id].layout).toEqual({
      kind: 'FLOW',
      order: 0,
      width: { value: 50, unit: 'MM' },
      minHeight: { value: 8, unit: 'MM' },
      keepTogether: false,
      breakBefore: false,
      breakAfter: false,
    });
    expect(checkGraph(doc)).toBe(true);
  });

  it('keeps body content in flow, reorders siblings and respects locked nodes', () => {
    const doc = document();
    const first = insertNodeInDocument(doc, { type: 'text', props: { text: 'A' } }, 0, []);
    const second = insertNodeInDocument(doc, { type: 'text', props: { text: 'B' } }, 0, []);
    expect(reorderFlow(doc, second, first)).toBe(true);
    expect(doc.nodes['body'].childIds).toEqual([second, first]);
    expect(doc.nodes[first].layout).toMatchObject({ kind: 'FLOW', order: 1 });
    doc.nodes[first].locked = true;
    expect(reorderFlow(doc, first, second)).toBe(false);
    expect(checkGraph(doc)).toBe(true);
  });

  it('resizes flow width and minimum height, preserves percentage units, and clamps to printable/parent width', () => {
    const doc = document();
    const id = insertNodeInDocument(
      doc,
      {
        type: 'text',
        props: { text: 'Text' },
        layout: { kind: 'FLOW', order: 0, width: { value: 50, unit: 'PERCENT' } },
      },
      0,
      [],
    );
    resizeFlow(doc, id, 500, 14, 100);
    expect(doc.nodes[id].layout).toMatchObject({
      kind: 'FLOW',
      width: { value: 100, unit: 'PERCENT' },
      minHeight: { value: 14, unit: 'MM' },
    });
    expect(canResizeFlow(doc.nodes['body'])).toBe(false);
    doc.nodes[id].locked = true;
    expect(resizeFlow(doc, id, 20, 20, 100)).toBe(false);
  });

  it('refuses conversions that lose rotation, page-field context, or zone restrictions', () => {
    const doc = document();
    setZoneHeight(doc, 'header', 20);
    const zone = hybridZone(doc, 'header');
    if (!zone) throw new Error('Header missing');
    const id = insertNodeInDocument(doc, { type: 'text', props: { text: 'Text' } }, 0, [zone.id]);
    updateFrameInDocument(doc, [id], { rotationDeg: 10 });
    expect(positionError(doc, doc.nodes[id], 'FLOW')).toBe('rotationInFlow');
    const field = insertNodeInDocument(
      doc,
      {
        type: 'dataField',
        props: { label: '' },
        binding: { path: 'page.number', nullBehavior: 'EMPTY' },
      },
      0,
      [zone.id],
    );
    expect(positionError(doc, doc.nodes[field], 'FLOW')).toBe('pageFieldInFlow');
  });

  it('enables a flow zone only with complete measured child boxes and preserves overflow for validation', () => {
    const doc = document();
    setZoneHeight(doc, 'header', 20);
    const zone = hybridZone(doc, 'header');
    if (!zone) throw new Error('Zone missing');
    zone.props.zoneMode = 'FLOW';
    const id = insertNodeInDocument(doc, { type: 'text', props: { text: 'Flow header' } }, 0, [], {
      parentId: zone.id,
    });
    expect(enableFixedZone(doc, 'header', new Map())).toBe(false);
    expect(doc.nodes[id].layout.kind).toBe('FLOW');
    expect(
      enableFixedZone(doc, 'header', new Map([[id, { x: 0, y: 15, width: 90, height: 12 }]])),
    ).toBe(true);
    expect(doc.nodes[id].layout).toMatchObject({ kind: 'ABSOLUTE', y: 15, height: 12 });
    expect(zone.props.zoneMode).toBe('FIXED');
    expect(checkGraph(doc)).toBe(true);
  });

  it('preserves stored dimensions when moving a rotated free item between zones', () => {
    const doc = document();
    setZoneHeight(doc, 'header', 30);
    setZoneHeight(doc, 'footer', 30);
    const header = hybridZone(doc, 'header');
    if (!header) throw new Error('Header missing');
    const id = insertNodeInDocument(doc, { type: 'text', props: { text: 'Rotated' } }, 0, [header.id]);
    updateFrameInDocument(doc, [id], { rotationDeg: 10 });
    expect(moveNodeToPosition(doc, id, 'footer', { x: 180, y: 25, width: 80, height: 20 })).toBe(true);
    expect(doc.nodes[id].layout).toMatchObject({ kind: 'ABSOLUTE', width: 60, height: 8, rotationDeg: 10 });
    expect(doc.nodes[id].parentId).toBe(hybridZone(doc, 'footer')?.id);
    expect(checkGraph(doc)).toBe(true);
  });

  it('resizes a flow column through minHeight while its row percentages keep control of width', () => {
    const doc = document();
    const row = insertNodeInDocument(doc, { type: 'row', props: { stackOnMobile: true, verticalAlign: 'TOP' } }, 0, []);
    const column = insertNodeInDocument(doc, { type: 'column', props: { widthPercent: 100 } }, 0, [], { parentId: row });
    expect(canResizeFlow(doc.nodes[row])).toBe(true);
    expect(resizeFlow(doc, column, 500, 20, 186)).toBe(true);
    expect(doc.nodes[column].layout).toEqual({ kind: 'FLOW', order: 0, minHeight: { value: 20, unit: 'MM' } });
    expect(resizeFlow(doc, column, 20, 20, 0)).toBe(false);
    expect(checkGraph(doc)).toBe(true);
  });
});
