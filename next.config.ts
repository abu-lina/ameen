import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  enablePrerenderSourceMaps: false,
  experimental: {
    agentUpgrade: 'security',
    cpus: 2,
  },
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.SITE_URL || 'http://localhost:3000',
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
