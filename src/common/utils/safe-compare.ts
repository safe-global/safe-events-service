import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// Per-process random key. Comparing HMAC digests instead of the raw values
// keeps the comparison constant-length (so input length is not leaked through
// timing) and prevents an attacker from precomputing or correlating digests.
const HMAC_KEY = randomBytes(32);

function digest(value: string): Buffer {
  return createHmac('sha256', HMAC_KEY).update(value).digest();
}

/**
 * Constant-time comparison of two values. Avoids leaking the expected value
 * (or its length) through response-timing differences: both inputs are reduced
 * to fixed-length HMAC digests and compared with `timingSafeEqual`, so the same
 * amount of work is done regardless of whether the lengths match. Non-string
 * input (e.g. a missing or array-valued header) compares as a mismatch.
 */
export function safeCompare(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string') {
    return false;
  }
  return timingSafeEqual(digest(provided), digest(expected));
}
