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

  it('should authenticate with correct parameters', async () => {
    const email = configService.getOrThrow('ADMIN_EMAIL');
    const password = configService.getOrThrow('ADMIN_PASSWORD');
    const expected = { email, password };
    const result = await authService.authenticate(email, password);
    expect(result).toEqual(expected);
  });

  it('should not authenticate with wrong parameters', async () => {
    const email = configService.getOrThrow('ADMIN_EMAIL');
    const password = configService.getOrThrow('ADMIN_PASSWORD') + 'b';
    const expected = undefined;
    const result = await authService.authenticate(email, password);
    expect(result).toEqual(expected);
  });
});
