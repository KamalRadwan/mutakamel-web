/**
 * Structured client logger with trace→fatal levels, matching the backend's
 * @mutakamel/logger level set. Redacts fields that look like secrets before
 * they ever reach console output, since WebPhone SIP passwords and other
 * credentials must never be written to logs (see AGENTS.md "WebPhone Security").
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

// Matches e.g. sipPassword/sip_password without over-redacting benign SIP
// fields like sipUsername/sipDomain/sipUri.
const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|credential|authorization|api[_-]?key/i;

const LOG_LEVEL_STORAGE_KEY = 'mutakamel:log-level';

const DEFAULT_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug';

function isLogLevel(value: string | null): value is LogLevel {
  return value !== null && value in LEVEL_ORDER;
}

function currentLevel(): LogLevel {
  if (typeof window === 'undefined') {
    return DEFAULT_LEVEL;
  }
  try {
    const override = window.localStorage.getItem(LOG_LEVEL_STORAGE_KEY);
    if (isLogLevel(override)) {
      return override;
    }
  } catch {
    // Storage unavailable (private browsing, disabled storage) — use default.
  }
  return DEFAULT_LEVEL;
}

function redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? '[redacted]'
      : redact(val, seen);
  }
  return redacted;
}

function emit(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel()]) {
    return;
  }
  const safeContext = context ? (redact(context) as Record<string, unknown>) : undefined;
  const args = safeContext ? [message, safeContext] : [message];
  switch (level) {
    case 'trace':
    case 'debug':
      console.debug(`[${level}]`, ...args);
      return;
    case 'info':
      console.info(`[${level}]`, ...args);
      return;
    case 'warn':
      console.warn(`[${level}]`, ...args);
      return;
    case 'error':
    case 'fatal':
      console.error(`[${level}]`, ...args);
      return;
  }
}

export const logger = {
  trace: (message: string, context?: Record<string, unknown>) =>
    emit('trace', message, context),
  debug: (message: string, context?: Record<string, unknown>) =>
    emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    emit('error', message, context),
  fatal: (message: string, context?: Record<string, unknown>) =>
    emit('fatal', message, context),
};
