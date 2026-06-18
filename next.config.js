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
  // pdfkit reads its standard-font .afm files from disk at runtime. Vercel's
  // serverless file tracing doesn't pick these up automatically (the require
  // path is built dynamically), which causes PDF generation to fail in
  // production with an ENOENT-style error even though it works locally.
  // Explicitly include the data directory for the routes that use pdfkit.
  experimental: {
    outputFileTracingIncludes: {
      '/api/admin/quotes/[id]/invoice/pdf': ['./node_modules/pdfkit/js/data/**'],
      '/api/admin/quotes/[id]/invoice/send': ['./node_modules/pdfkit/js/data/**'],
    },
  },
};

module.exports = nextConfig;
// Force hard redeploy 1780508258244338146
