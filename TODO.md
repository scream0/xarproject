🔗 1. Routing, URL Synchronization & Deep Linking

Saat ini state tab admin disimpan secara lokal, membuat admin tidak bisa membagikan tautan langsung atau melakukan refresh halaman tanpa kembali ke tab "overview".

    [x] 1.1 Sinkronisasi Query Parameter URL (?tab=...)

        Goal: Gunakan useSearchParams dan useRouter dari next/navigation agar setiap tab admin (?tab=products, ?tab=orders, ?tab=analytics, dll.) memiliki URL yang unik.

        Benefit: Memungkinkan bookmarking, deep linking, dan fungsi navigasi Back/Forward browser yang normal.

    [x] 1.2 Auto-Close Mobile Drawer

        Goal: Pastikan sidebar drawer di perangkat mobile otomatis tertutup setiap kali admin memilih menu atau menekan tombol keluar.

🎨 2. UI/UX, Command Center Polish & Micro-Interactions

Meningkatkan kesan profesional ala dasbor enterprise (Shopify Admin, Dashboard Toko Tokopedia).

    [x] 2.1 Sapaan & Header Command Center yang Elegan

        Goal: Ubah teks kaku SYSTEM ACCESS: [NAME] menjadi sapaan profesional yang ramah namun berwibawa, contoh: "Command Center • Halo, Admin 👋" lengkap dengan indikator peran (Role: Super Admin).

    [x] 2.2 Perbaikan Rendering Tab yang Terpotong (Fix Truncated Tabs)

        Goal: Lengkapi blok render kondisi tab di dalam viewWrapper (karena pada cuplikan kode sebelumnya bagian render tab seperti products, reviews, analytics, customers, dll. terpotong). Pastikan semuanya terpanggil dengan benar.

    [x] 2.3 Indikator Status Toko Interaktif

        Goal: Jadikan kartu status "Store is live" lebih interaktif (misalnya menampilkan status latensi server atau jumlah pesanan baru yang masuk secara real-time).

    [x] 2.4 Transisi & Highlight Menu Aktif yang Mulus

        Goal: Berikan aksen visual yang kuat (garis aksen kiri atau latar belakang kontras) pada navItemActive serta transisi fade-in yang halus saat berpindah menu.

📱 3. Mobile Experience & Accessibility (A11y)

Memastikan pengalaman pengelolaan toko dari smartphone atau tablet tetap optimal.

    [x] 3.1 Outside Click & ESC Key Listener

        Goal: Tutup mobile drawer otomatis saat admin mengeklik area luar sidebar atau menekan tombol Escape pada keyboard.

    [x] 3.2 Atribut ARIA & Navigasi Keyboard

        Goal: Tambahkan atribut aksesibilitas yang tepat (aria-expanded, aria-controls) pada tombol menu seluler.

    [x] 3.3 Sticky Mobile Top Bar

        Goal: Pertahankan bilah atas seluler agar tetap menempel di atas layar saat digulir (scroll), dilengkapi bayangan tipis agar batas konten terlihat jelas.

⚙️ 4. Clean Code, Arsitektur & Manajemen State

Menjaga kode tetap bersih, mudah dirawat, dan terhindar dari error.

    [x] 4.1 Ekstraksi Logika Auth & Role ke Custom Hook

        Goal: Pindahkan logika onAuthStateChanged dan fetch verifikasi role /api/users ke dalam custom hook (misal: useAdminAuth).

        Benefit: Membuat komponen AdminDashboard lebih ringkas dan fokus pada tata letak UI.

    [x] 4.2 Pembersihan Efek Samping (Effect Cleanup)

        Goal: Pastikan seluruh listener autentikasi dan fungsi asinkron dibersihkan dengan benar saat komponen dilepas (unmount).

🛡️ 5. Keamanan Akses & Penanganan Error (RBAC & Resilience)

Melindungi panel admin dari akses ilegal dan mencegah kegagalan sistem yang fatal.

    [x] 5.1 Tampilan Akses Ditolak (Unauthorized / Access Denied UI)

        Goal: Jika verifikasi API /api/users gagal atau mendeteksi bahwa pengguna bukan admin, jangan hanya mencetaknya di console.error. Tampilkan halaman peringatan "Akses Ditolak / Anda bukan Administrator" secara profesional.

    [x] 5.2 Modal Konfirmasi Logout

        Goal: Tambahkan dialog konfirmasi ringkas sebelum menjalankan logoutUser() untuk mencegah ketidaksengajaan saat admin mengeklik tombol keluar.