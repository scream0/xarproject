Berikut adalah TODO List komprehensif untuk memperbaiki potensi error, bug logika, dan meningkatkan stabilitas pada kode NotificationsSection Anda:
🛠️ TODO & Bug Fixing Roadmap: NotificationsSection
🚨 1. Penanganan Sesi & Autentikasi Token (Critical Bug Fixes)

    [x] 1.1 Validasi Keamanan Token pada Fungsi Aksi Massal (markAllRead)

        Goal: Pastikan variabel auth.currentUser tidak bernilai null sebelum memanggil .getIdToken() di dalam fungsi markAllRead untuk menghindari TypeError saat sesi kedaluwarsa.

        Solusi: Tambahkan pengecekan if (!auth.currentUser) return; di awal fungsi aksi.

    [x] 1.2 Optimasi Request API Mark All Read

        Goal: Ubah proses looping pemanggilan fetch secara paralel menggunakan Promise.all dengan membuat satu endpoint API backend terpusat (misal: PUT /api/notifications/mark-all).

        Benefit: Mengurangi beban jaringan (network overhead) dan mempercepat respons UI secara signifikan.

⚙️ 2. Optimalisasi Performa & State Management (Clean Code)

    [x] 2.1 Bungkus loadNotifications dengan useCallback

        Goal: Hindari peringatan lint warnings dari Next.js dengan membungkus fungsi loadNotifications menggunakan useCallback agar stabil saat dipanggil di dalam useEffect.

    [x] 2.2 Pembersihan Event Listener / Auth State Unsubscribe

        Goal: Pastikan pemanggilan onAuthStateChanged dikelola dengan baik dan dibersihkan melalui fungsi pengembali (cleanup function) dari useEffect.

🎨 3. Peningkatan UI/UX & Pengalaman Pengguna (User Experience)

    [x] 3.1 Tambahkan Indikator Visual Loading Saat Aksi

        Goal: Nonaktifkan tombol atau berikan indikator kecil saat proses markAllRead atau deleteNotification sedang berjalan agar pengguna tidak mengeklik tombol berkali-kali.

    [x] 3.2 Dialog Konfirmasi Hapus Notifikasi

        Goal: Tambahkan pencegahan penghapusan tidak sengaja (accidental delete) dengan menyematkan konfirmasi ringan sebelum perintah DELETE dikirim ke server.