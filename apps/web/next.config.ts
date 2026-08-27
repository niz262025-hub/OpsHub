import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@opshub/types', '@opshub/utils', '@opshub/ui', '@opshub/auth'],
};

export default nextConfig;
