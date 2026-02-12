/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@mirrormarkets/shared'],
};

module.exports = nextConfig;
