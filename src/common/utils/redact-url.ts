/**
 * Replaces the credentials of a URL so it can be logged. The URL is not parsed:
 * a password with unencoded `#`, `/` or `?` is read by the URL parser as part of
 * the host, path or fragment, and would be logged. Everything between the
 * scheme and the last `@` is hidden instead.
 */
export function redactUrlCredentials(value: string): string {
  const schemeEnd = value.indexOf('://');
  if (schemeEnd === -1) {
    return '<invalid url>';
  }
  const credentialsEnd = value.lastIndexOf('@');
  if (credentialsEnd < schemeEnd) {
    return value;
  }
  return `${value.slice(0, schemeEnd + 3)}***${value.slice(credentialsEnd)}`;
}
