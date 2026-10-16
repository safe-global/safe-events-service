import { Logger } from '@nestjs/common';

const logger = new Logger('Config');

/**
 * Parses a numeric config value. `Number()` alone turns a typo into `NaN`,
 * which timers and libraries read as 0 or as unset without any error. A value
 * that does not parse, or one below `min`, falls back to `fallback` and is
 * logged.
 */
export function parseNumberConfig(
  key: string,
  value: string | undefined,
  fallback: number,
  min: number,
): number {
  if (value == null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= min) {
    return parsed;
  }
  logger.warn({
    message: 'Invalid numeric config, falling back to default',
    messageContext: { key, value, fallback, min },
  });
  return fallback;
}
