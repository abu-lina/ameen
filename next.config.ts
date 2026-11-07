import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    cpus: 2,
  },
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.SITE_URL || 'http://localhost:3000',
  },
}

export default nextConfig
