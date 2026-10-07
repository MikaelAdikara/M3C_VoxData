# Master plan UI-4: Learning Line naik kelas + modul CCTV sealer

## Context
Dinda ingin UI setara atau lebih bagus dari PlantPulse (`caliber-2026-heisenberg.vercel.app`) **tanpa menjiplak**, dan ingin menerapkan pola CCTV dari repo `raphaeladikara/netra` yang disesuaikan dengan proyek kita.

Di ES, deteksi memang memakai **CCTV yang di-repurpose di stasiun sealer**: pencahayaan tetap, housing tertutup, pembersihan lensa masuk checklist maintenance, wajah di-mask di edge, dan kamera menghadap body mobil.

Keputusan Dinda (7 Okt):
- Pilot data dan data apa pun ditangani BE.
- Library baru diminta ke Bonfi lewat COLLAB.
- Bentuk akhirnya master plan dengan gaya kita sendiri.

Semua fase BE-0..3 dan UI-0..3 sudah ter-push. Pekerjaan ini menjadi **BE-4 / UI-4**.

## Yang diambil dari netra (prinsip, bukan kode atau aset)
- **Tiga sumber umpan, diurutkan dari yang paling jujur:**
  1. klip video tanpa kotak deteksi, karena tidak ada anotasi per frame;
  2. still dengan anotasi asli;
  3. adegan SVG prosedural untuk kamera yang belum punya rekaman.
- **Chrome CCTV:** grade (saturasi turun, kontras naik), vignette atau interlace tipis, nama kamera, timestamp, chip REC, satu sapuan scan hanya di kamera yang difokuskan, dan overlay "Signal lost". Ubin kecil tidak beranimasi.
- **Dinding kamera** 2×2/3×3/4×4 dengan mode Live/Playback, plus garis waktu rekaman yang menandai event dan jeda rekaman.
- **Kesehatan kamera:** uptime 14 hari, status, buat tiket.
- Badge data contoh di setiap layar.

## Versi kita: "Sealer camera wall" (orisinal untuk TMMIN)
1. **`CameraFeed` (komponen UI):** satu ubin kamera stasiun (`sealer-edge-04/cam-01`).
   - Sumber 1: klip pabrik nyata berlisensi bebas (Pexels; diriset saat eksekusi: robot sealer atau body shop), grayscale ala CCTV, berlabel "test clip · no annotation".
   - Sumber 2: still bead simulasi kita (`BeadIllustration`) dengan heatmap; ini satu-satunya yang boleh punya kotak, berlabel "simulated".
   - Sumber 3: **adegan SVG prosedural animasi**: panel pintu bergerak sesuai takt, nozzle robot meletakkan bead, dan sapuan kamera.
   - Chip tetap: "faces masked at edge" dan "fixed lighting".
2. **`/cameras`, dinding kamera:**
   - grid stasiun body line dengan andon pip per ubin;
   - ubin yang punya alert terbuka diberi frame kuning, ubin over budget diberi tanda biru "model review";
   - klik ubin untuk fokus;
   - garis waktu shift di bawahnya: tik alert, confirm, reject, dan keputusan TL dari data shift. Playhead bisa digeser dan menampilkan frame alert pada jam itu;
   - tombol "Open station" dan "Export evidence (simulated)".
3. **Kesehatan kamera (tab di `/cameras`):**
   - uptime 14 hari per kamera, terakhir lensa dibersihkan, versi model, fps/resolusi;
   - status: online / perlu perhatian (lensa kotor, pencahayaan bergeser) / offline;
   - tombol "Create maintenance ticket". Kaitkan dengan aturan ES: lens cleaning ada di checklist maintenance, dan false-alarm budget menunjuk kamera yang perlu dicek.
4. **Station memakai `CameraFeed`:** umpan "live" stasiun, lalu freeze-frame alert dengan heatmap. Gambar diam yang sekarang diganti cerita kamera ke keputusan.
5. **Landing v2:** hero memakai dinding kamera mini (3 ubin hidup) di samping kartu demo, menggantikan sebagian video stok.

## Pilar lain dari master plan (dunia "The Plant Sign, in motion")
Disusun dari objek TPS, bukan dari PlantPulse:
- **Andon line 3D:** menara lampu andon per stasiun di lini K2-Body, body bergerak sesuai takt, dibuat dengan React Three Fiber.
- **Sealer cell 3D:** robot meletakkan bead dan heatmap muncul.
- **Kartu kanban berjalan:** jejak abnormalitas ditampilkan sebagai kartu yang berpindah antar loop.
- **Takt board ~300 body per shift.**
- **Gemba hourly board** dan grafik pilot dari data BE.
- **"Ask the line" dock** untuk assistant.
- **Font display Big Shoulders Display** khusus landing. Tetap tanpa logo Toyota, semua data simulated, tanpa em-dash, warna hanya untuk status, dan menghormati reduced-motion.

## Request BE-4 (ditulis di COLLAB §6, dikerjakan Bonfi)
- **Dependency:** `three`, `@react-three/fiber`, `@react-three/drei`, `motion`, `recharts`.
- **`getCameraView()`:** daftar kamera per stasiun (id, stationId, kind, state, uptime14d[], lastLensCleanAt, modelVersion, fps, resolution, note) dan event shift per kamera (alert dibuat, confirm/reject, keputusan TL, dengan waktu).
- **Action `createCameraTicket(cameraId, reason)`.**
- **Pilot data:** `getPilotView()`, bentuknya ditentukan BE.
- Aset video stok dan adegan SVG tetap urusan UI (`public/**`).

## Tahapan
**Fase A (sekarang, tanpa menunggu BE)**
1. Tulis request BE-4 di COLLAB §6 dan baris BE-4/UI-4 di §3. Simpan master plan ini di `design/MASTER_PLAN.md`.
2. Riset dan unduh 2–4 klip pabrik berlisensi bebas (Pexels/Pixabay; body shop, robot sealer, conveyor). Proses dengan ffmpeg jadi klip loop 6–10 detik, ≤ 1,5 MB, grayscale CCTV, plus poster.
3. Prototipe di `design/mockup/`:
   - `cameras.html` (dinding + garis waktu + kesehatan) dengan data contoh lokal;
   - Station dengan `CameraFeed`;
   - adegan SVG sealer prosedural.
   - Kemudian uji 3D (Three.js via CDN) untuk andon line.

   Alurnya mengikuti impeccable (shape, concept/raise, build, review). Dinda memilih sebelum dipindah ke aplikasi.
4. Commit lokal. Push hanya atas instruksi.

**Fase B (setelah `handoff/be-4`)**
5. **UI-4:** `components/cctv/CameraFeed.tsx`, `CctvScene.tsx`, `app/cameras/page.tsx` (wall, timeline, health), Station memakai `CameraFeed`, nav "Cameras", 3D lazy-load, kanban trail, takt/gemba board, pilot charts, landing v2.
6. **Polish:** `/animate`, `/dataviz`, `/break-ui`, `/mobile-native`; finish reviewer impeccable; update `docs/DESIGN.md`.

## Skill yang dipakai
`/impeccable` (shape, new-work, craft-floor, overdrive untuk 3D, animate, finish reviewer, documenter), `/emil-design-eng`, `/animate`, `/apple-design`, `/dataviz`, `/design-taste-frontend`, `/high-end-visual-design`, `/break-ui`, `/mobile-native`, `/find-animation-opportunities`. Plus `/find-skills` untuk skill Three.js/R3F; skill baru diinstal hanya dengan izin Dinda.

## Verifikasi
- **Mockup:** screenshot laptop, tablet, dan HP; terang dan gelap; reduced-motion (video jadi poster, sapuan mati). Dinding 3×3 tetap ringan karena hanya ubin fokus yang beranimasi. Tidak ada kotak deteksi di atas klip nyata.
- **Aplikasi (setelah BE-4):** lint, typecheck, test, dan build lulus. Alur demo diuji dengan puppeteer: inject defect, ubin st-04 jadi kuning di `/cameras`, klik membuka Station dengan freeze-frame, lalu confirm. Tanpa error konsol dan tanpa overflow di 390 px. Bundle 3D dan video di-lazy-load.
- **Cek orisinalitas:** tidak ada kode, aset, atau teks dari netra maupun PlantPulse; hanya prinsipnya. Lisensi setiap klip dicatat di `design/ASSETS.md`.

---

# Roadmap multi-sesi (diperbarui 7 Okt 2026)

## Kritik jujur UI sekarang (UI-3)
- **Sudah kuat:** sistem tanda keselamatan (plate kuning/merah/hijau), kejujuran label, alur demo end-to-end, dark mode, HP.
- **Masih "formulir":** shift board berupa 8 kartu angka 0/0/0. Juri tidak *melihat* lini produksinya. Metrics didominasi tabel; grafik masih dasar. Belum ada satu momen visual yang diingat juri.
- **Belum ada gerak bercerita:** perpindahan dari kamera → operator → team leader → Kaizen → kartu belum terasa sebagai satu perjalanan.

## Tiga momen tanda tangan (pembeda kita, bukan tiruan PlantPulse)
PlantPulse menjual *pabrik digital* (3D plant + dashboard KPI). Kita menjual *satu abnormalitas yang menjadi standar*. Jadi pusat visual kita berbeda:
1. **The Line** (pengganti grid shift board): lini K2-Body sebagai ruang 3D/2.5D. Menara andon per stasiun, body bergerak sesuai takt, stasiun yang menunggu keputusan menyala kuning. Klik stasiun → kamera (CCTV wall) → keputusan.
2. **The Trail**: satu kartu kanban fisik yang berpindah antar loop (alert → konfirmasi → andon → tiket A3 → kartu tervalidasi), dengan cap peran dan jam di setiap perpindahan. Dipakai di landing, Station, dan Kaizen.
3. **Honest numbers**: setiap angka membawa chip asal-usul (Simulated · Illustration · Target · Benchmark) dan sumber (ES Gate 1, Casebook Exhibit 4). Seed fingerprint di Simulator. Ini rekomendasi laporan pilot data dan sulit ditiru karena butuh disiplin data, bukan efek visual.

Ditambah: CCTV wall (sudah di mockup), gemba hourly board, "Ask the line" dock, display font khusus landing.

## Rencana sesi
Satu sesi ≈ satu jatah 5 jam. Effort tinggi kecuali disebut lain.

| Sesi | Isi | Butuh BE? | Hasil |
|---|---|---|---|
| **S1** (sekarang) | Arah visual + motion tokens; prototipe **The Line** 3D (Three.js via CDN) di `design/mockup/line.html`; versi 2.5D fallback untuk HP dan reduced-motion | Tidak | Dinda memilih arah The Line |
| **S2** | Mockup **landing v2** (hero The Line + camera wall mini + scroll story The Trail), **metrics v2** (tren, sparkline, chip provenance, garis Gate 1), **Ask the line** dock | Tidak | Semua mockup lengkap; Dinda memilih |
| **S3** | UI-4 bagian 1 di Next: `CameraFeed`, `/cameras`, Station memakai kamera, The Line di shift board (lazy-load), nav | **Ya, `handoff/be-4`** | Modul inti di aplikasi |
| **S4** | UI-4 bagian 2: landing v2, metrics v2 + data pilot, The Trail, provenance chips, dock assistant, koreografi motion | Ya | Semua layar di aplikasi |
| **S5** (effort sedang + tinggi) | Pengerasan: break-ui, HP/tablet, a11y, performa bundle 3D/video, finish reviewer, screenshot, `docs/DESIGN.md`, update naskah video; push `handoff/ui-4` | Ya | Siap demo |
| S6 (cadangan) | Rekam video, Appendix C, perbaikan dari latihan | - | FINAL |

**Jalur kritis:** Bonfi belum bisa mulai BE-4 sebelum request di `COLLAB.md` ter-push. Push COLLAB + mockup sedini mungkin (atas instruksi Dinda) supaya S3 tidak menunggu.

## Aturan orisinalitas
- Tidak ada kode, aset, teks, palet, atau font dari PlantPulse/netra. PlantPulse memakai Archivo/IBM Plex, Lucide, Recharts default, dan pabrik 3D generik; kita memakai Source Sans 3 + display khusus landing, Phosphor, warna rambu keselamatan Jepang, dan objek TPS (andon, kanban, A3, gemba board).
- 3D kita dibangun dari primitif sendiri dengan gaya "maket insinyur" (abu-abu monokrom, garis tipis, warna hanya untuk status), bukan pabrik realistis.

---

# Landing v3 (diperbarui 7 Okt 2026, atas masukan Dinda)

Masukan: tulisan terlalu banyak, dan layout selalu gambar kiri/teks kanan. Arah baru:

**Aturan tulisan.** Setiap bagian maksimal satu judul dan satu kalimat pendek. Detail panjang (A3 lengkap) disembunyikan di balik "Read the whole case", jadi tetap ada untuk juri tapi tidak memenuhi layar.

**Ritme komposisi** (tidak ada dua bagian berurutan dengan susunan sama):

| # | Bagian | Komposisi | Isi |
|---|---|---|---|
| 1 | Hero | **Tengah**, judul di atas, maket 3D selebar layar di bawahnya | Judul, satu kalimat, dua tombol, strip gemba yang hidup (takt, body bertambah tiap takt, andon, status lini) |
| 2 | The Trail | **Poros tengah**: kartu abnormalitas sticky di tengah, langkah bergantian kiri-kanan dengan garis penghubung ke kartu | Lima langkah, masing-masing label + judul ≤ 6 kata + siapa yang memutuskan |
| 3 | Tiga larangan | **Tiga papan rambu** sejajar (stop merah, caution kuning, safe hijau) | Tiga kalimat pendek |
| 4 | Cameras | **Full-bleed** pita gelap, mosaik bento 4 kolom, frame alert besar di tengah | Satu judul, chip legenda |
| 5 | Angka jujur | **Buku besar di tengah**: angka besar baseline → target, chip asal-usul | Lima baris, lalu A3 lengkap dalam lipatan |
| 6 | Penutup | **Tengah**: judul, tombol, komposisi laptop + HP bertumpuk | Satu judul, satu tombol |

**Momen tanda tangan:** maket 3D di hero, kartu yang distempel di poros tengah, dan mosaik CCTV full-bleed.
