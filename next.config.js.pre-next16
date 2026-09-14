const path = require('path');

function getBasePath() {
  const rawBasePath =
    process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? '';
  const basePath = rawBasePath.trim().replace(/^\/+|\/+$/g, '');

  return basePath ? `/${basePath}` : '';
}

const basePath = getBasePath();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  trailingSlash: true,
  ...(basePath
    ? {
        basePath,
        assetPrefix: basePath
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  sassOptions: {
    additionalData: `$asset-prefix: '${basePath}';`
  },
  images: {
    unoptimized: true
  },
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^\.\/detection\.js$/,
        (resource) => {
          if (
            resource.context?.endsWith(
              path.join('@atproto', 'api', 'dist', 'rich-text')
            )
          ) {
            resource.request = path.resolve(
              __dirname,
              'src/lib/atproto/rich-text-detection-compat.js'
            );
          }
        }
      )
    );

    return config;
  }
};

module.exports = nextConfig;
