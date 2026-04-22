import { Request, Response } from 'express';
import { ADMIN_BASE_PATH } from '../modules/admin/admin.constants';
import { getForwardedPrefix } from './reverse-proxy.middleware';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rewrites occurrences of `adminRoot` in `body` so they include the proxy
 * `prefix`. Idempotent via negative lookbehind. Only matches `adminRoot`
 * followed by a path-boundary character to avoid rewriting "/administrator".
 */
export function rewriteAdminPaths(
  body: string,
  adminRoot: string,
  prefix: string,
): string {
  if (!prefix || !adminRoot) return body;
  const root = escapeRegex(adminRoot);
  const pfx = escapeRegex(prefix);
  const re = new RegExp(`(?<!${pfx})${root}(?=[\\/"'\`\\s?#\\\\]|$)`, 'g');
  return body.replace(re, `${prefix}${adminRoot}`);
}

/**
 * Patches `res.send` so string bodies (HTML and JSON produced by AdminJS)
 * get admin paths rewritten to include the proxy prefix. No-op when
 * `x-forwarded-prefix` is absent, preserving standalone behaviour.
 *
 * Redirects issued via `res.redirect` are handled by the existing
 * `ReverseProxyMiddleware` (invoked alongside this function), which
 * intercepts `res.setHeader('Location', ...)` globally.
 *
 * Binary assets served via `res.sendFile` are not touched because the
 * AdminJS JS bundles do not contain hardcoded `/admin` strings — they
 * read `rootPath` at runtime from the state injected in the HTML shell.
 */
export function wrapAdminResponse(req: Request, res: Response): void {
  const prefix = getForwardedPrefix(req);
  if (!prefix) return;
  const origSend = res.send.bind(res);
  (res.send as unknown) = function patchedSend(body: unknown): Response {
    if (typeof body === 'string') {
      body = rewriteAdminPaths(body, ADMIN_BASE_PATH, prefix);
      res.removeHeader('content-length');
    }
    return origSend(body as Parameters<Response['send']>[0]);
  };
}
