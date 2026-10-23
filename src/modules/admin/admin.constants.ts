/**
 * Path the AdminJS panel is mounted on, under the global `URL_BASE_PATH`.
 */
export function getAdminBasePath(urlBasePath: string): string {
  return urlBasePath + '/admin';
}
