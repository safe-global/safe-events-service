import { execFileSync } from 'node:child_process';

const DD_TRACE_IMPORT = '--import dd-trace/initialize.mjs';

function getNodeOptions(environment: Record<string, string>): string {
  return execFileSync(
    'bash',
    ['-c', '. ./scripts/datadog_tracer.sh; printf "%s" "${NODE_OPTIONS:-}"'],
    { env: { PATH: process.env.PATH, ...environment }, encoding: 'utf8' },
  );
}

describe('datadog_tracer.sh', () => {
  it.each(['1', 'true', 'True', 'TRUE', 'yes', 'y', 't', 'on', 'ON'])(
    'loads dd-trace when DD_APM_ENABLED is %p',
    (ddApmEnabled) => {
      expect(getNodeOptions({ DD_APM_ENABLED: ddApmEnabled })).toBe(
        DD_TRACE_IMPORT,
      );
    },
  );

  it.each(['', '0', 'false', 'off', 'no', 'enabled', ' true'])(
    'does not load dd-trace when DD_APM_ENABLED is %p',
    (ddApmEnabled) => {
      expect(getNodeOptions({ DD_APM_ENABLED: ddApmEnabled })).toBe('');
    },
  );

  it('does not load dd-trace when DD_APM_ENABLED is unset', () => {
    expect(getNodeOptions({})).toBe('');
  });

  it('keeps the NODE_OPTIONS already set', () => {
    expect(
      getNodeOptions({
        DD_APM_ENABLED: 'true',
        NODE_OPTIONS: '--max-old-space-size=512',
      }),
    ).toBe(`--max-old-space-size=512 ${DD_TRACE_IMPORT}`);
  });
});
