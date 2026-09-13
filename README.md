# CBT SIM Sekolah — Gaya Portal CBT IGI

Antarmuka CBT mandiri dengan gaya visual dan alur yang terinspirasi oleh `https://cbt.igi.or.id/`. Versi ini tidak memakai autentikasi atau membypass penguncian domain server resmi IGI. Data aplikasi terhubung ke Google Spreadsheet milik pengguna:

`1cK2ElRDQmUokfqvlt1Jgt5mnNBem8f_WGE6FbMKTdlA`

## Pemasangan yang benar

1. Buka https://script.google.com dan buat **Project baru**.
2. Ganti isi `Code.gs` dengan isi file `Code.gs` dari paket ini.
3. Klik tombol `+` → **HTML** dan beri nama persis `index`.
4. Tempel seluruh isi `index.html` ke file HTML tersebut.
5. Klik **Deploy** → **New deployment** → pilih **Web app**.
6. Pilih **Execute as: Me** dan **Who has access: Anyone**.
7. Klik **Deploy**, setujui izin akses spreadsheet, lalu buka URL yang berakhiran `/exec`.

Kode akses sekolah: `MAN1MALANG`

Jangan membuka `index.html` langsung dari komputer karena koneksi backend memerlukan deployment Google Apps Script.

## Jika index.html dipasang di Blogger/hosting lain

Deploy `Code.gs` terlebih dahulu. Salin URL Web App yang berakhiran `/exec`, lalu cari baris berikut di `index.html`:

```js
const STANDALONE_API_URL = "TEMPELKAN_URL_WEB_APP_EXEC_DI_SINI";
```

Ganti nilai tersebut dengan URL `/exec` yang sudah aktif.

## Data yang digunakan

- `Siswa`: data login siswa
- `Ujian`: jadwal, status, durasi, dan token ujian
- Tab bank soal: nama tab harus sama dengan `ID Ujian`
- `Jawaban`: hasil pengerjaan siswa

Hanya ujian berstatus `Active` yang tampil. Nilai dihitung ulang oleh backend sebelum disimpan.
