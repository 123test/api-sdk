# Installation instructions 123test API js

1. Run `npm install` to fetch dependencies (Node 20 or newer)
2. Run `npm run build` to build latest src, default destination dir is /dist/js.

## Release build

```
SDK_VERSION=21 npm run build
```

- `SDK_VERSION`: the version folder the build is released as (e.g. `21`). Required; used as the
  Sentry release (`its123api-js@21`).
- Needs a Sentry organization auth token in `.env.sentry-build-plugin` (gitignored):
  `SENTRY_AUTH_TOKEN=...`. The build uploads the source maps to Sentry (project
  `its123test-sdk`) and then deletes them from `dist/js`, so they are not published.
  The build stops if the token is missing or the upload fails.
- `SENTRY_DSN=` (empty) builds without error reporting and without upload.

Upload all files from `dist/js` to the new version folder, including `its123api.sentry.min.js`.

## Error reporting (Sentry)

The Sentry client is built as a separate file, `its123api.sentry.min.js`, which is only
downloaded when an error is reported.

Only SDK errors are sent (never errors from the host page), without personal data: no
respondent ids, IP addresses, access codes, report meta data or URL query strings. Expected API
responses (401, 403, 404, 408, 503) are not reported. The polyfill build (old browsers) never
reports. Errors from api.123test.eu are tagged `test`, from api.123test.info `development`.

Sites can turn reporting off with `new Its123({ ..., errorReporting: false })`, or with
`errorReporting=false` in the loader script URL.
