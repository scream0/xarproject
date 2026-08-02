# TODO — Alur Pembelian Profesional (Checkout Flow)

## ✅ Completed — Professional E-Commerce Checkout Flow
- [x] **Dedicated Checkout Page** (`/checkout`) — Halaman terpisah dengan 3 step: Alamat → Kurir → Promo
- [x] **Step 1: Alamat Pengiriman** — Pilih alamat tersimpan, search kota via RajaOngkir, tambah alamat baru
- [x] **Step 2: Pilih Kurir** — Bandingkan tarif JNE/TIKI/POS/JNT, auto-select termurah, tampilkan estimasi
- [x] **Step 3: Kode Promo** — Input promo, validasi, tampilkan diskon
- [x] **Ringkasan Belanja** — Sidebar sticky dengan item, subtotal, diskon, ongkir, total akhir
- [x] **CartSidebar → Redirect** — Mini-cart sekarang redirect ke `/checkout` (bukan payment langsung)
- [x] **City Search** — Dropdown kota dengan search (RajaOngkir API) di modal alamat
- [x] **Midtrans Payment** — Total akhir (produk + ongkir) dikirim ke Midtrans
- [x] **Build Success** — Compiled successfully

## Remaining
- [ ] Simpan detail ongkir (kurir, biaya, estimasi) di dokumen order Firestore
- [ ] Tampilkan rincian ongkir di modal order user (`OrdersSection`)
- [ ] Tampilkan ongkir di tabel admin (`TransactionTable`)
- [ ] Tambah dropdown kota di `SettingsView.js` untuk `storeCityId`/`storeCityName`

