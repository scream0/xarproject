/** @type {import('next').NextConfig} */

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://snap-assets.sandbox.midtrans.com https://api.sandbox.midtrans.com https://app.sandbox.midtrans.com https://pay.google.com https://gwk.gopayapi.com https://www.googletagmanager.com https://o.alicdn.com https://g.alicdn.com;
  connect-src 'self' https://api.sandbox.midtrans.com https://snap-assets.sandbox.midtrans.com https://gwk.gopayapi.com;
  frame-src 'self' https://app.sandbox.midtrans.com https://pay.google.com https://gwk.gopayapi.com;
  img-src 'self' data: https://*.midtrans.com https://*.alicdn.com;
  style-src 'self' 'unsafe-inline';
`;

const nextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\s{2,}/g, " ").trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
