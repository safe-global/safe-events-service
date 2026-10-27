import { Environment } from '../../config/environment';
import { isSchemaSyncEnabled } from './database.provider';

describe('isSchemaSyncEnabled', () => {
  it.each([
    [Environment.Production, false],
    [Environment.Dev, true],
    [Environment.Development, true],
    [Environment.Test, true],
  ])('%s -> %s', (nodeEnv, expected) => {
    expect(isSchemaSyncEnabled(nodeEnv)).toBe(expected);
  });
});
