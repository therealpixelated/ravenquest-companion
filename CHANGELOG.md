# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-12-26

### Added

- ESLint (airbnb-base) and Prettier for code quality and consistency
- Unhandled promise rejection logging for better error tracking
- Lint and format npm scripts (`npm run lint`, `npm run format`)
- CI now runs linting checks on push

### Changed

- Enhanced CHANGELOG format following keepachangelog.com standards

### Fixed

- Tab buttons now properly clickable in draggable navigation bar
- Auto-check collected checkbox when all materials are maxed out
- Auto-fill all materials to max when collected checkbox is checked

## [1.2.0] - 2025-12-25

### Added

- Frameless/transparent overlay window with skip-taskbar and positioning
- Daily reset alert toast (6AM PST)
- Reload data button with inline validation warnings
- Cosmetic progress bars and ARIA labels
- Icon prebuild script using sharp
- Draggable overlay with opacity control slider
- Playwright E2E tests for overlay functionality

### Changed

- Electron bumped to ^32.x for improved stability
- Consolidated trophy data into single trophies.json file

## [1.1.0] - 2025-12-25

- Added CSP to renderer page.
- Async data loads with validation and renderer warnings.
- IPC input validation and Jest tests (data/time/ipc).
- CI workflow (GitHub Actions) running npm test.
- Tray/menu toggle, loading/toast UI, ARIA/keyboard improvements.
- Updated icons (regenerated multi-size icon.ico from icon.jpg).
- Switched to @electron/packager and upgraded Electron via audit fix.
- README refreshed; added LICENSE and this changelog.
- Enabled sandbox in webPreferences.
- Improved accessibility for cosmetics list items.
