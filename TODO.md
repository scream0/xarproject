# Production Readiness TODO

Status audit dimulai 11 Agustus 2026. Checklist ini akan diperbarui selama pekerjaan berlangsung.

## Database & sinkronisasi

- [x] Rekonsiliasi riwayat migration remote `0001`–`0006`.
- [x] Terapkan migration sinkronisasi profil, Auth, dan `order_items`.
- [x] Audit dan backfill `auth.users` ↔ `profiles` ↔ `users` (5/5/5, tanpa mismatch).
- [x] Normalisasi 14 item order legacy ke `order_items` (tanpa orphan).
- [x] Tambahkan indeks query utama order, notifikasi, profil, dan produk.
- [x] Aktifkan RLS/policy pada tabel baru `users` dan `order_items`.
- [ ] Audit RLS tabel legacy yang sudah ada sebelum migrasi ini (produk, order, voucher, support).

## Keamanan autentikasi & API

- [x] Lindungi callback URL login dari open redirect.
- [x] Jangan percaya role admin dari metadata Auth.
- [x] Lindungi halaman checkout/account dari server proxy.
- [x] Amankan CRUD produk, alamat, pembatalan order, konfirmasi order, dan upload Cloudinary.
- [x] Validasi signature webhook Midtrans.
- [x] Validasi harga, varian, dan stok checkout pada server.
- [ ] Audit seluruh API route untuk autentikasi, otorisasi pemilik data, dan validasi input.
- [ ] Terapkan rate-limit pada endpoint sensitif (login/OTP/payment/webhook) bila infrastruktur tersedia.
- [ ] Hapus secret hard-code dan pastikan konfigurasi production memakai environment variable.

## Performa & reliability

- [ ] Audit request berulang, query tanpa pagination, dan N+1 pada dashboard admin/user.
- [x] Optimalkan indeks database untuk jalur user/admin yang paling sering dipakai.
- [ ] Pastikan checkout idempotent dan stok tidak dapat terpotong dua kali.
- [ ] Tambahkan error handling/observability yang aman untuk deployment.

## Pengujian & deployment

- [x] Unit/integration test order, webhook, dan auth redirect lulus.
- [x] Production build lulus.
- [x] E2E publik: beranda dan proteksi checkout lulus.
- [ ] E2E autentikasi admin/user memakai akun uji non-produksi.
- [ ] E2E pembayaran sandbox hingga webhook sukses.
- [x] Upgrade Next.js ke `16.3.0` dan override dependency rentan; audit dependency produksi: 0 vulnerability.
- [ ] Final deployment checklist dan environment production (butuh audit RLS legacy, akun E2E sandbox, dan verifikasi webhook Midtrans end-to-end).
