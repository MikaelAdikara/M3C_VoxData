# Panduan giliran UI ↔ BE

Ringkasan praktis dari `COLLAB.md` §3–§4: siapa sedang bekerja, kapan boleh push, dan kapan harus menunggu. Kalau ada yang bertentangan, `COLLAB.md` yang berlaku.

---

## 1. Giliran sekarang

| | |
|---|---|
| **Giliran** | **FINAL** (rekam video, Appendix C); tidak ada fase kode yang menunggu |
| Selesai | BE-4 (`handoff/be-4`) dan UI-4 (`handoff/ui-4`) |
| Isi UI-4 | Cameras, Station camera feed, The Line 3D, cover v3, Metrics v2, dock "Ask the line", bead realistis. Lihat `COLLAB.md` §7 |
| Berikutnya (opsional) | UI: model mobil realistis di cover dan update screenshot/DESIGN.md. BE: tidak ada request terbuka baru |

> Perbarui tabel ini setiap kali giliran berpindah, di commit yang sama dengan tag handoff.

---|---|
| **Giliran** | **UI → mengerjakan UI-4 setelah tag `handoff/be-4` tersedia di remote** |
| Syarat UI-4 | `handoff/be-4` menjadi penanda handoff BE-4 selesai |
| Isi UI-4 | Lihat `COLLAB.md` §3 (baris UI-4), §6 (request UI-4), dan §8 (kontrak BE-4); implementasikan mockup UI-4 dengan view/action backend yang tersedia |
| Referensi visual | `design/mockup/plan.html` (hub semua mockup) dan `design/MASTER_PLAN.md` |
| Status BE-4 | Dependency terpasang; lint, typecheck, 103 test, build, `db:seed`, dan smoke BE-4 lulus. Dataset mentah pilot tetap di workspace terpisah. |
| Paralel | **FINAL** (rekam video, Appendix C) bisa jalan kapan saja karena tidak mengubah kode |

> Perbarui tabel ini setiap kali giliran berpindah, di commit yang sama dengan tag handoff.

---

## 2. Siklus giliran

```
BE-n selesai ──► tag handoff/be-n ──► UI-n boleh mulai
                                        │
UI-n selesai ──► tag handoff/ui-n ──► BE-(n+1) boleh push
```

- Fase hanya boleh **dimulai** kalau tag di kolom "Butuh" (`COLLAB.md` §3) sudah ada di remote.
- Selama pihak lain bekerja, kamu **boleh menyiapkan fase berikutnya di lokal**, tapi **jangan push kode aplikasi** sampai tag pihak lain muncul.
- **Boleh di-push kapan saja** (asal `git pull --rebase` dulu): perubahan dokumen bersama (`COLLAB.md` §6–§7, `HANDOFF.md`) dan file desain milik UI (`design/**`). Keduanya tidak menyentuh kode yang sedang dikerjakan pihak lain.

---

## 3. Cara cek "sudah giliran saya belum?"

```bash
git fetch --all --tags
git tag -l 'handoff/*'          # daftar fase yang sudah selesai
git log origin/main --oneline -5
```

| Kamu | Cari tag | Kalau ada | Kalau belum |
|---|---|---|---|
| BE mau mulai BE-n | `handoff/ui-(n-1)` | Mulai BE-n | Tunggu, siapkan di lokal saja |
| UI mau mulai UI-n | `handoff/be-n` | Mulai UI-n | Tunggu, kerjakan mockup di `design/` |

Atau minta agent masing-masing: **"cek repo, apakah sudah giliran saya?"** Agent akan menjalankan perintah di atas sesuai `CLAUDE.md` / `AGENTS.md`.

---

## 4. Checklist mulai fase

1. `git fetch --all --tags && git pull --rebase origin main`
2. Pastikan tag "Butuh" ada (lihat §3).
3. Baca entri baru di `COLLAB.md` §6 (request) dan §7 (log kontrak).
4. `npm install && npm run typecheck`
5. Kalau typecheck gagal di file milik pihak lain: catat di §6, **jangan diperbaiki sendiri**.

## 5. Checklist selesai fase

1. `npm run lint && npm run typecheck && npm run test` (BE juga `npm run build`)
2. Stage **hanya file milikmu** + `COLLAB.md` (+ `HANDOFF.md`); cek dengan `git diff --name-only --cached`
3. Commit dengan prefix `be:` / `ui:` / `docs:`
4. Ubah status fase di `COLLAB.md` §3 jadi `DONE`, tambah entri di §7, perbarui tabel §1 di file ini
5. Tag dan push (tag wajib di-push terpisah):
   ```bash
   git tag -a handoff/be-4 -m "BE-4 done"
   git push origin main
   git push origin handoff/be-4
   ```
6. Kabari pihak lain: "handoff/be-4 sudah di-push".

---

## 6. Kalimat siap pakai untuk agent

**BE (mulai BE-4):**
> Baca `COLLAB.md`, `HANDOFF.md`, dan `design/MASTER_PLAN.md`. Cek repo: `handoff/ui-3` sudah ada, jadi kerjakan BE-4 sesuai §3 dan request bertanggal 2026-10-07 di §6. Selesai: lint, typecheck, test, build, update §3/§7 dan `HANDOFF.md` §1, tag `handoff/be-4`, push main lalu push tag.

**UI (cek giliran):**
> Cek repo. Kalau `handoff/be-4` sudah ada, mulai UI-4 dari mockup di `design/mockup/`. Kalau belum, bilang "Belum" dan lanjutkan mockup saja.

---

## 7. Aturan yang sering terlupa

- Jangan `push --force`. Selalu `git pull --rebase` sebelum push.
- Jangan mengedit file milik pihak lain (lihat `COLLAB.md` §1). Butuh sesuatu? Tulis di §6.
- Konflik di file bersama: ambil versi remote, tambahkan perubahanmu di bawahnya, jangan hapus entri pihak lain.
- Tag lupa di-push = pihak lain tidak bisa mulai. Selalu jalankan `git push origin handoff/<fase>`.
- Tidak ada nama orang di dokumen repo; pakai "UI" dan "BE".
