import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Extracts the x-forwarded-prefix header value, stripping trailing slashes.
 * Returns an empty string if the header is absent or empty.
 */
function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function getForwardedPrefix(req: Request): string {
  const raw = header(req, 'x-forwarded-prefix');
  if (!raw) return '';
  const stripped = raw.replace(/\/+$/, '');
  // Reject values that aren't a safe URL path prefix
  if (!/^(\/[\w.-]+)+$/.test(stripped)) return '';
  return stripped;
}

/**
 * Builds a proxy-aware base URL from reverse-proxy forwarding headers.
 *
 * When headers are present the URL is constructed as:
 *   {x-forwarded-proto}://{x-forwarded-host}[:{x-forwarded-port}]{x-forwarded-prefix}
 *
 * Falls back to the direct request values when headers are absent.
 *
 * Use this utility wherever the service needs to generate absolute URLs in
 * responses (e.g. pagination next/previous links) so they point to the
 * externally visible address instead of the internal host.
 */
export function getProxyAwareBaseUrl(req: Request): string {
  const prefix = getForwardedPrefix(req);
  const proto = header(req, 'x-forwarded-proto') || req.protocol;
  const host =
    header(req, 'x-forwarded-host') || header(req, 'host') || 'localhost';
  const port = header(req, 'x-forwarded-port');

  const effectiveHost = port && !host.includes(':') ? `${host}:${port}` : host;

  return `${proto}://${effectiveHost}${prefix}`;
}

/**
 * Middleware that rewrites Location headers in redirect responses to respect
 * the x-forwarded-prefix sent by an upstream reverse proxy.
 *
 * Without this, a redirect like `302 Location: /docs` would send the client
 * to the internal path instead of the externally-routed path. With the
 * middleware and a prefix of `/my-service`, the header becomes
 * `Location: /my-service/docs`.
 *
 * When x-forwarded-prefix is absent or empty the middleware is a no-op and
 * existing behaviour is preserved.
 */
@Injectable()
export class ReverseProxyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const prefix = getForwardedPrefix(req);

    if (prefix) {
      const originalSetHeader = res.setHeader.bind(res);
      const baseUrl = getProxyAwareBaseUrl(req);

      (res.setHeader as unknown) = (
        name: string,
        value: string | number | readonly string[],
      ): Response => {
        if (
          name.toLowerCase() === 'location' &&
          typeof value === 'string' &&
          value.startsWith('/') &&
          !value.startsWith(`${prefix}/`)
        ) {
          value = `${baseUrl}${value}`;
        }
        return originalSetHeader(name, value as string | number | string[]);
      };
    }

    next();
  }
}
