import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Agent, RetryAgent } from 'undici';
import {
  buildPublicAddressConnector,
  hasPublicHost,
  isPublicIpAddress,
  lookupPublicAddresses,
  NON_PUBLIC_TARGET_ERROR_CODE,
} from './public-address';

describe('public-address', () => {
  describe('isPublicIpAddress', () => {
    it.each([
      '127.0.0.1',
      '10.43.0.10',
      '172.20.1.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '::',
      '::1',
      '::ffff:127.0.0.1',
      '::ffff:a9fe:a9fe',
      '64:ff9b::7f00:1',
      '::ffff:0:a9fe:a9fe',
      '2002:7f00:1::',
      'fd00::1',
      'fe80::1',
      'ff02::1',
    ])('rejects non public address %s', (ipAddress) => {
      // Private, loopback, link-local, multicast and IPv6 forms that embed IPv4
      expect(isPublicIpAddress(ipAddress)).toBe(false);
    });

    it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
      'accepts public address %s',
      (ipAddress) => {
        // Public addresses, also in IPv4-mapped IPv6 form
        expect(isPublicIpAddress(ipAddress)).toBe(true);
      },
    );

    it('rejects a value that is not an IP address', () => {
      // Hostnames are never treated as public addresses
      expect(isPublicIpAddress('example.com')).toBe(false);
    });
  });

  describe('hasPublicHost', () => {
    it.each([
      'http://localhost:3000/webhook',
      'http://LOCALHOST./webhook',
      'http://api.localhost/webhook',
      'http://safe-transaction-service.default.svc.cluster.local/api',
      'http://safe-transaction-service.default.svc/api',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://127.0.0.1/webhook',
      'http://2130706433/webhook',
      'http://0x7f.0.0.1/webhook',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5:8080/webhook',
      'http://[::1]:8080/webhook',
      'http://[::ffff:127.0.0.1]/webhook',
      'http://[::ffff:0:a9fe:a9fe]/webhook',
      'http://webhook-receiver:8080/webhook',
    ])('rejects %s', (url) => {
      // Internal names, single-label names and non public IPs in any notation
      expect(hasPublicHost(url)).toBe(false);
    });

    it.each([
      'https://example.com/webhook',
      'http://example.com:8080/webhook?token=1',
      'https://8.8.8.8/webhook',
      'https://[2606:4700:4700::1111]/webhook',
    ])('accepts %s', (url) => {
      // Public hostnames and public IPs
      expect(hasPublicHost(url)).toBe(true);
    });
  });

  describe('lookupPublicAddresses', () => {
    function lookup(
      hostname: string,
      all: boolean,
    ): Promise<{ address: unknown; family?: number }> {
      return new Promise((resolve, reject) => {
        lookupPublicAddresses(hostname, { all }, (error, address, family) =>
          error ? reject(error) : resolve({ address, family }),
        );
      });
    }

    it('returns a single public address when `all` is false', async () => {
      // Same result shape as dns.lookup without `all`
      await expect(lookup('8.8.8.8', false)).resolves.toEqual({
        address: '8.8.8.8',
        family: 4,
      });
    });

    it('returns every public address when `all` is true', async () => {
      // Same result shape as dns.lookup with `all`, used by happy eyeballs
      await expect(lookup('8.8.8.8', true)).resolves.toEqual({
        address: [{ address: '8.8.8.8', family: 4 }],
        family: undefined,
      });
    });

    it('fails for a hostname that resolves to a non public address', async () => {
      // localhost resolves to 127.0.0.1 and ::1
      await expect(lookup('localhost', true)).rejects.toMatchObject({
        code: NON_PUBLIC_TARGET_ERROR_CODE,
      });
    });
  });

  describe('buildPublicAddressConnector', () => {
    let server: Server;
    let port: number;
    let receivedRequests: number;

    beforeAll(async () => {
      server = createServer((_request, response) => {
        receivedRequests++;
        response.end('ok');
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      port = (server.address() as AddressInfo).port;
    });

    beforeEach(() => {
      receivedRequests = 0;
    });

    afterAll(async () => {
      await new Promise((resolve) => server.close(resolve));
    });

    it.each([
      'http://127.0.0.1',
      'http://localhost',
      'https://127.0.0.1',
      'https://localhost',
      'http://[::1]',
      'https://[::1]',
    ])(
      'does not connect to a server on %s and does not retry',
      async (origin) => {
        // Covers the IP literal check (IPv4 and bracketed IPv6) and the
        // lookup, over TCP and TLS
        const agent = new RetryAgent(
          new Agent({
            connect: buildPublicAddressConnector({ timeout: 1000 }),
          }),
          { maxRetries: 2, minTimeout: 1, methods: ['POST'] },
        );
        const retrySpy = jest.spyOn(Agent.prototype, 'dispatch');

        await expect(
          agent.request({
            origin: `${origin}:${port}`,
            path: '/',
            method: 'POST',
          }),
        ).rejects.toMatchObject({ code: NON_PUBLIC_TARGET_ERROR_CODE });
        expect(receivedRequests).toBe(0);
        expect(retrySpy).toHaveBeenCalledTimes(1);

        retrySpy.mockRestore();
        await agent.close();
      },
    );

    it('connects to the same server when the guard is not used', async () => {
      // Shows the server is reachable, so the blocked cases fail on the guard
      const agent = new Agent({ connect: { timeout: 1000 } });

      const response = await agent.request({
        origin: `http://localhost:${port}`,
        path: '/',
        method: 'POST',
      });

      expect(response.statusCode).toBe(200);
      expect(await response.body.text()).toBe('ok');
      expect(receivedRequests).toBe(1);
      await agent.close();
    });
  });
});
