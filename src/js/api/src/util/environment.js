/**
 * Environment name for an API domain, used to tell test errors apart in Sentry.
 *   api.123test.eu    test
 *   api.123test.info  development (local machines)
 *   anything else     production (api.123test.com, api22.123test.com, ...)
 *
 * @param  {String} domain API domain, with or without protocol
 * @return {String}
 */
export default function getEnvironment(domain = '') {
  const host = String(domain).replace(/^[a-z]+:\/\//i, '').split(/[/:]/)[0].toLowerCase();

  if (/(^|\.)123test\.eu$/.test(host)) {
    return 'test';
  }
  if (/(^|\.)123test\.info$/.test(host) || host === 'localhost' || host === '127.0.0.1') {
    return 'development';
  }
  return 'production';
}
