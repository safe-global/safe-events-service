import { Request, Response } from 'express';
import { rewriteAdminPaths, wrapAdminResponse } from './admin-proxy.middleware';

function makeRequest(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function makeResponse(): {
  res: Response;
  sent: unknown[];
  headers: Record<string, string | number>;
} {
  const state = {
    sent: [] as unknown[],
    headers: {} as Record<string, string | number>,
  };
  const res = {
    getHeader: jest.fn((name: string) => state.headers[name.toLowerCase()]),
    setHeader: jest.fn((name: string, value: string | number) => {
      state.headers[name.toLowerCase()] = value;
      return res;
    }),
    removeHeader: jest.fn((name: string) => {
      delete state.headers[name.toLowerCase()];
    }),
    send: jest.fn((body: unknown) => {
      state.sent.push(body);
      return res;
    }),
  } as unknown as Response;
  return { res, ...state };
}

// ---------------------------------------------------------------------------
// rewriteAdminPaths (pure function)
// ---------------------------------------------------------------------------
describe('rewriteAdminPaths', () => {
  const adminRoot = '/admin';
  const prefix = '/internal/events';

  it('returns body unchanged when prefix is empty', () => {
    const body = '{"rootPath":"/admin"}';
    expect(rewriteAdminPaths(body, adminRoot, '')).toBe(body);
  });

  it('returns body unchanged when adminRoot is empty', () => {
    const body = '{"rootPath":"/admin"}';
    expect(rewriteAdminPaths(body, '', prefix)).toBe(body);
  });

  it('rewrites bare /admin in JSON', () => {
    const body = '{"rootPath":"/admin","loginPath":"/admin/login"}';
    const result = rewriteAdminPaths(body, adminRoot, prefix);
    expect(result).toBe(
      '{"rootPath":"/internal/events/admin","loginPath":"/internal/events/admin/login"}',
    );
  });

  it('rewrites src and href attributes in HTML', () => {
    const body =
      '<script src="/admin/frontend/assets/app.bundle.js"></script>' +
      '<link href="/admin/frontend/assets/style.css">';
    const result = rewriteAdminPaths(body, adminRoot, prefix);
    expect(result).toContain(
      'src="/internal/events/admin/frontend/assets/app.bundle.js"',
    );
    expect(result).toContain(
      'href="/internal/events/admin/frontend/assets/style.css"',
    );
  });

  it('does not double-prefix already-prefixed occurrences', () => {
    const body = '"/internal/events/admin/login" and "/admin/login"';
    const result = rewriteAdminPaths(body, adminRoot, prefix);
    expect(result).toBe(
      '"/internal/events/admin/login" and "/internal/events/admin/login"',
    );
  });

  it('does not rewrite /administrator or /adminxyz', () => {
    const body = '"/administrator" "/adminxyz" "/admin/ok"';
    const result = rewriteAdminPaths(body, adminRoot, prefix);
    expect(result).toContain('"/administrator"');
    expect(result).toContain('"/adminxyz"');
    expect(result).toContain('"/internal/events/admin/ok"');
  });

  it('is idempotent', () => {
    const body = '{"rootPath":"/admin"}';
    const once = rewriteAdminPaths(body, adminRoot, prefix);
    const twice = rewriteAdminPaths(once, adminRoot, prefix);
    expect(twice).toBe(once);
  });

  it('works with URL_BASE_PATH prefix in adminRoot', () => {
    const root = '/v1/admin';
    const body = '{"rootPath":"/v1/admin","loginPath":"/v1/admin/login"}';
    const result = rewriteAdminPaths(body, root, prefix);
    expect(result).toBe(
      '{"rootPath":"/internal/events/v1/admin","loginPath":"/internal/events/v1/admin/login"}',
    );
  });

  it('rewrites window.REDUX_STATE paths', () => {
    const body =
      'window.REDUX_STATE = {"paths":{"rootPath":"/admin","loginPath":"/admin/login","logoutPath":"/admin/logout"}}';
    const result = rewriteAdminPaths(body, adminRoot, prefix);
    expect(result).toContain('"rootPath":"/internal/events/admin"');
    expect(result).toContain('"loginPath":"/internal/events/admin/login"');
    expect(result).toContain('"logoutPath":"/internal/events/admin/logout"');
  });
});

// ---------------------------------------------------------------------------
// wrapAdminResponse (res.send interceptor)
// ---------------------------------------------------------------------------
describe('wrapAdminResponse', () => {
  it('is a no-op without x-forwarded-prefix', () => {
    const req = makeRequest();
    const { res } = makeResponse();
    const origSend = res.send;

    wrapAdminResponse(req, res);

    expect(res.send).toBe(origSend);
  });

  it('rewrites string bodies (HTML)', () => {
    const req = makeRequest({ 'x-forwarded-prefix': '/internal/events' });
    const { res, sent } = makeResponse();

    wrapAdminResponse(req, res);
    res.send('<script src="/admin/app.js"></script>');

    expect(sent[0]).toBe(
      '<script src="/internal/events/admin/app.js"></script>',
    );
  });

  it('rewrites string bodies (JSON)', () => {
    const req = makeRequest({ 'x-forwarded-prefix': '/internal/events' });
    const { res, sent } = makeResponse();

    wrapAdminResponse(req, res);
    res.send('{"rootPath":"/admin"}');

    expect(sent[0]).toBe('{"rootPath":"/internal/events/admin"}');
  });

  it('does not touch non-string bodies', () => {
    const req = makeRequest({ 'x-forwarded-prefix': '/internal/events' });
    const { res, sent } = makeResponse();

    wrapAdminResponse(req, res);
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    res.send(buffer);

    expect(sent[0]).toBe(buffer);
  });

  it('removes stale Content-Length so Express recomputes it', () => {
    const req = makeRequest({ 'x-forwarded-prefix': '/internal/events' });
    const { res } = makeResponse();

    wrapAdminResponse(req, res);
    res.send('/admin/x');

    expect(res.removeHeader).toHaveBeenCalledWith('content-length');
  });

  it('does not remove Content-Length for non-string bodies', () => {
    const req = makeRequest({ 'x-forwarded-prefix': '/internal/events' });
    const { res } = makeResponse();

    wrapAdminResponse(req, res);
    res.send(Buffer.from('binary'));

    expect(res.removeHeader).not.toHaveBeenCalled();
  });
});
