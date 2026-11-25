import { lookup as dnsLookup } from 'node:dns';
import { BlockList, isIP, LookupFunction } from 'node:net';
import { buildConnector } from 'undici';

// Ranges that are not reachable on the public internet (IANA special-purpose
// registries), plus the IPv6 ranges that embed an IPv4 address
const NON_PUBLIC_SUBNETS: ReadonlyArray<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
  ['::', 96],
  ['::ffff:0:0:0', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
];

const NON_PUBLIC_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.svc',
];

const nonPublicAddresses = new BlockList();
for (const [network, prefix] of NON_PUBLIC_SUBNETS) {
  nonPublicAddresses.addSubnet(
    network,
    prefix,
    isIP(network) === 4 ? 'ipv4' : 'ipv6',
  );
}

export const NON_PUBLIC_TARGET_ERROR_CODE = 'ERR_WEBHOOK_TARGET_NOT_PUBLIC';

class NonPublicTargetError extends Error {
  readonly code = NON_PUBLIC_TARGET_ERROR_CODE;
}

export function isPublicIpAddress(ipAddress: string): boolean {
  const family = isIP(ipAddress);
  if (family === 0) {
    return false;
  }
  return !nonPublicAddresses.check(ipAddress, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * Best-effort check on save, without resolving the host. The connect-time
 * check is the one that blocks delivery. Single-label names are rejected
 * because the Kubernetes DNS search path resolves them to cluster services.
 */
export function hasPublicHost(url: string): boolean {
  const hostname = new URL(url).hostname
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\.$/, '');
  if (isIP(hostname) !== 0) {
    return isPublicIpAddress(hostname);
  }
  return (
    hostname.includes('.') &&
    !NON_PUBLIC_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}

/**
 * Fails the lookup when any resolved address is not public, so a hostname
 * with mixed records cannot be used to reach an internal address.
 */
export const lookupPublicAddresses: LookupFunction = (
  hostname,
  lookupOptions,
  callback,
) => {
  dnsLookup(
    hostname,
    { ...lookupOptions, all: true },
    (lookupError, resolvedAddresses) => {
      if (lookupError) {
        callback(lookupError, '');
        return;
      }
      const nonPublicAddress = resolvedAddresses.find(
        ({ address }) => !isPublicIpAddress(address),
      );
      if (nonPublicAddress) {
        callback(
          new NonPublicTargetError(
            `${hostname} resolves to ${nonPublicAddress.address}, which is not a public address`,
          ),
          '',
        );
        return;
      }
      if (lookupOptions.all) {
        callback(null, resolvedAddresses);
      } else {
        callback(
          null,
          resolvedAddresses[0].address,
          resolvedAddresses[0].family,
        );
      }
    },
  );
};

/**
 * The address is checked on every connect, after DNS resolution, so it also
 * covers webhooks saved from the admin panel, which skips the URL check, and
 * hostnames whose records change after the webhook is saved. IP literal hosts
 * never go through the lookup, so they are checked here.
 */
export function buildPublicAddressConnector(
  options: buildConnector.BuildOptions,
): buildConnector.connector {
  const connect = buildConnector({ ...options, lookup: lookupPublicAddresses });
  return (connectOptions, callback) => {
    const { hostname } = connectOptions;
    if (isIP(hostname) !== 0 && !isPublicIpAddress(hostname)) {
      callback(
        new NonPublicTargetError(`${hostname} is not a public address`),
        null,
      );
      return;
    }
    connect(connectOptions, callback);
  };
}
