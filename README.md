# RavenQuest Companion

<p align="center">
  <img src="assets/icon.ico" alt="RavenQuest Companion" width="128">
</p>

<p align="center">
  <strong>Track your trophies, cosmetics, and progress in RavenQuest</strong>
</p>

<p align="center">
  Version: 1.4.0 | Windows Desktop App | Electron
</p>

---

## ✨ Features

### 🏆 Trophy Tracking
Track all trophy types with three collection tiers (Base, Golden, Enchanted):

- **Creature Trophies** - Hunt creatures and track your kills
- **Ocean Trophies** - Sea monster hunting progress
- **Monuments** - Boss kills with shared counter
- **Carnival Trophies** - Wheel spins and gambling stats

![Trophy Tracker](docs/screenshots/01-trophies-full.png)

### 📊 Kill Counters & Milestones
- Track kills per trophy type
- Record how you acquired each tier (Collected, Purchased, Gambled)
- Milestone history preserved even after counter resets

### 🎭 Cosmetics Tracking
Track 695+ cosmetic items across categories:
- Outfits, Mounts, Weapon Shines, Teleports, and more
- Category-by-category renown breakdown
- Progress toward max renown

![Cosmetics Tracker](docs/screenshots/05-cosmetics-full.png)

### 🔍 Powerful Filtering
Find what you're looking for quickly:

| Filter Type | Options |
|-------------|---------|
| **Search** | Filter by name |
| **Status** | All, Complete, Partial, Uncollected |
| **Tier** | Base, Golden, Enchanted collected |
| **Category** | Trophy type or cosmetic category |

![Search Results](docs/screenshots/08-search-results.png)

### ⚙️ Multiple View Modes
Adapt the app to your playstyle:

| Mode | Description | Screenshot |
|------|-------------|------------|
| **Full View** | Complete tracking interface | ![Full](docs/screenshots/full-trophies.png) |
| **Compact Sidebar** | Slim sidebar with stats & targets | ![Sidebar](docs/screenshots/compact-sidebar.png) |
| **Floating Tracker** | Small moveable checklist | ![Float](docs/screenshots/compact-floating.png) |

### 📈 Dashboard Stats
Real-time progress in the top bar:
- Trophy completion percentage
- Cosmetic collection progress  
- Total renown earned vs maximum

### 🔒 Data Management
- Local persistence (works offline)
- Reset counters only or full progress reset
- Data stored via electron-store

![Data Management](docs/screenshots/07-settings-reset.png)

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run the app
npm start
```

### Build for Windows

```bash
npm run build
```

Output goes to `dist/`.

---

## 🎮 Hotkeys

| Hotkey | Action |
|--------|--------|
| `Ctrl+Alt+F12` | Toggle overlay visibility |

Configurable in Settings panel.

---

## 📸 Screenshots Gallery

<details>
<summary>Click to expand all screenshots</summary>

### Trophy Categories

**Creature Trophies**
![Trophies](docs/screenshots/01-trophies-full.png)

**Ocean Trophies**
![Ocean](docs/screenshots/02-ocean-trophies.png)

**Monuments (Shared Boss Counter)**
![Monuments](docs/screenshots/03-monuments.png)

**Carnival Trophies**
![Carnival](docs/screenshots/04-carnival-trophies.png)

### Cosmetics

**Full Cosmetics View**
![Cosmetics](docs/screenshots/05-cosmetics-full.png)

**Mounts Category**
![Mounts](docs/screenshots/13-cosmetics-mounts.png)

**Outfits Category**
![Outfits](docs/screenshots/14-cosmetics-outfits.png)

### Filtering

**Completed Trophies**
![Complete](docs/screenshots/09-filter-complete.png)

**Partially Collected**
![Partial](docs/screenshots/10-filter-partial.png)

**Uncollected**
![Uncollected](docs/screenshots/11-filter-uncollected.png)

**Filter by Tier**
![Tier Filter](docs/screenshots/12-filter-tier.png)

### View Modes

**Full View - Trophies**
![Full Trophies](docs/screenshots/full-trophies.png)

**Full View - Cosmetics**
![Full Cosmetics](docs/screenshots/full-cosmetics.png)

**Compact Sidebar**
![Compact Sidebar](docs/screenshots/compact-sidebar.png)

**Floating Tracker**
![Floating](docs/screenshots/compact-floating.png)

**Settings Window**
![Settings](docs/screenshots/settings-open.png)

</details>

---

## 🗂️ Project Structure

```
ravenquest-companion/
├── main.js           # Electron main process
├── preload.js        # Context bridge
├── package.json
├── assets/           # Icons and images
├── data/             # JSON datasets
│   ├── cosmetics.json
│   ├── creature-trophies.json
│   ├── ocean-trophies.json
│   ├── aether-trophies.json
│   └── carnival-trophies.json
├── renderer/         # UI files
│   ├── index.html
│   ├── styles.css
│   ├── tabs.js
│   ├── trophies.js
│   ├── cosmetics.js
│   └── settings.js
├── src/              # Utilities
│   ├── timeUtils.js
│   ├── dataValidation.js
│   └── ipcValidation.js
├── tests/            # Jest tests
└── docs/             # Documentation & screenshots
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run linter
npm run lint
```

---

## 🔧 Development

### Requirements
- Node.js 18+
- Windows 10/11

### Icon Regeneration
If you update `assets/icon.jpg`:

```powershell
cd assets
magick convert icon.jpg -define icon:auto-resize="16,24,32,48,64,128,256" icon.ico
```

### Capture Screenshots
```bash
npx electron scripts/capture-screenshots.js
```

---

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## 📄 License

See [LICENSE](LICENSE).

---

<p align="center">
  Made for the RavenQuest community 🎮
</p>
