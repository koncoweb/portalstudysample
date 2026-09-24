*Status: disetujui*
# PRD: Portal Belajar (E-Learning Siswa)

## Tujuan
Siswa kesulitan menemukan dan mempelajari materi video pelajaran secara terpusat. Aplikasi ini menyediakan portal belajar satu halaman: siswa melihat daftar kursus/materi video YouTube, menonton langsung, dan melacak progres belajarnya; guru/admin mengelola materi (tambah, edit, hapus, kategori) tanpa perlu koding.

## Arah visual (dari INSPO)
Gaya Material bersih dari `material-io`/`amie-so`: banyak ruang putih, aksen biru `#10b1eb`, kartu materi membulat 12–16px, font Inter. Token lengkap di DESIGN.md.

## Fitur
- [ ] **Mode pengguna (siswa vs admin)** — pilihan peran di layar masuk; admin dibuka dengan kata sandi sederhana; seluruh fitur bisa diuji di preview.
- [x] **Dashboard siswa** — daftar kursus per kategori (mata pelajaran) dengan kartu: judul, deskripsi, jumlah video, progres.
- [x] **Pemutar video YouTube** — halaman detail materi: embed player YouTube, deskripsi, tombol "Tandai Selesai", riwayat tontonan.
- [x] **Progres belajar (localStorage)** — status selesai/belum per video + persentase per kursus, tersimpan di browser.
- [ ] **Admin kelola materi** — tambah/edit/hapus kursus & video (judul, deskripsi, link YouTube), atur kategori, urutan; data tersimpan di localStorage.

## Tahap pengerjaan
- [x] Tahap 1: **Landasan statis** — shell SPA (hash routing), styling token DESIGN, data contoh kursus & video, halaman beranda/dashboard siswa → preview.
- [x] Tahap 2: **Pemutar video + progres** — halaman detail materi dengan embed YouTube, tombol tandai selesai, riwayat tontonan & progres per kursus (localStorage) → preview.
- [x] Tahap 3: **Admin kelola materi** — mode admin: tabel daftar materi, form tambah/edit (judul, deskripsi, link YouTube, kategori), hapus, simpan ke localStorage → preview.

## Data
localStorage (default) — nama key: `e-learning.courses` (array kursus), `e-learning.progress` (map videoId → status), `e-learning.adminSession` (bool).

## File
- `index.html` — shell + footer SEO
- `src/style.css` — styling (token DESIGN)
- `src/main.js` — seluruh logika SPA (routing, render, CRUD admin, progres)

## Kriteria selesai
- Preview menampilkan dashboard siswa dengan kartu kursus dari data contoh.
- Klik kursus → pemutar YouTube tampil; "Tandai Selesai" mengubah status & progres kursus.
- Mode admin: tambah kursus/video baru → muncul di dashboard siswa tanpa reload.
- Validasi sintaks + build hijau + runtime headless tanpa console error / 404.

[AI pembuat aplikasi tanpa koding](https://boloku.com)
