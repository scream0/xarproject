/** @type {import('next').NextConfig} */

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://snap-assets.sandbox.midtrans.com https://snap.midtrans.com https://api.sandbox.midtrans.com https://api.midtrans.com https://app.sandbox.midtrans.com https://app.midtrans.com https://pay.google.com https://gwk.gopayapi.com https://www.googletagmanager.com https://o.alicdn.com https://g.alicdn.com https://apis.google.com https://www.google.com https://www.gstatic.com;
  connect-src 'self' https://gwdvcfuzwchnfrhnhaek.supabase.co wss://gwdvcfuzwchnfrhnhaek.supabase.co https://api.sandbox.midtrans.com https://api.midtrans.com https://snap-assets.sandbox.midtrans.com https://app.sandbox.midtrans.com https://app.midtrans.com https://gwk.gopayapi.com https://*.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com https://www.google.com https://www.gstatic.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://api.cloudinary.com;
  frame-src 'self' https://app.sandbox.midtrans.com https://app.midtrans.com https://account.midtrans.com https://pay.google.com https://gwk.gopayapi.com https://*.firebaseapp.com https://accounts.google.com https://www.google.com https://www.gstatic.com;
  img-src 'self' data: https://*.midtrans.com https://*.alicdn.com https://res.cloudinary.com https://www.google.com https://www.google-analytics.com https://analytics.google.com;
  style-src 'self' 'unsafe-inline' https://snap-assets.sandbox.midtrans.com https://app.sandbox.midtrans.com https://app.midtrans.com;
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
