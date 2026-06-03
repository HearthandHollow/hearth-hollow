/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'blob.vercelusercontent.com',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    SKIP_ENV_VALIDATION: 'true',
  },
};

module.exports = nextConfig;
