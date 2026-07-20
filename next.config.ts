/** @type {import('next').NextConfig} */

const nextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://snap-assets.sandbox.midtrans.com https://app.sandbox.midtrans.com; connect-src 'self' https://api.sandbox.midtrans.com; frame-src 'self' https://app.sandbox.midtrans.com;`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;