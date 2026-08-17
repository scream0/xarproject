Hapus logic role-check di DashboardView.js, biarkan satu sumber kebenaran saja (idealnya lewat hook useUserDashboardData, dan AdminDashboard pakai hook yang sama atau context yang di-share, bukan fetch ulang).
Di /api/users GET: kalau actor.id === userId (user ambil data sendiri), pakai data dari getUser(token) langsung untuk email/metadata — skip getUserById yang kedua sepenuhnya.
Kalau tetap butuh keduanya, jalankan dengan Promise.all bukan await berurutan.
Pertimbangkan simpan role di JWT claims/session (custom claim Supabase) supaya tidak perlu roundtrip DB sama sekali untuk cek role.