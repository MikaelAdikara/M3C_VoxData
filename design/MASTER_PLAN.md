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
