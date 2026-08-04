1. 🔗 Routing & Navigasi (URL Synchronization & Deep Linking)

Saat ini, hanya tab orders yang tersinkronisasi dengan URL (pathname). Tab lainnya masih murni menggunakan state lokal, membuat pengguna tidak bisa melakukan bookmark atau membagikan tautan langsung ke halaman profil, wishlist, atau shop.

    [ ] Sinkronkan Semua Tab ke URL / Query Parameters: Gunakan useSearchParams dan useRouter dari next/navigation agar setiap tab (?tab=shop, ?tab=profile, ?tab=wishlist, dll.) memiliki URL-nya sendiri. Ini mendukung tombol Back/Forward browser dan deep linking.

    [ ] Otomatis Tutup Drawer Mobile: Pastikan menu drawer di mobile otomatis tertutup setiap kali pengguna mengeklik salah satu menu navigasi atau tombol logout.

2. 🎨 UI/UX & Sentuhan Visual Profesional (Micro-interactions)

    [ ] Perhalus Greeting Header: Ubah teks uppercase WELCOME, [NAME] menjadi sapaan yang lebih hangat dan ramah khas e-commerce modern, contoh: "Halo, John Doe 👋" lengkap dengan emoji atau ikon status akun.

    [ ] Tambahkan Indikator Angka (Badge) di Sidebar: Tampilkan jumlah item di Wishlist atau Notifikasi secara real-time di samping label menu sidebar (mirip badge keranjang belanja) agar terkesan interaktif dan hidup.

    [ ] Transisi Antar Tab yang Halus (Smooth Transition): Berikan efek animasi transisi fade-in atau slide-subtle pada viewWrapper saat pengguna berpindah tab agar perpindahan terasa mulus (seamless).

    [ ] Perjelas State Aktif & Hover Effect: Pastikan navItemActive memiliki kontras warna yang sangat jelas dan indikator visual (seperti garis aksen di sisi kiri) agar pengguna tahu persis di halaman mana mereka berada.

3. 📱 Aksesibilitas (A11y) & Pengalaman Mobile

    [ ] Dukungan Tombol ESC & Klik Luar (Outside Click): Tambahkan event listener untuk menutup mobile menu drawer saat tombol Escape ditekan atau saat pengguna mengeklik area di luar sidebar.

    [ ] Penyempurnaan Atribut ARIA: Pastikan elemen interaktif seperti tombol hamburger dan menu drawer memiliki atribut aksesibilitas yang benar (aria-expanded, aria-haspopup).

    [ ] Sticky/Fixed Mobile Top Bar: Pastikan mobileTopBar tetap menempel di atas layar saat discroll ke bawah, namun dengan efek bayangan tipis (box-shadow) saat halaman digeser agar tidak menabrak konten.

4. ⚙️ Clean Code & Manajemen State

    [ ] Pindahkan Logika Firestore ke Custom Hook / Service: Pisahkan logika fetch/create user dari komponen UI utama. Buat custom hook (misal: useUserData) agar kode UserDashboard lebih bersih dan fokus pada layout.

    [ ] Validasi Fallback Nama yang Lebih Bersih: Perbaiki logika pembersihan nama pengguna (userName) agar tidak menampilkan string mentah dari email (misal: john.doe@gmail.com cukup diambil depannya saja atau diformat menjadi "John Doe" dengan huruf kapital di awal).

    [ ] Pembersihan Event Listener: Pastikan semua side-effect seperti timer animasi keranjang dan event listener dibersihkan dengan benar di fungsi return dari useEffect.

5. 🛡️ Penanganan Error & Ketahanan Aplikasi (Resilience)

    [ ] Tambahkan State Error / Fallback UI: Jika koneksi Firestore gagal saat mengambil data pengguna, jangan hanya menampilkannya di console.error. Tampilkan Banner Error kecil di layar dengan tombol "Coba Lagi" (Retry) agar pengguna tidak terjebak di layar loading atau halaman kosong.

    [ ] Konfirmasi Logout: Tambahkan modal konfirmasi sederhana sebelum fungsi handleLogout dieksekusi untuk mencegah pengguna tidak sengaja keluar akun saat salah klik tombol.