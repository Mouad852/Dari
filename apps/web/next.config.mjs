/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Pin the trace root to this app. Without it Next walks up looking for a
  // lockfile, finds a stray one in the user's home directory, and treats that
  // as the workspace root.
  outputFileTracingRoot: import.meta.dirname,

  // Photo hosts must be allowlisted for next/image. Phase 05's storage choice
  // resurfaces here; keep this list in step with it.
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' }, // MinIO, local dev
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Listing pages carry approximate locations. Keep them out of embeds.
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
