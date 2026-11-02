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
  ): Promise<{ email: string } | null> {
    const email = this.getAdminEmail();
    // Compute both comparisons before combining them so the check does not
    // short-circuit and leak (via timing) whether the email was correct.
    const emailMatch = safeCompare(providedEmail, email);
    const passwordMatch = safeCompare(
      providedPassword,
      this.getAdminPassword(),
    );
    // AdminJS stores the returned admin in the session and sends it to the
    // browser, so it must not hold the password
    if (emailMatch && passwordMatch) {
      return { email };
    }
    return null;
  }
}
