# Handoff UI terpadu — audit regresi 8 Oktober 2026

Dasar audit: `origin/main` 943dec6 (UI-4 dan penyempurnaan terbaru), kontrak BE-4, SSR lokal dengan seed deterministik, serta uji backend terisolasi. Ini satu paket permintaan; tidak ada file UI yang diubah oleh BE. Uji interaksi browser penuh belum tersedia di lingkungan audit, sehingga item di bawah perlu diuji ulang di browser setelah implementasi. Jangan membuat alert defect hanya untuk mengisi layar kamera offline. Semua visual tetap memuat label konsep/simulasi yang diwajibkan produk.

## 1. Station tetap menampilkan konteks stasiun dan kesehatan kamera (P1)

- **Lokasi:** `components/station/StationScreen.tsx`, terutama cabang `{alert ? ...}` sekitar baris 101 dan empty state sekitar baris 221; pemanggil `app/station/page.tsx` sudah mengambil `getStationView(st)` dan `getCameraView()`.
- **Saat ini:** `CameraFeed` berada hanya pada cabang `openAlert`. Seed st-04 tanpa alert menampilkan "No open alert" dan menyembunyikan feed. st-06 offline dengan recording gap juga kehilangan penjelasan kesehatan kamera setelah tautan **Open station** dari Camera wall. Ini cacat komposisi UI, bukan kurangnya defect seed.
- **Perubahan:** letakkan identitas Station dan panel camera/health di luar cabang open-alert. Gunakan kamera dari `getCameraView().cameras` yang sudah diteruskan page: `state`, `note`, `media`, `openAlertIds`, `pendingDecisionAlertIds`, `maintenanceTicketId`; gunakan `getStationView()` untuk `openAlert` dan `decisionHistory`. Panel keputusan operator hanya tampil ketika alert `open`. Ketika `confirmed`, tampilkan status menunggu TL; setelah `rejected`/`closed`, tampilkan outcome terbaru dari history. Untuk st-06, jelaskan signal lost, recording gap, dan tidak ada defect alert; tautkan tindakan maintenance pada peran/context yang tepat. Jangan menulis `LIVE` untuk offline.
- **Acceptance:** Reset → st-04 punya identitas dan kamera normal tanpa alert; inject defect → alert, skor/ambang/visual benar; confirm → pending TL; keputusan TL → riwayat outcome tetap ada; st-06 offline → health/gap terlihat tanpa alert palsu; reload dan polling tidak menghapus konteks. Uji desktop/tablet/HP dan ambil tangkapan layar tiap keadaan.

## 2. Bedakan kesehatan kamera sekarang dari ilustrasi replay dan sumber media (P1)

- **Lokasi:** `components/cctv/CameraFeed.tsx` sekitar baris 52 dan 88, juga pengguna di `components/cctv/CamerasScreen.tsx` dan `app/page.tsx`.
- **Saat ini:** alert frame historis disembunyikan ketika kamera *sekarang* offline (`showAlert` tergantung `camera.state`), sehingga riwayat seakan tidak ada. Media publik/ilustrasi dapat berlabel `LIVE`/`REC`, yang menyiratkan stream/rekaman aktual.
- **Perubahan:** pisahkan mode "current camera health" dan "historical alert illustration". Health offline tetap offline; alert lama boleh ditampilkan hanya sebagai ilustrasi atau playback yang jelas sumber/waktunya, tanpa berpura-pura frame tersedia di recording gap. Label media publik `Public visual reference`; SVG/scene buatan `Generated simulation`; data status `Simulated operational data`. Hanya pakai `LIVE`/`REC` jika memang ada stream/rekaman beranotasi yang nyata. Pertahankan fallback jika MP4/poster gagal dimuat dan reduced motion; tidak ada bounding box pada video publik tanpa anotasi frame-level.
- **Acceptance:** st-06 offline tidak pernah menunjukkan pseudo-live; alert historis tetap dapat dilihat dengan label historis; gap tidak menampilkan frame palsu; ganti kamera/fokus tidak membawa status kamera sebelumnya; video gagal load tetap terbaca. Sertakan screenshot health dan replay masing-masing.

## 3. Hentikan inferensi defect dari label teks (P1)

- **Lokasi:** `components/cctv/CameraFeed.tsx` fungsi `defectOfEvent()` sekitar baris 23, pemanggil di CamerasScreen dan landing.
- **Saat ini:** parser label tidak dikenal jatuh ke `BEAD_BREAK`, sehingga event yang tidak punya defect bisa bergambar broken bead.
- **Kontrak BE tersedia:** `CameraEventView.defectTypeId?: DefectTypeId | null` dan `visualScenarioId?: string` dari alert kanonis; `kind='gap'` tidak memiliki defect. `label` hanya copy tampilan.
- **Perubahan:** pilih ilustrasi lewat ID bertipe/semantic visual ID; bila kosong/tidak dikenal, tampilkan health/event netral. Hapus default `BEAD_BREAK` dan semua parsing label untuk fakta domain.
- **Acceptance:** unknown/gap/reject/health event tanpa ID tidak pernah tergambar broken bead; alert BEAD_EXCESS/BEAD_BREAK memakai ilustrasi tepat; copy label yang diubah tidak mengubah visual.

## 4. Timeline CCTV memakai waktu simulasi yang authoritative (P2)

- **Lokasi:** `components/cctv/CamerasScreen.tsx` kalkulasi `now` sekitar baris 21, inisialisasi playhead baris 29, pemilihan event dalam jendela 30 menit sekitar baris 36.
- **Saat ini:** batas waktu dibuat dari maksimum event atau `shift.start + 102 menit`, bukan jam simulasi BE; playhead lokal hanya diinisialisasi sekali dan dapat tertinggal setelah polling/fokus kamera berpindah. Pemilihan alert terdekat bisa dipersepsikan sebagai frame live.
- **Kontrak BE tersedia:** `CameraView.asOf`, `shift.startsAt/endsAt`, `events[].at/endsAt`, `recordingGaps` pada kamera, `state` saat ini.
- **Perubahan:** batasi sumbu dan playhead ke `view.asOf` dan shift; beri mode eksplisit `current` versus `history`. Saat polling, mode current mengikuti `asOf`, mode history mempertahankan pilihan pengguna jika masih valid. Saat kamera diganti, cocokkan selection/playhead dengan event kamera baru. Tampilkan gap sebagai gap, bukan footage. Format zona waktu simulasi WIB secara konsisten.
- **Acceptance:** polling/reload tidak membuat playhead usang; seek di gap menampilkan no recording; ganti kamera tidak memunculkan event kamera lain; timeline tidak melewati `asOf`/shift; uji tablet/HP dan keyboard.

## 5. Keputusan Shift: role gating benar, jelaskan keadaan secara spesifik (P2 UX)

- **Lokasi:** `components/shift-board/ShiftBoardScreen.tsx`/`DecisionPanel` sekitar baris 258, `components/shell/RoleGate.tsx`, `app/shift-board/page.tsx` sekitar baris 17.
- **Bukti:** SSR seed memberi tombol `disabled` untuk cookie operator; cookie `learning-line-role=team_leader` memberi tombol aktif pada alert st-05 yang confirmed dan pending. `decideShift` backend menolak non-TL, alert tak eligible, catatan kosong, dan retry duplikat. Jadi screenshot `Operator · st-04` dengan tombol mati adalah **perilaku yang benar**, bukan defect backend.
- **Perubahan kecil:** teks di dekat tombol menjelaskan penyebab aktif: perlu team leader, belum ada pending confirmed alert, line stopped, atau catatan wajib. Jangan beri kesan bahwa catatan saja membuka tombol untuk operator. Setelah `setRole`, pastikan router refresh menampilkan hak baru dan alert pending terbaru; setelah submit perbarui panel/status. Tidak perlu API baru.
- **Acceptance:** operator + pending tidak bisa mutate dan tahu sebab; TL + pending + catatan bisa stop/contain/continue; TL tanpa catatan/pending, alert sudah diputuskan, atau line stopped mendapat alasan yang tepat; rapid click/multi-tab menghasilkan satu decision; role switch + refresh memperbarui kontrol. Rekam screenshot operator dan TL.

## 6. Knowledge: alur revisi setelah senior return (P2)

- **Lokasi:** `components/kaizen/TicketScreen.tsx`, `components/knowledge/CardDetail.tsx` dan form aksi terkait.
- **Kontrak BE baru:** `TicketView.validation` memuat `draftCardId` hanya bila pending, `returnedCardId`, `returnedComment`, `canRequest`; untuk kartu dari tiket, engineer edit A3 lalu panggil `requestValidation(ticketId)` yang membuat revisi draft berikutnya. Kartu draft mandiri yang sudah dikembalikan dapat dikirim ulang oleh engineer melalui `reviseReturnedCard(cardId, {rootCause,countermeasure,standardRevised})`. `validateCard` menolak draft yang belum direvisi. Semua status dari view, bukan perhitungan lokal.
- **Perubahan:** tampilkan komentar senior dan CTA revisi sesuai sumber kartu. Nonaktifkan Validate untuk returned draft; tampilkan riwayat revisi dan status menunggu senior setelah submit baru. Validasi tetap hanya senior.
- **Acceptance:** return → engineer melihat komentar → edit A3/kartu sesuai sumber → submit revisi → senior validate revisi baru → citation menunjuk ID dan revisi validated. Double return/submit tidak membuat revisi ganda.

## 7. Kejujuran angka dan fixture simulasi (P2/P3)

- `app/metrics/page.tsx` sekitar baris 79 bertajuk "What st-04 confirms" tetapi menerima `view.pareto` lintas stasiun. Ubah judul menjadi cakupan seluruh line atau tampilkan subset dari query BE yang benar bila desain memang ingin st-04; jangan menghitung aturan bisnis diam-diam di UI.
- `app/page.tsx` sekitar baris 128 menandai baseline casebook lama sebagai "today". Pakai label waktu/sumber `case_data` yang benar. Jangan menyebut 24% simulated sebagai hasil pilot terukur.
- `components/simulator/SimulatorScreen.tsx` sekitar baris 41: `injectRepeat3()` adalah fixture cepat yang menyisipkan tiga alert confirmed dan keputusan operator sintetis secara atomik. Tuliskan jelas "accelerated demo fixture"; itu bukan tiga interaksi manusia. Skenario biasa tetap perlu operator confirm.
- The Line menghentikan animasi saat `line.state='stopped'`, tetapi angka `bodiesCompleted` hanya berubah bila action `advanceSimulatedProduction(expectedCompleted)` dipanggil. Jika UI menjanjikan counter bergerak saat running, hubungkan action itu dengan compare-and-increment dan refresh; jangan menaikkan angka bisnis di client. Saat stopped, counter wajib tetap.
- Pastikan teks tablet `paint-bm` tidak menyiratkan CCTV; perangkat ini kamera jenis `paint_tablet` tanpa feed CCTV.
- **Acceptance:** provenance setiap angka tepat; perubahan status tidak menghasilkan KPI buatan; reset memulihkan fingerprint; counter tidak naik saat stopped; tampilan fixture tidak menyiratkan tiga operator sungguhan.

## Batas kontrak dan bukti yang masih dibutuhkan

Tidak ada endpoint kamera/Station duplikat yang diperlukan. `getStationView()`, `getCameraView()`, `getLineView()`, dan action BE yang ada sudah memuat fakta domain. Tambahan BE dalam audit ini hanya ID defect/visual, `asOf`, metadata return, dan action revisi kartu mandiri. UI harus menguji alur penuh dengan assertion browser pada desktop, tablet, HP, termasuk reload, polling, role switch, multi-tab, kegagalan media, reduced motion, dan screenshot state penting. Browser E2E audit ini **NOT_VERIFIED** karena otomasi browser ditolak lingkungan; SSR dan test BE tidak menggantikan bukti tersebut.
