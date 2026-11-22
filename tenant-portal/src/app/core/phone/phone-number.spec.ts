import { describe, expect, it } from 'vitest';
import { toDialable, toSipTarget } from './phone-number';

describe('phone-number', () => {
  describe('toDialable', () => {
    it('strips spaces and dashes while preserving leading +', () => {
      expect(toDialable('+20 100-555 0142')).toBe('+201005550142');
    });

    it('strips brackets, dots, and letters', () => {
      expect(toDialable('+20 (100) 555.0142 ext')).toBe('+201005550142');
      expect(toDialable('(02) 2555-0100')).toBe('0225550100');
    });

    it('keeps * and # DTMF/feature characters', () => {
      expect(toDialable('*123#45#')).toBe('*123#45#');
    });

    it('removes non-leading + signs and handles empty input', () => {
      expect(toDialable('12+34+5')).toBe('12345');
      expect(toDialable('++20 100')).toBe('+20100');
      expect(toDialable('tel:+20-100-555-0142')).toBe('+201005550142');
      expect(toDialable(null)).toBe('');
      expect(toDialable('')).toBe('');
      expect(toDialable('   ---  ')).toBe('');
    });
  });

  describe('toSipTarget', () => {
    it('preserves existing sip: URIs', () => {
      expect(toSipTarget('sip:1001@pbx.example.com', 'other.domain')).toBe('sip:1001@pbx.example.com');
      expect(toSipTarget('SIP:1001@pbx.example.com', 'other.domain')).toBe('sip:1001@pbx.example.com');
    });

    it('prefixes sip: when target already includes @domain', () => {
      expect(toSipTarget('1001@pbx.example.com', 'fallback.domain')).toBe('sip:1001@pbx.example.com');
    });

    it('builds sip:<dialable>@<sipDomain> for plain and formatted numbers', () => {
      expect(toSipTarget('+20 100-555 0142', 'pbx.example.com')).toBe('sip:+201005550142@pbx.example.com');
      expect(toSipTarget('*99#', 'pbx.example.com')).toBe('sip:*99#@pbx.example.com');
      expect(toSipTarget('   ', 'pbx.example.com')).toBe('');
    });
  });
});
