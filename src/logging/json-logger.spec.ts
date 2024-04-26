import { JsonConsoleLogger } from './json-logger';

const consoleLogSpy = jest.spyOn(process.stdout, 'write');
const dateNowSpy = jest
  .spyOn(Date, 'now')
  .mockImplementation(() => 958694400000);

describe('JsonLogger', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return a stringified JSON', async () => {
    const consoleLogger = new JsonConsoleLogger('JsonLoggerTest', {
      timestamp: false,
    });

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
  it('should return a stringified JSON for a JSON message', async () => {
    const consoleLogger = new JsonConsoleLogger('JsonLoggerTest', {
      timestamp: false,
    });

    //dateNowSpy.mockClear()
    //consoleLogSpy.mockClear()
    expect(dateNowSpy).toBeCalledTimes(0);
    expect(consoleLogSpy).toBeCalledTimes(0);
    consoleLogger.debug({ message: 'testJSON', event: { chainId: 1 } });
    // Internal logger Date.now() and our Date.now() call
    expect(dateNowSpy).toBeCalledTimes(2);
    expect(consoleLogSpy).toBeCalledTimes(1);
    expect(consoleLogSpy).toBeCalledWith(
      '{"timestamp":"2000-05-19T00:00:00.000Z","context":"JsonLoggerTest","level":"debug","message":"testJSON","event":{"chainId":1}}\n',
    );
  });
});
