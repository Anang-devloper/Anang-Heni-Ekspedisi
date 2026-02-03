# Anang Heni Ekspedisi — Static Website

Ini adalah situs statis untuk "Anang Heni Ekspedisi" siap di-deploy ke Vercel (hosting gratis untuk proyek statis).

## Struktur file
- `index.html` — Halaman utama
- `assets/styles.css` — Stylesheet utama
- `assets/script.js` — Interaksi frontend (navbar, demo tracking)
- `assets/favicon.svg` — Logo sederhana
- `vercel.json` — (optional) konfigurasi Vercel

## Cara cepat deploy ke Vercel (via GitHub)
1. Buat repository baru di GitHub dan push semua file.
2. Buka https://vercel.com dan login.
3. Pilih "New Project" → import repository Anda.
4. Gunakan pengaturan default (Build Command kosong untuk situs statis). Klik Deploy.
5. Selesai — site akan tersedia di subdomain vercel.app, Anda bisa tambahkan custom domain.

## Cara cepat deploy via Vercel CLI
1. Install Vercel CLI:
```bash
npm i -g vercel
```
2. Inisialisasi dari folder proyek:
```bash
vercel
```
3. Ikuti prompt dan deploy.

## Menghubungkan form dan pelacakan real-time
- Form permintaan penawaran saat ini diarahkan ke `https://formsubmit.co/your-email@example.com`. Ganti `your-email@example.com` dengan email Anda atau pakai endpoint serverless (Vercel Functions) / CRM.
- Modul pelacakan pada `assets/script.js` adalah demo. Untuk data real-time:
  - Integrasikan API kurir (mis. kurir internal, EasyParcel, JNE API, atau API pihak ketiga) di backend.
  - Buat endpoint serverless (Vercel Function) yang memanggil API kurir dan mengembalikan hasil JSON, lalu ubah script frontend agar memanggil endpoint tersebut.

## Kustomisasi cepat
- Ganti warna primer di `assets/styles.css :root` untuk palet brand.
- Ganti logo di `assets/favicon.svg`.
- Update metadata (title, description, og:image) di `index.html` untuk SEO.

## Catatan keamanan & produksi
- Jika memakai layanan form pihak ketiga, pastikan konfigurasi anti-spam / validasi.
- Untuk nomor telepon & email nyata, letakkan di `.env` pada backend atau konfig serverless, jangan hardcode jika sensitif.
- Tambahkan HTTPS (Vercel otomatis), Content-Security-Policy, dan header keamanan jika diperlukan.

Jika Anda mau, saya bisa:
- Menyisipkan integrasi pelacakan real ke API kurir tertentu (sebutkan kurir/layanan).
- Membuat halaman tambahan: FAQ, Pricing, Terms, atau panel admin sederhana.
- Membuat desain alternatif (warna/typo/logo) sesuai brand guideline Anda.
