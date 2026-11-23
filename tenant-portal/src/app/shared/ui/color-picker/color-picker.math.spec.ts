import { describe, expect, it } from 'vitest';
import {
  alphaByteToPercent,
  alphaPercentToByte,
  formatHslString,
  formatRgbString,
  hslToHsv,
  hslToRgb,
  hsvToHex,
  hsvToHsl,
  hsvToRgb,
  normalizeColor,
  parseColor,
  parseColorText,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
} from './color-picker.math';

describe('color-picker.math', () => {
  it('round-trips hex <-> rgb <-> hsv <-> hsl across representative colours', () => {
    const samples = [
      '#000000',
      '#FFFFFF',
      '#808080',
      '#FF0000',
      '#00FF00',
      '#0000FF',
      '#FFFF00',
      '#00FFFF',
      '#FF00FF',
      '#1D56C9',
      '#0F2F78',
      '#DBEAFE',
      '#1E40AF',
      '#1FBF75',
    ];

    for (const hex of samples) {
      const rgb = parseColor(hex);
      expect(rgb).not.toBeNull();
      if (!rgb) continue;

      const hsv = rgbToHsv(rgb);
      const rgbFromHsv = hsvToRgb(hsv);
      expect(rgbToHex(rgbFromHsv)).toBe(hex);

      const hsl = rgbToHsl(rgb);
      const rgbFromHsl = hslToRgb(hsl);
      expect(rgbToHex(rgbFromHsl)).toBe(hex);

      const hslViaHsv = hsvToHsl(hsv);
      const hsvBack = hslToHsv(hslViaHsv);
      expect(hsvToHex(hsvBack)).toBe(hex);
    }
  });

  it('handles edge cases: 0 and 360 hue, greyscale, black, white, and alpha 0 / 100', () => {
    expect(hsvToHex({ h: 0, s: 100, v: 100, a: 100 })).toBe('#FF0000');
    expect(hsvToHex({ h: 360, s: 100, v: 100, a: 100 })).toBe('#FF0000');

    const grey = parseColor('#7F7F7F');
    expect(grey).not.toBeNull();
    if (grey) {
      const hsv = rgbToHsv(grey);
      expect(hsv.h).toBe(0);
      expect(hsv.s).toBe(0);
      const hsl = rgbToHsl(grey);
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(0);
    }

    expect(hsvToHex({ h: 210, s: 0, v: 0, a: 100 })).toBe('#000000');
    expect(hsvToHex({ h: 210, s: 0, v: 100, a: 100 })).toBe('#FFFFFF');

    expect(hsvToHex({ h: 0, s: 100, v: 100, a: 0 }, true)).toBe('#FF000000');
    expect(hsvToHex({ h: 0, s: 100, v: 100, a: 0 }, false)).toBe('#FF0000');
    expect(alphaPercentToByte(0)).toBe(0);
    expect(alphaPercentToByte(100)).toBe(255);
    expect(Math.round(alphaByteToPercent(0))).toBe(0);
    expect(Math.round(alphaByteToPercent(255))).toBe(100);
  });

  it('preserves 8-digit hex alpha bytes losslessly when allowAlpha is true', () => {
    for (const hex8 of ['#1D56C900', '#1D56C901', '#1D56C944', '#1D56C980', '#1D56C9FE']) {
      expect(normalizeColor(hex8, true)).toBe(hex8);
      expect(normalizeColor(hex8, false)).toBe('#1D56C9');
    }
    expect(normalizeColor('#1D56C9FF', true)).toBe('#1D56C9');
  });

  it('parses and normalises #RGB, #RGBA, #RRGGBB, #RRGGBBAA, rgb()/rgba(), and hsl()/hsla()', () => {
    expect(normalizeColor('#f0a')).toBe('#FF00AA');
    expect(normalizeColor('#f0a8', true)).toBe('#FF00AA88');
    expect(normalizeColor('#f0a8', false)).toBe('#FF00AA');
    expect(normalizeColor('  #1d56c9  ')).toBe('#1D56C9');
    expect(normalizeColor('rgb(29, 86, 201)')).toBe('#1D56C9');
    expect(normalizeColor('rgb(29 86 201 / 50%)')).toBe('#1D56C980');
    expect(normalizeColor('rgba(255, 0, 0, 0.5)', true)).toBe('#FF000080');
    expect(normalizeColor('rgba(255, 0, 0, 0.5)', false)).toBe('#FF0000');
    expect(normalizeColor('rgb(100%, 0%, 0%)')).toBe('#FF0000');
    expect(normalizeColor('hsl(120, 100%, 50%)')).toBe('#00FF00');
    expect(normalizeColor('hsl(360deg, 100%, 50%)')).toBe('#FF0000');
    expect(normalizeColor('hsl(-120, 100%, 50%)')).toBe('#0000FF');
    expect(normalizeColor('hsla(240, 100%, 50%, 0)', true)).toBe('#0000FF00');
    expect(normalizeColor('hsl(240 100% 50% / 100%)', true)).toBe('#0000FF');
  });

  it('parses bare hex in parseColorText while respecting allowAlpha', () => {
    const rgb6 = parseColorText('1d56c9', false);
    expect(rgb6 ? rgbToHex(rgb6, false) : null).toBe('#1D56C9');

    const rgb3 = parseColorText('f0a', false);
    expect(rgb3 ? rgbToHex(rgb3, false) : null).toBe('#FF00AA');

    expect(parseColorText('ff000080', false)).toBeNull();
    expect(parseColorText('#ff000080', false)).toBeNull();

    const rgb8 = parseColorText('ff000080', true);
    expect(rgb8 ? rgbToHex(rgb8, true) : null).toBe('#FF000080');
  });

  it('rejects malformed and out-of-range colour strings', () => {
    const invalidInputs = [
      '',
      '   ',
      'red',
      'transparent',
      'currentColor',
      '#1',
      '#12',
      '#12345',
      '#1234567',
      '#123456789',
      '##123456',
      '#GGGGGG',
      '123456',
      'rgb()',
      'rgb(10, 20)',
      'rgb(256, 0, 0)',
      'rgb(-1, 0, 0)',
      'rgb(10, 20, 30, 40, 50)',
      'rgb(10 20 30 0.5)',
      'rgba(10 20 30 0.5)',
      'rgb(10, 20, 30 / 50%)',
      'rgba(10, 20, 30, 1.5)',
      'rgba(10, 20, 30, -0.1)',
      'rgba(10, 20, 30, 120%)',
      'hsl(120, 50, 50)',
      'hsl(120, 150%, 50%)',
      'hsl(120, 50%, -5%)',
      'hsla(120, 50%, 50%, 2)',
      'hsl(120 50% 50% 0.5)',
      'hsla(120 50% 50% 0.5)',
    ];

    for (const bad of invalidInputs) {
      expect(parseColor(bad)).toBeNull();
    }
    expect(parseColor(null)).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });

  it('formats rgb and hsl strings with and without alpha', () => {
    expect(formatRgbString({ r: 29, g: 86, b: 201, a: 100 })).toBe('rgb(29, 86, 201)');
    expect(formatRgbString({ r: 29, g: 86, b: 201, a: 50 }, true)).toBe('rgba(29, 86, 201, 50%)');
    expect(formatRgbString({ r: 29, g: 86, b: 201, a: 50 }, false)).toBe('rgb(29, 86, 201)');

    expect(formatHslString({ h: 220, s: 75, l: 45, a: 100 })).toBe('hsl(220, 75%, 45%)');
    expect(formatHslString({ h: 220, s: 75, l: 45, a: 25 }, true)).toBe('hsla(220, 75%, 45%, 25%)');
    expect(formatHslString({ h: 220, s: 75, l: 45, a: 25 }, false)).toBe('hsl(220, 75%, 45%)');
  });

  it('round-trips formatted CSS without losing RGB channels or any alpha byte', () => {
    for (let alpha = 0; alpha <= 255; alpha += 1) {
      const hex = `#1D56C9${alpha.toString(16).padStart(2, '0').toUpperCase()}`;
      const rgb = parseColor(hex);
      if (!rgb) throw new Error(`Expected valid colour ${hex}`);
      const expected = alpha === 255 ? '#1D56C9' : hex;
      expect(normalizeColor(formatRgbString(rgb))).toBe(expected);
      expect(normalizeColor(formatHslString(rgbToHsl(rgb)))).toBe(expected);
    }
  });
});
