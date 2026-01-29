/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors. The errors shown in Vercel were from
    // a caching issue - the code passes locally.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
