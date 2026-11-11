/* global __SENTRY_DSN__ */
/*
 * Error reporting to Sentry for the SDK itself.
 *
 * The Sentry client (./sentry.client.js) is large, so it is built as a separate file
 * (its123api.sentry.min.js, next to the SDK) and only downloaded when the first error
 * is reported. Visitors without errors never load it.
 */

let clientModule = null;
let disabled = !__SENTRY_DSN__;

function loadClient() {
  if (disabled) {
    return null;
  }

  if (!clientModule) {
    if (typeof Promise === 'undefined' || typeof window.fetch === 'undefined') {
      disabled = true;
      return null;
    }

    clientModule = import(/* webpackChunkName: "its123api.sentry" */ './sentry.client')
      .catch(() => {
        disabled = true;
        return null;
      });
  }

  return clientModule;
}

/**
 * Report an SDK error to Sentry. Never throws, and does nothing when no DSN was set
 * at build time.
 *
 * @param  {Error}  error
 * @param  {Object} [options]
 * @param  {String} [options.environment='production']
 * @param  {String} [options.level='error']  'error' or 'warning'
 * @param  {Object} [options.tags={}]        Searchable key/values (no personal data)
 * @param  {Object} [options.context={}]     Extra data shown on the event (no personal data)
 * @return {void}
 */
export function captureSdkException(error, options) {
  try {
    const loading = loadClient();
    if (loading) {
      loading
        .then((client) => {
          if (client) {
            client.capture(error, options);
          }
        })
        .catch(() => {});
    }
  } catch (e) {
    // Reporting must never break the SDK
  }
}

export default captureSdkException;
