/* global __SENTRY_DSN__, __SDK_VERSION__ */
/*
 * Sentry client for the SDK's own errors. Loaded on demand by ./sentry.js, so it
 * ends up in a separate file that is only downloaded when an error is reported.
 *
 * The SDK runs on customer websites, so this uses its own isolated Sentry client
 * instead of Sentry.init(): no global error handlers are installed, the host page's
 * errors are never captured, and a Sentry setup on the host page is left alone.
 */
import {
  BrowserClient,
  Scope,
  makeFetchTransport,
  defaultStackParser,
  dedupeIntegration,
  linkedErrorsIntegration,
  httpContextIntegration,
} from '@sentry/browser';

const DSN = __SENTRY_DSN__;
const RELEASE = `its123api-js@${__SDK_VERSION__}`;

let scope = null;
let disabled = !DSN;

function stripUrl(url) {
  return typeof url === 'string' ? url.split(/[?#]/)[0] : url;
}

function beforeSend(event) {
  const result = event;
  if (result.request) {
    result.request.url = stripUrl(result.request.url);
    if (result.request.headers) {
      delete result.request.headers.Referer;
    }
    delete result.request.query_string;
  }
  return result;
}

function getScope(environment) {
  if (disabled) {
    return null;
  }
  if (scope) {
    return scope;
  }

  try {
    const client = new BrowserClient({
      dsn: DSN,
      release: RELEASE,
      environment,
      transport: makeFetchTransport,
      stackParser: defaultStackParser,
      integrations: [
        dedupeIntegration(),
        linkedErrorsIntegration(),
        httpContextIntegration(),
      ],
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
        httpBodies: [],
        urlQueryParams: false,
        stackFrameVariables: false,
      },
      beforeSend,
    });

    scope = new Scope();
    scope.setClient(client);
    client.init();
    scope.setTag('host', window.location.hostname);
  } catch (e) {
    disabled = true;
    scope = null;
  }

  return scope;
}

/**
 * Send an error to Sentry. Never throws. Options: see captureSdkException in ./sentry.js
 * @return {void}
 */
export function capture(error, {
  environment = 'production',
  level = 'error',
  tags = {},
  context = {},
} = {}) {
  const baseScope = getScope(environment);
  if (!baseScope) {
    return;
  }

  try {
    const eventScope = baseScope.clone();
    eventScope.setLevel(level);
    eventScope.setTags(tags);
    eventScope.setContext('its123', context);
    eventScope.captureException(error);
  } catch (e) {
    // Reporting must never break the SDK
  }
}

export default capture;
