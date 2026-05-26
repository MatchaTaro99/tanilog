# 🌾 TaniLog

**TaniLog** adalah aplikasi *Progressive Web App* (PWA) yang dirancang khusus untuk membantu petani modern dalam mencatat aktivitas harian (logbook) dan mengelola keuangan pertanian. Aplikasi ini menggunakan pendekatan **Offline-First**, sehingga petani tetap dapat memasukkan data meski sedang berada di lahan yang tidak memiliki koneksi internet.

## ✨ Fitur Utama

- **Offline-Ready:** Tetap bisa digunakan tanpa internet berkat teknologi IndexedDB.
- **Background Sync:** Sinkronisasi otomatis ke server ketika koneksi internet kembali tersedia, didukung dengan manajemen transaksi atomik untuk mencegah duplikasi data.
- **Logbook Harian:** Jadwal otomatis untuk aktivitas bertani (Penyiraman, Pemupukan, Proteksi Hama) berdasarkan jenis tanaman.
- **Kalkulator Finansial:** Pencatatan pengeluaran (modal) dan pemasukan (panen) secara *real-time*, lengkap dengan perhitungan *Break-Even Point* (BEP) per kilogram dan status keuntungan.
- **Modern Tech Stack:** Performa tinggi menggunakan Bun runtime.

## 🛠️ Teknologi yang Digunakan

**Frontend:**
- [Next.js](https://nextjs.org/) (React Framework)
- [Tailwind CSS](https://tailwindcss.com/) (Styling)
- [Dexie.js](https://dexie.org/) (Wrapper IndexedDB untuk Offline Storage)
- [next-pwa](https://github.com/shadowwalker/next-pwa) (Progressive Web App)

**Backend:**
- [Bun](https://bun.sh/) (Fast JavaScript Runtime)
- [ElysiaJS](https://elysiajs.com/) (Web Framework yang sangat cepat)
- [Drizzle ORM](https://orm.drizzle.team/) (TypeScript ORM)
- [MySQL](https://www.mysql.com/) (Database Relasional)

---

## 🚀 Panduan Instalasi (Menjalankan secara Lokal)

### Persyaratan Sistem
- Terinstal **[Bun](https://bun.sh/)** v1.0+
- Terinstal **MySQL** (berjalan di port `3306`)

### 1. Setup Database MySQL
Buat database baru di MySQL dengan nama `tanilog`:
```sql
CREATE DATABASE tanilog;
```

### 2. Setup Backend Server
Buka terminal dan jalankan perintah berikut:
```bash
cd backend
bun install
bunx drizzle-kit push   # Sinkronisasi skema ORM ke MySQL
bun run dev             # Server akan berjalan di http://localhost:3000
```
*Catatan: Pastikan string koneksi database di file `backend/.env` sesuai dengan konfigurasi lokal Anda (default: `DATABASE_URL="mysql://root:@127.0.0.1:3306/tanilog"`).*

### 3. Setup Frontend Web
Buka *tab* terminal baru dan jalankan:
```bash
cd frontend
bun install
cp .env.example .env.local  # Konfigurasi URL backend
bun run dev                 # Frontend akan berjalan di http://localhost:3001
```

Akses aplikasi melalui browser di **http://localhost:3001**.

---

## 🤝 Berkontribusi
Pull requests are welcome! Untuk perubahan besar, harap buka *issue* terlebih dahulu untuk mendiskusikan apa yang ingin Anda ubah.

## 📄 Lisensi
[MIT](https://choosealicense.com/licenses/mit/)
