/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['firebase-admin', 'jwks-rsa', 'jose'],
};

module.exports = nextConfig;
