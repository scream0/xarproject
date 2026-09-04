// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://snap-assets.sandbox.midtrans.com https://snap.midtrans.com https://api.sandbox.midtrans.com https://api.midtrans.com https://app.sandbox.midtrans.com https://app.midtrans.com https://pay.google.com https://gwk.gopayapi.com https://www.googletagmanager.com https://o.alicdn.com https://g.alicdn.com https://accounts.google.com https://apis.google.com https://www.google.com https://www.gstatic.com;
  connect-src 'self' https://gwdvcfuzwchnfrhnhaek.supabase.co wss://gwdvcfuzwchnfrhnhaek.supabase.co https://api.sandbox.midtrans.com https://api.midtrans.com https://snap-assets.sandbox.midtrans.com https://app.sandbox.midtrans.com https://app.midtrans.com https://gwk.gopayapi.com https://accounts.google.com https://*.googleapis.com https://www.google.com https://www.gstatic.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://api.cloudinary.com https://api.mameko.my.id;
  frame-src 'self' https://app.sandbox.midtrans.com https://app.midtrans.com https://account.midtrans.com https://pay.google.com https://gwk.gopayapi.com https://accounts.google.com https://www.google.com https://www.gstatic.com;
  img-src 'self' data: https://*.midtrans.com https://*.alicdn.com https://res.cloudinary.com https://www.google.com https://*.googleusercontent.com https://www.google-analytics.com https://analytics.google.com;
  style-src 'self' 'unsafe-inline' https://snap-assets.sandbox.midtrans.com https://app.sandbox.midtrans.com https://app.midtrans.com;
`;

const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts', 'swiper'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "gwdvcfuzwchnfrhnhaek.supabase.co",
      },
    ],
  },
  async rewrites() {
    // Di production (Vercel): gunakan NEXT_PUBLIC_API_URL atau https://api.mameko.my.id
    // Di lokal: wajib gunakan http://127.0.0.1:8080 agar tidak error SSL Handshake dari proxy Next.js
    const isProd = process.env.NODE_ENV === 'production';
    const apiBase = isProd ? (process.env.NEXT_PUBLIC_API_URL || "https://api.mameko.my.id") : "http://127.0.0.1:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
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
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
