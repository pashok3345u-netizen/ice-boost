# IceBoost — PC optimizer for gamers

Windows desktop app (Electron + React + TypeScript + Tailwind v4, i18next RU/EN). Owner: Pasha (Aising), beginner — explain in plain Russian.
Goal: portfolio piece + give to friends. Owner's PC: i5-9400F, RX 590 8 GB, 16 GB RAM, 256 GB SSD (C: low on space), Windows 11 Pro.

## Commands
- `npm run dev` — run with hot reload
- `npm run typecheck` — TS check (TypeScript 7)
- `npm run build` — build to `out/`
- `npm run dist` — installer + portable exe in `release/` (exe requires admin via manifest)
- Node is at `C:\Program Files\nodejs` (prepend to PATH in PowerShell)

## Dev checks (env vars, see src/main/devhooks.ts)
- `ICEBOOST_SELFTEST=1` + run electron → prints `@@SELFTEST {json}`: sysinfo, live, processes, startup, tweaks, scan, registry write/read/delete on throwaway key `HKCU\Software\IceBoostSelfTest`, cleaning a temp folder. Touches nothing real.
- `ICEBOOST_SHOTS=<dir>` (+ `ICEBOOST_PAGES`, `ICEBOOST_WAIT`, `ICEBOOST_PAGE_WAIT` ms per page) → saves PNG of each page, quits. The same page listed twice → `space.png`, `space-2.png`… (use `ICEBOOST_JS` with a `sessionStorage` counter to click different tabs).
- Self-test also covers Disk Space: drives, app list + measuring, icons, the file engine on a temp folder (copies, "portable game" folder), and that protected paths are refused by `trashPaths`.
- Run: `node_modules\electron\dist\electron.exe .` (or `... release\win-unpacked\resources\app.asar` for the packaged build)
- Careful: these runs share `%APPDATA%\IceBoost` (localStorage: lang, XP, achievements) with the installed app. Restore anything you change (e.g. `lang` for EN screenshots).

## Site (`site/`, separate package)
- Landing page: Vite + React + Tailwind v4 + motion, same palette/font/mascot as the app. All text RU/EN in `site/src/i18n.ts`.
- `npm run dev --prefix site` (port 5174, launch config "site" in `.claude/launch.json`), `npm run build --prefix site` → `site/dist`.
- `site/src/config.ts`: VERSION + download links → GitHub Releases of `pashok3345u-netizen/ice-boost`, tag `v<version>`. Bump on every release.
- Live at https://pashok3345u-netizen.github.io/ice-boost/ — `.github/workflows/pages.yml` rebuilds it on every push to `main` that touches `site/` (`SITE_BASE=/ice-boost/`). `og:url`/`og:image` in `site/index.html` are absolute — change them if the address changes.
- Release = `npm run dist`, bump `VERSION` in `site/src/config.ts`, then `gh release create v<ver> release\IceBoost-Setup-<ver>.exe release\IceBoost-<ver>-portable.exe`.
- Repo is public. Commits use the GitHub noreply email (local git config) — never the owner's real email.
- Screenshots `site/public/shots/{ru,en}/*.webp` come from `ICEBOOST_SHOTS`. Don't use the Startup page: it shows the Windows username in paths.

## Layout
- `src/main/ps.ts` — persistent PowerShell workers (stdin protocol, base64 lines, `@@` prefix); `runElevated` = one UAC prompt per call via temp .ps1 (direct if already admin)
- `src/main/system.ts` — sysinfo, live CPU (os.cpus deltas) / RAM / disk (statfs) / GPU (perf counters via CIM, cached), processes grouped by name with CPU% deltas
- `src/main/gpu.ts` + `src/shared/gpu.ts` — GPU temperature/voltage/fan/power watcher and danger zones (see "GPU monitor")
- `src/main/cleaner.ts` — junk categories; skips apps that are running; temp folders only files >24h old
- `src/main/startup.ts` — Run keys + Startup folders; toggles via `StartupApproved` (same as Task Manager)
- `src/main/tweaks.ts` + `src/shared/tweaks.ts` — tweak definitions; backup of original values in `%APPDATA%\IceBoost\backup.json` before first change; undo restores backup or Windows default
- `src/shared/protected.ts` — processes that can never be killed
- `src/renderer/src` — pages (Dashboard with health score + one-click, GPU monitor, Boost, Cleaner, Disk Space, Startup, Processes, Settings), `i18n.ts` has all RU/EN text, `catalog.ts` startup hints + "close before game" apps + app hints ("better keep") + game detection + disk map hints

## Design (v0.2)
- Owner's palette: `#25252B` (bg), `#528A9A` (teal), `#D9E7E8` (frost); tokens in `styles.css` `@theme`, JS copies in `theme.ts`. Headings/numbers use the Unbounded font (`font-display`).
- Animations via `motion` (`motion/react`): page transitions, nav pill (`layoutId`), springs. `Fx.tsx` = canvas snow + confetti bursts (`burst()`, `blizzard()`), ~30 fps, off via Settings → Effects.
- `Mascot.tsx` = "Айсик" ice cube, mood from health score (melts when bad, sunglasses at 90+); 7 fast clicks (or 5 on the title-bar logo) = secret blizzard.
- `progress.tsx` = XP / levels / 13 achievements in localStorage `iceboost.progress`; call `track({...})` after real actions.
- `health.ts` = score + issues (shared by Dashboard, mascot, progress).
- `ICEBOOST_JS=<code>` in shot mode runs JS before each screenshot (e.g. click the mascot).
- `ICEBOOST_FAKE_GPU='{"temp":89,"voltage":1.27}'` → GPU sensors report these values (check the danger UI + Windows notification). Notifications land in `%LOCALAPPDATA%\Microsoft\Windows\Notifications\wpndatabase.db` (handler `com.aising.iceboost.dev` for test runs, `com.aising.iceboost` for the installed app) — query a copy with Python sqlite3 to confirm one was shown.
- Test runs via `electron.exe` use AppUserModelId `com.aising.iceboost.dev` (`app.isPackaged` = false). Never give them the real id: Electron writes a Start-menu `Electron.lnk` with that id, and Windows then shows the installed app as "Electron" (happened 2026-10-24, fixed by deleting the .lnk).

## GPU monitor (v0.3, added 2026-10-24 — owner's card almost burned)
- `src/main/gpu.ts`: watcher in the main process, every 2 s, own PowerShell worker `sensorPs`. AMD = ADL (`atiadlxx.dll`) through C# compiled by `Add-Type` on first call; OverdriveN path (RX 400/500/Vega) tested on owner's RX 590, Overdrive 8 PMLog path (RX 5000+) untested. NVIDIA = `nvidia-smi` (no voltage), untested. Detection tries NVIDIA first (AMD iGPU + GeForce PCs).
- `src/shared/gpu.ts`: zones shared by page, health score and notifications. Temp zones from the driver's own max (RX 590 reports 90 °C → warm 70 / hot 80 / danger 87). Voltage: >1.2 V hot, >1.25 V danger. Fan 0 at ≥75 °C = in-app hint only.
- Windows notification only for `danger`, after 2 readings in a row, max once per 3 min per problem, one toast for several problems; click → GPU page. Text RU/EN from renderer `localStorage.lang`.
- RX 590 readings: idle 0.762 V / ~42 °C / 300 MHz / ~7 W, light load 1.081 V @ 1300 MHz. Fans stop below ~50–60 °C (zero-RPM) → fan RPM 0 is normal when cool. Fan RPM under real load NOT verified yet (card never got warm enough in tests).

## Disk Space page (v0.4, added 2026-10-25 — friends need room for games)
- `src/main/space.ts` (IPC side) + `src/main/space.cs` (C# engine, `Add-Type` in its own worker `diskPs`, imported with `?raw`) + `src/main/space-apps.ps1` (app list). Renderer: `space.tsx` (context above the pages), `pages/Space.tsx` (goal card + quick finds), `pages/space/*` (Apps, Files, Map tabs, uninstall window, treemap).
- Apps = Windows "Apps" registry (HKLM/WOW/HKCU Uninstall) + Steam manifests (size, LastPlayed; unfinished download in `steamapps\downloading\<id>` counted) + Epic manifests (untested, no Epic here) + Store apps with a Start menu entry. Folders measured by the engine; "last started" from Prefetch + BAM (need admin = only in the packaged app) + UserAssist (off on owner's PC).
- Uninstall: windowed uninstallers are spawned directly from main (window comes to the front), console ones (PE subsystem 3: powershell, winget) via PS `Start-Process`. Quiet mode: QuietUninstallString / MSI `/x /qb` / Inno `_is1` `/SILENT`. Steam → `steam://uninstall/<id>`. Store → `Remove-AppxPackage`. Then polls `appInstalled` and looks for leftovers (install folder + AppData/ProgramData folders with the exact app/folder name).
- Nothing is deleted for good: files/leftovers go to the Recycle Bin (`shell.trashItem`), quick find "Корзина" empties it. `shared/space.ts` `lockReason()` protects Windows, Program Files, ProgramData, AppData, drive roots, Users/profile/known folders and installed app folders — checked again in main before trashing.
- Files tab: user folder (+ added folders), files ≥10 MB; "last used" = max(changed, created, opened if NtfsDisableLastAccessUpdate allows). Files in folders with an `.exe` next to `.dll` (portable apps/games, build outputs) are hidden and never count as copies — a test once picked real `release\win-unpacked` files as "copies".
- Copies: same size → SHA1 (full ≤256 MB, else 32×1 MB samples); the file's "last opened" date is put back after reading.
- Disk map: whole drive scan (C: ≈18 s, 580k files, 6 threads on the first 2 levels), tree kept in the engine, `mapLevel` = instant drill-down.
- Testing uninstall: scratchpad scripts made a throwaway HKCU "IceBoost Test App" (console and wscript uninstallers). Tests that click "delete" must only ever pick test files; test runs also give XP — restore `iceboost.progress` afterwards.

## Install
- `npm run dist`, then `release\IceBoost-Setup-<ver>.exe` (per-user, no admin to install; `/S` = silent). Installs to `%LOCALAPPDATA%\Programs\IceBoost`, desktop + Start menu shortcuts, listed in Settings → Apps. Icon: `build/make-icon.ps1` → `icon.png` + multi-size `icon.ico`.
- Window size/position saved in `%APPDATA%\IceBoost\window.json`.

## Status (2026-10-25, v0.4.0)
- v0.4 (Disk Space) built and installed on owner's PC (silent install over v0.3). Self-test passes on the packaged build. Uninstall flow tested end-to-end on a fake app; NOT yet tested on a real program, Steam game or Store app, and Prefetch/BAM "last started" not checked with admin rights.
- Site updated for v0.4 (features, Disk Space screenshot RU/EN, 18 achievements, FAQ) — not pushed yet at the time of writing.
- Public: repo github.com/pashok3345u-netizen/ice-boost, releases v0.2.0 and v0.3.0 (setup + portable exe), site live on GitHub Pages.
- NOT yet verified on real settings: applying/undoing real tweaks, admin cleaning, restore point, UAC flows. First real run should be by the owner.
- Exe is unsigned → SmartScreen warning for friends ("More info → Run anyway").
