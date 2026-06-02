import { Request, Response } from 'express';
import { ADMIN_BASE_PATH } from '../modules/admin/admin.constants';
import {
  getForwardedPrefix,
  patchLocationHeader,
} from './reverse-proxy.middleware';

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

/**
 * Patches `res.sendFile` so AdminJS's static frontend bundles are served
 * instead of 404ing.
 *
 * `@adminjs/express` serves its assets with `res.sendFile(path.resolve(src))`
 * and no options. Under pnpm those assets live in `node_modules/.pnpm/...`,
 * and the `.pnpm` segment is a dotfile. Express 5's `res.sendFile` delegates
 * to `send`, whose default `dotfiles: 'ignore'` makes any absolute path
 * containing a dot-segment resolve to `404 Not Found` — so every AdminJS
 * bundle (JS/CSS/fonts) fails to load and the admin UI renders blank.
 *
 * We force `dotfiles: 'allow'` for the asset paths AdminJS serves. These are
 * fixed, package-internal files (never user-controlled), so allowing dotfiles
 * here is safe. `@adminjs/express` only ever calls `sendFile(path)` with a
 * single argument, so that is the only shape we need to handle.
 */
export function patchAdminAssetDotfiles(res: Response): void {
  const origSendFile = res.sendFile.bind(res);
  (res.sendFile as unknown) = (path: string): void => {
    origSendFile(path, { dotfiles: 'allow' });
  };
}

/**
 * Single entry point for every response adaptation AdminJS needs. AdminJS
 * mounts its own Express router ahead of Nest's middleware, so these are
 * applied by wrapping the admin layer's handler in `main.ts` rather than via
 * `MiddlewareConsumer`.
 *
 *  - {@link patchLocationHeader}: rewrites `res.redirect` Location headers
 *    (login/logout) to include the proxy prefix.
 *  - {@link wrapAdminResponse}: rewrites `res.send` HTML/JSON bodies that
 *    hardcode the internal `rootPath` to include the proxy prefix.
 *  - {@link patchAdminAssetDotfiles}: makes `res.sendFile` serve AdminJS's
 *    pnpm-hosted static bundles instead of 404ing on the `.pnpm` dotfile.
 *
 * The first two are no-op without `x-forwarded-prefix`; the dotfile patch
 * always applies.
 */
export function patchAdminResponse(req: Request, res: Response): void {
  patchLocationHeader(req, res);
  wrapAdminResponse(req, res);
  patchAdminAssetDotfiles(res);
}
