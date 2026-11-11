const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');

const SENTRY_ORG = '123test-bv-uk';
const SENTRY_PROJECT = 'its123test-sdk';
const DEFAULT_DSN = 'https://78b9d1d0757d83d176570663be9bbd7e@o4511727076573184.ingest.de.sentry.io/4512344455839824';

function sentrySetupError(reason) {
  return new Error([
    `Release build stopped: ${reason}`,
    '',
    'Source maps must be uploaded to Sentry for readable stack traces. To configure it:',
    `  1. In Sentry (org ${SENTRY_ORG}), create a token: Settings > Developer Settings > Organization Tokens`,
    '  2. Put it in src/js/api/.env.sentry-build-plugin (gitignored) as: SENTRY_AUTH_TOKEN=<token>',
    `  3. Check that project "${SENTRY_PROJECT}" exists and the token belongs to org ${SENTRY_ORG}`,
    '  4. Run the build again: SDK_VERSION=<version> npm run build',
    '',
    'To build without error reporting (and without upload) instead: SENTRY_DSN= SDK_VERSION=<version> npm run build',
  ].join('\n'));
}

// SENTRY_AUTH_TOKEN from the environment or the gitignored .env.sentry-build-plugin
function readAuthToken() {
  if (process.env.SENTRY_AUTH_TOKEN) {
    return process.env.SENTRY_AUTH_TOKEN;
  }
  const file = path.resolve(__dirname, '.env.sentry-build-plugin');
  if (!fs.existsSync(file)) {
    return '';
  }
  const match = fs.readFileSync(file, 'utf8').match(/^\s*SENTRY_AUTH_TOKEN\s*=\s*["']?([^"'\s]+)/m);
  return match ? match[1] : '';
}

module.exports = (env = {}) => {
  const isDist = env.output === 'dist';
  const outputDir = path.resolve(__dirname, isDist ? '../../../dist/js' : 'build');

  // SENTRY_DSN= (empty) builds without error reporting
  const dsn = process.env.SENTRY_DSN !== undefined ? process.env.SENTRY_DSN : (isDist ? DEFAULT_DSN : '');
  const sdkVersion = process.env.SDK_VERSION || 'dev';
  const isRelease = isDist && !!dsn;

  let sentryPlugins = [];
  if (isRelease) {
    if (!process.env.SDK_VERSION) {
      throw new Error('Set SDK_VERSION to the version folder of this release, e.g. SDK_VERSION=21 npm run build');
    }
    const authToken = readAuthToken();
    if (!authToken) {
      throw sentrySetupError('no Sentry auth token found.');
    }
    sentryPlugins = [sentryWebpackPlugin({
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      authToken,
      telemetry: false,
      release: { name: `its123api-js@${sdkVersion}`, inject: false },
      sourcemaps: { filesToDeleteAfterUpload: path.join(outputDir, '*.map') },
      errorHandler: (err) => {
        ['its123api', 'its123api.loader', 'its123api.sentry'].forEach((name) => {
          [`${name}.min.js`, `${name}.min.js.map`].forEach((file) => {
            fs.rmSync(path.join(outputDir, file), { force: true });
          });
        });
        throw sentrySetupError(`uploading source maps to Sentry failed (${err.message}). `
          + 'The files built for this release were removed from dist/js.');
      },
    })];
  }

  const common = {
    target: ['web', 'es5'],
    output: {
      path: outputDir,
      filename: isDist ? '[name].min.js' : '[name].js',
      chunkFilename: isDist ? '[name].min.js' : '[name].js',
      publicPath: 'auto',
      uniqueName: 'its123api',
    },
    module: {
      rules: [
        {
          test: /\.m?js$/,
          // Transpile our own code and Sentry (which ships modern JS)
          include: [
            path.resolve(__dirname, 'src'),
            path.resolve(__dirname, 'node_modules/@sentry'),
            path.resolve(__dirname, 'node_modules/@sentry-internal'),
          ],
          use: {
            loader: 'babel-loader',
            options: {
              presets: [['@babel/preset-env', { modules: false }]],
            },
          },
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        __SENTRY_DSN__: JSON.stringify(dsn),
        __SDK_VERSION__: JSON.stringify(sdkVersion),
      }),
    ],
    optimization: {
      minimizer: [new TerserPlugin({ extractComments: false, terserOptions: { format: { comments: false } } })],
      splitChunks: false,
    },
    performance: { hints: false },
  };

  return [
    {
      ...common,
      name: 'modern',
      // Release builds: maps are uploaded to Sentry and not published (no sourceMappingURL)
      devtool: isDist ? 'hidden-source-map' : 'source-map',
      entry: {
        its123api: './src/main.js',
        'its123api.loader': './src/loader.js',
      },
      plugins: [...common.plugins, ...sentryPlugins],
      devServer: {
        static: path.resolve(__dirname, 'build'),
        compress: true,
        allowedHosts: 'all',
      },
    },
    {
      ...common,
      name: 'legacy',
      // The legacy build never reports to Sentry, so release builds need no maps
      devtool: isDist ? false : 'source-map',
      entry: {
        'its123api.polyfill': './src/polyfill.js',
      },
      resolve: {
        alias: {
          [path.resolve(__dirname, 'src/util/sentry.js')]: path.resolve(__dirname, 'src/util/sentry.noop.js'),
        },
      },
    },
  ];
};
