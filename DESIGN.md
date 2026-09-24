*Status: disetujui*
# DESIGN: Portal Belajar (E-Learning Siswa)

## Token inti (bisa diganti)
- **Warna dominan:** `#10b1eb` (aksen biru) · `#095c8a` (biru tua) · `#ebf397` (kuning lembut) · `#5057b2` (ungu) · `#b8a6cc` (ungu muda) — diadaptasi ke skema netral: `#0f172a` (teks) · `#f8fafc` (bg) · `#ffffff` (surface)
- **Aksen:** `#10b1eb`
- **Font judul:** Google Sans (fallback Inter) · **Font isi:** Google Sans Text (fallback Inter)
- **Mood:** modern, bersih, fokus konten
- **Referensi INSPO:** `material-io`, `amie-so`

## Token lengkap
### Tone
Prioritas pada kejelasan dan fungsionalitas dengan tata letak bersih dan lega. Tipografi lugas dan mudah dibaca, menekankan hierarki konten. Palet terkendali, mengandalkan nada kalem dan banyak ruang putih untuk kesan profesional (gaya Material, cocok untuk portal belajar).

### Colors (diadaptasi)
| Hex | Role |
|---|---|
| `#10b1eb` | primary / aksen |
| `#095c8a` | primary gelap (hover/teks penting) |
| `#ebf397` | highlight kuning |
| `#5057b2` | aksen sekunder |
| `#b8a6cc` | muted / badge |

Base surface diadaptasi: `#ffffff` (card/surface) · `#f1f5f9` (bg lembut) · `#0f172a` (teks utama) · `#64748b` (teks sekunder) · `#ef4444` (status belum selesai) · `#22c55e` (status selesai).

### Typography
| Role | Family | Size | Weight | Line-height |
|---|---|---|---|---|
| h1 | Google Sans / Inter | 32–40px | 700 | 1.1 |
| h2 | Google Sans / Inter | 24–28px | 700 | 1.2 |
| h3 | Google Sans Text / Inter | 16–18px | 600 | 1.4 |
| body | Google Sans Text / Inter | 16px | 400 | 1.5 |
| button | Google Sans Text / Inter | 14–16px | 500 | 1.5 |

### Spacing scale
`4px` · `8px` · `12px` · `16px` · `20px` · `24px` · `32px` · `48px` · `64px` · `96px`
Base step **4px**.

### Border radius
`0px` · `4px` · `8px` · `12px` · `16px` · `24px` — kartu materi pakai 12–16px, tombol pill 24px.

### Container
Max content width: **1080px** (dipersempit dari 1352px agar nyaman dibaca isi kursus). Padding-inline 24px minimum di mobile.

### CSS variables (token inti → `:root`)
```css
:root {
  --color-primary: #10b1eb;
  --color-primary-dark: #095c8a;
  --color-accent: #ebf397;
  --color-secondary: #5057b2;
  --color-muted: #b8a6cc;
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
  --color-success: #22c55e;
  --color-danger: #ef4444;
  --font-heading: "Google Sans", "Inter", system-ui, sans-serif;
  --font-body: "Google Sans Text", "Inter", system-ui, sans-serif;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 24px;
  --container: 1080px;
}
```

## Catatan
Arah visual: portal belajar yang bersih ala Material — banyak ruang putih, aksen biru `#10b1eb`, kartu materi dengan sudut membulat 12–16px, font Inter untuk keterbacaan. Ambil inspirasi dari `material-io` (gaya Material, komponen sticky nav + feature trio) dan `amie-so` (palet biru lembut); adaptasi, jangan salin. Sertakan komponen: sidebar/nav sticky, kartu kursus, panel pemutar video, dan tabel admin.

[AI pembuat aplikasi tanpa koding](https://boloku.com)
