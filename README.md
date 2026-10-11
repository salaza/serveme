# Game Server Builder 🎮⚙️

A modern, fast desktop application built with **Electron**, **React**, **TypeScript**, and **Tailwind CSS** to easily build, configure, and manage dedicated servers for multiplayer games — starting with **Minecraft** (Fabric, Forge, NeoForge, Paper, Purpur, Vanilla).

---

## 🌟 Key Features

### 1. Multi-Loader & Game Support
- **Minecraft Java Edition**:
  - **Fabric**: Lightweight & modular mod loader. Direct installerless launcher downloading.
  - **Paper / Purpur**: High-performance server jars with Bukkit / Spigot plugin compatibility.
  - **NeoForge / Forge**: Support for heavy modpacks and classic mod loaders.
  - **Vanilla**: Official Mojang server executables.
- **Extensible Architecture**: Structured modular services so upcoming games (e.g., SteamCMD games like Palworld, Valheim, Factorio, Terraria) can plug in with their own manifest adapters.

### 2. Dual Mod Provider Ecosystem
- **Modrinth (Fully open & keyless)**:
  - Live query search with category, game version, and mod loader filters.
  - 1-click installation directly into the server's `mods/` directory.
  - Automatic dependency resolution (detects required libraries like Fabric API and prompts/installs them).
- **CurseForge Integration**:
  - Live search across CurseForge's extensive mod index.
  - Configurable via free CurseForge API key in Global Settings.

### 3. Modlist Import & Export (JSON)
- **Export**: Generates a clean, portable `modlist.json` containing metadata, loader, game version, and mod records.
- **Import**: Select any exported `modlist.json` to batch-download and install every listed mod onto the server automatically.

### 4. Visual Configuration & Performance Suite
- **Visual `server.properties` Editor**:
  - Toggles and controls for difficulty, gamemodes, max-players, PvP, MOTD, port, whitelist, flight, view distances, and simulation distance.
- **Raw File Editor**:
  - Direct built-in code editor fallback for fine-tuning `server.properties`.
- **JVM & Memory Tuning**:
  - Min/Max RAM sliders (`-Xms`, `-Xmx`).
  - **Aikar's Flags preset** with 1-click application for optimized Garbage Collection and reduced tick lag.
  - Custom JVM argument support.
  - Auto-detection of local Java JDKs (e.g. Microsoft OpenJDK, Eclipse Adoptium, Oracle).

### 5. Interactive Live Terminal Console
- Real-time streaming standard output and error logs with ANSI/color formatting.
- Interactive command execution input (`op`, `gamemode`, `stop`, `say`, etc.).
- Shell command history navigation (Up / Down arrows).
- Auto-scroll lock toggle and log clearing.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ (tested on Node.js 25.x)
- **Java**: JDK 17 or JDK 21+ (for modern Minecraft 1.20+)

### Running the App

#### Development Mode (with Vite Hot Reloading)
```powershell
npm run dev
```

#### Production Mode
```powershell
npm run build
npm start
```

---

## 📁 Project Architecture

```
server_builder/
├── electron/
│   ├── main.ts              # Electron lifecycle, child process management, IPC handlers
│   └── preload.ts           # Secure ContextBridge exposing window.electronAPI
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx             # Server list, navigation, brand & create button
│   │   ├── CreateServerModal.tsx   # Server setup wizard (Game, Loader, Version, RAM)
│   │   ├── ServerDashboard.tsx     # Active server controls, header & tab switching
│   │   ├── ConsoleTab.tsx          # Real-time console terminal & command prompt
│   │   ├── ModsTab.tsx             # Installed mods table, enable/disable, JSON import/export
│   │   ├── ModBrowserModal.tsx     # Modrinth & CurseForge search and 1-click installer
│   │   ├── ConfigTab.tsx           # Visual server.properties, JVM flags, and raw editor
│   │   └── SettingsModal.tsx       # CurseForge API key, default dirs, Java paths
│   ├── services/
│   │   ├── minecraft-meta.ts       # Mojang manifest, Fabric meta, PaperMC API
│   │   └── mod-providers/
│   │       ├── modrinth.ts         # Modrinth REST API client & dependency resolver
│   │       └── curseforge.ts       # CurseForge Eternal API client
│   ├── types.ts                    # Global TypeScript interfaces
│   ├── App.tsx                     # Main layout & reactive state
│   ├── main.tsx                    # React DOM entry
│   └── index.css                   # Tailwind styles, theme & custom scrollbars
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
└── vite.config.ts
```

---

## 📄 Modlist JSON Specification Example
```json
{
  "schemaVersion": 1,
  "name": "My SMP Server",
  "game": "minecraft",
  "gameVersion": "1.20.1",
  "loader": "fabric",
  "exportedAt": "2026-10-11T17:45:00.000Z",
  "mods": [
    {
      "id": "P7dR8mBk",
      "name": "Fabric API",
      "fileName": "fabric-api-0.92.2+1.20.1.jar",
      "provider": "modrinth",
      "downloadUrl": "https://cdn.modrinth.com/..."
    }
  ]
}
```
