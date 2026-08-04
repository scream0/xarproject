🚨 1. Perbaikan Bug Utama (Critical Error Fixes)

    [x] 1.1 Perbaiki Argumen Pemanggilan loadNotifications() di handleCreate

        Masalah: Pada fungsi handleCreate, baris pemanggilan await loadNotifications(); dipanggil tanpa argumen currentUser. Hal ini menyebabkan variabel currentUser di dalam loadNotifications bernilai undefined, yang berpotensi membuat token gagal dimuat (auth.currentUser bisa saja null jika state belum sepenuhnya sinkron).

        Solusi: Ubah menjadi await loadNotifications(auth.currentUser); agar token selalu diambil dari user yang aktif saat ini.

    [x] 1.2 Tangani Kondisi Unauthenticated / Token Null

        Masalah: Jika auth.currentUser bernilai null saat tombol aksi (seperti Mark All Read atau Delete) ditekan, pemanggilan getIdToken() akan melempar TypeError.

        Solusi: Tambahkan validasi penjagaan di awal fungsi (misal: if (!auth.currentUser) return;) atau gunakan optional chaining yang aman disertai pesan toast error jika sesi habis.

⚙️ 2. Optimalisasi State & Performa (Clean Code)

    [x] 2.1 Hindari Multi-Fetch Beruntun saat Mark All Read

        Masalah: Penggunaan Promise.all dengan melakukan banyak request fetch satuan (PUT) untuk setiap notifikasi yang belum dibaca sangat boros performa (N network requests).

        Solusi: Buat endpoint API tunggal (misal: PUT /api/notifications/mark-all) di backend untuk mengubah status seluruh notifikasi yang belum dibaca dalam satu kali request database.

    [x] 2.2 Perbaiki Ketergantungan useEffect (Effect Dependencies)

        Masalah: loadNotifications didefinisikan di luar useEffect namun tidak dibungkus dengan useCallback, serta useEffect menggunakan array dependensi kosong [], yang berpotensi memicu stale closure pada lint warnings Next.js.

        Solusi: Bungkus loadNotifications dengan useCallback atau masukkan langsung ke dalam useEffect.

🎨 3. Peningkatan UI/UX & Interaksi Profesional

    [x] 3.1 Tambahkan Loading State pada Tombol Aksi Modal (Submit & Create)

        Masalah: Saat admin membuat notifikasi baru, tombol "Simpan / Kirim" tidak memiliki status loading, sehingga pengguna bisa mengeklik tombol tersebut berkali-kali dan mengirim data duplikat.

        Solusi: Tambahkan state lokal submitting untuk menonaktifkan tombol dan mengubah teks menjadi "Menyimpan..." saat proses handleCreate berjalan.

    [x] 3.2 Fitur Konfirmasi Hapus Notifikasi

        Masalah: Notifikasi langsung terhapus begitu tombol ✕ ditekan tanpa adanya dialog konfirmasi, berisiko terjadi salah klik (accidental delete).

        Solusi: Tambahkan konfirmasi ringan (atau animasi geser/undo toast) sebelum perintah DELETE dikirim ke server.

    [x] 3.3 Perbaikan Aksesibilitas Modal (ESC Key & Outside Click)

        Masalah: Pastikan modal pembuatan notifikasi tertutup secara bersih ketika pengguna menekan tombol Escape pada keyboard sebagai pelengkap outside click.