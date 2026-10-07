# Naskah rekaman video demo · Learning Line

Target **2:50**, batas keras **3:00**. Narasi (voice-over) dalam **bahasa Inggris**, karena ES juga berbahasa Inggris. Instruksi di dokumen ini dalam bahasa Indonesia.

Urutan klik sudah diuji end-to-end di aplikasi versi UI-4 pada 7 Okt 2026. Semua ID, label, dan angka di bawah sesuai dengan yang tampil di layar.

Subtitle siap pakai ada di `captions-en.srt`, dengan timing yang sama dengan tabel di bawah.

---

## 1. Persiapan alat (sekali saja)

- [ ] **URL:** pakai URL live (`https://m3c-learning-line-mvp.vercel.app`) setelah Bonfi mematikan Deployment Protection dan deploy ulang versi UI-4. Kalau belum siap, rekam di lokal: `npm run build && npm start`, lalu buka `http://localhost:3000`.
- [ ] **Browser:** Chrome, jendela **1920×1080**, zoom 100%. Sembunyikan bookmark bar (Cmd+Shift+B). Pakai profil kosong tanpa ekstensi atau avatar.
- [ ] **Tema:** terang. Kalau tombol di bar atas menampilkan matahari, klik sekali sampai muncul ikon bulan.
- [ ] **Mac:** aktifkan Do Not Disturb, tutup aplikasi lain, dan sembunyikan ikon desktop.
- [ ] **Perekam layar:** QuickTime (Cmd+Shift+5), rekam jendela Chrome saja.
- [ ] **Larangan:** tidak ada wajah, nama, atau logo kampus. Kursor tetap terlihat.
- [ ] **3D:** buka cover dan Shift board sekali sebelum merekam supaya maket dan model mobil sudah ter-cache. Saat merekam, jangan klik tombol jeda di maket.

## 2. Persiapan data (di luar kamera, ±3 menit)

Lakukan tepat sebelum merekam. Setelah langkah ini **jangan tekan Reset lagi**.

1. Buka `/simulator`, klik **Reset demo**.
2. Di bar atas, ganti role ke **Engineer**. Halaman akan pindah ke Kaizen.
3. Klik tiket **KZ-SEAL-008**. Isi keenam blok A3 dengan teks di bawah (copy-paste), lalu klik **Save** di tiap blok:

| Blok | Teks |
|---|---|
| Background | Three bead-off-path alerts at st-02 in shift A, all on seam-L-door-03. |
| Current condition | Bead runs 3 to 4 mm off the seam after robot path teaching; the camera flags each body. |
| Root cause | The robot path offset was not re-taught after the fixture change on st-02. |
| Countermeasure | Re-teach the sealer robot path after every fixture change; add the check to the changeover sheet. |
| Check | Trial over three shifts: no bead-off-path alert at seam-L-door-03. |
| Standardise | Revise standardized work st-02, changeover step; yokoten to st-01 and st-04. |

4. Pastikan tombol **Request validation** aktif (tidak abu-abu), tapi **jangan diklik**.
5. Buka `/` (cover page). Rekaman dimulai dari sini.

Catatan: di awal, cover menampilkan **st-05** dengan yellow andon. Itu bagian dari data seed (satu keputusan yang memang sedang menunggu). Tidak perlu diubah.

## 3. Shot list

Tip umum:
- Gerakkan kursor pelan.
- Beri jeda ±1 detik sebelum dan sesudah klik.
- Ganti role lewat dropdown di kanan atas; halaman otomatis pindah ke layar role tersebut.

| Waktu | Layar | Aksi di layar | Voice-over (EN) |
|---|---|---|---|
| 0:00–0:12 | Cover `/` | Diam di hero. Biarkan kamera maket bergerak pelan; arahkan kursor ke label "Yellow andon" dan kartu kuning body yang menunggu. | "This is Learning Line, a concept prototype for TMMIN Karawang. We follow one sealer defect from the camera to a revised standard, and show who decides at every step." |
| 0:12–0:30 | `/simulator` lalu Station | Footer: **Demo control** → **Inject true defect** → ganti role ke **Operator · st-04**. Tunjuk frame kamera ("Alert frame 08:42:17 · simulated") dan heatmap, lalu skor **0.83** vs threshold **0.61**. Klik **Live** sebentar, lalu kembali ke **Alert frame**. | "A repurposed camera checks every sealer bead. The model learned only from good beads, so it flags anything that departs from them and marks where. The alert goes to the station that made the defect, not to final inspection." |
| 0:30–0:40 | Station | Klik **Confirm defect**. Papan berubah jadi konfirmasi dan yellow andon. | "The operator confirms. A false alarm would be rejected with a reason, and only a rejection the team leader verifies can update the model." |
| 0:40–1:08 | Shift board · Line | Ganti role ke **Team leader**. Tunjuk lampu kuning st-04 di maket dan saran "Stop and fix". Ketik catatan `Nozzle check, body held`, klik **Stop and fix**: lampu jadi merah, papan "Line: Stopped by team leader". Ketik `Nozzle replaced, bead rechecked` di Repair note, klik **Repair done · restart line**. Terakhir tunjuk lampu biru st-02. | "The confirmation raises a yellow andon for the team leader, with a suggestion: stop and fix, because the defect is leak-critical. The system never stops the line. The team leader does, logs a note, and restarts it after the repair. Station 2 is over its false-alarm budget, so its model goes to review, but confirmed defects are never hidden." |
| 1:08–1:20 | Cameras `/cameras` | Klik **Cameras** di nav. Panel fokus sudah di **Sealer 04** dengan frame alert. Tunjuk garis waktu shift dan daftar event (alert, confirmed, team leader), lalu chip "Faces masked at edge". | "Every station camera is on one wall. The shift timeline replays each alert frame next to the decision people made, and faces are masked at the edge." |
| 1:20–1:38 | `/simulator` lalu Kaizen | Footer: **Demo control** → **Inject repeat ×3** → ganti role ke **Engineer** → klik **KZ-SEAL-009** (paling atas). Tunjuk tiga gambar pemicu dan label "Drafted by AI, check". | "When the same defect is confirmed a third time in a shift, a Kaizen ticket opens on its own, with the three alerts attached. AI only drafts the background and the current condition, and says so." |
| 1:38–1:58 | Kaizen → Knowledge | Breadcrumb **Kaizen cockpit** → **KZ-SEAL-008** → **Request validation**. Ganti role ke **Senior expert** → filter **Draft** → **KC-SEAL-051** → **Validate card**. Papan berubah hijau: "Validated: safe to reuse". | "Here is a ticket that has finished its countermeasure trial. The engineer requests validation, and the senior expert validates the knowledge card. It now revises the standard, and yokoten carries it to every station running the same process." |
| 1:58–2:18 | Metrics + dock | Ganti role ke **Management**. Klik **Ask the line** (kanan bawah) → saran kedua "Bead break near the right door…" → tunjuk chip **KC-SEAL-021 r2**. Lalu saran keempat "How do we fix paint orange peel?" → **Route to owner engineer**. Tutup dock. | "From any screen, the assistant answers only from validated knowledge cards, and cites the card it used. When no card covers a question, it says so, and routes it to the owner engineer instead of guessing." |
| 2:18–2:38 | Metrics | Tunjuk lintasan Gate 1 baris "Operators overriding alerts" (31% → 24%, zona Gate 1 di bawah 20%) dan chip **Case data / Target / Simulated**. Scroll ke grafik 30 hari. | "Management watches the Gate 1 indicators as distance to target. Every number says where it comes from: the thirty-one percent baseline is case data, the move toward twenty-four is simulated history, and Gate 1 is not reached yet." |
| 2:38–2:50 | Cover `/` | Klik **Cover page** di footer. Scroll ke "One defect. Five pairs of hands."; kartu menampilkan cap **Flagged, Confirmed, Decided**. | "AI detects and drafts. People decide. Learning Line, a concept prototype on simulated data." |

Narasi totalnya ±340 kata. Dengan tempo tenang (±2,1 kata per detik), panjangnya sekitar 2:42, jadi masih ada sisa untuk jeda klik. Uji klik penuh di aplikasi memakan ±65 detik, sehingga semua jeda muat.

## 4. Cara merekam suara

- **Disarankan:** rekam layar dulu tanpa suara, lalu rekam narasi terpisah dengan mikrofon HP di ruangan sunyi (Voice Memos), satu baris per shot. Gabungkan di CapCut atau iMovie dan geser klip layar agar pas dengan narasi.
- Kalau ada shot yang lebih panjang dari narasinya, potong jeda loading atau percepat sedikit (maksimal 1,25×). Jangan percepat bagian tombol keputusan.
- Kalau ada yang salah di tengah rekaman: buka `/simulator`, **Reset demo**, ulangi persiapan data di bagian 2, lalu rekam ulang shot yang gagal saja.

## 5. Subtitle

Impor `captions-en.srt` ke CapCut atau iMovie, lalu sesuaikan timing kalau potongan video bergeser. Pastikan subtitle "burned in", supaya tetap terlihat di Google Drive.

## 6. Cek sebelum upload

- [ ] Durasi ≤ 3:00
- [ ] Tidak ada wajah, nama orang, nama, atau logo kampus
- [ ] Istilahnya sama dengan ES: Shift loop, Kaizen loop, yellow andon, false-alarm budget, verified rejection, 4M change, validated knowledge card, A3, yokoten, team leader, senior expert
- [ ] Label "Concept prototype · simulated data" terlihat (footer atau cover)
- [ ] Upload ke Google Drive dengan akses **Anyone with the link → Viewer**
- [ ] Link video dan link aplikasi sudah dibuka dari jendela **incognito**
- [ ] Kedua link sudah dimasukkan ke Appendix C di ES
