import { redactUrlCredentials } from './redact-url';

describe('redactUrlCredentials', () => {
  it('hides user and password', () => {
    /** Host, port and vhost stay, the credentials do not. */
    expect(redactUrlCredentials('amqps://user:p%40ss@rabbitmq:5671/%2F')).toBe(
      'amqps://***@rabbitmq:5671/%2F',
    );
  });

  it('hides a token used as user', () => {
    /** Some brokers take an API key as the user part. */
    expect(redactUrlCredentials('amqps://api-key@rabbitmq')).toBe(
      'amqps://***@rabbitmq',
    );
  });

  it.each([
    'amqp://admin:1234#s3cret@rabbitmq',
    'amqp://admin:12/s@cret@rabbitmq',
  ])('hides an unencoded password in %s', (url) => {
    /** A URL parser reads these passwords as port, path or fragment. */
    expect(redactUrlCredentials(url)).toBe('amqp://***@rabbitmq');
  });

  it('keeps a URL without credentials as is', () => {
    /** Nothing to hide, so the URL is logged unchanged. */
    expect(redactUrlCredentials('amqp://localhost:5672')).toBe(
      'amqp://localhost:5672',
    );
  });

  it('hides a value without scheme', () => {
    /** It can still hold credentials, so it is never returned. */
    expect(redactUrlCredentials('user:secret@rabbitmq')).toBe('<invalid url>');
  });
});
