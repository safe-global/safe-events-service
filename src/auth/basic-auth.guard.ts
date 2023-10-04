import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.configService.get('SSE_AUTH_TOKEN', '');
    // If token is not set, authentication is disabled
    return (
      token === '' || request.headers['authorization'] === `Basic ${token}`
    );
  }
}
