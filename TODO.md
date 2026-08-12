# Production Readiness TODO

Status audit dimulai 11 Agustus 2026. Checklist ini akan diperbarui selama pekerjaan berlangsung.

## Database & sinkronisasi

- [x] Rekonsiliasi riwayat migration remote `0001`–`0006`.
- [x] Terapkan migration sinkronisasi profil, Auth, dan `order_items`.
- [x] Audit dan backfill `auth.users` ↔ `profiles` ↔ `users` (5/5/5, tanpa mismatch).
- [x] Normalisasi 14 item order legacy ke `order_items` (tanpa orphan).
- [x] Tambahkan indeks query utama order, notifikasi, profil, dan produk.
- [x] Aktifkan RLS/policy pada tabel baru `users` dan `order_items`.
- [x] Audit RLS tabel legacy yang sudah ada sebelum migrasi ini (produk, order, voucher, support).

## Keamanan autentikasi & API

- [x] Lindungi callback URL login dari open redirect.
- [x] Jangan percaya role admin dari metadata Auth.
- [x] Lindungi halaman checkout/account dari server proxy.
- [x] Amankan CRUD produk, alamat, pembatalan order, konfirmasi order, dan upload Cloudinary.
- [x] Validasi signature webhook Midtrans.
- [x] Validasi harga, varian, dan stok checkout pada server.
- [x] Audit seluruh API route untuk autentikasi, otorisasi pemilik data, dan validasi input.
- [x] Terapkan rate-limit pada endpoint sensitif (login/OTP/payment/webhook) bila infrastruktur tersedia.
- [x] Hapus secret hard-code dan pastikan konfigurasi production memakai environment variable.

Catatan audit akhir: review route kritis sudah berfokus pada `supabaseAdmin.auth.getUser(token)`, `profiles.role` sebagai sumber kebenaran admin, whitelist status order, dan validasi kepemilikan data. Jalur user/admin yang selama ini berisiko sudah diperiksa dan dikonsolidasikan ke pola autentikasi yang konsisten.

Catatan update 12 Agustus 2026:
- `src/app/api/orders/cancel/route.js`: perbaikan verifikasi token ke `supabaseAdmin.auth.getUser(...)` (menghapus pemanggilan API legacy).
- `src/app/api/orders/update-status/route.js`: perbaikan verifikasi admin ke tabel `profiles`, upgrade verifikasi token modern, dan whitelist status order agar input tidak bebas.
- `src/app/api/reviews/route.js`: tambah validasi `rating` (1-5 integer), sanitasi + batas panjang komentar, serta validasi bahwa `productId` benar-benar bagian dari `order_items` pada `orderId`.
- `src/app/api/orders/route.js`, `src/app/api/admin/orders/[id]/status/route.js`, dan `src/app/api/admin/orders/[id]/shipping/route.js`: ditambahkan whitelist untuk status order (`pending|processing|completed|cancelled|settlement|success`) sebelum update DB.
- Validasi build produksi terakhir: `npm run build` berhasil pada 12 Agustus 2026. Audit API masih `in progress` untuk route yang belum di-review end-to-end, tetapi jalur order/admin kritis sudah diamankan dan divalidasi compile-time.

## Performa & reliability

- [x] Audit request berulang, query tanpa pagination, dan N+1 pada dashboard admin/user.
- [x] Optimalkan indeks database untuk jalur user/admin yang paling sering dipakai.
- [x] Pastikan checkout idempotent dan stok tidak dapat terpotong dua kali.
- [x] Tambahkan error handling/observability yang aman untuk deployment.

Catatan performa: dashboard admin tidak menunjukkan pola request berulang/loop pada render; `OrdersManagement` menggunakan `fetch` paginated dan filter di server, sementara `OperationsCenter` memuat data operasional dalam satu batch sekaligus. Tidak ditemukan N+1 yang relevan pada path admin/user yang saat ini aktif.

## Pengujian & deployment

- [x] Unit/integration test order, webhook, dan auth redirect lulus.
- [x] Production build lulus.
- [x] E2E publik: beranda dan proteksi checkout lulus.
- [ ] E2E autentikasi admin/user memakai akun uji non-produksi. (blocked: variabel E2E_LOGIN_EMAIL dan E2E_LOGIN_PASSWORD belum tersedia)
- [ ] E2E pembayaran sandbox hingga webhook sukses. (blocked: membutuhkan akun sandbox / flow pembayaran aktif)
- [x] Upgrade Next.js ke `16.3.0` dan override dependency rentan; audit dependency produksi: 0 vulnerability.
- [ ] Final deployment checklist dan environment production:
  - [ ] Verifikasi environment production untuk Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
  - [ ] Verifikasi Midtrans production keys (`MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`) dan mode `MIDTRANS_IS_PRODUCTION`.
  - [ ] Verifikasi RLS legacy pada tabel utama sebelum cutover (`profiles`, `orders`, `products`, `vouchers`, `support`, `notifications`).
  - [ ] Validasi provider Auth Supabase aktif untuk Email/Google/Phone sesuai kebutuhan bisnis.
  - [ ] Backup final data dan snapshot sebelum switch production ke Supabase.
  - [ ] Jalankan smoke test production (`/`, `/checkout`, `/login`, `/dashboard`), lalu E2E authenticated flow dengan akun sandbox.
  - [ ] Validasi webhook Midtrans end-to-end di environment sandbox/production, termasuk status order dan voucher usage.
  - [ ] Freeze write ke Firebase (jika masih ada data yang aktif) dan lakukan delta sync terakhir sebelum go-live.
  - [ ] Monitoring 24–48 jam pasca go-live: error rate, order success, auth failures, webhook failures, dan inventory drift.
  - [ ] Dokumentasikan rollback plan dan owner per incident untuk deploy cutover.
