# Instruksi AI: Penyesuaian `suma.module.css` untuk Tema Gelap & Terang (Dark/Light Theme)

File ini berfungsi sebagai panduan dan konteks instruksi bagi Gemini atau AI assistant dalam memodifikasi dan merestrukturisasi file `suma.module.css` agar mendukung sistem tema ganda (Gelap & Terang) secara optimal dan konsisten.

---

## 🎯 Tujuan Utama
Mengubah atau memperbarui `suma.module.css` agar:
1. Menggunakan **CSS Custom Properties (CSS Variables)** untuk semua warna (background, teks, border, aksen).
2. Mendukung peralihan tema secara dinamis (baik via atribut `data-theme="dark/light"` maupun `@media (prefers-color-scheme)`).
3. Mempertahankan modularitas CSS Modules (`composes`, scoped classes) tanpa merusak struktur komponen yang ada.
4. Menambahkan transisi warna yang halus (*smooth transition*) untuk kenyamanan visual pengguna.

---

## 📋 Pedoman Implementasi Teknis

### 1. Definisi Variabel Warna (`:root` & Selector Tema)
Gunakan pendekatan berbasis atribut atau kelas pada root/wrapper, contoh:
```css
/* Default / Light Theme */
:root, :global([data-theme="light"]) {
  --suma-bg: #ffffff;
  --suma-surface: #f8f9fa;
  --suma-text-primary: #1a1a1a;
  --suma-text-secondary: #666666;
  --suma-border: #e2e8f0;
  --suma-primary: #0070f3;
  --suma-primary-hover: #0051a2;
}

/* Dark Theme */
:global([data-theme="dark"]) {
  --suma-bg: #0f172a;
  --suma-surface: #1e293b;
  --suma-text-primary: #f8fafc;
  --suma-text-secondary: #94a3b8;
  --suma-border: #334155;
  --suma-primary: #3b82f6;
  --suma-primary-hover: #60a5fa;
}
```

### 2. Penerapan pada Kelas di `suma.module.css`
Pastikan semua properti warna menggunakan variabel yang telah didefinisikan:
```css
.container {
  background-color: var(--suma-bg);
  color: var(--suma-text-primary);
  border-color: var(--suma-border);
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

.card {
  background-color: var(--suma-surface);
  border: 1px solid var(--suma-border);
  border-radius: 8px;
  padding: 1.5rem;
}

.title {
  color: var(--suma-text-primary);
  font-weight: 600;
}

.subtitle {
  color: var(--suma-text-secondary);
}

.button {
  background-color: var(--suma-primary);
  color: #ffffff;
  border: none;
  transition: background-color 0.2s ease;
}

.button:hover {
  background-color: var(--suma-primary-hover);
}
```

---

## 🛠️ Instruksi Prompt untuk AI saat Menjalankan Perintah
Ketika perintah **"Sesuaikan suma module.css untuk tema gelap terang"** dieksekusi, AI harus:
1. **Menganalisis** struktur kode `suma.module.css` yang ada saat ini (jika ada) atau membuat struktur standar komponen UI.
2. **Memetakan** seluruh warna hardcoded (seperti `#fff`, `#000`, `rgb(...)`) ke dalam **CSS Variables**.
3. **Menyediakan** blok konfigurasi tema untuk Light mode dan Dark mode secara lengkap.
4. **Menambahkan** transisi mulus (*smooth transition*) agar perpindahan tema tidak kaku.
5. **Memastikan** kompatibilitas dengan CSS Modules (menggunakan `:global()` jika diperlukan untuk penanda atribut tema di root).

---
*Dokumen ini dibuat otomatis sebagai referensi prompt sistem untuk pengembangan antarmuka proyek.*
