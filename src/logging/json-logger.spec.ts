import { JsonConsoleLogger } from './json-logger';

describe('JsonLogger', () => {
  it('should return a stringified JSON', async () => {
    const consoleLogger = new JsonConsoleLogger('JsonLoggerTest', {
      timestamp: false,
    });
    const consoleLogSpy = jest.spyOn(process.stdout, 'write');
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => 958694400000);

    expect(dateNowSpy).toBeCalledTimes(0);
    expect(consoleLogSpy).toBeCalledTimes(0);
    consoleLogger.debug('test');
    // Internal logger Date.now() and our Date.now() call
    expect(dateNowSpy).toBeCalledTimes(2);
    expect(consoleLogSpy).toBeCalledTimes(1);
    expect(consoleLogSpy).toBeCalledWith(
      '{"timestamp":"2000-05-19T00:00:00.000Z","context":"JsonLoggerTest","level":"debug","message":"test"}\n',
    );
  });
});
