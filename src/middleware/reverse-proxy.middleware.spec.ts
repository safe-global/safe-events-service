import { Request, Response } from 'express';
import {
  getForwardedPrefix,
  getProxyAwareBaseUrl,
  ReverseProxyMiddleware,
} from './reverse-proxy.middleware';

function makeRequest(
  headers: Record<string, string> = {},
  protocol = 'http',
): Request {
  return { headers, protocol } as unknown as Request;
}

function makeResponse(): {
  res: Response;
  capturedHeaders: Record<string, string | number | readonly string[]>;
} {
  const capturedHeaders: Record<string, string | number | readonly string[]> =
    {};
  const res = {
    setHeader: jest
      .fn()
      .mockImplementation(
        (name: string, value: string | number | readonly string[]) => {
          capturedHeaders[name] = value;
          return res;
        },
      ),
  } as unknown as Response;
  return { res, capturedHeaders };
}

describe('ReverseProxyMiddleware', () => {
  let middleware: ReverseProxyMiddleware;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = new ReverseProxyMiddleware();
    next = jest.fn();
  });

  it('no forwarding headers: passes through and does not modify Location', () => {
    const req = makeRequest();
    const { res, capturedHeaders } = makeResponse();

    middleware.use(req, res, next);
    res.setHeader('Location', '/docs');

    expect(capturedHeaders['Location']).toBe('/docs');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('empty x-forwarded-prefix: passes through and does not modify Location', () => {
    const req = makeRequest({ 'x-forwarded-prefix': '' });
    const { res, capturedHeaders } = makeResponse();

    middleware.use(req, res, next);
    res.setHeader('Location', '/docs');

    expect(capturedHeaders['Location']).toBe('/docs');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('proxy headers without port: rewrites Location to full external URL', () => {
    const req = makeRequest({
      'x-forwarded-prefix': '/my-service',
      'x-forwarded-host': 'proxy.example.com',
      'x-forwarded-proto': 'https',
    });
    const { res, capturedHeaders } = makeResponse();

    middleware.use(req, res, next);
    res.setHeader('Location', '/docs');

    expect(capturedHeaders['Location']).toBe(
      'https://proxy.example.com/my-service/docs',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('proxy headers with port: rewrites Location to full external URL including port', () => {
    const req = makeRequest({
      'x-forwarded-prefix': '/my-service',
      'x-forwarded-host': 'proxy.example.com',
      'x-forwarded-proto': 'https',
      'x-forwarded-port': '8443',
    });
    const { res, capturedHeaders } = makeResponse();

    middleware.use(req, res, next);
    res.setHeader('Location', '/docs/');

    expect(capturedHeaders['Location']).toBe(
      'https://proxy.example.com:8443/my-service/docs/',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not double-prefix an already-prefixed Location', () => {
    const req = makeRequest({ 'x-forwarded-prefix': '/my-service' });
    const { res, capturedHeaders } = makeResponse();

    middleware.use(req, res, next);
    res.setHeader('Location', '/my-service/docs');

    expect(capturedHeaders['Location']).toBe('/my-service/docs');
  });

  it('does not rewrite non-path Location values (e.g. absolute URLs)', () => {
    const req = makeRequest({ 'x-forwarded-prefix': '/my-service' });
    const { res, capturedHeaders } = makeResponse();

    middleware.use(req, res, next);
    res.setHeader('Location', 'https://other.example.com/docs');

    expect(capturedHeaders['Location']).toBe('https://other.example.com/docs');
  });
});

describe('getProxyAwareBaseUrl', () => {
  it('no forwarding headers: returns URL from direct request context', () => {
    const req = makeRequest({ host: 'localhost:3000' });
    expect(getProxyAwareBaseUrl(req)).toBe('http://localhost:3000');
  });

  it('proxy headers without port: returns proxy URL with prefix', () => {
    const req = makeRequest({
      'x-forwarded-prefix': '/my-service',
      'x-forwarded-host': 'proxy.example.com',
      'x-forwarded-proto': 'https',
    });
    expect(getProxyAwareBaseUrl(req)).toBe(
      'https://proxy.example.com/my-service',
    );
  });

  it('proxy headers with port: includes port in the URL', () => {
    const req = makeRequest({
      'x-forwarded-prefix': '/my-service',
      'x-forwarded-host': 'proxy.example.com',
      'x-forwarded-proto': 'https',
      'x-forwarded-port': '8443',
    });
    expect(getProxyAwareBaseUrl(req)).toBe(
      'https://proxy.example.com:8443/my-service',
    );
  });

  it('host already includes port: does not append x-forwarded-port again', () => {
    const req = makeRequest({
      'x-forwarded-prefix': '/svc',
      'x-forwarded-host': 'proxy.example.com:8080',
      'x-forwarded-proto': 'http',
      'x-forwarded-port': '8080',
    });
    expect(getProxyAwareBaseUrl(req)).toBe('http://proxy.example.com:8080/svc');
  });

  it('prefix has trailing slash: strips it', () => {
    const req = makeRequest({
      'x-forwarded-prefix': '/my-service/',
      'x-forwarded-host': 'proxy.example.com',
      'x-forwarded-proto': 'https',
    });
    expect(getProxyAwareBaseUrl(req)).toBe(
      'https://proxy.example.com/my-service',
    );
  });
});

describe('getForwardedPrefix', () => {
  it('returns empty string when header is absent', () => {
    expect(getForwardedPrefix(makeRequest())).toBe('');
  });

  it('returns empty string when header is empty', () => {
    expect(getForwardedPrefix(makeRequest({ 'x-forwarded-prefix': '' }))).toBe(
      '',
    );
  });

  it('strips trailing slashes', () => {
    expect(
      getForwardedPrefix(makeRequest({ 'x-forwarded-prefix': '/my-service/' })),
    ).toBe('/my-service');
  });

  it('returns prefix unchanged when no trailing slash', () => {
    expect(
      getForwardedPrefix(makeRequest({ 'x-forwarded-prefix': '/my-service' })),
    ).toBe('/my-service');
  });
});
