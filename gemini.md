# Todo: Optimasi Latency & Paralelisasi Fetch

## ✅ Sudah selesai (dari sesi sebelumnya)
- [x] Buat helper `shouldSkipAuthEvent()` di `src/utils/authHelpers.js`
- [x] Terapkan filter event `TOKEN_REFRESHED` / `INITIAL_SESSION` di `useAdminAuth.js`
- [x] Terapkan filter event yang sama di `useUserDashboardData.js`
- [x] Terapkan filter event yang sama di `StoreContext.js`

## 🔲 Belum selesai — paralelisasi fetch

### 1. `src/context/StoreContext.js` — prioritas tinggi
Dipakai di seluruh app lewat layout, jadi menyumbang latency ke semua halaman.

- [x] Di `handleUserData()` (baris ~127–214): fetch `/api/users?userId=...` (profil) dan `/api/cart` saat ini berjalan berurutan (`await` satu-satu). Gabungkan jadi `Promise.all([...])` karena keduanya independen — cuma butuh `userId` dan `token`.
- [x] Pastikan logic yang bergantung pada hasil (misal `setCustomer`, `setCart`, sync cart) tetap dijalankan setelah kedua promise selesai, bukan di tengah.
- [x] Test: login baru → cek Network tab, kedua request `/api/users` dan `/api/cart` harus mulai bersamaan, bukan satu nunggu yang lain.

### 2. `src/components/Dashboard/User/Overview/OverviewUser.js` — prioritas sedang
- [x] Di `fetchDashboardData()` (baris ~90–200): fetch `/api/orders?userId=...` dan fetch `/api/users?userId=...` (untuk saldo) saat ini sequential. Ubah jadi `Promise.all([orderPromise, userPromise])`.
- [x] Pindahkan logic fallback nama (`fetchedFullName`) supaya dievaluasi SETELAH kedua response ada, tetap pakai urutan prioritas yang sama (user_metadata → orderResult.primaryAddress → userResult.data).
- [x] Test: buka dashboard user → waktu render statistik (total order, saldo) harus lebih cepat dari sebelumnya.

### 3. Audit lanjutan (opsional, cek dulu sebelum ubah)
- [x] `OrdersSection.js` — cek apakah ada fetch lain yang bisa digabung (`/api/user/orders`, `/api/products`) kalau dipanggil di komponen/halaman yang sama saat mount. *(Aman, fetch mandiri)*
- [x] `AdminDashboard.js` — beberapa `useEffect` terpisah untuk fetch admin data; pastikan tidak ada yang saling menunggu tanpa alasan (cek dependency array masing-masing). *(Aman, interval berjalan mandiri)*
- [x] Scan ulang seluruh `src/components/Dashboard/` untuk pola `await fetch(...)` berurutan yang datanya sebenarnya independen. *(Telah ditemukan dan diparalelkan di `UserProfil.js` dan `OverviewStats.js`!)*

## 🔲 Verifikasi akhir
- [ ] Ukur ulang latency setelah paralelisasi (Network tab / Lighthouse), bandingkan dengan baseline 600ms.
- [ ] Pastikan tidak ada race condition baru — terutama di `StoreContext` saat `isCartSynced` state diset dari hasil cart fetch yang sekarang jalan paralel dengan user fetch.
- [ ] Regresi test alur: login → lihat cart tersinkron dengan benar → lihat profil/nama muncul dengan benar.

## Catatan keamanan (tetap berlaku)
- Jangan ubah `proxy.js` atau `apiAuth.ts` — itu lapisan enforcement sebenarnya (server-side), fetch paralel ini murni soal UX/performa di client.
- Paralelisasi fetch tidak mengubah data apa yang boleh diakses user, cuma mengubah kapan/bagaimana urutan request dikirim.