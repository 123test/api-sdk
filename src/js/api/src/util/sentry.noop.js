// Used instead of sentry.js in the legacy (polyfill) build: Sentry does not
// support the old browsers that build targets, so errors are not reported there.
export function captureSdkException() {}

export default captureSdkException;
