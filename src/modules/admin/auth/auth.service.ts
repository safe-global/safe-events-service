import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}

  getAdminEmail(): string {
    return this.configService.getOrThrow('ADMIN_EMAIL');
  }

  getAdminPassword(): string {
    return this.configService.getOrThrow('ADMIN_PASSWORD');
  }

  async authenticate(
    providedEmail: string,
    providedPassword: string,
  ): Promise<{ email: string; password: string } | undefined> {
    const email = this.getAdminEmail();
    const password = this.getAdminPassword();
    const adminCredentials = { email, password };
    if (
      providedEmail === adminCredentials.email &&
      providedPassword === adminCredentials.password
    ) {
      return adminCredentials;
    }
    return undefined;
  }
}
