# Sistem Analisis Peperiksaan KAFA

Repo ini mengandungi sistem web **SISTEM ANALISIS PEPERIKSAAN KAFA** untuk **KAFA SK KOMPLEKS KLIA**.

Sistem ini menggunakan Google Apps Script sebagai Web App dan Google Sheet sebagai pangkalan data. Jika dibuka terus sebagai fail HTML, sistem masih boleh diuji menggunakan data contoh setempat melalui `localStorage`.

## Konfigurasi Semasa

- ID Google Sheet simpanan markah: `18h0tLT4fYbLZs9tkiImTTnngFyl9mqW6TSyXvMm95SE`
- URL Web App Apps Script: `https://script.google.com/macros/s/AKfycbze5wLruriUkGCViHDXt23enYKH3xmLGg9YKujqQDyCY1Z6OirWbACLbGIMQIgMthMk6g/exec`
- Data kelas, nama murid dan nombor IC dibaca terus daripada CSV `gid=0`.
- Data pentaksiran dan subjek dibaca terus daripada CSV `gid=1612819479`.

## Fail Utama

- `Code.gs` - backend Apps Script untuk login guru, carian IC ibu bapa, data murid dan simpanan markah.
- `Index.html` - antaramuka sistem lengkap dengan login, tab guru, analisis, kedudukan, pelaporan dan cetakan.
- `appsscript.json` - manifest projek Apps Script.
- `google-sites-embed.html` dan `google-sites-embed-simple.html` - kod iframe untuk Google Sites.

## Login

- Guru: `guruskkompleksklia`
- Ibu bapa: masukkan nombor IC anak yang wujud dalam helaian `Murid`.

## Struktur Google Sheet

Sistem akan mencipta dua helaian secara automatik:

- `Markah`: rekod markah mengikut murid, pentaksiran dan subjek.

Senarai murid tidak perlu ditaip semula dalam sistem kerana ia dibaca daripada CSV Google Sheet yang telah diterbitkan.

## Cara Deploy Apps Script

1. Buka <https://script.google.com> dan cipta projek baharu.
2. Tampal kandungan `Code.gs` ke fail `Code.gs`.
3. Cipta fail HTML bernama `Index`, kemudian tampal kandungan `Index.html`.
4. Buka `Project Settings`, aktifkan paparan `appsscript.json`, kemudian tampal manifest.
5. Jalankan fungsi `setupKafaSpreadsheet` sekali untuk mencipta Google Sheet dan beri kebenaran akses.
6. Buka `Executions` atau `Logs` untuk salin URL Google Sheet yang dijana.
7. Pergi ke `Deploy > New deployment > Web app`.
8. Tetapkan:
   - Execute as: `Me`
   - Who has access: ikut keperluan sekolah, contohnya `Anyone with the link` atau akaun organisasi.
9. Klik `Deploy` dan buka URL web app.

## Cetakan

Fungsi `printReport()` mencetak kandungan aktif daripada elemen `.print-content` dalam format A4 untuk analisis dan slip pencapaian murid.
