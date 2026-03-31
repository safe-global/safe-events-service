import { timingSafeEqual } from 'crypto';
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
    const emailBuf = Buffer.from(providedEmail);
    const storedEmailBuf = Buffer.from(adminCredentials.email);
    const emailMatch =
      emailBuf.byteLength === storedEmailBuf.byteLength &&
      timingSafeEqual(emailBuf, storedEmailBuf);

    const passwordBuf = Buffer.from(providedPassword);
    const storedPasswordBuf = Buffer.from(adminCredentials.password);
    const passwordMatch =
      passwordBuf.byteLength === storedPasswordBuf.byteLength &&
      timingSafeEqual(passwordBuf, storedPasswordBuf);
    if (emailMatch && passwordMatch) {
      return adminCredentials;
    }
    return undefined;
  }
}
