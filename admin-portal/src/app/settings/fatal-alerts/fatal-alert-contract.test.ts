import { describe, expect, it } from 'vitest';
import {
  buildFatalAlertPatch,
  formFromConfig,
  readFatalAlertConfigEnvelope,
  type RealtimeFatalAlertConfig,
} from './fatal-alert-contract';

const TIMESTAMP = '2026-08-25T02:00:00.000Z';

function configured(): RealtimeFatalAlertConfig {
  return {
    configured: true,
    enabled: false,
    revision: 3,
    webhookUrl: 'https://alerts.example.net/realtime',
    webhookTokenConfigured: true,
    timeoutMs: 5000,
    updatedAt: TIMESTAMP,
  };
}

describe('Realtime fatal-alert settings contract', () => {
  it('builds the exact initial Core patch and keeps the token write-only', () => {
    const current: RealtimeFatalAlertConfig = {
      configured: false,
      enabled: false,
      revision: null,
      webhookUrl: null,
      webhookTokenConfigured: false,
      timeoutMs: 5000,
      updatedAt: null,
    };

    expect(
      buildFatalAlertPatch(
        {
          enabled: true,
          webhookUrl: ' https://alerts.example.net/realtime ',
          timeoutMs: '7000',
        },
        ' write-only-token ',
        current,
      ),
    ).toEqual({
      errors: {},
      dto: {
        enabled: true,
        webhookUrl: 'https://alerts.example.net/realtime',
        webhookToken: 'write-only-token',
        timeoutMs: 7000,
      },
    });
  });

  it('allows switching an existing configuration without resending its token', () => {
    const current = configured();
    expect(
      buildFatalAlertPatch(
        { ...formFromConfig(current), enabled: true },
        '',
        current,
      ),
    ).toEqual({ errors: {}, dto: { enabled: true } });
  });

  it('rejects incomplete setup, embedded URL credentials, and unsafe responses', () => {
    const current: RealtimeFatalAlertConfig = {
      configured: false,
      enabled: false,
      revision: null,
      webhookUrl: null,
      webhookTokenConfigured: false,
      timeoutMs: 5000,
      updatedAt: null,
    };
    expect(
      buildFatalAlertPatch(
        {
          enabled: true,
          webhookUrl: 'https://user:pass@alerts.example.net/realtime',
          timeoutMs: '0',
        },
        '',
        current,
      ).errors,
    ).toEqual({
      webhookUrl: 'INVALID_WEBHOOK_URL',
      webhookToken: 'TOKEN_REQUIRED',
      timeoutMs: 'INVALID_TIMEOUT',
    });

    expect(() =>
      readFatalAlertConfigEnvelope({
        success: true,
        data: { ...configured(), webhookToken: 'must-not-leak' },
        correlationId: 'corr-fatal-alert',
        timestamp: TIMESTAMP,
      }),
    ).toThrow('INVALID_FATAL_ALERT_CONFIG_RESPONSE');
  });

  it('accepts the exact safe Core response projection', () => {
    expect(
      readFatalAlertConfigEnvelope({
        success: true,
        data: configured(),
        correlationId: 'corr-fatal-alert',
        timestamp: TIMESTAMP,
      }).data,
    ).toEqual(configured());
  });
});
