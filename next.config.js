/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['jwks-rsa', 'jose'],
};

module.exports = nextConfig;
