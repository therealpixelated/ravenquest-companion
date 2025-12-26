# RavenQuest Companion

Version: 1.2.0  
Last updated: December 2025

Windows companion app for tracking RavenQuest cosmetics and trophies. Electron + context isolation, local JSON data, electron-store persistence.

## Features

- Trophy tracker (creature/ocean/carnival/monuments) with tier states and stat totals
- Cosmetics tracker with per-material counts and collected flag
- Loading/toast feedback, basic ARIA/keyboard support
- Overlay window: frameless, transparent, always-on-top with global toggle `Ctrl+Alt+F12`
- Local persistence via electron-store; offline friendly

## Quick start

```bash
npm install
npm start
```

Run tests:

```bash
npm test
```

Build (Windows):

```bash
npm run build
```

Output goes to `dist/`.

Requires Electron 32.x (installed via npm).

Regenerate icon (prebuild):

```bash
npm run prebuild:icon
```

## Project layout

- data/… JSON datasets (cosmetics, creature/ocean/carnival/aether trophies)
- renderer/… HTML/CSS/JS for UI
- src/timeUtils.js, src/dataValidation.js, src/ipcValidation.js
- tests/… Jest + data checks
- main.js, preload.js, package.json

## Hotkeys

- Show/hide: `Ctrl+Alt+F12`

## Icon regeneration

If you update `assets/icon.jpg`, regenerate `icon.ico` (multi-size) with ImageMagick:

```powershell
cd assets
"C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe" convert icon.jpg -define icon:auto-resize="16,24,32,48,64,128,256" icon.ico
```

## Troubleshooting

- Ensure Node.js is installed and `npm install` completed.
- If tray icon is missing, verify `assets/icon.ico` exists.

## License

See [LICENSE](LICENSE).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
