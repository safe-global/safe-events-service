import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { safeCompare } from '../utils/safe-compare';

@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.configService.get('SSE_AUTH_TOKEN', '');
    // If token is not set, authentication is disabled
    return (
      token === '' ||
      safeCompare(request.headers['authorization'], `Basic ${token}`)
    );
  }
}

@Injectable()
export class AdminWebhookGuard implements CanActivate {
  private readonly logger = new Logger(AdminWebhookGuard.name);

  constructor(private readonly configService: ConfigService) {}
  /**
   * Guard to protect webhooks endpoint.
   * @param context
   * @returns
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.configService.get('ADMIN_WEBHOOK_AUTH', '');
    // Deny access when the token is not configured, otherwise the endpoint
    // would be reachable with an empty `Basic ` credential.
    if (token === '') {
      this.logger.error(
        'ADMIN_WEBHOOK_AUTH is not set. Webhook administration endpoints are ' +
          'disabled until it is configured.',
      );
      return false;
    }
    return safeCompare(request.headers['authorization'], `Basic ${token}`);
  }
}
