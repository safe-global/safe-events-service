import { Request } from 'express';

/**
 * Extracts the x-forwarded-prefix header value, stripping trailing slashes.
 * Returns an empty string if the header is absent, empty or not a safe URL
 * path prefix.
 */
export function getForwardedPrefix(req: Request): string {
  const value = req.headers['x-forwarded-prefix'];
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return '';
  const stripped = raw.replace(/\/+$/, '');
  if (!/^(\/[\w.-]+)+$/.test(stripped)) return '';
  return stripped;
}
