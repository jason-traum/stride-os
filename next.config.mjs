/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Allow builds to complete even with ESLint warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow builds to complete even with TypeScript errors
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent server-only native modules from being bundled client-side
      config.resolve.alias = {
        ...config.resolve.alias,
        'better-sqlite3': false,
        'bindings': false,
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

export default nextConfig;
