# Game Server Builder 🎮⚙️

A modern, fast desktop application built with **Electron**, **React**, **TypeScript**, and **Tailwind CSS** to build, configure, run, and manage dedicated game servers with one click — currently featuring **Minecraft Java Edition** and **Garry's Mod**.

---

## 🌟 Key Features

### 1. 🧱 Minecraft Java Edition
- **Multi-Loader Ecosystem**:
  - **Fabric**: Fast & lightweight mod loader with direct installerless jar bootstrap.
  - **Paper & Purpur**: High-performance servers with Bukkit & Spigot plugin support.
  - **NeoForge & Forge**: Full modpack compatibility for classic and modern forge mods.
  - **Vanilla**: Official Mojang server jars.
- **Dual Mod Store (Modrinth & CurseForge)**:
  - Live search across millions of mods with category, loader, and version filters.
  - 1-click installation directly into the server's `mods/` directory.
  - Automatic recursive dependency resolution (e.g. automatically downloads Fabric API and required libraries).
  - Enable, disable, and delete installed mods with one click.
- **Prism / MultiMC Modpack Exporter**:
  - Export any server into a portable client modpack ZIP archive compatible with Prism Launcher and MultiMC.
  - Add optional client-only mods (like Sodium, Iris, JourneyMap, JEI) with automatic dependency fetching.
- **World Management**:
  - **Backups**: 1-click compressed ZIP backups of server worlds with timestamping and 1-click restoration.
  - **Multi-World Switcher**: Create alternate worlds or switch between adventure/creative worlds effortlessly.
  - **Regeneration**: Wipe and re-generate a fresh world with custom seeds and difficulty levels while preventing 0-byte ghost world issues.
- **Visual `server.properties` & JVM Tuning**:
  - Visual sliders and toggles for difficulty, gamemodes, max-players, PvP, MOTD, port, whitelist, flight, view distances, and simulation distance.
  - Min/Max RAM sliders (`-Xms`, `-Xmx`).
  - **Aikar's Flags** 1-click preset for optimized Garbage Collection and reduced tick lag.
  - Auto-detection of local Java JDKs (Microsoft OpenJDK, Eclipse Adoptium, Oracle) with version validation and modern Java 22+ warning suppression.

---

### 2. 🕹️ Garry's Mod Dedicated Server (SRCDS)
- **Automated SteamCMD Bootstrap**:
  - Automatically downloads Valve's SteamCMD utility and installs Garry's Mod dedicated server files (App ID 4020) anonymously.
  - Real-time sub-second download progress tracking showing percentages, stages, and downloaded gigabytes (`3.15 GB / 6.96 GB`).
- **Engine Stability & 64-bit Support**:
  - Runs in a managed Win32 console environment, eliminating the notorious `CTextConsoleWin32::GetLine: !GetNumberOfConsoleInputEvents` exit code 100 crash.
  - Automatic detection and support for `srcds_win64.exe` (64-bit) and `srcds.exe`.
  - Generates a standalone `start.bat` for launching outside the app if desired.
- **Live Console Streaming & Source RCON**:
  - Real-time log capture streaming server output via `-condebug` into the in-app terminal console.
  - Integrated Source RCON TCP protocol: execute live server commands (`status`, `changelevel`, `say`, `kick`, `ulx`) directly from the UI console with immediate response display.
  - Graceful `quit` shutdown when stopping the server.
- **Rich Gamemode Configurations**:
  - **Sandbox**: Toggle noclip (`sbox_noclip`), NPC spawning, global godmode, PvP damage, weapon spawning, and customize per-player limits for props, ragdolls, vehicles, balloons, thrusters, wheels, and dynamite.
  - **DarkRP**: Starting wallet balance (`rp_startingmoney`), payday salary interval and amounts, hunger mode toggle, gun licenses, commercial `/advert` chat, F4 custom jobs, jail sentence duration, demote cooldowns, and prop-push protection.
  - **Trouble in Terrorist Town (TTT)**: Prep round timers, round duration, haste mode, traitor and detective role ratios, detective minimum player count, Karma system tuning (starting/max karma, low karma autokick threshold, clean round bonus), DNA scanner range, and 3D positional voice.
  - **Prop Hunt**: Hunter blind setup time, round duration, hunter miss penalty HP, kill bonus HP, auto-taunts toggle and interval, custom taunt cooldown, and prop 3rd-person camera distance.
  - **Murder**: Round time limits, clue requirements for crafting revolvers, murderer knife draw delay, flashlight battery duration, holstered knife display, and drop-gun-on-death.
  - **Cinema**: Per-player queue limits, max video duration in minutes, voteskip percentage, Twitch stream permissions, and direct video URL support.
- **Steam Workshop & Addon Manager**:
  - Synchronize collections using `+host_workshop_collection` and `-authkey`.
  - Addon browser for local `.gma` and folder addons with instant enable/disable and deletion.

---

### 3. 🖥️ Interactive Console & Global Features
- **Live Terminal Console**:
  - ANSI/color formatting, auto-scroll lock, shell command history (Up/Down arrows), and instant log clearing.
- **Port Conflict Detector**:
  - Automatically scans network ports (e.g. `25565`, `27015`) and warns if another process is currently binding to the port before server startup.
- **Duplicate Server Name Prevention**:
  - Validates unique server names across the application, preventing directory overlaps.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ (tested on Node.js 22.x & 25.x)
- **Java**: JDK 17 or JDK 21+ (required for Minecraft 1.20+)
- **SteamCMD**: Automatically managed and downloaded by the app when creating Garry's Mod servers.

### Installation & Development

```powershell
# Clone the repository
git clone https://github.com/salaza/game-server-builder.git
cd game-server-builder

# Install dependencies
npm install

# Start development mode with Vite hot-reloading
npm run dev
```

### Production Build

```powershell
# Compile Vite frontend and Electron TypeScript
npm run build

# Run in production mode
npm start
```

### Packaging Windows Release Executable

```powershell
# Package standalone installer and portable Windows executable
npm run dist
```
Distribution packages will be output to the `release/` directory:
- Setup Installer (`Game Server Builder Setup 1.0.0.exe`)
- Standalone Portable (`Game Server Builder 1.0.0.exe`)

---

## 📁 Project Architecture

```
server_builder/
├── electron/
│   ├── main.ts              # Electron lifecycle, child process management, RCON, SteamCMD, IPC handlers
│   └── preload.ts           # Secure ContextBridge exposing window.electronAPI
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx             # Server list, game tags, create button
│   │   ├── CreateServerModal.tsx   # Server wizard (Minecraft & GMod gamemodes, maps, ports)
│   │   ├── ServerDashboard.tsx     # Active server controls, header & tab switching
│   │   ├── ConsoleTab.tsx          # Real-time console terminal & interactive command input
│   │   ├── ModsTab.tsx             # Minecraft installed mods table, toggle, delete, import/export
│   │   ├── ModBrowserModal.tsx     # Modrinth & CurseForge search and 1-click installer
│   │   ├── ConfigTab.tsx           # Minecraft server.properties, JVM flags, and raw editor
│   │   ├── WorldsTab.tsx           # World backups, multi-world switcher & world regeneration
│   │   ├── ExportModpackModal.tsx  # MultiMC & Prism Launcher ZIP modpack generator
│   │   ├── GModConfigTab.tsx       # Gamemode config editor (Sandbox, DarkRP, TTT, Prop Hunt, Murder, Cinema)
│   │   ├── GModAddonsTab.tsx       # GMA & folder addon browser with toggle, delete, workshop sync
│   │   └── SettingsModal.tsx       # CurseForge API key, default dirs, Java paths
│   ├── services/
│   │   ├── minecraft-meta.ts       # Mojang manifest, Fabric meta, PaperMC API
│   │   └── mod-providers/
│   │       ├── modrinth.ts         # Modrinth REST API client & dependency resolver
│   │       └── curseforge.ts       # CurseForge Eternal API client
│   ├── types.ts                    # Global TypeScript interfaces
│   ├── App.tsx                     # Main layout & reactive state
│   ├── main.tsx                    # React DOM entry
│   └── index.css                   # Tailwind styles, dark theme & custom scrollbars
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
└── vite.config.ts
```

---

## 📜 License

Distributed under the [MIT License](LICENSE).
