/* Portal Belajar — E-Learning Siswa (Tahap 3: admin kelola materi)
   SPA client-only, hash routing, data kursus localStorage, progres localStorage.
   Satu entry file — tanpa import/export. */

'use strict';

/* ---------- Data contoh (dipakai sebagai seed awal) ---------- */
const KURSUS_SEED = [
  {
    id: 'matematika',
    judul: 'Matematika Dasar',
    kategori: 'Matematika',
    deskripsi: 'Pelajari aljabar, pecahan, dan bangun datar lewat video singkat yang mudah dipahami.',
    video: [
      { id: 'm1', judulVideo: 'Pengantar Aljabar', youtubeId: 'dQw4w9WgXcQ', durasiLabel: '8:24' },
      { id: 'm2', judulVideo: 'Operasi Pecahan', youtubeId: 'dQw4w9WgXcQ', durasiLabel: '10:05' },
      { id: 'm3', judulVideo: 'Luas Bangun Datar', youtubeId: 'dQw4w9WgXcQ', durasiLabel: '12:40' }
    ]
  },
  {
    id: 'ipa',
    judul: 'IPA: Alam Sekitar',
    kategori: 'IPA',
    deskripsi: 'Eksplorasi sains sehari-hari: tumbuhan, energi, dan tata surya dengan eksperimen sederhana.',
    video: [
      { id: 'i1', judulVideo: 'Fotosintesis', youtubeId: 'dQw4w9WgXcQ', durasiLabel: '9:12' },
      { id: 'i2', judulVideo: 'Sumber Energi', youtubeId: 'dQw4w9WgXcQ', durasiLabel: '7:48' },
      { id: 'i3', judulVideo: 'Tata Surya', youtubeId: 'dQw4w9WgXcQ', durasiLabel: '11:30' },
      { id: 'i4', judulVideo: 'Daur Air', youtubeId: 'dQw4w9WgXcQ', durasiLabel: '6:55' }
    ]
  },
  {
    id: 'bahasa-indonesia',
    judul: 'Bahasa Indonesia',
    kategori: 'Bahasa Indonesia',
    deskripsi: 'Tingkatkan kemampuan membaca, menulis, dan bercerita dengan materi interaktif.',
    video: [
      { id: 'b1', judulVideo: 'Mengenal Puisi', youtubeId: 'dQw4w9WgXcQ', durasiLabel: '8:02' },
      { id: 'b2', judulVideo: 'Menulis Cerita Pendek', youtubeId: 'dQw4w9WgXcQ', durasiLabel: '13:18' },
      { id: 'b3', judulVideo: 'Ide Pokok Paragraf', youtubeId: 'dQw4w9WgXcQ', durasiLabel: '9:45' }
    ]
  }
];

/* ---------- Penyimpanan: BOLO_DB (Turso) dengan cache in-memory ---------- */
const LS_ADMIN = 'e-learning.adminSession';
const LS_USER = 'e-learning.userSession';
const LS_WATCHED = 'e-learning.watched';

// Akun contoh: 1 guru + 10 siswa (diseed ke DB bila tabel users kosong)
const USERS_SEED = [
  { username: 'guru', password: 'guru123', role: 'admin' },
  { username: 'siswa1', password: 'siswa123', role: 'siswa' },
  { username: 'siswa2', password: 'siswa123', role: 'siswa' },
  { username: 'siswa3', password: 'siswa123', role: 'siswa' },
  { username: 'siswa4', password: 'siswa123', role: 'siswa' },
  { username: 'siswa5', password: 'siswa123', role: 'siswa' },
  { username: 'siswa6', password: 'siswa123', role: 'siswa' },
  { username: 'siswa7', password: 'siswa123', role: 'siswa' },
  { username: 'siswa8', password: 'siswa123', role: 'siswa' },
  { username: 'siswa9', password: 'siswa123', role: 'siswa' },
  { username: 'siswa10', password: 'siswa123', role: 'siswa' }
];

// Cache in-memory (dibaca sinkron oleh render; ditulis ke DB async)
let cacheCourses = [];
let cacheProgress = {}; // { [videoId]: { done, watchedAt } }
let cacheUsers = [];
let dbReady = false;

// User yang sedang login (untuk progres per siswa)
function currentUser() {
  return loadJSON(LS_USER, null);
}
function setUser(u) {
  saveJSON(LS_USER, u || null);
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------- Data kursus: cache sinkron + persist BOLO_DB ---------- */
function getCourses() {
  if (dbReady || cacheCourses.length) return cacheCourses;
  // Fallback sebelum DB siap (pernah dipakai lokal)
  return cacheCourses.length ? cacheCourses : loadJSON('e-learning.courses', []);
}

function findCourse(id) {
  return getCourses().find(function (x) { return x.id === id; });
}

// Normalisasi: kursus (nested) <-> tabel courses + videos
function courseToRows(k) {
  return {
    course: { id: k.id, title: k.judul, category: k.kategori, description: k.deskripsi || '' },
    videos: (k.video || []).map(function (v) {
      return {
        id: v.id, course_id: k.id, title: v.judulVideo,
        description: '', youtube_url: v.youtubeId, durasi_label: v.durasiLabel || ''
      };
    })
  };
}
function rowsToCourse(row, videoRows) {
  return {
    id: row.id,
    judul: row.title,
    kategori: row.category,
    deskripsi: row.description || '',
    video: (videoRows || []).map(function (v) {
      return {
        id: v.id, judulVideo: v.title, youtubeId: v.youtube_url,
        durasiLabel: v.durasi_label || ''
      };
    })
  };
}

// Persist satu kursus (upsert course + ganti video rows) ke DB
async function persistCourse(k) {
  const r = courseToRows(k);
  let res;
  try {
    res = await BOLO_DB.update('courses', r.course); // upsert: update dulu
  } catch (e) { res = null; }
  if (!res || !res.changes) await BOLO_DB.insert('courses', r.course);
  // video: ganti semua (hapus punya kursus ini lalu insert ulang)
  const existing = await BOLO_DB.list('videos');
  const olds = (existing.rows || []).filter(function (v) { return v.course_id === k.id; });
  for (let i = 0; i < olds.length; i++) await BOLO_DB.remove('videos', olds[i].id);
  for (let i = 0; i < r.videos.length; i++) await BOLO_DB.insert('videos', r.videos[i]);
}
// Hapus kursus + videonya di DB
async function removeCourseFromDb(id) {
  await BOLO_DB.remove('courses', id);
  const existing = await BOLO_DB.list('videos');
  const olds = (existing.rows || []).filter(function (v) { return v.course_id === id; });
  for (let i = 0; i < olds.length; i++) await BOLO_DB.remove('videos', olds[i].id);
}
// Simpan cache + persist seluruh daftar ke DB (diff: hanya kursus berubah yang ditulis)
function saveCourses(list) {
  cacheCourses = list;
  if (!window.BOLO_DB) return true;
  const prev = list;
  list.forEach(function (k) {
    persistCourse(k).catch(function (e) { console.error('gagal simpan kursus', e); });
  });
  return true;
}

/* ---------- Progres: cache sinkron + persist BOLO_DB ---------- */
function getProgress() {
  return cacheProgress;
}

function getWatched() {
  return loadJSON(LS_WATCHED, []);
}

function saveWatched(w) {
  return saveJSON(LS_WATCHED, w.slice(0, 30));
}

function progresKursus(k) {
  const p = getProgress();
  const total = k.video.length;
  if (!total) return { done: 0, pct: 0 };
  const done = k.video.filter(function (v) {
    return p[v.id] && p[v.id].done;
  }).length;
  return { done: done, pct: Math.round((done / total) * 100) };
}
// Catat tontonan (riwayat: videoId unik, tersimpan paling baru di atas)
function catatTontonan(k, v) {
  const w = getWatched().filter(function (x) { return x.videoId !== v.id; });
  w.unshift({
    videoId: v.id,
    judulVideo: v.judulVideo,
    kursusId: k.id,
    judulKursus: k.judul,
    watchedAt: new Date().toISOString()
  });
  saveWatched(w);
}
// Toggle status selesai per video (upsert ke DB progress)
async function persistProgress(videoId, done, watchedAt) {
  const u = currentUser();
  const username = (u && u.username) || 'siswa';
  const row = { video_id: videoId, username: username, done: done ? 1 : 0, watched_at: watchedAt };
  try {
    await BOLO_DB.update('progress', row); // ada -> update
  } catch (e) {
    try { await BOLO_DB.insert('progress', row); } catch (e2) { console.error('gagal simpan progres', e2); }
  }
}
function setDoneState(k, v, done) {
  const p = getProgress();
  const prev = p[v.id] || {};
  p[v.id] = {
    done: done,
    watchedAt: done ? new Date().toISOString() : (prev.watchedAt || new Date().toISOString())
  };
  if (window.BOLO_DB) persistProgress(v.id, done, p[v.id].watchedAt);
  catatTontonan(k, v);
}

/* ---------- Mode admin / sesi user ---------- */
function isAdmin() {
  const u = currentUser();
  return !!(u && u.role === 'admin');
}

function setAdmin(on) {
  // Dipertahankan utk kompatibilitas; admin ditentukan dari sesi user.
  saveJSON(LS_ADMIN, !!on);
}

function logout() {
  setUser(null);
  setAdmin(false);
  location.hash = '#/masuk';
  render();
}

// Otentikasi terhadap tabel users (cache dari DB)
function findUser(username, password) {
  const name = String(username || '').trim().toLowerCase();
  if (!name) return null;
  return cacheUsers.find(function (u) {
    return String(u.username).toLowerCase() === name && String(u.password) === String(password);
  }) || null;
}

/* ---------- Helper kecil ---------- */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function totalVideo(k) {
  return k.video.length;
}

function thumbUrl(v) {
  return 'https://img.youtube.com/vi/' + encodeURIComponent(v.youtubeId) + '/hqdefault.jpg';
}

function embedUrl(v) {
  return 'https://www.youtube.com/embed/' + encodeURIComponent(v.youtubeId);
}

function formatWaktu(iso) {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return iso;
  }
}

/* ---------- Render halaman ---------- */
function renderKartuKursus(k) {
  const pr = progresKursus(k);
  return (
    '<a class="course-card" href="#/kursus/' + encodeURIComponent(k.id) + '">' +
      '<div class="course-top">' +
        '<h3 class="course-title">' + esc(k.judul) + '</h3>' +
        '<span class="badge">' + esc(k.kategori) + '</span>' +
      '</div>' +
      '<p class="course-desc">' + esc(k.deskripsi) + '</p>' +
      '<div class="course-meta">' +
        '<span>📺 <span class="count">' + totalVideo(k) + ' video</span></span>' +
      '</div>' +
      '<div class="progress-row">' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pr.pct + '%"></div></div>' +
        '<span class="progress-label">' + pr.pct + '% selesai</span>' +
      '</div>' +
    '</a>'
  );
}

function renderRiwayat() {
  const w = getWatched().slice(0, 5);
  if (!w.length) {
    return (
      '<section class="riwayat-card">' +
        '<h2 class="riwayat-title">Riwayat Tontonan</h2>' +
        '<p class="riwayat-empty">Belum ada tontonan. Buka salah satu kursus dan mulai belajar! 🎬</p>' +
      '</section>'
    );
  }
  const items = w.map(function (x) {
    return (
      '<li class="riwayat-item">' +
        '<span class="riwayat-video">' + esc(x.judulVideo) + '</span>' +
        '<span class="riwayat-kursus">' + esc(x.judulKursus) + '</span>' +
        '<time class="riwayat-waktu">' + esc(formatWaktu(x.watchedAt)) + '</time>' +
      '</li>'
    );
  }).join('');
  return (
    '<section class="riwayat-card">' +
      '<h2 class="riwayat-title">Riwayat Tontonan</h2>' +
      '<ul class="riwayat-list">' + items + '</ul>' +
    '</section>'
  );
}

function renderDashboard() {
  const kursus = getCourses();
  return (
    '<section class="page-head">' +
      '<h1 class="page-title">Halo, Siswa 👋</h1>' +
      '<p class="page-sub">Pilih kursus dan mulai belajar lewat video pilihanmu.</p>' +
    '</section>' +
    renderSlider(kursus) +
    '<section class="grid-courses">' +
      kursus.map(renderKartuKursus).join('') +
    '</section>' +
    renderRiwayat()
  );
}

/* Slider / carousel kursus unggulan di halaman depan */
function renderSlider(kursus) {
  const items = (kursus || []).slice(0, 5);
  if (!items.length) return '';
  const slides = items.map(function (k, i) {
    const pct = progresKursus(k).pct;
    return (
      '<a class="slide" href="#/kursus/' + encodeURIComponent(k.id) + '" style="--i:' + i + '">' +
        '<span class="slide-badge">' + esc(k.kategori) + '</span>' +
        '<span class="slide-title">' + esc(k.judul) + '</span>' +
        '<span class="slide-desc">' + esc(k.deskripsi) + '</span>' +
        '<span class="slide-meta">📺 ' + totalVideo(k) + ' video • ' + pct + '% selesai</span>' +
        '<span class="slide-cta">Mulai Belajar →</span>' +
      '</a>'
    );
  }).join('');
  const dots = items.map(function (_, i) {
    return '<button type="button" class="slider-dot" data-slide="' + i + '" aria-label="Slide ' + (i + 1) + '"></button>';
  }).join('');
  return (
    '<section class="slider" aria-label="Kursus unggulan">' +
      '<div class="slider-track">' + slides + '</div>' +
      '<button type="button" class="slider-nav slider-prev" aria-label="Sebelumnya">‹</button>' +
      '<button type="button" class="slider-nav slider-next" aria-label="Berikutnya">›</button>' +
      '<div class="slider-dots">' + dots + '</div>' +
    '</section>'
  );
}

function renderDaftarKursus() {
  const kursus = getCourses();
  return (
    '<section class="page-head">' +
      '<h1 class="page-title">Semua Kursus</h1>' +
      '<p class="page-sub">' + kursus.length + ' kursus tersedia untuk kamu pelajari.</p>' +
    '</section>' +
    '<section class="grid-courses">' +
      kursus.map(renderKartuKursus).join('') +
    '</section>'
  );
}

function renderDetailKursus(id, videoId) {
  const k = findCourse(id);
  if (!k) {
    return (
      '<section class="placeholder-card">' +
        '<h2>Kursus tidak ditemukan</h2>' +
        '<p>Kembali ke <a href="#/">dashboard</a> untuk memilih kursus lain.</p>' +
      '</section>'
    );
  }

  const v = k.video.find(function (x) { return x.id === videoId; }) || k.video[0];
  const pr = progresKursus(k);
  const p = getProgress();
  const st = p[v.id] || {};
  const isDone = !!st.done;

  // Update "terakhir ditonton" setiap video dibuka
  catatTontonan(k, v);

  const listItems = k.video.map(function (x) {
    const d = p[x.id] && p[x.id].done;
    const active = x.id === v.id;
    return (
      '<a class="video-item' + (active ? ' active' : '') + '" href="#/kursus/' +
        encodeURIComponent(k.id) + '/' + encodeURIComponent(x.id) +
        '" aria-label="Tonton ' + esc(x.judulVideo) + '">' +
        '<img class="video-thumb" src="' + thumbUrl(x) + '" alt="Thumbnail ' + esc(x.judulVideo) + '" loading="lazy">' +
        '<span class="video-body">' +
          '<span class="video-title">' + esc(x.judulVideo) + '</span>' +
          '<span class="video-meta-row">' +
            '<span class="video-durasi">⏱ ' + esc(x.durasiLabel) + '</span>' +
            '<span class="status-badge' + (d ? ' is-done' : '') + '">' + (d ? '✓ Selesai' : 'Belum') + '</span>' +
          '</span>' +
        '</span>' +
      '</a>'
    );
  }).join('');

  return (
    '<a class="back-link" href="#/kursus">← Semua Kursus</a>' +
    '<section class="page-head">' +
      '<span class="badge">' + esc(k.kategori) + '</span>' +
      '<h1 class="page-title" style="margin-top:10px">' + esc(k.judul) + '</h1>' +
      '<p class="page-sub">' + esc(k.deskripsi) + '</p>' +
      '<div class="progress-row detail-progress">' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pr.pct + '%"></div></div>' +
        '<span class="progress-label">' + pr.pct + '% • ' + pr.done + '/' + totalVideo(k) + ' video</span>' +
      '</div>' +
    '</section>' +

    '<section class="player-card" aria-label="Pemutar video">' +
      '<div class="player-wrap">' +
        '<iframe src="' + embedUrl(v) + '" title="' + esc(v.judulVideo) +
          '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"' +
          ' allowfullscreen referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>' +
      '</div>' +
      '<div class="player-info">' +
        '<div class="player-caption">' +
          '<h2 class="player-title">' + esc(v.judulVideo) + '</h2>' +
          '<span class="video-durasi">⏱ ' + esc(v.durasiLabel) + '</span>' +
        '</div>' +
        '<button type="button" class="btn-toggle' + (isDone ? ' is-done' : '') + '"' +
          ' data-action="toggle-done" data-video="' + esc(v.id) + '" aria-pressed="' + isDone + '">' +
          (isDone ? '✓ Tandai Belum Selesai' : 'Tandai Selesai') +
        '</button>' +
      '</div>' +
    '</section>' +

    '<section class="video-section">' +
      '<h2 class="section-title">Daftar Video (' + totalVideo(k) + ')</h2>' +
      '<div class="video-list">' + listItems + '</div>' +
    '</section>'
  );
}

/* ---------- Router ---------- */
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const parts = raw.split('/').filter(Boolean); // ['kursus','matematika','m1'] dst.
  return { raw: raw, parts: parts };
}

/* ---------- Admin: kelola materi ---------- */

// Ekstrak youtubeId dari URL watch?v= / youtu.be / embed; fallback seluruh input
function extractYoutubeId(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  const m = s.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : s;
}

function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function renderLogin() {
  return (
    '<section class="login-wrap">' +
      '<div class="login-brand">' +
        '<div class="login-brand-icon">🎓</div>' +
        '<h1 class="login-title">Portal Belajar</h1>' +
        '<p class="login-tagline">Masuk untuk melanjutkan belajar atau mengelola materi.</p>' +
      '</div>' +
      '<form id="login-form" class="login-card" novalidate>' +
        '<div class="field">' +
          '<label class="field-label" for="login-user">Username</label>' +
          '<input class="field-input" id="login-user" name="username" type="text" autocomplete="username" placeholder="cth: siswa1 atau guru" required>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label" for="login-pass">Kata sandi</label>' +
          '<input class="field-input" id="login-pass" name="password" type="password" autocomplete="current-password" placeholder="Masukkan kata sandi" required>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary btn-block">Masuk</button>' +
        '<p id="login-error" class="login-error" role="alert"></p>' +
        '<div class="login-hint">' +
          '<p class="login-hint-title">Akun contoh</p>' +
          '<p><strong>Guru:</strong> <code>guru</code> / <code>guru123</code></p>' +
          '<p><strong>Siswa:</strong> <code>siswa1</code> – <code>siswa10</code> / <code>siswa123</code></p>' +
        '</div>' +
      '</form>' +
    '</section>'
  );
}

function renderAdmin() {
  const kursus = getCourses();
  const rows = kursus.map(function (k) {
    return (
      '<div class="admin-row">' +
        '<div class="admin-row-main">' +
          '<span class="badge">' + esc(k.kategori) + '</span>' +
          '<span class="admin-row-title">' + esc(k.judul) + '</span>' +
          '<span class="admin-row-sub">' + totalVideo(k) + ' video</span>' +
        '</div>' +
        '<div class="admin-row-actions">' +
          '<a class="btn btn-ghost" href="#/admin/kursus/' + encodeURIComponent(k.id) + '">Video</a>' +
          '<a class="btn btn-ghost" href="#/admin/kursus/' + encodeURIComponent(k.id) + '/edit">Edit</a>' +
          '<button type="button" class="btn btn-danger" data-admin-delete="' + esc(k.id) + '">Hapus</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  return (
    '<a class="back-link" href="#/">← Dashboard</a>' +
    '<section class="page-head admin-head">' +
      '<h1 class="page-title">Kelola Materi</h1>' +
      '<p class="page-sub">Tambah, ubah, atau hapus kursus dan video untuk siswa.</p>' +
    '</section>' +
    '<a class="btn btn-primary btn-block-sm" href="#/admin/kursus/baru">+ Tambah Kursus</a>' +
    '<section class="admin-list">' +
      (rows || '<p class="empty-state">Belum ada kursus. Tambahkan kursus pertama kamu. 🎉</p>') +
    '</section>'
  );
}

function renderAdminKursus(id) {
  const k = findCourse(id);
  if (!k) {
    return (
      '<section class="placeholder-card">' +
        '<h2>Kursus tidak ditemukan</h2>' +
        '<p>Kembali ke <a href="#/admin">Kelola Materi</a>.</p>' +
      '</section>'
    );
  }
  const items = k.video.map(function (v) {
    return (
      '<div class="admin-row">' +
        '<div class="admin-row-main">' +
          '<span class="admin-row-title">' + esc(v.judulVideo) + '</span>' +
          '<span class="admin-row-sub">⏱ ' + esc(v.durasiLabel) + ' • id: ' + esc(v.youtubeId) + '</span>' +
        '</div>' +
        '<div class="admin-row-actions">' +
          '<a class="btn btn-ghost" href="#/admin/kursus/' + encodeURIComponent(k.id) + '/video/' + encodeURIComponent(v.id) + '/edit">Edit</a>' +
          '<button type="button" class="btn btn-danger" data-admin-delvideo="' + esc(v.id) + '">Hapus</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  return (
    '<a class="back-link" href="#/admin">← Kelola Materi</a>' +
    '<section class="page-head admin-head">' +
      '<span class="badge">' + esc(k.kategori) + '</span>' +
      '<h1 class="page-title" style="margin-top:10px">' + esc(k.judul) + '</h1>' +
      '<p class="page-sub">' + esc(k.deskripsi) + '</p>' +
    '</section>' +
    '<a class="btn btn-primary btn-block-sm" href="#/admin/kursus/' + encodeURIComponent(k.id) + '/video/baru">+ Tambah Video</a>' +
    '<section class="admin-list">' +
      (items || '<p class="empty-state">Belum ada video di kursus ini.</p>') +
    '</section>'
  );
}

function renderFormKursus(id) {
  const editing = id !== 'baru';
  const k = editing ? findCourse(id) : null;
  if (editing && !k) {
    return (
      '<section class="placeholder-card"><h2>Kursus tidak ditemukan</h2>' +
      '<p>Kembali ke <a href="#/admin">Kelola Materi</a>.</p></section>'
    );
  }
  const v = k || {};
  return (
    '<a class="back-link" href="#/admin">← Kelola Materi</a>' +
    '<section class="page-head"><h1 class="page-title">' + (editing ? 'Edit Kursus' : 'Tambah Kursus') + '</h1></section>' +
    '<form id="course-form" class="form-card" novalidate>' +
      '<div class="field">' +
        '<label class="field-label" for="f-judul">Judul kursus *</label>' +
        '<input class="field-input" id="f-judul" name="judul" type="text" required value="' + esc(v.judul || '') + '" placeholder="mis. Matematika Dasar">' +
      '</div>' +
      '<div class="field">' +
        '<label class="field-label" for="f-kategori">Kategori *</label>' +
        '<input class="field-input" id="f-kategori" name="kategori" type="text" required value="' + esc(v.kategori || '') + '" placeholder="mis. Matematika">' +
      '</div>' +
      '<div class="field">' +
        '<label class="field-label" for="f-deskripsi">Deskripsi</label>' +
        '<textarea class="field-input" id="f-deskripsi" name="deskripsi" rows="3" placeholder="Ringkasan singkat kursus">' + esc(v.deskripsi || '') + '</textarea>' +
      '</div>' +
      '<input type="hidden" name="id" value="' + esc(editing ? k.id : '') + '">' +
      '<div class="form-actions">' +
        '<button type="submit" class="btn btn-primary">' + (editing ? 'Simpan Perubahan' : 'Simpan Kursus') + '</button>' +
        '<a class="btn btn-ghost" href="#/admin">Batal</a>' +
      '</div>' +
      '<p id="form-error" class="login-error" role="alert"></p>' +
    '</form>'
  );
}

function renderFormVideo(kursusId, videoId) {
  const k = findCourse(kursusId);
  if (!k) {
    return (
      '<section class="placeholder-card"><h2>Kursus tidak ditemukan</h2>' +
      '<p>Kembali ke <a href="#/admin">Kelola Materi</a>.</p></section>'
    );
  }
  const editing = videoId !== 'baru';
  const v = editing ? k.video.find(function (x) { return x.id === videoId; }) : null;
  if (editing && !v) {
    return (
      '<section class="placeholder-card"><h2>Video tidak ditemukan</h2>' +
      '<p>Kembali ke <a href="#/admin/kursus/' + encodeURIComponent(k.id) + '">kelola video</a>.</p></section>'
    );
  }
  const cur = v || {};
  return (
    '<a class="back-link" href="#/admin/kursus/' + encodeURIComponent(k.id) + '">← Kelola Video</a>' +
    '<section class="page-head"><h1 class="page-title">' + (editing ? 'Edit Video' : 'Tambah Video') + '</h1>' +
      '<p class="page-sub">Kursus: ' + esc(k.judul) + '</p></section>' +
    '<form id="video-form" class="form-card" novalidate>' +
      '<div class="field">' +
        '<label class="field-label" for="f-vjudul">Judul video *</label>' +
        '<input class="field-input" id="f-vjudul" name="judulVideo" type="text" required value="' + esc(cur.judulVideo || '') + '" placeholder="mis. Pengantar Aljabar">' +
      '</div>' +
      '<div class="field">' +
        '<label class="field-label" for="f-vlink">Link YouTube *</label>' +
        '<input class="field-input" id="f-vlink" name="link" type="text" required value="' + esc(cur.youtubeId || '') + '" placeholder="https://www.youtube.com/watch?v=...">' +
        '<p class="field-hint">Tempel tautan watch?v= / youtu.be / embed. Jika bukan tautan, cukup id video.</p>' +
      '</div>' +
      '<div class="field">' +
        '<label class="field-label" for="f-vdurasi">Durasi *</label>' +
        '<input class="field-input" id="f-vdurasi" name="durasiLabel" type="text" required value="' + esc(cur.durasiLabel || '') + '" placeholder="mis. 8:24">' +
      '</div>' +
      '<input type="hidden" name="kursusId" value="' + esc(k.id) + '">' +
      '<input type="hidden" name="videoId" value="' + esc(editing ? v.id : '') + '">' +
      '<div class="form-actions">' +
        '<button type="submit" class="btn btn-primary">' + (editing ? 'Simpan Perubahan' : 'Simpan Video') + '</button>' +
        '<a class="btn btn-ghost" href="#/admin/kursus/' + encodeURIComponent(k.id) + '">Batal</a>' +
      '</div>' +
      '<p id="form-error" class="login-error" role="alert"></p>' +
    '</form>'
  );
}

// CRUD
function saveCourseFromForm(fd) {
  const list = getCourses();
  const judul = fd.get('judul').trim();
  const kategori = fd.get('kategori').trim();
  const deskripsi = fd.get('deskripsi').trim();
  const editingId = fd.get('id');
  if (!judul || !kategori) return 'Judul dan kategori wajib diisi.';

  if (editingId) {
    const k = list.find(function (x) { return x.id === editingId; });
    if (!k) return 'Kursus tidak ditemukan.';
    k.judul = judul;
    k.kategori = kategori;
    k.deskripsi = deskripsi;
  } else {
    list.push({
      id: uid('kursus'),
      judul: judul,
      kategori: kategori,
      deskripsi: deskripsi,
      video: []
    });
  }
  saveCourses(list);
  return null;
}

function saveVideoFromForm(fd) {
  const list = getCourses();
  const kursusId = fd.get('kursusId');
  const videoId = fd.get('videoId');
  const k = list.find(function (x) { return x.id === kursusId; });
  if (!k) return 'Kursus tidak ditemukan.';

  const judulVideo = fd.get('judulVideo').trim();
  const link = fd.get('link').trim();
  const durasiLabel = fd.get('durasiLabel').trim();
  if (!judulVideo || !link || !durasiLabel) return 'Semua kolom video wajib diisi.';
  const youtubeId = extractYoutubeId(link);
  if (!youtubeId) return 'Link YouTube tidak valid.';

  if (videoId) {
    const v = k.video.find(function (x) { return x.id === videoId; });
    if (!v) return 'Video tidak ditemukan.';
    v.judulVideo = judulVideo;
    v.youtubeId = youtubeId;
    v.durasiLabel = durasiLabel;
  } else {
    k.video.push({ id: uid('vid'), judulVideo: judulVideo, youtubeId: youtubeId, durasiLabel: durasiLabel });
  }
  saveCourses(list);
  return null;
}

function deleteCourse(id) {
  const list = getCourses().filter(function (x) { return x.id !== id; });
  saveCourses(list);
  if (window.BOLO_DB) removeCourseFromDb(id).catch(function (e) { console.error('gagal hapus kursus', e); });
}

function deleteVideo(kursusId, videoId) {
  const list = getCourses();
  const k = list.find(function (x) { return x.id === kursusId; });
  if (!k) return;
  k.video = k.video.filter(function (x) { return x.id !== videoId; });
  saveCourses(list);
}

/* ---------- Render utama ---------- */
function render() {
  const app = document.getElementById('app');
  const { parts } = parseHash();

  let html = '';
  let activeRoute = '/';

  if (parts.length === 0) {
    // Belum login → tampilkan halaman login dulu
    html = currentUser() ? renderDashboard() : renderLogin();
  } else if (parts[0] === 'masuk') {
    html = renderLogin();
    activeRoute = '/masuk';
  } else if (parts[0] === 'kursus' && parts.length === 1) {
    html = currentUser() ? renderDaftarKursus() : renderLogin();
    activeRoute = '/kursus';
  } else if (parts[0] === 'kursus' && parts.length >= 2) {
    html = currentUser() ? renderDetailKursus(decodeURIComponent(parts[1]), parts.length >= 3 ? decodeURIComponent(parts[2]) : null) : renderLogin();
    activeRoute = '/kursus';
  } else {
    // Halaman admin butuh sesi aktif
    if (!isAdmin()) {
      html = renderLogin();
    } else if (parts.length === 1) {
      html = renderAdmin();
      activeRoute = '/admin';
    } else if (parts[1] === 'kursus' && parts[2] === 'baru' && parts.length === 3) {
      html = renderFormKursus('baru');
      activeRoute = '/admin';
    } else if (parts[1] === 'kursus' && parts.length === 3) {
      html = renderAdminKursus(decodeURIComponent(parts[2] || ''));
      activeRoute = '/admin';
    } else if (parts[1] === 'kursus' && parts[3] === 'edit' && parts.length === 4) {
      html = renderFormKursus(decodeURIComponent(parts[2]));
      activeRoute = '/admin';
    } else if (parts[1] === 'kursus' && parts[3] === 'video' && parts.length === 6 && parts[5] === 'edit') {
      html = renderFormVideo(decodeURIComponent(parts[2]), decodeURIComponent(parts[4]));
      activeRoute = '/admin';
    } else if (parts[1] === 'kursus' && parts[3] === 'video' && parts.length === 5 && parts[4] === 'baru') {
      html = renderFormVideo(decodeURIComponent(parts[2]), 'baru');
      activeRoute = '/admin';
    } else {
      html = renderAdmin();
      activeRoute = '/admin';
    }
  }

  app.innerHTML = html;
  app.scrollTop = 0;

  // Aksi tombol "Tandai Selesai / Belum"
  app.querySelectorAll('[data-action="toggle-done"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const p2 = parseHash().parts;
      const k = findCourse(decodeURIComponent(p2[1]));
      const v = k && k.video.find(function (x) { return x.id === btn.getAttribute('data-video'); });
      if (!k || !v) return;
      const st = getProgress()[v.id] || {};
      setDoneState(k, v, !st.done);
      render();
    });
  });

  // Form login (username + kata sandi terhadap tabel users)
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    const errEl = document.getElementById('login-error');
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const fd = new FormData(loginForm);
      const user = findUser(fd.get('username'), fd.get('password'));
      if (!user) {
        errEl.textContent = 'Username atau kata sandi salah. Coba lagi.';
        loginForm.querySelector('#login-user').focus();
        return;
      }
      setUser({ username: user.username, role: user.role });
      setAdmin(user.role === 'admin');
      // Arahkan sesuai peran; hashchange akan memicu render() otomatis.
      const target = user.role === 'admin' ? '#/admin' : '#/';
      if (location.hash === target) {
        render();
      } else {
        location.hash = target;
      }
    });
  }

  // Form kursus
  const courseForm = document.getElementById('course-form');
  if (courseForm) {
    courseForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const err = saveCourseFromForm(new FormData(courseForm));
      const errEl = document.getElementById('form-error');
      if (err) { errEl.textContent = err; return; }
      location.hash = '#/admin';
      render();
    });
  }

  // Form video
  const videoForm = document.getElementById('video-form');
  if (videoForm) {
    videoForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const fd = new FormData(videoForm);
      const err = saveVideoFromForm(fd);
      const errEl = document.getElementById('form-error');
      if (err) { errEl.textContent = err; return; }
      location.hash = '#/admin/kursus/' + encodeURIComponent(fd.get('kursusId'));
      render();
    });
  }

  // Hapus kursus
  app.querySelectorAll('[data-admin-delete]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.getAttribute('data-admin-delete');
      const k = findCourse(id);
      if (!k) return;
      if (window.confirm('Hapus kursus "' + k.judul + '" beserta semua videonya?')) {
        deleteCourse(id);
        render();
      }
    });
  });

  // Hapus video
  app.querySelectorAll('[data-admin-delvideo]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const p2 = parseHash().parts;
      const kursusId = decodeURIComponent(p2[2]);
      const videoId = btn.getAttribute('data-admin-delvideo');
      if (window.confirm('Hapus video ini?')) {
        deleteVideo(kursusId, videoId);
        render();
      }
    });
  });

  // Sorot menu aktif + tampilkan tautan admin bila sesi admin aktif
  const adminLink = document.getElementById('nav-admin');
  if (adminLink) adminLink.hidden = !isAdmin();
  const logoutBtn = document.getElementById('nav-logout');
  const loginLink = document.getElementById('nav-login');
  const loggedIn = !!currentUser();
  if (logoutBtn) logoutBtn.hidden = !loggedIn;
  if (loginLink) loginLink.hidden = loggedIn;

  // Chip user di header (mirip avatar app)
  const headerUser = document.getElementById('header-user');
  const userChip = document.getElementById('user-chip');
  if (headerUser) headerUser.hidden = !loggedIn;
  if (userChip && loggedIn) {
    const u = currentUser();
    userChip.textContent = (u.username || 'User').charAt(0).toUpperCase();
    userChip.title = u.username;
  }

  function wireLogout(el) {
    if (el) {
      el.addEventListener('click', function () {
        logout();
      });
    }
  }
  wireLogout(logoutBtn);
  wireLogout(document.getElementById('nav-logout-mobile'));

  document.querySelectorAll('.tab-item').forEach(function (link) {
    const route = link.getAttribute('data-route');
    link.classList.toggle('active', route === activeRoute);
  });

  // Slider: navigasi panah + dots + scroll-snap
  const slider = document.querySelector('.slider');
  if (slider) {
    const track = slider.querySelector('.slider-track');
    const dots = slider.querySelectorAll('.slider-dot');
    const step = function () {
      const idx = Math.round(track.scrollLeft / track.clientWidth);
      return Math.max(0, Math.min(idx, dots.length - 1));
    };
    const goTo = function (idx) {
      const max = dots.length - 1;
      const i = Math.max(0, Math.min(idx, max));
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
      updateDots(i);
    };
    const updateDots = function (i) {
      dots.forEach(function (d, di) {
        d.classList.toggle('active', di === i);
      });
    };
    const prev = slider.querySelector('.slider-prev');
    const next = slider.querySelector('.slider-next');
    if (prev) prev.addEventListener('click', function () { goTo(step() - 1); });
    if (next) next.addEventListener('click', function () { goTo(step() + 1); });
    dots.forEach(function (d) {
      d.addEventListener('click', function () { goTo(parseInt(d.getAttribute('data-slide'), 10)); });
    });
    track.addEventListener('scroll', function () { updateDots(step()); }, { passive: true });
    updateDots(0);
  }

  window.scrollTo(0, 0);
}

/* ---------- Init: muat data dari BOLO_DB lalu render ---------- */
async function initData() {
  try {
    if (!window.BOLO_DB) throw new Error('BOLO_DB tidak ada');
    // Kursus: courses + videos -> cache nested
    const cr = await BOLO_DB.list('courses');
    const vr = await BOLO_DB.list('videos');
    const vrows = (vr && vr.rows) || [];
    const courseRows = (cr && cr.rows) || [];
    // Seed bila DB kosong
    if (!courseRows.length) {
      for (let i = 0; i < KURSUS_SEED.length; i++) {
        await persistCourse(KURSUS_SEED[i]);
      }
      const cr2 = await BOLO_DB.list('courses');
      const vr2 = await BOLO_DB.list('videos');
      cacheCourses = rowsToCourses((cr2 && cr2.rows) || [], (vr2 && vr2.rows) || []);
    } else {
      cacheCourses = rowsToCourses(courseRows, vrows);
    }
    // Progres: rows -> { [video_id]: {done, watchedAt} }
    const pr = await BOLO_DB.list('progress');
    const prog = {};
    ((pr && pr.rows) || []).forEach(function (r) {
      prog[r.video_id] = { done: !!r.done, watchedAt: r.watched_at || '' };
    });
    cacheProgress = prog;
    // Users: ambil dari DB; seed bila kosong
    const ur = await BOLO_DB.list('users');
    const urows = (ur && ur.rows) || [];
    if (urows.length) {
      cacheUsers = urows;
    } else {
      for (let i = 0; i < USERS_SEED.length; i++) {
        try { await BOLO_DB.insert('users', USERS_SEED[i]); } catch (e) { /* duplikat */ }
      }
      cacheUsers = USERS_SEED;
    }
    dbReady = true;
  } catch (e) {
    // DB tak terjangkau: fallback ke localStorage lama (mode offline/preview lama)
    const legacy = loadJSON('e-learning.courses', null);
    cacheCourses = legacy || KURSUS_SEED;
    cacheProgress = loadJSON('e-learning.progress', {});
    cacheUsers = USERS_SEED;
    dbReady = false;
  }
  render();
}
function rowsToCourses(courseRows, videoRows) {
  return courseRows.map(function (c) {
    return rowsToCourse(c, videoRows.filter(function (v) { return v.course_id === c.id; }));
  });
}
window.addEventListener('hashchange', render);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initData);
} else {
  initData();
}
