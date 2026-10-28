import { Logger } from '@nestjs/common';
import { parseNumberConfig } from './parse-number-config';

describe('parseNumberConfig', () => {
  let loggerWarn: jest.SpyInstance;

  beforeEach(() => {
    loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    loggerWarn.mockRestore();
  });

  it('returns the parsed value', () => {
    expect(parseNumberConfig('KEY', '1500', 100, 0)).toBe(1500);
    expect(loggerWarn).not.toHaveBeenCalled();
  });

  it('accepts a value equal to min', () => {
    expect(parseNumberConfig('KEY', '0', 100, 0)).toBe(0);
  });

  it.each([undefined, ''])(
    'returns the default value without a warning when unset (%p)',
    (value) => {
      expect(parseNumberConfig('KEY', value, 100, 0)).toBe(100);
      expect(loggerWarn).not.toHaveBeenCalled();
    },
  );

  it.each(['abc', '15s', 'Infinity', 'NaN'])(
    'returns the default value and logs a warning for %p',
    (value) => {
      expect(parseNumberConfig('KEY', value, 100, 0)).toBe(100);
      expect(loggerWarn).toHaveBeenCalledWith({
        message: 'Invalid numeric config, falling back to default',
        messageContext: { key: 'KEY', value, defaultValue: 100, min: 0 },
      });
    },
  );

  it('returns the default value and logs a warning below min', () => {
    expect(parseNumberConfig('KEY', '-1', 100, 0)).toBe(100);
    expect(loggerWarn).toHaveBeenCalledTimes(1);
  });
});
