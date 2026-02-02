import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    dirs: ['src'],
    ignoreDuringBuilds: false,
  },

  async rewrites() {
    return [
      {
        source: '/api/bridge/:path*',
        destination: `${process.env.BRIDGE_URL ?? 'http://localhost:8765'}/:path*`,
      },
    ]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
