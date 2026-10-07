# COLLAB.md: aturan main tim Backend (BE) × tim UI

Dokumen ini wajib dibaca semua anggota tim (dan asisten coding yang dipakai) sebelum mengerjakan apa pun di repo ini.
Tujuannya satu: backend dan UI dikerjakan bergantian tanpa saling menimpa file.

- **BE**: backend & logika MVP.
- **UI**: desain & implementasi UI/UX.
- Sumber kebenaran produk tetap `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/SEED_DATA.md`, `docs/DESIGN.md`. Dokumen ini hanya mengatur **siapa mengerjakan apa dan kapan**.

---

## 1. Kepemilikan file

Setiap path punya **satu pemilik**. Yang bukan pemilik **tidak boleh** membuat, mengubah, atau menghapus file di path itu.

| Pemilik | Path |
|---|---|
| **BE** | `package.json`, `package-lock.json`, semua config (`next.config.*`, `tsconfig.json`, `vitest.config.*`, `eslint.config.*`, `drizzle.config.*`, `postcss.config.*`), `lib/**`, `db/**`, `app/api/**`, `scripts/**`, `**/*.test.ts`, `.env.example`, setting Vercel |
| **UI** | `app/globals.css`, `app/layout.tsx`, `app/**/page.tsx`, `app/**/loading.tsx`, `app/**/error.tsx`, `app/**/not-found.tsx`, `components/**`, `public/**` (kecuali `public/beads/` yang di-generate script BE), `docs/DESIGN.md`, `docs/screenshots/**`, `design/**` (mockup HTML), `PRODUCT.md`, `.impeccable/**` |
| **Bersama** | `COLLAB.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/PRD.md`, `docs/DEMO_SCRIPT.md` |

Aturan tambahan:

- File **bersama** hanya diubah di commit terpisah dengan prefix `docs:`, dan ditulis di log perubahan (§7).
- **Pengecualian BE-0:** BE membuat stub `page.tsx` dan `layout.tsx` polos sekali saat scaffold. Setelah tag `handoff/be-0` ada, file itu milik UI.
- Dependency npm baru untuk UI (mis. library chart/ikon) diminta lewat §6. BE yang menambahkan ke `package.json`.
- Server Actions **tidak** ditaruh di folder `app/`. Semuanya ada di `lib/actions/*.ts` (`'use server'`), supaya `app/` tetap milik UI.

---

## 2. Kontrak BE ↔ UI

UI **tidak menghitung aturan bisnis** dan **tidak mengakses store langsung**. UI hanya:

1. memanggil fungsi baca di `lib/queries.ts` (dari Server Component),
2. memanggil Server Actions di `lib/actions/*.ts` (dari form/button),
3. memakai tipe dari `lib/types.ts`.

BE wajib menyediakan semua yang ada di bawah ini pada fase yang disebut. Nama boleh disesuaikan, tapi **perubahan nama atau bentuk data harus dicatat di §7** supaya UI bisa menyesuaikan UI.

### 2.1 Tipe (`lib/types.ts`) — siap di BE-0

```ts
export type Role = 'operator' | 'team_leader' | 'engineer' | 'senior_expert' | 'management';
export type Actor = `role:${Role}@${string}`;          // contoh: 'role:operator@st-04'
export type Loop = 'shift' | 'kaizen' | 'launch';
export type Criticality = 'leak_critical' | 'non_critical';
export type AlertStatus = 'open' | 'confirmed' | 'rejected' | 'closed';
export type ShiftDecision = 'stop_fix' | 'contain' | 'continue';
export type ReasonCode = 'reflection' | 'variant_mismatch' | 'dirty_lens' | 'within_tolerance' | 'other';
export type TicketStatus = 'open' | 'a3_in_progress' | 'countermeasure_trial' | 'validated' | 'closed';
export type CardStatus = 'draft' | 'validated' | 'retired';

// View model per layar (bentuk persis ditentukan BE di BE-0)
export interface StationView     { station; openAlert: AlertView | null; reasonCodes; ideasOpen }       // /station
export interface ShiftBoardView  { shift; stations: StationTileView[]; pendingDecisions: AlertView[] } // /shift-board
export interface KaizenView      { pareto: { defectType; count }[]; tickets: TicketSummary[] }         // /kaizen
export interface TicketView      { ticket; triggerAlerts: AlertView[]; a3: A3; aiPrefilledFields: string[] } // /kaizen/[id]
export interface KnowledgeView   { cards: CardView[]; filters }                                         // /knowledge
export interface MetricsView     { gate1: KpiView[]; learningCycleDays; ideas }                          // /metrics
export interface KpiView         { id; label; value; unit; baseline; target; sourceLabel }               // tooltip sumber
export interface AssistantAnswer { mode: 'live' | 'offline' | 'no_card'; text; citations: { cardId; revision }[] }
```

### 2.2 Fungsi baca (`lib/queries.ts`)

| Fungsi | Dipakai di | Fase |
|---|---|---|
| `getStationView(stationId)` | `/station?st=st-04` | BE-0 (data seed) |
| `getShiftBoardView()` | `/shift-board` | BE-0 |
| `getKaizenView()` · `getTicketView(id)` | `/kaizen`, `/kaizen/[id]` | BE-2 |
| `getKnowledgeView(filters)` | `/knowledge` | BE-2 |
| `getMetricsView()` | `/metrics` | BE-3 |

### 2.3 Server Actions (`lib/actions/*.ts`)

| Action | Fase |
|---|---|
| `confirmAlert(alertId)` · `rejectAlert(alertId, reasonCode, note?)` · `submitIdea(stationId, text)` | BE-1 |
| `decideShift(alertId, decision: ShiftDecision, note)` · `verifyRejection(reviewId)` | BE-1 |
| `updateA3(ticketId, patch)` · `advanceTicket(ticketId)` · `requestValidation(ticketId)` | BE-2 |
| `validateCard(cardId)` · `returnCard(cardId, comment)` · `routeToOwner(question)` | BE-2 |
| `POST /api/assistant { question }` → `AssistantAnswer` | BE-2 |
| `injectTrueDefect()` · `injectFalseAlarm()` · `injectRepeat3()` · `resetDemo()` | BE-3 |
| `setRole(role)` (cookie) | BE-0 |

Semua action mengembalikan `{ ok: true } | { ok: false; error: string }` dan memanggil `revalidatePath` sendiri. Untuk update live, UI memakai `router.refresh()` setiap 2 detik di layar station dan shift board (cara ini dipilih BE di BE-1, lihat §7).

---

## 3. Fase & status

Penanda fase selesai = **git tag `handoff/<fase>`** yang sudah di-push **dan** baris di tabel ini diubah ke `DONE`.
Fase berikutnya **tidak boleh dimulai** sebelum tag di kolom "Butuh" ada di remote.

| Fase | Pemilik | Isi | Butuh | Status |
|---|---|---|---|---|
| BE-0 | BE | Scaffold Next.js (App Router) + TS strict + Tailwind v4 + Vitest; folder sesuai ARCHITECTURE §2; `lib/types.ts` lengkap (§2.1); memory store + seed (SEED_DATA.md); `getStationView`, `getShiftBoardView`, `setRole`; stub `page.tsx` polos untuk semua route; script `dev`/`test`/`lint`/`typecheck` jalan | – | DONE |
| UI-0 | UI | Token Plant Sign (gradien abu + kaca, light/dark) di `globals.css` + `@theme inline`; `layout.tsx`: top bar (strip merah, nav, theme toggle, role switcher, shift clock), tab bar HP, footer label; primitive `components/ui/`: Button/ButtonLink, Badge, AndonBadge, LoopBadge, Plate (sign plate), DataTable, KpiTile, Sheet, EmptyState; `components/shell/Trail`; preview di `/styleguide` | `handoff/be-0` | DONE |
| BE-1 | BE | `lib/rules` repeat/budget/recommend/override + test; action §2.3 fase BE-1; mekanisme refresh 2 detik | `handoff/ui-0` | DONE |
| UI-1 | UI | `/station`: AlertCard + HeatmapImage, score vs threshold, DecisionBar, ReasonCodeSheet, status "what happens next", Suggest idea. `/shift-board`: grid StationTile (counts, budget meter, flag "model review needed"), RecommendationBox + 3 tombol keputusan + note | `handoff/be-1` | DONE |
| BE-2 | BE | Ticket auto-open (repeat ×3), A3, status flow, cards + validate/return, assistant (retrieve, guardrail, offline mode, rate limit) + test; `getKaizenView`, `getTicketView`, `getKnowledgeView` | `handoff/ui-1` | DONE |
| UI-2 | UI | `/kaizen`: Pareto, daftar tiket. `/kaizen/[id]`: TicketHeader + status stepper, A3Form 6 blok, label "Drafted by AI, check". `/knowledge`: list + filter, CardView + riwayat revisi, Validate/Return, AssistantPanel (citation chip, offline label, no-card state + Route to owner engineer) | `handoff/be-2` | DONE |
| BE-3 | BE | `getMetricsView`, simulator actions, reset, generator SVG bead (`public/beads/`), deploy Vercel + env | `handoff/ui-2` | DONE |
| UI-3 | UI | `/metrics` (KPI + tooltip sumber, Gate 1 panel), `/simulator`; polish tablet 10" & laptop, kontras AA, keyboard, loading/empty/error state, cek istilah ES, `docs/screenshots/` | `handoff/be-3` | DONE |
| FINAL | Berdua | DEMO_SCRIPT dijalankan di URL live setelah Reset; rekam video ≤ 3 menit (UI); link ke Appendix C | `handoff/ui-3` | TODO |
| BE-4 | BE | Dependency 3D/motion/chart; `getCameraView()` + `createCameraTicket`; `getPilotView()` (pilot data); lihat `design/MASTER_PLAN.md` | `handoff/ui-3` | TODO |
| UI-4 | UI | Modul CCTV (`CameraFeed`, `/cameras` wall + timeline + health, Station pakai feed), andon line 3D, kanban trail, takt/gemba board, grafik pilot, landing v2 | `handoff/be-4` | TODO |

> Karena file tidak overlap, BE **boleh** menyiapkan BE-(n+1) di lokal selama UI-n berjalan. Tapi push hanya boleh setelah tag `handoff/ui-n` ada, supaya urutan di `main` tetap rapi.

---

## 4. Prosedur handoff (wajib diikuti kedua pihak)

### Sebelum mulai fase

```bash
git fetch --all --tags
git pull --rebase origin main
git tag -l 'handoff/*'            # tag "Butuh" untuk fase ini ada?
```

- **Tag belum ada** → berhenti. Laporkan ke manusianya: "`handoff/xx` belum di-push, tunggu pihak lain." Jangan mengerjakan file milik orang lain untuk "membantu".
- **Tag ada** → baca §6 dan §7 (request & log perubahan terbaru), lalu jalankan `npm install && npm run typecheck`. Kalau typecheck gagal di file milik pihak lain, catat di §6, jangan diperbaiki sendiri.

### Saat selesai fase

```bash
npm run lint && npm run typecheck && npm run test
git add <hanya file milikmu> COLLAB.md
git commit -m "ui: UI-1 station + shift board"      # prefix be: / ui: / docs:
git tag -a handoff/ui-1 -m "UI-1 done"
git push origin main
git push origin handoff/ui-1         # tag wajib di-push terpisah
```

Lalu ubah status fase di §3 menjadi `DONE`. Status boleh ikut commit yang sama.

### Konvensi

- Semua kerja di branch `main`. Selalu `pull --rebase` sebelum push. Jangan `push --force`.
- Prefix commit: `be:` (BE), `ui:` (UI), `docs:` (file bersama).
- Sebelum commit, cek `git diff --name-only --cached`. Kalau ada path milik pihak lain, batalkan stage file itu.
- Konflik merge di file bersama: ambil versi remote, tambahkan perubahanmu di bawahnya, jangan menghapus entri orang lain.

---

## 5. Aturan produk yang tidak boleh dilanggar (BE & UI)

Ringkasan dari `CLAUDE.md` dan `docs/PRD.md`:

- Tidak ada secret di repo. App harus jalan tanpa key (assistant offline mode).
- Tidak ada line stop otomatis. Sistem hanya merekomendasikan; team leader yang memutuskan. Merah `#C62828` hanya muncul sebagai keputusan TL.
- False-alarm budget tidak pernah menyembunyikan defect yang sudah confirmed.
- Assistant hanya menjawab dari card `validated` dan selalu mengutip `[CARD-ID r<rev>]`.
- Aktor ditulis sebagai role@station. Tidak ada nama orang dan tidak ada gambar wajah.
- Footer di setiap layar: **"Concept prototype · simulated data · not connected to TMMIN systems"**.
- Istilah harus sama persis dengan ES: Shift loop, Kaizen loop, Launch loop, yellow andon, false-alarm budget, verified rejection, 4M change, validated knowledge card, A3, yokoten, team leader, senior expert, DX cell.
- Operator & TL: target sentuh ≥ 48 px, kontras AA, semua bisa dijangkau keyboard.

---

## 6. Request antar-pihak

Tambahkan baris baru di bawah. Penerima mengubah status menjadi `done (commit abc123)` atau `ditolak: alasan`.

### Request ke BE (dari UI)

| Tgl | Request | Untuk fase | Status |
|---|---|---|---|
| 2026-10-06 | **Bug build:** `lib/actions/role.ts` adalah file `"use server"` tapi meng-export `const ROLE_COOKIE_NAME`. `next build` gagal ("Only async functions are allowed to be exported in a 'use server' file") begitu client mengimpor `setRole`. Pindahkan konstanta ke modul lain (mis. `lib/role-cookie.ts`). Sampai ini beres, role switcher UI hanya berpindah layar tanpa memanggil `setRole`. | BE-1 | done (`handoff/be-1`) |
| 2026-10-06 | Tambah query `getCurrentRole(): Promise<Role>` di `lib/queries.ts` (membaca cookie role), supaya UI tidak membaca cookie sendiri. | BE-1 | done (`handoff/be-1`) |
| 2026-10-06 | Tambah dependency `@phosphor-icons/react` ke `package.json`. UI-0 sementara memuat Phosphor web dari CDN (unpkg) di `layout.tsx`. | BE-1 | done (`handoff/be-1`) |
| 2026-10-06 | `ShiftBoardView` belum membawa daftar `modelReviews` (id + stationId + alertIds + status), jadi UI belum bisa memanggil `verifyRejection(reviewId)`. Tolong tambahkan, mis. `pendingReviews` di `ShiftBoardView`. | BE-2 | done (commit `94210bd`) |
| 2026-10-06 | `StationView` belum membawa riwayat keputusan stasiun di shift ini (alert + decision), yang ada di mockup ("This station, this shift"). Opsional; UI-1 menyembunyikan panel itu. | BE-2 | done (commit `94210bd`) |
| 2026-10-06 | Info: UI menggambar ilustrasi bead sendiri dari `defectType.id` (`components/station/BeadIllustration.tsx`), jadi `public/beads/*.svg` dan field `image`/`mask` belum dipakai UI. BE tidak perlu membuat SVG kecuali untuk event/API. | BE-3 | resolved (commit `3d6f910`; no current API/event consumer, so SVG generation skipped) |
| 2026-10-07 | `TicketView` belum membawa objek `defectType` tiket (hanya `ticket.defectTypeId`); UI memakai fallback nama lokal. Tolong tambahkan `defectType: DefectType` di `TicketView`. | BE-3 | done (commit `3d6f910`) |
| 2026-10-07 | **Seed:** trigger alert KZ-SEAL-007 (thin bead) berisi alert history dengan jenis defect lain (break/missing), jadi gambar pemicu tidak cocok dengan tiketnya. Pakai alert dengan `defectTypeId` yang sama. | BE-3 | done (commit `3d6f910`) |
| 2026-10-07 | **Seed:** kartu KC-SEAL-040..045 berisi teks placeholder ("Validated sealer symptom 1", dll.) dan beberapa field memakai "—". Untuk demo ke juri, ganti dengan isi realistis dari SEED_DATA atau hapus; hindari em-dash di teks data. | BE-3 | done (commit `3d6f910`) |
| 2026-10-07 | **Deploy:** `m3c-learning-line-mvp.vercel.app` memakai Vercel Authentication, jadi juri yang membuka link dari Appendix C akan diminta login Vercel. Untuk FINAL, matikan Deployment Protection untuk Production (Project → Settings → Deployment Protection) atau siapkan alternatif yang bisa dibuka publik, lalu cek dari incognito. Deploy ulang setelah `handoff/ui-3` supaya UI-3 ikut live. | FINAL | open |
| 2026-10-07 | **BE-4 dependency:** tambahkan `three`, `@react-three/fiber`, `@react-three/drei`, `motion`, `recharts` ke `package.json` (untuk andon line 3D, transisi kartu kanban, grafik pilot). | BE-4 | open |
| 2026-10-07 | **BE-4 kamera:** query `getCameraView()` mengembalikan `cameras: { id, stationId, name, kind: "sealer" \| "paint_tablet" \| "final", state: "online" \| "attention" \| "offline", note?, uptime14d: number[] (0..1 per hari), lastLensCleanAt, modelVersion, fps, resolution }[]` dan `events: { cameraId, at, kind: "alert" \| "confirm" \| "reject" \| "stop_fix" \| "contain" \| "continue" \| "gap", alertId?, label }[]` untuk shift berjalan (dari alerts/decisions yang sudah ada). Action `createCameraTicket(cameraId, reason)` (role team leader atau DX cell). Seed: minimal 1 kamera "attention" (lensa kotor) dan 1 jeda rekaman, konsisten dengan st-02 over budget. | BE-4 | open |
| 2026-10-07 | **BE-4 pilot data:** `getPilotView()` untuk timeline pilot (bentuk ditentukan BE; UI akan menampilkan tren mingguan Gate 1 dan baseline → target). Semua berlabel simulated. | BE-4 | open |

### Request ke UI (dari BE)

| Tgl | Request | Untuk fase | Status |
|---|---|---|---|
| 2026-10-06 | Pada UI-1, hubungkan role switcher ke `setRole`, baca awal melalui `getCurrentRole`, ganti CDN ikon dengan `@phosphor-icons/react`, dan jalankan `router.refresh()` sekitar tiap 2 detik pada `/station` serta `/shift-board`. | UI-1 | done (`handoff/ui-1`) |
| 2026-10-07 | Pada UI-3, gunakan `TicketView.defectType` sebagai sumber nama/criticality tiket; hubungkan `/metrics` ke `getMetricsView()` dan `/simulator` ke empat action simulator. | UI-3 | done (`handoff/ui-3`) |

---

## 7. Log perubahan kontrak

Setiap perubahan nama/bentuk di `lib/types.ts`, `lib/queries.ts`, `lib/actions/*` atau file bersama **wajib** dicatat di sini.

| Tgl | Oleh | Perubahan | Dampak ke pihak lain |
|---|---|---|---|
| 2026-10-06 | UI | Aturan kolaborasi (COLLAB.md, AGENTS.md) dibuat | BE mulai dari BE-0 |
| 2026-10-06 | BE | BE-0 menambahkan kontrak tipe lengkap, `getStationView(stationId)`, `getShiftBoardView()`, dan `setRole(role)` | UI-0 memakai view model dari `lib/queries.ts`, tipe dari `lib/types.ts`, dan action dari `lib/actions/role.ts` |
| 2026-10-06 | UI | Mockup HTML 5 layar di `design/mockup/` + `PRODUCT.md`; `design/**`, `PRODUCT.md`, `.impeccable/**` jadi milik UI | Tidak ada; BE boleh membuka `design/mockup/` untuk melihat bentuk data yang dibutuhkan tiap layar |
| 2026-10-06 | UI | UI-0 selesai: shell + primitive + `/styleguide`. Desain diganti ke "The Plant Sign" (lihat `docs/DESIGN.md`), bukan top bar navy. | Tidak ada perubahan kontrak. Lihat 3 request di §6. |
| 2026-10-06 | BE | Konstanta/validasi cookie role dipindah ke `lib/role-cookie.ts`; `lib/actions/role.ts` kini hanya mengekspor async `setRole`; `getCurrentRole()` ditambah dengan default aman `operator` | UI dapat memakai role cookie tanpa membaca cookie langsung; regresi build server action selesai |
| 2026-10-06 | BE | Menambah action BE-1: `confirmAlert`, `rejectAlert`, `submitIdea`, `decideShift`, `verifyRejection`; `AlertView.recommendation` membawa keputusan, teks, sumber sistem, dan hitungan repeat | UI-1 memanggil action sesuai peran; rekomendasi hanya panduan dan keputusan shift tetap tindakan team leader |
| 2026-10-06 | BE | Action me-revalidate `/station` dan `/shift-board`; live view memakai `router.refresh()` UI sekitar tiap 2 detik; dependency `@phosphor-icons/react` tersedia | UI-1 memasang polling ringan dan mengganti CDN ikon tanpa menghitung aturan bisnis |
| 2026-10-06 | UI | Prosedur handoff (§4, AGENTS.md, CLAUDE.md): tag dibuat `git tag -a` dan di-push terpisah (`git push origin handoff/<fase>`), karena `--follow-tags` tidak membawa tag lightweight. | BE: pakai perintah baru mulai `handoff/be-2` |
| 2026-10-06 | UI | UI-1 selesai: `/station` (alert, skor vs threshold, confirm/reject + reason sheet, ide) dan `/shift-board` (tile + budget, panel keputusan dengan catatan wajib); role switcher memakai `setRole`/`getCurrentRole`; ikon pakai `@phosphor-icons/react`; `LiveRefresh` 2 detik. | Tidak ada perubahan kontrak. 3 request baru di §6 (dua untuk BE-2). |
| 2026-10-06 | BE | `ShiftBoardView.modelReviews` mengekspos review current-shift beserta ID/status; `StationView.decisionHistory` mengekspos alert dan keputusan operator/team leader current-shift | UI-2 dapat memanggil `verifyRejection(reviewId)` dan menampilkan "This station, this shift" tanpa join atau aturan bisnis di client |
| 2026-10-06 | BE | Menambah `getKaizenView()`, `getTicketView(id)`, `getKnowledgeView(filters)`; confirm ketiga atomik membuka satu ticket; action `updateA3`, `advanceTicket`, `requestValidation`, `validateCard`, `returnCard` menjaga state machine dan otoritas manusia | UI-2 merender Pareto, ticket/A3, provenance field prefill, readiness validasi, current card, dan riwayat revisi langsung dari view model |
| 2026-10-06 | BE | `POST /api/assistant` hanya mengambil card validated, mewajibkan citation `[CARD-ID r<revision>]`, fallback offline saat key/API gagal, mengembalikan `no_card` tanpa tebakan, dan dibatasi 20 request/menit per request key | UI-2 memakai `AssistantAnswer.mode`; jika `no_card`, panggil `routeToOwner(question)` untuk membuat antrean ke `role:engineer@body` |
| 2026-10-06 | BE | Menambah `@anthropic-ai/sdk` untuk enhancement server-side opsional; retrieval lokal dan guardrail tetap authoritative tanpa key | Tidak ada secret/client SDK; demo tetap berjalan tanpa `ANTHROPIC_API_KEY` atau `DATABASE_URL` |
| 2026-10-07 | UI | UI-2 selesai: `/kaizen` (Pareto + tiket terbuka), `/kaizen/[id]` (stepper, alert pemicu, A3 6 blok editable + tag AI, advance/request validation), `/knowledge` (filter status/stasiun via URL, CardView + revisi, validate/return, AssistantPanel via `POST /api/assistant` dengan citation chip + route to owner). Tambahan UI-1: riwayat stasiun dan antrean "Rejections to verify" (`verifyRejection`). | Tidak ada perubahan kontrak. 3 request baru di §6 untuk BE-3. |
| 2026-10-07 | BE | `TicketView.defectType` ditambah dan seed ticket diperbaiki agar tiga trigger selalu confirmed serta cocok station/defect; konten kartu placeholder diganti tanpa mengubah distribusi 9 validated, 2 draft, 1 retired | UI-3 dapat menghapus fallback defect lokal dan merender objek `defectType` langsung |
| 2026-10-07 | BE | `getMetricsView()` mengekspos KPI Gate 1 bersumber, false alarm per station, tren override 31% ke simulated 24%, median learning cycle, idea counts, dan label `Simulated data`; action `injectTrueDefect`, `injectFalseAlarm`, `injectRepeat3`, `resetDemo` tersedia | UI-3 hanya merender view model dan memanggil action; simulator tetap memerlukan confirm operator dan keputusan team leader |
| 2026-10-07 | BE | `getStore()` memakai Drizzle/Postgres snapshot transaksional saat `DATABASE_URL` tersedia dan MemoryStore saat tidak ada; tidak ada current API/event consumer untuk file bead, sehingga SVG tidak dibuat | Deploy publik perlu `DATABASE_URL` untuk state simulator lintas instance; build lokal tetap tanpa env. Vercel belum dideploy karena CLI logged out, sehingga BE-3 tetap TODO dan belum ada `handoff/be-3` |
| 2026-10-07 | BE | BE-3 dideploy ke `https://m3c-learning-line-mvp.vercel.app` dengan `DATABASE_URL` Production Secret; `demo_states` terinisialisasi otomatis dan reset → true defect → repeat ×3 ticket → reset bertahan pada request Production terpisah; assistant tanpa key tetap offline dan grounded | BE-3 selesai. Deployment memakai Vercel Authentication protection; UI-3 memakai URL Production dan kontrak BE-3 yang sudah tercatat |
| 2026-10-07 | UI | UI-3 selesai: `/` cover page (hero video grayscale + demo, A3 kasus, penutup; app chrome disembunyikan via `ChromeGate`), `/metrics` (Gate 1, grafik override baseline→now dengan target, false alarm per stasiun), `/simulator` (4 skenario + alur demo), tiket memakai `TicketView.defectType`, link Demo control di footer, `docs/screenshots/` (laptop/tablet/HP, terang/gelap). | Tidak ada perubahan kontrak. Request FINAL di §6 soal Vercel protection. |
| 2026-10-07 | UI | Master plan UI-4 (`design/MASTER_PLAN.md`): modul CCTV sealer terinspirasi prinsip netra, andon line 3D, kanban trail, takt/gemba board. 3 request BE-4 di §6. UI membuat prototipe di `design/mockup/` dulu. | BE: kerjakan BE-4 setelah FINAL siap; UI-4 menunggu `handoff/be-4`. |
