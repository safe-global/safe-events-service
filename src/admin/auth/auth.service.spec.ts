import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

describe('Test auth service', () => {
  let authService: AuthService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [AuthService],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should authenticate with correct parameters', () => {
    const email = configService.getOrThrow('ADMIN_EMAIL');
    const password = configService.getOrThrow('ADMIN_PASSWORD');
    const expected = Promise.resolve({ email, password });
    expect(authService.authenticate(email, password)).toEqual(expected);
  });

  it('should not authenticate with wrong parameters', () => {
    const email = configService.getOrThrow('ADMIN_EMAIL');
    const password = configService.getOrThrow('ADMIN_PASSWORD') + 'b';
    const expected = Promise.resolve(undefined);
    expect(authService.authenticate(email, password)).toEqual(expected);
  });
});
