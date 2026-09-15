function getBasePath() {
  const rawBasePath =
    process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? '';
  const basePath = rawBasePath.trim().replace(/^\/+|\/+$/g, '');

  return basePath ? `/${basePath}` : '';
}

const basePath = getBasePath();

/** @type {import("next").NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_STATIC_EXPORT === 'true' ? { output: 'export' } : {}),
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
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
  turbopack: {
    root: __dirname
  }
};

module.exports = nextConfig;
