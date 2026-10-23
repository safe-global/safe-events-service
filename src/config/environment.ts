// Type conversion reads the property types emitted as metadata
import 'reflect-metadata';
import { ConfigModuleOptions } from '@nestjs/config';
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum Environment {
  Production = 'production',
  Development = 'development',
  Dev = 'dev',
  Test = 'test',
}

// `log` is an alias of `info`, kept for deployments that use NestJS level names
export enum LogLevel {
  Trace = 'trace',
  Debug = 'debug',
  Log = 'log',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  Fatal = 'fatal',
}

/**
 * Implicit conversion turns every non-empty string into `true`, including
 * `"false"`, so booleans are parsed from the raw value. Anything other than
 * `true`/`false` (any case) is kept as is and fails `@IsBoolean`.
 */
export function parseBoolean(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return value;
}

const ToBoolean = () => Transform(({ obj, key }) => parseBoolean(obj[key]));

/**
 * Every environment variable the service reads, with its type, constraints and
 * default. The README configuration table documents the same variables.
 *
 * Values are converted from strings, so `ConfigService.get(KEY, { infer: true })`
 * returns the type declared here.
 */
export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV!: Environment;

  @IsString()
  @Matches(/^(\/[\w.~-]+)*$/, {
    message:
      'URL_BASE_PATH must be empty or a path like "/v1", without a trailing "/" or query',
  })
  URL_BASE_PATH: string = '';

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.Info;

  @IsOptional()
  @IsString()
  BUILD_COMMIT?: string;

  // Database
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @ToBoolean()
  @IsBoolean()
  DATABASE_SSL_ENABLED: boolean = false;

  @IsOptional()
  @IsString()
  DATABASE_CA_PATH?: string;

  @IsInt()
  @Min(1)
  DB_HEALTH_CHECK_TIMEOUT: number = 5_000;

  // RabbitMQ
  @IsString()
  @IsNotEmpty()
  AMQP_URL!: string;

  @IsString()
  AMQP_EXCHANGE: string = 'safe-transaction-service-events-with-topics';

  @IsString()
  AMQP_QUEUE: string = 'safe-events-service';

  // 0 means unlimited in AMQP, which removes the bound on concurrent webhook
  // requests per host
  @IsInt()
  @Min(1)
  AMQP_PREFETCH_MESSAGES: number = 100;

  // Admin panel and webhook management API
  @IsString()
  @IsNotEmpty()
  ADMIN_EMAIL!: string;

  @IsString()
  @IsNotEmpty()
  ADMIN_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  ADMIN_COOKIE_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  ADMIN_SESSION_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  ADMIN_WEBHOOK_AUTH!: string;

  // An empty token disables authentication for the SSE endpoint
  @IsString()
  SSE_AUTH_TOKEN: string = '';

  // Events
  @ToBoolean()
  @IsBoolean()
  EVENTS_LOG_ENABLED: boolean = true;

  // Webhook HTTP client. undici reads NaN as unset and a NaN retry limit is
  // never reached, so these must be real numbers.
  @IsInt()
  @Min(1)
  HTTP_TIMEOUT: number = 5_000;

  // 0 disables retries
  @IsInt()
  @Min(0)
  HTTP_MAX_RETRIES: number = 2;

  @IsInt()
  @Min(1)
  HTTP_KEEP_ALIVE_TIMEOUT: number = 60_000;

  // Unset leaves the pool uncapped
  @IsOptional()
  @IsInt()
  @Min(1)
  HTTP_CONNECTIONS_PER_HOST?: number;

  // 0 keeps connections until they go idle
  @IsInt()
  @Min(0)
  HTTP_CLIENT_TTL: number = 600_000;

  // Webhook health
  @ToBoolean()
  @IsBoolean()
  WEBHOOK_AUTO_DISABLE: boolean = false;

  @IsNumber()
  @Min(0)
  @Max(100)
  WEBHOOK_FAILURE_THRESHOLD: number = 90;

  @IsInt()
  @Min(1)
  WEBHOOK_HEALTH_MINUTES_WINDOW: number = 60;

  @IsInt()
  @Min(0)
  WEBHOOK_MAX_RESPONSE_BYTES: number = 10_000;
}

/**
 * Validates the environment at startup, so a missing or malformed variable
 * stops the app before it connects to anything. An empty or whitespace-only
 * value is treated as unset, so it gets the default or fails when the variable
 * is required.
 */
export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const nonEmpty = Object.fromEntries(
    Object.entries(config).filter(
      ([, value]) => !(typeof value === 'string' && value.trim() === ''),
    ),
  );
  const validated = plainToInstance(EnvironmentVariables, nonEmpty, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated);
  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }
  return validated;
}

/**
 * `skipProcessEnv` makes `get()` return only validated values. Otherwise a key
 * missing from the validated config, like an empty optional variable, falls
 * back to the raw string in `process.env`.
 */
export const configModuleOptions: ConfigModuleOptions = {
  isGlobal: true,
  validate,
  skipProcessEnv: true,
};
