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
| **UI** | `app/globals.css`, `app/layout.tsx`, `app/**/page.tsx`, `app/**/loading.tsx`, `app/**/error.tsx`, `app/**/not-found.tsx`, `components/**`, `public/**` (kecuali `public/beads/` yang di-generate script BE), `docs/DESIGN.md`, `docs/screenshots/**` |
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
| UI-0 | UI | Token `@theme` di `globals.css` (DESIGN.md); `layout.tsx`: top bar navy, role switcher, shift clock, footer label; primitive `components/ui/`: Button (48–64 px), Badge, AndonBadge, LoopBadge, DataTable gaya dokumen, KpiTile, Sheet/Dialog, EmptyState | `handoff/be-0` | TODO |
| BE-1 | BE | `lib/rules` repeat/budget/recommend/override + test; action §2.3 fase BE-1; mekanisme refresh 2 detik | `handoff/ui-0` | TODO |
| UI-1 | UI | `/station`: AlertCard + HeatmapImage, score vs threshold, DecisionBar, ReasonCodeSheet, status "what happens next", Suggest idea. `/shift-board`: grid StationTile (counts, budget meter, flag "model review needed"), RecommendationBox + 3 tombol keputusan + note | `handoff/be-1` | TODO |
| BE-2 | BE | Ticket auto-open (repeat ×3), A3, status flow, cards + validate/return, assistant (retrieve, guardrail, offline mode, rate limit) + test; `getKaizenView`, `getTicketView`, `getKnowledgeView` | `handoff/ui-1` | TODO |
| UI-2 | UI | `/kaizen`: Pareto, daftar tiket. `/kaizen/[id]`: TicketHeader + status stepper, A3Form 6 blok, label "Drafted by AI, check". `/knowledge`: list + filter, CardView + riwayat revisi, Validate/Return, AssistantPanel (citation chip, offline label, no-card state + Route to owner engineer) | `handoff/be-2` | TODO |
| BE-3 | BE | `getMetricsView`, simulator actions, reset, generator SVG bead (`public/beads/`), deploy Vercel + env | `handoff/ui-2` | TODO |
| UI-3 | UI | `/metrics` (KPI + tooltip sumber, Gate 1 panel), `/simulator`; polish tablet 10" & laptop, kontras AA, keyboard, loading/empty/error state, cek istilah ES, `docs/screenshots/` | `handoff/be-3` | TODO |
| FINAL | Berdua | DEMO_SCRIPT dijalankan di URL live setelah Reset; rekam video ≤ 3 menit (UI); link ke Appendix C | `handoff/ui-3` | TODO |

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
git tag handoff/ui-1
git push origin main --follow-tags
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
| | | | |

### Request ke UI (dari BE)

| Tgl | Request | Untuk fase | Status |
|---|---|---|---|
| | | | |

---

## 7. Log perubahan kontrak

Setiap perubahan nama/bentuk di `lib/types.ts`, `lib/queries.ts`, `lib/actions/*` atau file bersama **wajib** dicatat di sini.

| Tgl | Oleh | Perubahan | Dampak ke pihak lain |
|---|---|---|---|
| 2026-10-06 | UI | Aturan kolaborasi (COLLAB.md, AGENTS.md) dibuat | BE mulai dari BE-0 |
| 2026-10-06 | BE | BE-0 menambahkan kontrak tipe lengkap, `getStationView(stationId)`, `getShiftBoardView()`, dan `setRole(role)` | UI-0 memakai view model dari `lib/queries.ts`, tipe dari `lib/types.ts`, dan action dari `lib/actions/role.ts` |
