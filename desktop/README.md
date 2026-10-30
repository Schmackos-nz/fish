# Trout for Clout — desktop / Steam build

An Electron shell around the web game. `build.mjs` copies `../index.html` and `../js/` into `app/game/`. It swaps the
CDN Three.js and Google Fonts for local copies in `vendor/`, so the game runs fully offline.

## Build

```
cd desktop
npm install
npm start            # stage + run in a window (F12 = dev tools)
npm run dist         # stage + package → dist/win-unpacked/TroutForClout.exe
npm run dist:linux   # Steam Deck / Linux build (dist/linux-unpacked)
npm run dist:mac     # macOS — must be run on a Mac
```

Rebuild after any change to the game: `dist` always restages from the repo root.

## What the shell adds

- Fullscreen by default; **F11 / Alt+Enter** toggles it (remembered).
- **Quit to desktop** on the title menu.
- Saves are mirrored to `%APPDATA%\Trout for Clout\saves\reelwild.json` and restored from it at launch.
- Catch photos ("Download") go to `Pictures\Trout for Clout`.
- Steamworks (`steamworks.js`) starts when launched through Steam and enables the overlay (Shift+Tab). Without Steam the game still runs.

## Shipping on Steam

1. **Steamworks partner account:** sign up at partner.steamgames.com, pay the US$100 app fee, and fill in the tax/bank forms. You receive an **App ID**.
2. **App ID:**
   - For local testing, put it in `desktop/steam_appid.txt`. It's 480 (Valve's Spacewar test app) until you have one.
   - Don't ship `steam_appid.txt` in the depot; Steam supplies the ID when it launches the game.
3. **Depot:** run `npm run dist`, then upload `dist/win-unpacked/` as the Windows depot with SteamCMD / ContentBuilder. Set the launch option to `TroutForClout.exe`.
4. **Steam Cloud:** under *Steam Cloud → Auto-Cloud*, add a root.
   - Root: `WinAppDataRoaming`, subdirectory `Trout for Clout/saves`, pattern `*.json`.
   - Set quota to ~1 MB / 10 files.
5. **Content survey:** the game has nudity, sexual content, drug use, crime and gun violence. Answer the Mature Content survey honestly. Expect an adult-content flag; Steam requires it.
6. **Store assets:** capsule images, at least 5 screenshots, a trailer and a description are needed before review.
7. **Release:** Valve reviews the build and store page (a few days). The page must be "Coming Soon" for at least 2 weeks before launch.

Optional: buy a code-signing certificate and set `win.certificateFile` in package.json, so Windows SmartScreen doesn't warn on the exe. Steam installs don't strictly need it.
