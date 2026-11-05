import { Request } from 'express';
import { getForwardedPrefix } from './forwarded-prefix';

function makeRequest(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

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

  it('accepts multi-segment prefixes with dots and hyphens', () => {
    expect(
      getForwardedPrefix(
        makeRequest({ 'x-forwarded-prefix': '/internal/events-v2.0' }),
      ),
    ).toBe('/internal/events-v2.0');
  });

  it('rejects values with spaces', () => {
    expect(
      getForwardedPrefix(makeRequest({ 'x-forwarded-prefix': '/foo bar' })),
    ).toBe('');
  });

  it('rejects values with query string characters', () => {
    expect(
      getForwardedPrefix(makeRequest({ 'x-forwarded-prefix': '/foo?bar=1' })),
    ).toBe('');
  });

  it('rejects double slashes', () => {
    expect(
      getForwardedPrefix(makeRequest({ 'x-forwarded-prefix': '//evil' })),
    ).toBe('');
  });

  it('rejects values not starting with /', () => {
    expect(
      getForwardedPrefix(
        makeRequest({ 'x-forwarded-prefix': 'javascript:alert(1)' }),
      ),
    ).toBe('');
  });

  it('rejects inline <script> tag', () => {
    expect(
      getForwardedPrefix(
        makeRequest({ 'x-forwarded-prefix': '/foo<script>alert(1)</script>' }),
      ),
    ).toBe('');
  });

  it('rejects encoded script injection (%3Cscript%3E)', () => {
    expect(
      getForwardedPrefix(
        makeRequest({
          'x-forwarded-prefix': '/foo%3Cscript%3Ealert(1)%3C/script%3E',
        }),
      ),
    ).toBe('');
  });
});
