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
- `ICEBOOST_SHOTS=<dir>` (+ `ICEBOOST_PAGES`, `ICEBOOST_WAIT`) → saves PNG of each page, quits.
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
- `src/renderer/src` — pages (Dashboard with health score + one-click, GPU monitor, Boost, Cleaner, Startup, Processes, Settings), `i18n.ts` has all RU/EN text, `catalog.ts` startup hints + "close before game" apps

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

## Install
- `npm run dist`, then `release\IceBoost-Setup-<ver>.exe` (per-user, no admin to install; `/S` = silent). Installs to `%LOCALAPPDATA%\Programs\IceBoost`, desktop + Start menu shortcuts, listed in Settings → Apps. Icon: `build/make-icon.ps1` → `icon.png` + multi-size `icon.ico`.
- Window size/position saved in `%APPDATA%\IceBoost\window.json`.

## Status (2026-10-25, v0.3.0, on `main`)
- v0.3 (GPU monitor) installed on owner's PC (silent install over v0.2). Self-test passes on the packaged build.
- Public: repo github.com/pashok3345u-netizen/ice-boost, releases v0.2.0 and v0.3.0 (setup + portable exe), site live on GitHub Pages.
- NOT yet verified on real settings: applying/undoing real tweaks, admin cleaning, restore point, UAC flows. First real run should be by the owner.
- Exe is unsigned → SmartScreen warning for friends ("More info → Run anyway").
