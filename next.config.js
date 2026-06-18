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
  // pdfkit reads its standard-font .afm files from disk at runtime using a
  // path built from its own __dirname. When webpack bundles pdfkit into a
  // single serverless chunk (Next's default), that __dirname no longer
  // points at node_modules/pdfkit, so the lookup 404s in production
  // ("ENOENT .../.next/server/chunks/data/Helvetica.afm") even though it
  // works locally. Marking pdfkit (and its dependency fontkit) as external
  // keeps them as plain node_modules requires so __dirname stays correct,
  // and outputFileTracingIncludes makes sure the actual .afm files get
  // copied into the deployed function.
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'fontkit'],
    outputFileTracingIncludes: {
      '/api/admin/quotes/[id]/invoice/pdf': ['./node_modules/pdfkit/js/data/**'],
      '/api/admin/quotes/[id]/invoice/send': ['./node_modules/pdfkit/js/data/**'],
    },
  },
};

module.exports = nextConfig;
// Force hard redeploy 1780508258244338146
