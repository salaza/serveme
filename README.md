# ServeMe

A desktop application for creating, configuring, and managing dedicated game servers for Minecraft and Garry's Mod.

---

## Features

### Minecraft
- **Server Setup**: Supports Fabric, Forge, NeoForge, Paper, Purpur, and Vanilla with automatic server jar downloads.
- **Mod Manager**: Search and install mods directly from Modrinth and CurseForge with automatic dependency resolution. Easily enable, disable, or delete installed mods.
- **Modpack Export**: Export the server's mod setup as a MultiMC / Prism Launcher compatible zip file with optional client-side mods.
- **World Management**: Create, switch, backup, restore, and regenerate worlds.
- **Configuration**: Visual and raw editors for `server.properties`, RAM allocation sliders, and JVM arguments.

### Garry's Mod
- **Automated Installation**: Downloads and sets up dedicated server files via SteamCMD.
- **Gamemode Configuration**: Dedicated settings for Sandbox, DarkRP, Trouble in Terrorist Town (TTT), Prop Hunt, Murder, and Cinema.
- **Server Settings**: Configure hostname, map, tickrate, max players, passwords, FastDL, physics, and entity limits.
- **Addon Management**: Manage local addons (`.gma` and extracted folders) and configure Steam Workshop collections.
- **RCON & Console**: Live log streaming with integrated Source RCON command execution.

### General
- Interactive live terminal console with command input and history.
- Automatic port availability checking before server startup.
- Duplicate server name validation.

---

## Development & Build

### Prerequisites
- Node.js (v18+)
- Java (JDK 17 or JDK 21+ for Minecraft)

### Commands

```powershell
# Install dependencies
npm install

# Run in development mode
npm run dev

# Compile production build
npm run build

# Package Windows executable (.exe)
npm run dist
```

---

## License

MIT
