import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { safeCompare } from '../../../common/utils/safe-compare';

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
    // Compute both comparisons before combining them so the check does not
    // short-circuit and leak (via timing) whether the email was correct.
    const emailMatch = safeCompare(providedEmail, adminCredentials.email);
    const passwordMatch = safeCompare(
      providedPassword,
      adminCredentials.password,
    );
    if (emailMatch && passwordMatch) {
      return adminCredentials;
    }
    return undefined;
  }
}
