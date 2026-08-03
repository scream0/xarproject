# TODO — Pengembangan Sistem Pesanan Profesional

Status:
- [x] Selesai
- [ ] Belum / Parsial (lihat catatan)

## 1. Database & Schema Design

- [x] **Tabel `orders` (Pesanan Utama)**
- [ ] Kolom utama: `id`, `order_number` (unique), `user_id`, `status`, `total_amount`, `shipping_cost`, `tax_amount`, `discount_amount`, `notes`. *(Parsial: kolom sudah ada di payload, uniqueness `order_number` belum diverifikasi secara global di Firestore)*
- [ ] Timestamps: `created_at`, `updated_at`, `cancelled_at`, `completed_at`. *(Parsial: tersedia, namun penggunaan field format tanggal belum sepenuhnya konsisten di semua endpoint)*
- [x] **Tabel `order_items` (Detail Item Pesanan)**
- [x] Kolom: `id`, `order_id`, `product_id`, `variant_id`, `quantity`, `price` (snapshot saat beli), `subtotal`.
- [x] **Tabel `order_status_history` (Log Status Pesanan)**
- [x] Kolom: `id`, `order_id`, `status_from`, `status_to`, `changed_by`, `notes`, `created_at`.
- [x] **Tabel `shipping_details` (Informasi Pengiriman)**
- [x] Kolom: `id`, `order_id`, `courier_name`, `service_type`, `tracking_number`, `shipping_address`, `recipient_name`, `phone_number`.
- [ ] **Setup Indexing & Foreign Keys**
- [ ] Index pada `user_id`, `order_number`, dan `status` untuk performa pencarian. *(Belum terdokumentasi/terverifikasi untuk kombinasi query saat ini)*

## 2. Backend API Development

- [ ] **Manajemen Checkout & Pembuatan Pesanan**
- [x] Endpoint `POST /api/orders` (Membuat pesanan baru dari keranjang).
- [x] Validasi stok produk secara real-time sebelum pesanan dibuat. *(Selesai: POST `/api/orders` kini memakai lock inventory + reserve stok sebelum order disimpan)*
- [ ] Kalkulasi otomatis ongkir, diskon voucher, dan pajak. *(Parsial: field didukung, namun kalkulasi otomatis terpusat belum terlihat di endpoint ini)*
- [x] **Manajemen Pesanan Pelanggan (User)**
- [x] Endpoint `GET /api/user/orders` (Daftar pesanan dengan filter status & pagination).
- [x] Endpoint `GET /api/user/orders/{id}` (Detail pesanan lengkap).
- [x] Endpoint `POST /api/user/orders/{id}/cancel` (Pembatalan pesanan oleh user dengan syarat tertentu).
- [x] Endpoint `POST /api/user/orders/{id}/confirm` (Konfirmasi pesanan diterima).
- [x] **Manajemen Pesanan Admin / Seller**
- [x] Endpoint `GET /api/admin/orders` (Semua pesanan dengan advanced filtering & searching).
- [x] Endpoint `PUT /api/admin/orders/{id}/status` (Update status pesanan: Pending -> Paid -> Processing -> Shipped -> Delivered).
- [x] Endpoint `POST /api/admin/orders/{id}/shipping` (Input nomor resi dan kurir).
- [x] **Payment Gateway Webhook**
- [x] Endpoint `POST /api/webhook/payment` (Sinkronisasi otomatis status pembayaran lunas/gagal).

## 3. Frontend Customer Portal (User Experience)

- [ ] **Halaman Checkout**
- [ ] Form alamat pengiriman & pilihan kurir. *(Perlu verifikasi implementasi spesifik di halaman checkout terbaru)*
- [ ] Ringkasan pesanan (*order summary*) dan rincian biaya. *(Perlu verifikasi implementasi spesifik di halaman checkout terbaru)*
- [ ] Pilihan metode pembayaran yang terintegrasi. *(Parsial: script Midtrans dipakai di area order user, alur checkout end-to-end perlu validasi lagi)*
- [x] **Halaman Daftar Pesanan (`/account/orders`)**
- [x] Tab status pesanan (*Semua, Belum Bayar, Diproses, Dikirim, Selesai, Dibatalkan*).
- [x] Card ringkasan pesanan dengan tombol aksi cepat (Bayar, Lacak, Konfirmasi).
- [x] **Halaman Detail Pesanan (`/account/orders/{id}`)**
- [x] Timeline visual status pengiriman pesanan.
- [x] Rincian item produk yang dibeli beserta harga satuan.
- [x] Informasi alamat pengiriman dan resi kurir (dengan tombol *copy* & link lacak).
- [ ] Tombol cetak / unduh Invoice (PDF). *(Parsial: unduh invoice sudah ada, format saat ini teks `.txt`, belum PDF)*

## 4. Admin & Seller Dashboard

- [x] **Halaman Manajemen Pesanan (`/admin/orders`)** *(diimplementasikan sebagai tab Orders pada Admin Dashboard)*
- [x] Tabel data pesanan interaktif (Sorting, Searching by Order ID/Customer Name).
- [ ] Filter berdasarkan rentang tanggal dan status pesanan. *(Parsial: status filter ada, rentang tanggal belum ada)*
- [ ] Badge warna indikator status pesanan yang jelas. *(Parsial: status ada dalam select, badge tabel konsisten belum terlihat)*
- [x] **Modal / Halaman Aksi Admin**
- [x] Fitur update status pesanan massal (*Bulk Action*).
- [x] Form input nomor resi pengiriman instan.
- [ ] Tombol cetak Label Pengiriman (*Shipping Label*) / Resi secara massal. *(Parsial: print preview slip ada, belum alur label/resi massal final)*
- [ ] Opsi pembatalan pesanan dan pengembalian dana (*Refund*). *(Parsial: cancel status ada, workflow refund terpisah belum terlihat)*

## 5. Integrasi Pihak Ketiga (Third-Party)

- [ ] **Payment Gateway Integration**
- [ ] Integrasi Midtrans / Stripe / Xendit untuk pembayaran otomatis. *(Parsial: Midtrans/webhook sudah ada; Stripe/Xendit belum)*
- [ ] Handle redirect URL setelah pembayaran berhasil/gagal. *(Perlu verifikasi route return khusus gateway)*
- [ ] **Logistik / Courier API**
- [ ] Integrasi API RajaOngkir / Biteship untuk cek ongkir & tracking resi otomatis.
- [ ] **Sistem Notifikasi**
- [ ] Integrasi email otomatis untuk notifikasi (Invoice, Pesanan Dibayar, Pesanan Dikirim). *(Parsial: notifikasi internal Firestore sudah ada untuk event tertentu)*
- [ ] Integrasi WhatsApp Notification Gateway.

## 6. Testing & Quality Assurance

- [ ] **Unit & Feature Testing (Backend)**
- [x] Test skenario pembuatan pesanan & pengurangan stok produk. *(Cakupan saat ini: reserve stok saat checkout + restore saat cancel, dengan test otomatis `orderService.stockLifecycle.test.js`)*
- [x] Test webhook payment gateway (sukses dan gagal). *(Cakupan saat ini: mapping status payment -> status order termasuk `settlement/capture/success`, gagal `failure/expire/deny`, normalisasi whitespace status (contoh: `" settlement "`), audit note memakai status ternormalisasi dengan batas panjang aman, metadata audit menyimpan raw+normalized status beserta sumber field (`transaction_status`/`payment_status`) dengan sanitasi+batas panjang saat disimpan ke payload order/history serta timestamp metadata terakhir, helper query admin untuk filter/sort berdasarkan waktu webhook terbaru (`webhookOnly` + `sortBy=webhook_latest`), fallback status kosong ke `pending`, fallback `payment_status` saat `transaction_status` tidak ada, prioritas `transaction_status` saat kedua field ada, validasi payload wajib, skenario gagal yang memicu cancel + restock stok ter-reserve, serta verifikasi response HTTP route webhook, melalui `paymentWebhookService.test.js` dan `route.test.js`)*
- [x] Test validasi pembatalan pesanan. *(Cakupan saat ini: cancel idempoten dan stok tidak kembali dua kali)*
- [x] **Integration & End-to-End (E2E) Testing** *(Parsial: backend integration + browser smoke; full UI checkout dengan akun nyata/payment sandbox end-to-end masih perlu skenario lanjutan)*
- [x] Simulasikan *User Journey* dari tambah ke keranjang -> checkout -> bayar -> ubah status oleh admin -> selesai. *(Selesai di level backend integration test: create order -> webhook payment -> admin processing -> delivered, lihat `orderJourney.integration.test.js`)*
- [x] Browser smoke test dasar (home render + proteksi auth checkout -> redirect login) dengan Playwright. *(Lihat `tests/e2e/smoke.spec.ts`, jalankan via `npm run e2e`)*
- [x] Browser smoke test login + akses halaman orders user dengan akun test env. *(Playwright: `E2E_LOGIN_EMAIL` + `E2E_LOGIN_PASSWORD`, otomatis skip jika env belum diset, di `tests/e2e/smoke.spec.ts`; runner cepat: `npm run e2e:auth`)*
- [ ] **Performance & Security Check**
- [x] Pastikan pencegahan *Race Condition* pada stok produk saat flash sale/checkout bersamaan. *(Selesai: logic lock+reserve stok checkout diekstrak ke `checkoutReservationService.js` dan diuji dengan skenario kontensi owner paralel + guard stok tidak minus di `checkoutReservationService.test.js`)*
- [x] Validasi keamanan otorisasi API agar user tidak bisa melihat pesanan user lain. *(Selesai: endpoint detail order user kini wajib `userId` dan mengembalikan `403 Forbidden` untuk order milik user lain; tercakup di `orderDetailRouteHandler.test.js`)*

