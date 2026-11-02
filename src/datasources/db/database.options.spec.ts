import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EnvironmentVariables } from '../../config/environment';
import { buildSslOptions, sslOptionsFromConfig } from './database.options';

describe('buildSslOptions', () => {
  let dir: string;
  let caPath: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'ssl-options-'));
    caPath = join(dir, 'ca.pem');
    writeFileSync(caPath, 'test-ca');
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns undefined when SSL is disabled', () => {
    // A CA path alone does not turn SSL on
    expect(buildSslOptions(false, caPath)).toBeUndefined();
  });

  it('accepts any certificate when SSL is enabled without a CA', () => {
    // Without a CA file there is nothing to verify the server against
    expect(buildSslOptions(true, undefined)).toEqual({
      rejectUnauthorized: false,
    });
  });

  it('verifies the server with the CA file when one is set', () => {
    // The CA file content is loaded and verification is enforced
    expect(buildSslOptions(true, caPath)).toEqual({
      ca: Buffer.from('test-ca'),
      rejectUnauthorized: true,
    });
  });

  it('fails when the CA file does not exist', () => {
    // A wrong path fails at startup instead of connecting without the CA
    expect(() => buildSslOptions(true, join(dir, 'missing.pem'))).toThrow(
      'ENOENT',
    );
  });

  it('reads the SSL settings from ConfigService', () => {
    // The app and the AdminJS session pool build the options from config
    const values: Partial<EnvironmentVariables> = {
      DATABASE_SSL_ENABLED: true,
      DATABASE_CA_PATH: caPath,
    };
    const configService = {
      get: (key: keyof EnvironmentVariables) => values[key],
    } as unknown as ConfigService<EnvironmentVariables, true>;

    expect(sslOptionsFromConfig(configService)).toEqual({
      ca: Buffer.from('test-ca'),
      rejectUnauthorized: true,
    });
  });
});
