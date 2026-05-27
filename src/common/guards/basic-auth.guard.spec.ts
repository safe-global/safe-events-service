import { ExecutionContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminWebhookGuard } from './basic-auth.guard';

describe('AdminWebhookGuard', () => {
  const buildContext = (headers: Record<string, string> = {}) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as ExecutionContext;

  it('should deny access and log an error when ADMIN_WEBHOOK_AUTH is unset', () => {
    const configService = {
      get: jest.fn().mockReturnValue(''),
    } as unknown as ConfigService;
    const guard = new AdminWebhookGuard(configService);
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const result = guard.canActivate(buildContext({ authorization: 'Basic ' }));

    expect(result).toBe(false);
    expect(loggerSpy).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('ADMIN_WEBHOOK_AUTH is not set'),
    );

    loggerSpy.mockRestore();
  });

  it('should grant access when the authorization header matches the configured token', () => {
    const configService = {
      get: jest.fn().mockReturnValue('secret-token'),
    } as unknown as ConfigService;
    const guard = new AdminWebhookGuard(configService);

    const result = guard.canActivate(
      buildContext({ authorization: 'Basic secret-token' }),
    );

    expect(result).toBe(true);
  });
});
