1. Frontend — Rendering & Bundle
 Audit bundle size pakai next build (liat output "First Load JS") — cari dependency berat yang bisa di-lazy-load
 Pakai dynamic() import untuk komponen berat yang nggak perlu render langsung (modal, chart, editor, dll)
 Ganti komponen client ('use client') yang sebenernya nggak butuh interaktivitas jadi Server Component
 Cek penggunaan gambar — pastikan semua pakai next/image (auto lazy-load, resize, format webp/avif)
 Preload font pakai next/font biar nggak ada layout shift/render blocking
 Hapus library yang nggak kepake (npm ls, cek package.json)
 Aktifkan code splitting per route (default Next.js udah, tapi cek kalau ada import global yang bikin semua route ke-bundle bareng)
2. Data Fetching
 Pindahin fetch yang bisa statis ke Static Generation (generateStaticParams, ISR pakai revalidate)
 Pakai Promise.all() untuk fetch paralel, jangan await berurutan kalau nggak saling bergantung
 Implementasi SWR / React Query di client biar ada caching + revalidate otomatis, ga fetch ulang tiap render
 Cek waterfall request di Network tab (DevTools) — request yang nunggu request lain padahal bisa paralel
 Pakai fetch dengan cache option yang tepat (force-cache, no-store, atau revalidate) sesuai kebutuhan data
3. API Routes / Backend
 Batasin payload — select() field spesifik di query, jangan select('*')
 Tambah index database di kolom yang sering dipakai WHERE/JOIN
 Cache response API yang jarang berubah (pakai Cache-Control header atau Vercel KV/Redis)
 Ganti getUser() (network call) jadi getSession() (baca cookie lokal) kalau nggak butuh validasi super ketat
 Gabung beberapa endpoint kecil jadi satu kalau sering dipanggil bareng dari frontend yang sama
4. Database
 Pastikan region database deket sama region hosting (Vercel/server)
 Review RLS policy Supabase — policy kompleks bikin query lambat
 Analisa query lambat lewat Supabase Dashboard → Query Performance
 Pertimbangkan connection pooling (Supabase Pooler / PgBouncer) kalau traffic tinggi
5. Infra & Hosting
 Set region Vercel Function deket ke database & mayoritas user
 Pakai Edge Runtime untuk route ringan (skip cold start Node.js)
 Aktifkan CDN caching untuk asset statis (Vercel udah otomatis, tapi cek header cache-nya)
 Cek apakah pakai HTTP/2 atau HTTP/3 (biasanya otomatis di Vercel/Cloudflare)
6. Third-party Scripts
 Audit semua script eksternal (analytics, chat widget, ads) — load pakai next/script dengan strategy lazyOnload atau afterInteractive
 Hapus tracking script yang duplikat/nggak kepake
7. Monitoring & Testing
 Jalanin Lighthouse / PageSpeed Insights buat baseline skor
 Pasang Vercel Analytics atau Web Vitals tracking (LCP, FID/INP, CLS, TTFB)
 Setup Sentry/LogRocket buat lacak error & performance real-user
 Test dari lokasi geografis berbeda (pakai tools kayak WebPageTest) kalau user tersebar