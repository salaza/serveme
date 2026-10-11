import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, execSync, ChildProcess } from 'child_process';
import http from 'http';
import https from 'https';
import net from 'net';
import AdmZip from 'adm-zip';
import {
  ServerInstance,
  AppSettings,
  ModlistFile,
  PortCheckResult,
  JavaVersionInfo,
  JavaValidationResult,
  WorldInfo,
  WorldBackup,
  CreateWorldOptions,
  RegenerateWorldOptions,
  ExportModpackOptions,
  ExportModpackResult,
  LocalClientMod,
  CreateGModServerOptions,
  GModAddonInfo,
  GModServerConfig
} from '../src/types';

let mainWindow: BrowserWindow | null = null;
const runningProcesses = new Map<string, ChildProcess>();

interface GModSession {
  port: number;
  rconPassword: string;
  childPid: number;
  logInterval: NodeJS.Timeout;
}
const gmodSessions = new Map<string, GModSession>();

function sendSourceRcon(host: string, port: number, password: string, command: string, timeoutMs: number = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const authReqId = 1001;
    const cmdReqId = 2002;
    let responseText = '';
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      socket.removeAllListeners();
      socket.destroy();
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('RCON request timed out'));
    }, timeoutMs);

    function makePacket(id: number, type: number, body: string): Buffer {
      const bodyBuf = Buffer.from(body + '\0', 'utf-8');
      const padBuf = Buffer.from([0]);
      const size = 4 + 4 + bodyBuf.length + padBuf.length;
      const header = Buffer.alloc(12);
      header.writeInt32LE(size, 0);
      header.writeInt32LE(id, 4);
      header.writeInt32LE(type, 8);
      return Buffer.concat([header, bodyBuf, padBuf]);
    }

    socket.connect(port, host, () => {
      socket.write(makePacket(authReqId, 3, password));
    });

    socket.on('data', (data: Buffer) => {
      if (data.length < 12) return;
      const id = data.readInt32LE(4);
      const type = data.readInt32LE(8);

      if (type === 2) {
        if (id === -1) {
          cleanup();
          return reject(new Error('RCON authentication failed: invalid password'));
        }
        socket.write(makePacket(cmdReqId, 2, command));
        return;
      }

      if (type === 0 && id === cmdReqId) {
        if (data.length >= 14) {
          responseText += data.subarray(12, data.length - 2).toString('utf-8');
        }
        cleanup();
        return resolve(responseText);
      }
    });

    socket.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

// Global exception safety against transient network socket drops
process.on('uncaughtException', (err: any) => {
  if (err && (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ETIMEDOUT' || err.message?.includes('ECONNRESET'))) {
    console.warn('Caught transient network socket drop in main process:', err.message);
    return;
  }
  console.error('Uncaught Exception in main process:', err);
});

// Storage paths
const userDataPath = app.getPath('userData');
const serversConfigFile = path.join(userDataPath, 'servers.json');
const settingsConfigFile = path.join(userDataPath, 'settings.json');

function getDefaultSettings(): AppSettings {
  const defaultDir = path.join(app.getPath('documents'), 'GameServers');
  if (!fs.existsSync(defaultDir)) {
    try { fs.mkdirSync(defaultDir, { recursive: true }); } catch {}
  }
  return {
    defaultServersDir: defaultDir,
    defaultJavaPath: 'java',
    curseForgeApiKey: '',
    preferredModProvider: 'modrinth'
  };
}

function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(settingsConfigFile)) {
      const data = JSON.parse(fs.readFileSync(settingsConfigFile, 'utf-8'));
      return { ...getDefaultSettings(), ...data };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return getDefaultSettings();
}

function saveSettingsToDisk(settings: AppSettings) {
  try {
    fs.writeFileSync(settingsConfigFile, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function loadServers(): ServerInstance[] {
  try {
    if (fs.existsSync(serversConfigFile)) {
      return JSON.parse(fs.readFileSync(serversConfigFile, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load servers:', e);
  }
  return [];
}

function saveServersToDisk(servers: ServerInstance[]) {
  try {
    fs.writeFileSync(serversConfigFile, JSON.stringify(servers, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save servers:', e);
  }
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (percent: number, downloadedBytes: number, totalBytes: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith('https') ? https : http;

    const request = client.get(url, (response) => {
      // Handle redirects
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        downloadFile(response.headers.location, destPath, onProgress).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        reject(new Error(`Download failed with status: ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0 && onProgress) {
          const pct = Math.round((downloadedBytes / totalBytes) * 100);
          onProgress(pct, downloadedBytes, totalBytes);
        }
      });

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch {}
      reject(err);
    });
  });
}

async function ensureSteamCMD(onStatus?: (stage: string, percent?: number, details?: string) => void): Promise<string> {
  const steamcmdDir = path.join(userDataPath, 'steamcmd');
  const steamcmdExe = path.join(steamcmdDir, 'steamcmd.exe');

  if (!fs.existsSync(steamcmdExe)) {
    if (!fs.existsSync(steamcmdDir)) {
      fs.mkdirSync(steamcmdDir, { recursive: true });
    }

    onStatus?.('Downloading SteamCMD utility from Valve...', 0);
    const zipPath = path.join(steamcmdDir, 'steamcmd.zip');
    await downloadFile('https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip', zipPath, (pct, downloaded, total) => {
      onStatus?.(
        'Downloading SteamCMD utility from Valve...',
        pct,
        `${formatBytes(downloaded)} / ${formatBytes(total)}`
      );
    });

    onStatus?.('Extracting SteamCMD archive...', 100);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(steamcmdDir, true);

    try {
      fs.unlinkSync(zipPath);
    } catch {}

    if (!fs.existsSync(steamcmdExe)) {
      throw new Error('Failed to extract steamcmd.exe from Valve archive');
    }
  }

  // SteamCMD self-updates on first run and exits with code 7 or 0.
  // Ensure it has finished bootstrapping before running actual server downloads.
  const isFullyBootstrapped = fs.existsSync(path.join(steamcmdDir, 'steamclient.dll')) && fs.existsSync(path.join(steamcmdDir, 'steamapps'));
  if (!isFullyBootstrapped) {
    onStatus?.('Initializing and self-updating SteamCMD components...', 0);
    await new Promise<void>((resolve) => {
      const child = spawn(steamcmdExe, ['+quit'], {
        cwd: steamcmdDir,
        shell: false
      });

      let buffer = '';
      child.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        // SteamCMD outputs: Downloading update (25,617 of 43,472 KB)...
        const updateMatch = buffer.match(/Downloading update \(([0-9,]+)\s+of\s+([0-9,]+)\s*KB\)/i);
        if (updateMatch) {
          const currentKB = parseInt(updateMatch[1].replace(/,/g, ''), 10);
          const totalKB = parseInt(updateMatch[2].replace(/,/g, ''), 10);
          if (totalKB > 0) {
            const pct = Math.round((currentKB / totalKB) * 100);
            onStatus?.(
              'Updating SteamCMD runtime components...',
              pct,
              `${(currentKB / 1024).toFixed(1)} MB / ${(totalKB / 1024).toFixed(1)} MB`
            );
          }
        }
      });

      child.on('close', () => {
        resolve();
      });
      child.on('error', () => {
        resolve();
      });
    });
  }

  return steamcmdExe;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    frame: true,
    title: 'Game Server Builder',
    backgroundColor: '#090d16',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Gracefully stop all running servers
  for (const [id, child] of runningProcesses.entries()) {
    try {
      child.stdin?.write('stop\n');
      setTimeout(() => {
        if (!child.killed) child.kill();
      }, 3000);
    } catch {}
  }
  if (process.platform !== 'darwin') app.quit();
});

// IPC: Servers CRUD
ipcMain.handle('servers:get', async () => {
  const servers = loadServers();
  // Sync status with actual running map
  return servers.map(s => ({
    ...s,
    status: runningProcesses.has(s.id) ? 'running' : 'stopped'
  }));
});

ipcMain.handle('servers:save', async (_, server: ServerInstance) => {
  const servers = loadServers();
  const index = servers.findIndex(s => s.id === server.id);
  if (index >= 0) {
    servers[index] = server;
  } else {
    servers.push(server);
  }
  saveServersToDisk(servers);
});

ipcMain.handle('servers:delete', async (_, { serverId, deleteFiles }: { serverId: string; deleteFiles: boolean }) => {
  const servers = loadServers();
  const server = servers.find(s => s.id === serverId);
  if (server) {
    // If running, stop first
    if (runningProcesses.has(serverId)) {
      const proc = runningProcesses.get(serverId);
      proc?.stdin?.write('stop\n');
      setTimeout(() => proc?.kill(), 2000);
      runningProcesses.delete(serverId);
    }

    if (deleteFiles && fs.existsSync(server.path)) {
      try {
        fs.rmSync(server.path, { recursive: true, force: true });
      } catch (err) {
        console.error('Failed to delete server files:', err);
      }
    }
  }
  const updated = servers.filter(s => s.id !== serverId);
  saveServersToDisk(updated);
});

ipcMain.handle('dialog:selectDirectory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Server Setup (Install Minecraft / Loader)
ipcMain.handle('server:setup', async (_, { server, downloadUrl, jarName, acceptEula }: {
  server: ServerInstance;
  downloadUrl: string;
  jarName: string;
  acceptEula: boolean;
}) => {
  try {
    const allServers = loadServers();
    if (allServers.some(s => s.name.trim().toLowerCase() === server.name.trim().toLowerCase() && s.id !== server.id)) {
      return { success: false, error: `A server named "${server.name}" already exists. Please choose a different name.` };
    }

    if (!fs.existsSync(server.path)) {
      fs.mkdirSync(server.path, { recursive: true });
    }

    // Ensure mods directory exists
    const modsDir = path.join(server.path, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }

    // Accept EULA
    if (acceptEula) {
      fs.writeFileSync(path.join(server.path, 'eula.txt'), 'eula=true\n', 'utf-8');
    }

    // Create default server.properties if not exists
    const propsPath = path.join(server.path, 'server.properties');
    if (!fs.existsSync(propsPath)) {
      const defaultProps = [
        `# Minecraft server properties generated by Game Server Builder`,
        `server-port=${server.port}`,
        `motd=${server.name}`,
        `difficulty=easy`,
        `gamemode=survival`,
        `pvp=true`,
        `max-players=20`,
        `online-mode=true`,
        `view-distance=10`,
        `simulation-distance=10`,
        `spawn-protection=0`,
        `enable-command-block=true`
      ].join('\n');
      fs.writeFileSync(propsPath, defaultProps, 'utf-8');
    }

    // Download server jar
    const destJar = path.join(server.path, jarName);
    if (downloadUrl) {
      mainWindow?.webContents.send('server:setupProgress', {
        serverId: server.id,
        stage: `Downloading ${jarName}...`,
        percent: 0
      });
      await downloadFile(downloadUrl, destJar, (pct, downloaded, total) => {
        mainWindow?.webContents.send('server:setupProgress', {
          serverId: server.id,
          stage: `Downloading ${jarName}...`,
          percent: pct,
          details: `${formatBytes(downloaded)} / ${formatBytes(total)}`
        });
      });
    }

    // Create start.bat for Windows
    const javaBin = server.javaPath || 'java';
    const batContent = `@echo off\ntitle ${server.name}\n"${javaBin}" -Xms${server.ramMin}G -Xmx${server.ramMax}G -jar "${jarName}" nogui\npause\n`;
    fs.writeFileSync(path.join(server.path, 'start.bat'), batContent, 'utf-8');

    // Save server instance
    const servers = loadServers();
    const existingIdx = servers.findIndex(s => s.id === server.id);
    if (existingIdx >= 0) {
      servers[existingIdx] = server;
    } else {
      servers.push(server);
    }
    saveServersToDisk(servers);

    return { success: true };
  } catch (err: any) {
    console.error('Server setup error:', err);
    return { success: false, error: err.message };
  }
});

// Server Process Management
ipcMain.handle('server:start', async (_, serverId: string) => {
  if (runningProcesses.has(serverId)) {
    return { success: false, error: 'Server is already running' };
  }

  const servers = loadServers();
  const server = servers.find(s => s.id === serverId);
  if (!server) return { success: false, error: 'Server not found' };

  if (!fs.existsSync(server.path)) {
    return { success: false, error: 'Server directory does not exist' };
  }

  // Garry's Mod Dedicated Server handling
  if (server.game === 'gmod') {
    let exeName = 'srcds.exe';
    if (fs.existsSync(path.join(server.path, 'srcds_win64.exe'))) {
      exeName = 'srcds_win64.exe';
    } else if (fs.existsSync(path.join(server.path, 'srcds.exe'))) {
      exeName = 'srcds.exe';
    } else {
      return { success: false, error: 'srcds.exe not found in server directory. Please verify server installation.' };
    }

    const cfg = server.gmodConfig;
    const gmodPort = server.port || 27015;
    const rconPassword = cfg?.rconPassword?.trim() || `sb_${Math.random().toString(36).slice(2, 10)}`;

    const gmodArgs = [
      '-game', 'garrysmod',
      '-console',
      '-condebug',
      '-port', String(gmodPort),
      '+ip', '0.0.0.0',
      '+maxplayers', String(cfg?.maxPlayers || 16),
      '+map', cfg?.defaultMap || 'gm_construct',
      '+gamemode', cfg?.gamemode || 'sandbox',
      '-tickrate', String(cfg?.tickrate || 66),
      '+hostname', server.name,
      '+rcon_password', rconPassword
    ];

    if (cfg?.workshopCollectionId) {
      gmodArgs.push('+host_workshop_collection', cfg.workshopCollectionId.trim());
    }
    if (cfg?.steamApiKey) {
      gmodArgs.push('-authkey', cfg.steamApiKey.trim());
    }
    if (cfg?.serverPassword) {
      gmodArgs.push('+sv_password', cfg.serverPassword.trim());
    }

    try {
      const logFilePath = path.join(server.path, 'garrysmod', 'console.log');
      let logOffset = 0;
      try {
        if (fs.existsSync(logFilePath)) {
          fs.writeFileSync(logFilePath, '');
        }
      } catch {}

      // Launch srcds in a dedicated console window via cmd.exe start /wait
      // This provides a valid Win32 console buffer to satisfy CTextConsoleWin32::GetLine
      const child = spawn('cmd.exe', ['/c', 'start', '/wait', `Garry's Mod Server - ${server.name}`, exeName, ...gmodArgs], {
        cwd: server.path,
        windowsHide: false
      });

      const logInterval = setInterval(() => {
        try {
          if (!fs.existsSync(logFilePath)) return;
          const stat = fs.statSync(logFilePath);
          if (stat.size > logOffset) {
            const fd = fs.openSync(logFilePath, 'r');
            const bytesToRead = stat.size - logOffset;
            const buffer = Buffer.alloc(bytesToRead);
            fs.readSync(fd, buffer, 0, bytesToRead, logOffset);
            fs.closeSync(fd);
            logOffset = stat.size;

            const text = buffer.toString('utf-8');
            if (text) {
              mainWindow?.webContents.send('server:log', { serverId, log: text, type: 'stdout' });
            }
          }
        } catch {}
      }, 250);

      gmodSessions.set(serverId, {
        port: gmodPort,
        rconPassword,
        childPid: child.pid!,
        logInterval
      });

      runningProcesses.set(serverId, child);
      mainWindow?.webContents.send('server:status', { serverId, status: 'running' });
      mainWindow?.webContents.send('server:log', {
        serverId,
        log: `[System] Garry's Mod dedicated server launched (${exeName} on port ${gmodPort})\n`,
        type: 'system'
      });

      child.on('close', (code) => {
        clearInterval(logInterval);
        gmodSessions.delete(serverId);
        runningProcesses.delete(serverId);

        // Read any remaining lines
        try {
          if (fs.existsSync(logFilePath)) {
            const stat = fs.statSync(logFilePath);
            if (stat.size > logOffset) {
              const fd = fs.openSync(logFilePath, 'r');
              const bytesToRead = stat.size - logOffset;
              const buffer = Buffer.alloc(bytesToRead);
              fs.readSync(fd, buffer, 0, bytesToRead, logOffset);
              fs.closeSync(fd);
              const text = buffer.toString('utf-8');
              if (text) {
                mainWindow?.webContents.send('server:log', { serverId, log: text, type: 'stdout' });
              }
            }
          }
        } catch {}

        mainWindow?.webContents.send('server:status', { serverId, status: 'stopped' });
        mainWindow?.webContents.send('server:log', {
          serverId,
          log: `[System] Garry's Mod server stopped with exit code ${code}\n`,
          type: 'system'
        });
      });

      child.on('error', (err) => {
        clearInterval(logInterval);
        gmodSessions.delete(serverId);
        runningProcesses.delete(serverId);
        mainWindow?.webContents.send('server:status', { serverId, status: 'stopped' });
        mainWindow?.webContents.send('server:log', {
          serverId,
          log: `[System Error] Failed to launch Garry's Mod server: ${err.message}\n`,
          type: 'stderr'
        });
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Minecraft Server handling
  let jarName = 'server.jar';
  const files = fs.readdirSync(server.path);
  const potentialJars = files.filter(f => f.endsWith('.jar') && !f.includes('installer'));
  if (potentialJars.length > 0) {
    // Prefer fabric-server-launch.jar, paper-*.jar, server.jar
    const preferred = potentialJars.find(f => f.includes('server') || f.includes('fabric') || f.includes('paper')) || potentialJars[0];
    jarName = preferred;
  }

  const javaExec = server.javaPath || 'java';
  const args = [
    `-Xms${server.ramMin}G`,
    `-Xmx${server.ramMax}G`
  ];

  // Modern Java (22+) restricted methods warning suppression for JNA/Fabric
  try {
    const rawJavaVer = execSync(`"${javaExec}" -version 2>&1`, { encoding: 'utf-8' });
    const major = parseJavaMajor(rawJavaVer);
    if (major >= 22) {
      args.push('--enable-native-access=ALL-UNNAMED');
    }
  } catch {}

  if (server.jvmArgs && server.jvmArgs.trim()) {
    args.push(...server.jvmArgs.trim().split(/\s+/));
  }

  args.push('-jar', jarName, 'nogui');

  try {
    const child = spawn(javaExec, args, {
      cwd: server.path,
      shell: false
    });

    runningProcesses.set(serverId, child);
    mainWindow?.webContents.send('server:status', { serverId, status: 'running' });

    child.stdout.on('data', (data) => {
      const text = data.toString();
      mainWindow?.webContents.send('server:log', { serverId, log: text, type: 'stdout' });
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      mainWindow?.webContents.send('server:log', { serverId, log: text, type: 'stderr' });
    });

    child.on('close', (code) => {
      runningProcesses.delete(serverId);
      mainWindow?.webContents.send('server:status', { serverId, status: 'stopped' });
      mainWindow?.webContents.send('server:log', {
        serverId,
        log: `[System] Server stopped with exit code ${code}\n`,
        type: 'system'
      });
    });

    child.on('error', (err) => {
      runningProcesses.delete(serverId);
      mainWindow?.webContents.send('server:status', { serverId, status: 'stopped' });
      mainWindow?.webContents.send('server:log', {
        serverId,
        log: `[System Error] Failed to launch server: ${err.message}\n`,
        type: 'stderr'
      });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('server:stop', async (_, serverId: string) => {
  const child = runningProcesses.get(serverId);
  if (!child) return { success: true };

  const servers = loadServers();
  const server = servers.find(s => s.id === serverId);

  mainWindow?.webContents.send('server:status', { serverId, status: 'stopping' });
  
  const gmodSession = gmodSessions.get(serverId);
  if (gmodSession) {
    // Attempt graceful quit via RCON
    sendSourceRcon('127.0.0.1', gmodSession.port, gmodSession.rconPassword, 'quit').catch(() => {});

    // Safety fallback: terminate process tree if not closed after 3 seconds
    setTimeout(() => {
      if (runningProcesses.has(serverId)) {
        try {
          execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
        } catch {}
      }
    }, 3000);

    return { success: true };
  }

  // Minecraft graceful stop
  child.stdin?.write('stop\n');

  // Safety fallback after 12 seconds
  setTimeout(() => {
    if (runningProcesses.has(serverId)) {
      const c = runningProcesses.get(serverId);
      if (c && !c.killed) {
        c.kill('SIGKILL');
      }
      runningProcesses.delete(serverId);
      mainWindow?.webContents.send('server:status', { serverId, status: 'stopped' });
    }
  }, 12000);

  return { success: true };
});

ipcMain.handle('server:command', async (_, { serverId, command }: { serverId: string; command: string }) => {
  const gmodSession = gmodSessions.get(serverId);
  if (gmodSession) {
    mainWindow?.webContents.send('server:log', {
      serverId,
      log: `> ${command}\n`,
      type: 'system'
    });
    try {
      const response = await sendSourceRcon('127.0.0.1', gmodSession.port, gmodSession.rconPassword, command);
      if (response && response.trim()) {
        mainWindow?.webContents.send('server:log', {
          serverId,
          log: response.trim() + '\n',
          type: 'stdout'
        });
      }
    } catch (err: any) {
      mainWindow?.webContents.send('server:log', {
        serverId,
        log: `[RCON] ${err.message || 'Command executed'}\n`,
        type: 'system'
      });
    }
    return { success: true };
  }

  const child = runningProcesses.get(serverId);
  if (child && child.stdin) {
    child.stdin.write(command + '\n');
    mainWindow?.webContents.send('server:log', {
      serverId,
      log: `> ${command}\n`,
      type: 'system'
    });
  }
  return { success: true };
});

// Mod management
ipcMain.handle('mods:getInstalled', async (_, serverPath: string) => {
  const modsDir = path.join(serverPath, 'mods');
  if (!fs.existsSync(modsDir)) return [];

  const files = fs.readdirSync(modsDir);
  return files
    .filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
    .map(fileName => {
      const filePath = path.join(modsDir, fileName);
      const stat = fs.statSync(filePath);
      const enabled = fileName.endsWith('.jar');
      const baseName = fileName.replace(/\.jar(\.disabled)?$/, '');
      return {
        fileName,
        name: baseName,
        enabled,
        fileSize: stat.size
      };
    });
});

ipcMain.handle('mods:install', async (_, { serverPath, downloadUrl, fileName }: {
  serverPath: string;
  downloadUrl: string;
  fileName: string;
}) => {
  try {
    const modsDir = path.join(serverPath, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }

    const dest = path.join(modsDir, fileName);
    await downloadFile(downloadUrl, dest);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to install mod:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('mods:toggle', async (_, { serverPath, fileName, enable }: {
  serverPath: string;
  fileName: string;
  enable: boolean;
}) => {
  const modsDir = path.join(serverPath, 'mods');
  const oldPath = path.join(modsDir, fileName);
  if (!fs.existsSync(oldPath)) return false;

  let newFileName = fileName;
  if (enable && fileName.endsWith('.jar.disabled')) {
    newFileName = fileName.replace(/\.disabled$/, '');
  } else if (!enable && fileName.endsWith('.jar')) {
    newFileName = fileName + '.disabled';
  }

  const newPath = path.join(modsDir, newFileName);
  fs.renameSync(oldPath, newPath);
  return true;
});

ipcMain.handle('mods:delete', async (_, { serverPath, fileName }: { serverPath: string; fileName: string }) => {
  const target = path.join(serverPath, 'mods', fileName);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    return true;
  }
  return false;
});

// Modlist Import & Export
ipcMain.handle('modlist:export', async (_, { serverPath, defaultName }: { serverPath: string; defaultName: string }) => {
  if (!mainWindow) return null;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Modlist JSON',
    defaultPath: `${defaultName}-modlist.json`,
    filters: [{ name: 'JSON Modlist', extensions: ['json'] }]
  });

  if (canceled || !filePath) return null;

  const modsDir = path.join(serverPath, 'mods');
  const installedMods = fs.existsSync(modsDir)
    ? fs.readdirSync(modsDir).filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
    : [];

  const servers = loadServers();
  const currentServer = servers.find(s => s.path === serverPath);

  const modlistData: ModlistFile = {
    schemaVersion: 1,
    name: currentServer ? currentServer.name : defaultName,
    game: 'minecraft',
    gameVersion: currentServer?.version || '1.20.1',
    loader: currentServer?.loader || 'fabric',
    exportedAt: new Date().toISOString(),
    mods: installedMods.map((m, idx) => ({
      id: `mod-${idx}`,
      name: m.replace(/\.jar(\.disabled)?$/, ''),
      fileName: m.endsWith('.disabled') ? m.replace(/\.disabled$/, '') : m,
      provider: 'modrinth',
      downloadUrl: ''
    }))
  };

  fs.writeFileSync(filePath, JSON.stringify(modlistData, null, 2), 'utf-8');
  return filePath;
});

ipcMain.handle('modlist:import', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Modlist JSON',
    filters: [{ name: 'JSON Modlist', extensions: ['json'] }],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) return null;

  try {
    const raw = fs.readFileSync(filePaths[0], 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed as ModlistFile;
  } catch (err) {
    console.error('Failed to import modlist:', err);
    return null;
  }
});

// Modpack Export (Prism Launcher & MultiMC instance format)
ipcMain.handle('dialog:saveZipFile', async (_, { defaultName }: { defaultName?: string }) => {
  if (!mainWindow) return null;
  const defaultDir = app.getPath('documents');
  const defaultPath = path.join(defaultDir, defaultName || 'modpack.zip');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Modpack for Prism / MultiMC',
    defaultPath,
    filters: [{ name: 'ZIP Modpack Archive', extensions: ['zip'] }]
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
});

ipcMain.handle('dialog:selectJarFiles', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Client Mods (.jar)',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Minecraft Mod JARs', extensions: ['jar'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return [];

  return result.filePaths.map(filePath => {
    const fileName = path.basename(filePath);
    try {
      const stat = fs.statSync(filePath);
      return {
        path: filePath,
        fileName,
        name: fileName.replace(/\.jar$/i, ''),
        fileSize: stat.size
      };
    } catch {
      return {
        path: filePath,
        fileName,
        name: fileName.replace(/\.jar$/i, ''),
        fileSize: 0
      };
    }
  });
});

ipcMain.handle('modpack:export', async (_, options: ExportModpackOptions): Promise<ExportModpackResult> => {
  try {
    const servers = loadServers();
    const server = servers.find(s => s.id === options.serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    if (!fs.existsSync(server.path)) {
      return { success: false, error: 'Server directory does not exist' };
    }

    const zip = new AdmZip();

    // 1. instance.cfg (MultiMC / Prism Launcher instance configuration)
    const sanitizedNotes = (options.packNotes || `Exported from Game Server Builder`)
      .replace(/\r?\n/g, '\\n');
    const instanceCfg = [
      'InstanceType=OneSix',
      'iconKey=default',
      `name=${options.packName || server.name}`,
      `notes=${sanitizedNotes}`,
      `IntendedVersion=${server.version}`
    ].join('\n') + '\n';
    zip.addFile('instance.cfg', Buffer.from(instanceCfg, 'utf-8'));

    // 2. mmc-pack.json (Components manifest)
    const components: any[] = [
      {
        cachedName: 'Minecraft',
        important: true,
        uid: 'net.minecraft',
        version: server.version
      }
    ];

    if (server.loader && server.loader !== 'vanilla') {
      const loaderVersion = server.loaderVersion || '0.15.11';
      if (server.loader === 'fabric') {
        components.push({
          cachedName: 'Fabric Loader',
          important: true,
          uid: 'net.fabricmc.fabric-loader',
          version: loaderVersion
        });
      } else if (server.loader === 'forge') {
        components.push({
          cachedName: 'Forge',
          important: true,
          uid: 'net.minecraftforge',
          version: loaderVersion
        });
      } else if (server.loader === 'neoforge') {
        components.push({
          cachedName: 'NeoForge',
          important: true,
          uid: 'net.neoforged',
          version: loaderVersion
        });
      } else if (server.loader === 'quilt') {
        components.push({
          cachedName: 'Quilt Loader',
          important: true,
          uid: 'org.quiltmc.quilt-loader',
          version: loaderVersion
        });
      }
    }

    const mmcPack = {
      formatVersion: 1,
      components
    };
    zip.addFile('mmc-pack.json', Buffer.from(JSON.stringify(mmcPack, null, 2), 'utf-8'));

    let totalMods = 0;
    const addedFileNames = new Set<string>();

    // 3. Server Mods
    const serverModsDir = path.join(server.path, 'mods');
    if (fs.existsSync(serverModsDir)) {
      for (const modFile of options.selectedServerModFiles) {
        const fullModPath = path.join(serverModsDir, modFile);
        if (fs.existsSync(fullModPath)) {
          const targetName = modFile.replace(/\.disabled$/, '');
          zip.addLocalFile(fullModPath, '.minecraft/mods', targetName);
          addedFileNames.add(targetName.toLowerCase());
          totalMods++;
        }
      }
    }

    // 4. Client Mods downloaded from Modrinth / CurseForge
    if (options.clientModsToDownload && options.clientModsToDownload.length > 0) {
      const tempDir = path.join(app.getPath('temp'), `gsb-client-mods-${Date.now()}`);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      try {
        for (const clientMod of options.clientModsToDownload) {
          if (!clientMod.downloadUrl) continue;
          const fileName = clientMod.fileName || `${clientMod.name}.jar`;
          if (addedFileNames.has(fileName.toLowerCase())) continue;

          const tempDest = path.join(tempDir, fileName);
          await downloadFile(clientMod.downloadUrl, tempDest);

          if (fs.existsSync(tempDest)) {
            zip.addLocalFile(tempDest, '.minecraft/mods', fileName);
            addedFileNames.add(fileName.toLowerCase());
            totalMods++;
          }
        }
      } finally {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}
      }
    }

    // 5. Local Client Mods provided by user
    if (options.localClientModPaths && options.localClientModPaths.length > 0) {
      for (const localModPath of options.localClientModPaths) {
        if (fs.existsSync(localModPath)) {
          const fileName = path.basename(localModPath);
          if (!addedFileNames.has(fileName.toLowerCase())) {
            zip.addLocalFile(localModPath, '.minecraft/mods', fileName);
            addedFileNames.add(fileName.toLowerCase());
            totalMods++;
          }
        }
      }
    }

    // 6. Include Server configs if requested
    if (options.includeConfigs) {
      const configDir = path.join(server.path, 'config');
      if (fs.existsSync(configDir)) {
        zip.addLocalFolder(configDir, '.minecraft/config');
      }
    }

    // 7. Write ZIP
    const outDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    zip.writeZip(options.outputPath);

    return {
      success: true,
      outputPath: options.outputPath,
      modsCount: totalMods
    };
  } catch (err: any) {
    console.error('Failed to export modpack:', err);
    return {
      success: false,
      error: err.message || 'Unknown error exporting modpack'
    };
  }
});

// Config: server.properties
ipcMain.handle('config:readProperties', async (_, serverPath: string) => {
  const propsPath = path.join(serverPath, 'server.properties');
  if (!fs.existsSync(propsPath)) return {};

  const lines = fs.readFileSync(propsPath, 'utf-8').split(/\r?\n/);
  const result: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      result[key] = val;
    }
  }

  return result;
});

ipcMain.handle('config:saveProperties', async (_, { serverPath, properties }: { serverPath: string; properties: Record<string, string> }) => {
  const propsPath = path.join(serverPath, 'server.properties');
  const lines: string[] = ['# Minecraft server properties - Managed by Game Server Builder'];

  for (const [key, val] of Object.entries(properties)) {
    lines.push(`${key}=${val}`);
  }

  fs.writeFileSync(propsPath, lines.join('\n') + '\n', 'utf-8');
  return true;
});

ipcMain.handle('files:readRaw', async (_, filePath: string) => {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return '';
});

ipcMain.handle('files:writeRaw', async (_, { filePath, content }: { filePath: string; content: string }) => {
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('shell:openPath', async (_, dirPath: string) => {
  await shell.openPath(dirPath);
});

ipcMain.handle('shell:showItemInFolder', async (_, filePath: string) => {
  shell.showItemInFolder(filePath);
});

// Settings & System
ipcMain.handle('settings:get', async () => loadSettings());
ipcMain.handle('settings:save', async (_, settings: AppSettings) => {
  saveSettingsToDisk(settings);
});

// Java Version Discovery & Validation
function parseJavaMajor(raw: string): number {
  const m = raw.match(/version\s*["']?(\d+)(?:\.(\d+))?/i) || raw.match(/(\d+)(?:\.(\d+))?/);
  if (!m) return 0;
  const first = parseInt(m[1], 10);
  if (first === 1 && m[2]) {
    return parseInt(m[2], 10); // 1.8 -> 8
  }
  return first;
}

function detectAllJavas(): JavaVersionInfo[] {
  const javaList: JavaVersionInfo[] = [];
  const seenPaths = new Set<string>();

  // 1. Check PATH default java
  try {
    const output = execSync('java -version 2>&1', { encoding: 'utf-8' });
    const major = parseJavaMajor(output);
    javaList.push({
      path: 'java',
      version: `Java ${major || 21} (PATH Default)`,
      major: major || 21,
      isDefault: true
    });
    seenPaths.add('java');
  } catch {}

  // 2. Check JAVA_HOME if set
  if (process.env.JAVA_HOME) {
    const javaHomeExe = path.join(process.env.JAVA_HOME, 'bin', 'java.exe');
    if (fs.existsSync(javaHomeExe) && !seenPaths.has(javaHomeExe.toLowerCase())) {
      try {
        const output = execSync(`"${javaHomeExe}" -version 2>&1`, { encoding: 'utf-8' });
        const major = parseJavaMajor(output);
        javaList.push({
          path: javaHomeExe,
          version: `Java ${major} (JAVA_HOME)`,
          major,
          isDefault: false
        });
        seenPaths.add(javaHomeExe.toLowerCase());
      } catch {}
    }
  }

  // 3. Check known directories
  const searchDirs = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\BellSoft',
    'C:\\Program Files\\Amazon Corretto',
    'C:\\Program Files (x86)\\Java'
  ];

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      try {
        const subdirs = fs.readdirSync(dir);
        for (const sub of subdirs) {
          const javaExe = path.join(dir, sub, 'bin', 'java.exe');
          if (fs.existsSync(javaExe) && !seenPaths.has(javaExe.toLowerCase())) {
            try {
              const output = execSync(`"${javaExe}" -version 2>&1`, { encoding: 'utf-8' });
              const major = parseJavaMajor(output);
              javaList.push({
                path: javaExe,
                version: `Java ${major} (${sub})`,
                major,
                isDefault: false
              });
              seenPaths.add(javaExe.toLowerCase());
            } catch {}
          }
        }
      } catch {}
    }
  }

  // Sort descending by major version (25, 21, 17, 8)
  return javaList.sort((a, b) => b.major - a.major);
}

function getRequiredJavaVersionNumber(mcVersion: string): { major: number; reason: string; downloadUrl: string } {
  const clean = (mcVersion || '').trim().toLowerCase();
  if (clean.startsWith('26') || clean.startsWith('25') || clean.startsWith('1.25')) {
    return {
      major: 25,
      reason: 'Minecraft 26+ snapshots require Java 25 (class file version 69.0)',
      downloadUrl: 'https://learn.microsoft.com/en-us/java/openjdk/download'
    };
  }

  const parts = clean.split('.').map(p => parseInt(p, 10));
  if (parts.length >= 2 && parts[0] === 1) {
    const minor = parts[1];
    const patch = parts[2] || 0;
    if (minor > 20 || (minor === 20 && patch >= 5)) {
      return {
        major: 21,
        reason: 'Minecraft 1.20.5+ requires Java 21 (class file version 65.0)',
        downloadUrl: 'https://adoptium.net/temurin/releases/?version=21'
      };
    }
    if (minor >= 18) {
      return {
        major: 17,
        reason: 'Minecraft 1.18 – 1.20.4 requires Java 17 (class file version 61.0)',
        downloadUrl: 'https://adoptium.net/temurin/releases/?version=17'
      };
    }
    if (minor === 17) {
      return {
        major: 16,
        reason: 'Minecraft 1.17 requires Java 16+ (class file version 60.0)',
        downloadUrl: 'https://adoptium.net/temurin/releases/?version=17'
      };
    }
    return {
      major: 8,
      reason: 'Minecraft 1.16.5 and older requires Java 8 (class file version 52.0)',
      downloadUrl: 'https://adoptium.net/temurin/releases/?version=8'
    };
  }

  return {
    major: 21,
    reason: 'Standard modern Minecraft runtime',
    downloadUrl: 'https://adoptium.net/temurin/releases/?version=21'
  };
}

ipcMain.handle('system:detectJava', async (): Promise<JavaVersionInfo[]> => {
  return detectAllJavas();
});

ipcMain.handle('system:validateJava', async (_, { mcVersion, javaPath }: { mcVersion: string; javaPath: string }): Promise<JavaValidationResult> => {
  const allDetectedJavas = detectAllJavas();
  const req = getRequiredJavaVersionNumber(mcVersion);

  let currentMajor = 0;
  try {
    const javaBin = javaPath || 'java';
    const output = execSync(`"${javaBin}" -version 2>&1`, { encoding: 'utf-8' });
    currentMajor = parseJavaMajor(output);
  } catch (err) {
    console.warn(`Failed to inspect current javaPath "${javaPath}":`, err);
  }

  const isCompatible = req.major === 8
    ? currentMajor === 8 || currentMajor === 11
    : currentMajor >= req.major;

  if (isCompatible && currentMajor > 0) {
    return {
      valid: true,
      currentMajor,
      requiredMajor: req.major,
      currentJavaPath: javaPath,
      allDetectedJavas,
      reason: `Installed Java ${currentMajor} meets requirement of Java ${req.major}`
    };
  }

  // Incompatible! Find a compatible one among allDetectedJavas
  const candidate = allDetectedJavas.find(j => {
    if (req.major === 8) return j.major === 8;
    return j.major >= req.major;
  });

  return {
    valid: false,
    currentMajor,
    requiredMajor: req.major,
    currentJavaPath: javaPath,
    compatibleJavaPath: candidate ? candidate.path : undefined,
    compatibleVersionName: candidate ? candidate.version : undefined,
    allDetectedJavas,
    downloadUrl: req.downloadUrl,
    reason: req.reason
  };
});

ipcMain.handle('shell:openExternal', async (_, url: string) => {
  await shell.openExternal(url);
});

// Network & Router Gateway Detection
function getNetworkGatewayInfo(): { gatewayIp: string; localIp: string } {
  let gatewayIp = '192.168.1.1';
  let localIp = '127.0.0.1';

  try {
    const out = execSync('ipconfig', { encoding: 'utf-8' });
    const sections = out.split(/\r?\n\r?\n/);
    for (const section of sections) {
      const gwMatch = section.match(/(?:Standardgateway|Default Gateway)[\s\.:]+(\d+\.\d+\.\d+\.\d+)/i);
      const ipMatch = section.match(/(?:IPv4-Adresse|IPv4 Address)[\s\.:]+(\d+\.\d+\.\d+\.\d+)/i);
      if (gwMatch && ipMatch && gwMatch[1] !== '0.0.0.0') {
        gatewayIp = gwMatch[1];
        localIp = ipMatch[1];
        break;
      }
    }
  } catch (err) {
    console.warn('Failed to detect gateway from ipconfig:', err);
  }

  return { gatewayIp, localIp };
}

ipcMain.handle('network:checkPort', async (_, args: number | { port: number; serverId?: string }): Promise<PortCheckResult> => {
  const port = typeof args === 'number' ? args : args.port;
  const serverId = typeof args === 'object' ? args.serverId : undefined;
  const { gatewayIp, localIp } = getNetworkGatewayInfo();

  let publicIp = '';
  try {
    const ipCtrl = new AbortController();
    const ipTimeout = setTimeout(() => ipCtrl.abort(), 3000);
    const ipRes = await fetch('https://api.ipify.org?format=json', { signal: ipCtrl.signal });
    clearTimeout(ipTimeout);
    if (ipRes.ok) {
      const ipData = await ipRes.json();
      publicIp = ipData.ip;
    }
  } catch {}

  // If this server process is already running, check if it's reachable externally
  if (serverId && runningProcesses.has(serverId)) {
    let isExternalOnline = false;
    if (publicIp) {
      try {
        const mcCtrl = new AbortController();
        const mcTimeout = setTimeout(() => mcCtrl.abort(), 3500);
        const checkRes = await fetch(`https://api.mcsrvstat.us/3/${publicIp}:${port}`, {
          signal: mcCtrl.signal
        });
        clearTimeout(mcTimeout);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          isExternalOnline = Boolean(checkData.online);
        }
      } catch {}
    }

    return {
      port,
      isOpen: isExternalOnline,
      isLocalPortFree: true,
      gatewayIp,
      localIp,
      publicIp,
      message: isExternalOnline ? 'Server is reachable externally.' : `Port ${port} is not forwarded on router.`
    };
  }

  // Server is not running: start a temporary listener to see if incoming traffic hits THIS computer
  let incomingProbeHit = false;
  const activeSockets = new Set<net.Socket>();

  const tempServer = net.createServer((socket) => {
    incomingProbeHit = true;
    activeSockets.add(socket);

    // CRITICAL: Attach error handler to prevent unhandled ECONNRESET when scanner closes socket
    socket.on('error', () => {
      // Ignore client abort / ECONNRESET
    });

    socket.on('close', () => {
      activeSockets.delete(socket);
    });

    try {
      socket.end('MC_PORT_CHECK\n');
    } catch {}
  });

  tempServer.on('error', (err) => {
    console.warn('tempServer socket error:', err);
  });

  let tempBound = false;
  let isLocalPortFree = true;

  await new Promise<void>((resolve) => {
    tempServer.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        isLocalPortFree = false;
      }
      resolve();
    });
    tempServer.listen(port, '0.0.0.0', () => {
      tempBound = true;
      resolve();
    });
  });

  if (!isLocalPortFree) {
    return {
      port,
      isOpen: false,
      isLocalPortFree: false,
      gatewayIp,
      localIp,
      publicIp,
      message: `Port ${port} is already in use by another program on this computer.`
    };
  }

  let isOpen = false;

  try {
    if (tempBound && publicIp) {
      // Trigger external probe request to hit publicIp:port
      const probeCtrl = new AbortController();
      const probeTimeout = setTimeout(() => probeCtrl.abort(), 3500);
      try {
        await Promise.any([
          fetch(`https://api.mcsrvstat.us/3/${publicIp}:${port}`, { signal: probeCtrl.signal }),
          fetch(`https://api.mcstatus.io/v2/status/java/${publicIp}:${port}`, { signal: probeCtrl.signal })
        ]);
      } catch {}
      clearTimeout(probeTimeout);

      // Wait up to 1.8 seconds for incoming TCP packet to reach tempServer
      const startWait = Date.now();
      while (!incomingProbeHit && Date.now() - startWait < 1800) {
        await new Promise((r) => setTimeout(r, 100));
      }

      isOpen = incomingProbeHit;
    }
  } catch (err) {
    isOpen = false;
  } finally {
    if (tempBound) {
      for (const sock of activeSockets) {
        try {
          sock.destroy();
        } catch {}
      }
      activeSockets.clear();
      await new Promise<void>((resolve) => tempServer.close(() => resolve()));
    }
  }

  return {
    port,
    isOpen,
    isLocalPortFree: true,
    gatewayIp,
    localIp,
    publicIp,
    message: isOpen
      ? `Port ${port} is open and forwarded to this PC.`
      : `Port ${port} is not forwarded on router to ${localIp}.`
  };
});

ipcMain.handle('network:openRouter', async (_, gatewayIp: string) => {
  const url = gatewayIp.startsWith('http') ? gatewayIp : `http://${gatewayIp}`;
  await shell.openExternal(url);
});

// ==================== WORLDS & BACKUPS ====================

function getDirectorySize(dirPath: string): number {
  let size = 0;
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        try {
          size += fs.statSync(fullPath).size;
        } catch {}
      }
    }
  } catch {}
  return size;
}

function copyDirectorySync(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getActiveWorldName(serverPath: string): string {
  const propsPath = path.join(serverPath, 'server.properties');
  if (fs.existsSync(propsPath)) {
    try {
      const content = fs.readFileSync(propsPath, 'utf-8');
      const match = content.match(/^level-name\s*=\s*(.+)$/m);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    } catch {}
  }
  return 'world';
}

function listWorldsInServer(serverPath: string): { activeWorld: string; worlds: WorldInfo[] } {
  const activeWorld = getActiveWorldName(serverPath);
  const foundWorlds: WorldInfo[] = [];
  const seenNames = new Set<string>();

  if (!fs.existsSync(serverPath)) {
    return { activeWorld, worlds: [] };
  }

  const entries = fs.readdirSync(serverPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const lower = name.toLowerCase();

    // Skip known non-world directories
    if (['mods', 'config', 'logs', 'crash-reports', 'backups', 'libraries', 'versions', '.fabric', '.cache'].includes(lower)) {
      continue;
    }
    // Skip companion dimension folders directly (they belong to their parent world)
    if (name.endsWith('_nether') || name.endsWith('_the_end')) {
      continue;
    }

    const dirPath = path.join(serverPath, name);
    const hasLevelDat = fs.existsSync(path.join(dirPath, 'level.dat'));
    const hasRegion = fs.existsSync(path.join(dirPath, 'region'));
    const isNamedActive = name === activeWorld;

    if (hasLevelDat || hasRegion || isNamedActive) {
      seenNames.add(name);
      const isGenerated = hasLevelDat || hasRegion;
      let sizeBytes = isGenerated ? getDirectorySize(dirPath) : 0;
      let mtime = 0;
      try {
        mtime = fs.statSync(dirPath).mtimeMs;
      } catch {}

      // Add nether/end companion sizes if Paper/Spigot style
      const netherPath = path.join(serverPath, `${name}_nether`);
      const hasNether = isGenerated && (fs.existsSync(path.join(dirPath, 'DIM-1')) || fs.existsSync(netherPath));
      if (isGenerated && fs.existsSync(netherPath)) {
        sizeBytes += getDirectorySize(netherPath);
      }

      const endPath = path.join(serverPath, `${name}_the_end`);
      const hasEnd = isGenerated && (fs.existsSync(path.join(dirPath, 'DIM1')) || fs.existsSync(endPath));
      if (isGenerated && fs.existsSync(endPath)) {
        sizeBytes += getDirectorySize(endPath);
      }

      foundWorlds.push({
        name,
        isActive: name === activeWorld,
        isGenerated,
        sizeBytes,
        lastModified: mtime || Date.now(),
        hasNether,
        hasEnd
      });
    }
  }

  // If active world folder doesn't exist yet (fresh server), list it as ready to generate
  if (!seenNames.has(activeWorld)) {
    foundWorlds.unshift({
      name: activeWorld,
      isActive: true,
      isGenerated: false,
      sizeBytes: 0,
      lastModified: 0,
      hasNether: false,
      hasEnd: false
    });
  }

  return {
    activeWorld,
    worlds: foundWorlds.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0))
  };
}

function getBackupsInServer(serverPath: string): WorldBackup[] {
  const backupsDir = path.join(serverPath, 'backups');
  if (!fs.existsSync(backupsDir)) {
    return [];
  }

  const entries = fs.readdirSync(backupsDir, { withFileTypes: true });
  const backups: WorldBackup[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.zip')) continue;
    const fullPath = path.join(backupsDir, entry.name);
    try {
      const stat = fs.statSync(fullPath);
      const match = entry.name.match(/^([^_]+(?:_[^_]+)*?)_backup_/);
      const worldName = match ? match[1] : 'world';

      backups.push({
        id: entry.name,
        fileName: entry.name,
        filePath: fullPath,
        worldName,
        sizeBytes: stat.size,
        createdAt: stat.mtimeMs
      });
    } catch {}
  }

  return backups.sort((a, b) => b.createdAt - a.createdAt);
}

ipcMain.handle('worlds:list', async (_, serverPath: string) => {
  return listWorldsInServer(serverPath);
});

ipcMain.handle('worlds:setActive', async (_, { serverPath, worldName }: { serverPath: string; worldName: string }) => {
  const propsPath = path.join(serverPath, 'server.properties');
  if (fs.existsSync(propsPath)) {
    let content = fs.readFileSync(propsPath, 'utf-8');
    if (content.match(/^level-name\s*=/m)) {
      content = content.replace(/^level-name\s*=.*$/m, `level-name=${worldName}`);
    } else {
      content += `\nlevel-name=${worldName}\n`;
    }
    fs.writeFileSync(propsPath, content, 'utf-8');
    return true;
  }
  return false;
});

ipcMain.handle('worlds:create', async (_, { serverPath, options }: { serverPath: string; options: CreateWorldOptions }) => {
  try {
    const cleanName = options.name.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    if (!cleanName) return { success: false, error: 'Invalid world name' };

    const worldDir = path.join(serverPath, cleanName);
    if (!fs.existsSync(worldDir)) {
      fs.mkdirSync(worldDir, { recursive: true });
    }

    if (options.switchActive) {
      const propsPath = path.join(serverPath, 'server.properties');
      if (fs.existsSync(propsPath)) {
        let content = fs.readFileSync(propsPath, 'utf-8');
        const updateLine = (key: string, val: string) => {
          const regex = new RegExp(`^${key}\\s*=.*$`, 'm');
          if (content.match(regex)) {
            content = content.replace(regex, `${key}=${val}`);
          } else {
            content += `\n${key}=${val}\n`;
          }
        };

        updateLine('level-name', cleanName);
        if (options.seed !== undefined) updateLine('level-seed', options.seed);
        if (options.generatorType) updateLine('level-type', options.generatorType);
        if (options.difficulty) updateLine('difficulty', options.difficulty);
        if (options.hardcore !== undefined) updateLine('hardcore', options.hardcore ? 'true' : 'false');

        fs.writeFileSync(propsPath, content, 'utf-8');
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('worlds:duplicate', async (_, { serverPath, sourceWorldName, targetWorldName }: { serverPath: string; sourceWorldName: string; targetWorldName: string }) => {
  try {
    const cleanTarget = targetWorldName.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    if (!cleanTarget) return { success: false, error: 'Invalid destination world name' };

    const srcDir = path.join(serverPath, sourceWorldName);
    const dstDir = path.join(serverPath, cleanTarget);
    if (!fs.existsSync(srcDir)) return { success: false, error: 'Source world directory does not exist' };
    if (fs.existsSync(dstDir)) return { success: false, error: 'A world with that name already exists' };

    copyDirectorySync(srcDir, dstDir);

    const srcNether = path.join(serverPath, `${sourceWorldName}_nether`);
    if (fs.existsSync(srcNether)) {
      copyDirectorySync(srcNether, path.join(serverPath, `${cleanTarget}_nether`));
    }
    const srcEnd = path.join(serverPath, `${sourceWorldName}_the_end`);
    if (fs.existsSync(srcEnd)) {
      copyDirectorySync(srcEnd, path.join(serverPath, `${cleanTarget}_the_end`));
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('worlds:delete', async (_, { serverPath, worldName }: { serverPath: string; worldName: string }) => {
  try {
    const active = getActiveWorldName(serverPath);
    if (worldName === active) {
      return { success: false, error: 'Cannot delete the currently active world! Switch to another world first.' };
    }

    const worldDir = path.join(serverPath, worldName);
    if (fs.existsSync(worldDir)) {
      fs.rmSync(worldDir, { recursive: true, force: true });
    }
    const netherDir = path.join(serverPath, `${worldName}_nether`);
    if (fs.existsSync(netherDir)) {
      fs.rmSync(netherDir, { recursive: true, force: true });
    }
    const endDir = path.join(serverPath, `${worldName}_the_end`);
    if (fs.existsSync(endDir)) {
      fs.rmSync(endDir, { recursive: true, force: true });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('worlds:regenerate', async (_, { serverPath, worldName, options }: { serverPath: string; worldName: string; options: RegenerateWorldOptions }) => {
  try {
    const servers = loadServers();
    const serverInstance = servers.find((s) => s.path === serverPath);
    if (serverInstance && runningProcesses.has(serverInstance.id)) {
      return { success: false, error: 'Server is currently running! Please stop the server before regenerating the world.' };
    }

    // 1. Safety backup if requested
    if (options.createBackupFirst) {
      const backupsDir = path.join(serverPath, 'backups');
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${worldName}_pre-regen_${timestamp}.zip`;
      const targetZipPath = path.join(backupsDir, fileName);

      const zip = new AdmZip();
      const worldDir = path.join(serverPath, worldName);
      if (fs.existsSync(worldDir)) {
        zip.addLocalFolder(worldDir, worldName);
      }
      const netherDir = path.join(serverPath, `${worldName}_nether`);
      if (fs.existsSync(netherDir)) {
        zip.addLocalFolder(netherDir, `${worldName}_nether`);
      }
      const endDir = path.join(serverPath, `${worldName}_the_end`);
      if (fs.existsSync(endDir)) {
        zip.addLocalFolder(endDir, `${worldName}_the_end`);
      }
      zip.addFile(
        'backup-metadata.json',
        Buffer.from(JSON.stringify({ reason: 'Auto-backup before world regeneration', worldName, createdAt: new Date().toISOString() }), 'utf-8')
      );
      await zip.writeZipPromise(targetZipPath);
    }

    // 2. Wipe existing world data
    const worldDir = path.join(serverPath, worldName);
    if (fs.existsSync(worldDir)) {
      fs.rmSync(worldDir, { recursive: true, force: true });
    }
    const netherDir = path.join(serverPath, `${worldName}_nether`);
    if (fs.existsSync(netherDir)) {
      fs.rmSync(netherDir, { recursive: true, force: true });
    }
    const endDir = path.join(serverPath, `${worldName}_the_end`);
    if (fs.existsSync(endDir)) {
      fs.rmSync(endDir, { recursive: true, force: true });
    }

    // 3. Update level-seed in server.properties if specified
    if (options.newSeed !== undefined) {
      const propsPath = path.join(serverPath, 'server.properties');
      if (fs.existsSync(propsPath)) {
        let content = fs.readFileSync(propsPath, 'utf-8');
        if (content.match(/^level-seed\s*=/m)) {
          content = content.replace(/^level-seed\s*=.*$/m, `level-seed=${options.newSeed}`);
        } else {
          content += `\nlevel-seed=${options.newSeed}\n`;
        }
        fs.writeFileSync(propsPath, content, 'utf-8');
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to regenerate world:', err);
    return { success: false, error: err.message || 'Failed to regenerate world' };
  }
});

ipcMain.handle('worlds:getBackups', async (_, serverPath: string) => {
  return getBackupsInServer(serverPath);
});

ipcMain.handle('worlds:createBackup', async (_, { serverPath, worldName, note }: { serverPath: string; worldName: string; note?: string }) => {
  try {
    const backupsDir = path.join(serverPath, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${worldName}_backup_${timestamp}.zip`;
    const targetZipPath = path.join(backupsDir, fileName);

    const zip = new AdmZip();
    const worldDir = path.join(serverPath, worldName);
    if (fs.existsSync(worldDir)) {
      zip.addLocalFolder(worldDir, worldName);
    }

    const netherDir = path.join(serverPath, `${worldName}_nether`);
    if (fs.existsSync(netherDir)) {
      zip.addLocalFolder(netherDir, `${worldName}_nether`);
    }

    const endDir = path.join(serverPath, `${worldName}_the_end`);
    if (fs.existsSync(endDir)) {
      zip.addLocalFolder(endDir, `${worldName}_the_end`);
    }

    const meta = {
      worldName,
      createdAt: new Date().toISOString(),
      note: note || ''
    };
    zip.addFile('backup-metadata.json', Buffer.from(JSON.stringify(meta, null, 2), 'utf-8'));

    await zip.writeZipPromise(targetZipPath);

    const stat = fs.statSync(targetZipPath);
    const backup: WorldBackup = {
      id: fileName,
      fileName,
      filePath: targetZipPath,
      worldName,
      sizeBytes: stat.size,
      createdAt: stat.mtimeMs,
      note
    };

    return { success: true, backup };
  } catch (err: any) {
    console.error('Failed to create world backup:', err);
    return { success: false, error: err.message || 'Failed to create backup' };
  }
});

ipcMain.handle('worlds:restoreBackup', async (_, { serverPath, backupFileName, targetWorldName }: { serverPath: string; backupFileName: string; targetWorldName?: string }) => {
  try {
    const servers = loadServers();
    const serverInstance = servers.find((s) => s.path === serverPath);
    if (serverInstance && runningProcesses.has(serverInstance.id)) {
      return { success: false, error: 'Server is currently running! Please stop the server before restoring a backup to prevent world corruption.' };
    }

    const zipPath = path.join(serverPath, 'backups', backupFileName);
    if (!fs.existsSync(zipPath)) {
      return { success: false, error: 'Backup archive not found.' };
    }

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(serverPath, true);

    if (targetWorldName) {
      const propsPath = path.join(serverPath, 'server.properties');
      if (fs.existsSync(propsPath)) {
        let content = fs.readFileSync(propsPath, 'utf-8');
        if (content.match(/^level-name\s*=/m)) {
          content = content.replace(/^level-name\s*=.*$/m, `level-name=${targetWorldName}`);
        } else {
          content += `\nlevel-name=${targetWorldName}\n`;
        }
        fs.writeFileSync(propsPath, content, 'utf-8');
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to restore backup:', err);
    return { success: false, error: err.message || 'Failed to restore backup' };
  }
});

ipcMain.handle('worlds:deleteBackup', async (_, { serverPath, backupFileName }: { serverPath: string; backupFileName: string }) => {
  const target = path.join(serverPath, 'backups', backupFileName);
  if (fs.existsSync(target)) {
    try {
      fs.unlinkSync(target);
      return true;
    } catch {}
  }
  return false;
});

// ==========================================
// GARRY'S MOD DEDICATED SERVER IPC HANDLERS
// ==========================================

ipcMain.handle('gmod:setup', async (_, options: CreateGModServerOptions) => {
  const { server, gamemode, defaultMap, maxPlayers, tickrate, workshopCollectionId, steamApiKey } = options;
  const serverId = server.id;

  try {
    const allServers = loadServers();
    if (allServers.some(s => s.name.trim().toLowerCase() === server.name.trim().toLowerCase() && s.id !== server.id)) {
      return { success: false, error: `A server named "${server.name}" already exists. Please choose a different name.` };
    }

    if (!fs.existsSync(server.path)) {
      fs.mkdirSync(server.path, { recursive: true });
    }

    const sendProgress = (stage: string, percent?: number, details?: string) => {
      mainWindow?.webContents.send('server:setupProgress', {
        serverId,
        stage,
        percent,
        details
      });
    };

    sendProgress('Checking SteamCMD installation...', 0);
    const steamcmdExe = await ensureSteamCMD((stage, pct, details) => sendProgress(stage, pct, details));

    const runSteamCmdInstall = (attempt: number = 1): Promise<void> => {
      sendProgress(
        attempt > 1
          ? `Continuing Garry's Mod Dedicated Server download (Attempt ${attempt}/3)...`
          : "Starting SteamCMD download for Garry's Mod Dedicated Server (App ID 4020)...",
        undefined
      );

      // SteamCMD command: +force_install_dir "<path>" +login anonymous +app_update 4020 validate +quit
      const args = [
        '+force_install_dir', server.path,
        '+login', 'anonymous',
        '+app_update', '4020', 'validate',
        '+quit'
      ];

      return new Promise<void>((resolve, reject) => {
        const child = spawn(steamcmdExe, args, {
          cwd: path.dirname(steamcmdExe),
          shell: false
        });

        // Real-time progress monitor: SteamCMD flushes progress updates to console_log.txt
        const consoleLogPath = path.join(path.dirname(steamcmdExe), 'logs', 'console_log.txt');
        let lastLogOffset = 0;
        if (fs.existsSync(consoleLogPath)) {
          try {
            lastLogOffset = fs.statSync(consoleLogPath).size;
          } catch {}
        }

        const pollInterval = setInterval(() => {
          if (!fs.existsSync(consoleLogPath)) return;
          try {
            const stat = fs.statSync(consoleLogPath);
            if (stat.size > lastLogOffset) {
              const readLen = stat.size - lastLogOffset;
              const buf = Buffer.alloc(readLen);
              const fd = fs.openSync(consoleLogPath, 'r');
              fs.readSync(fd, buf, 0, readLen, lastLogOffset);
              fs.closeSync(fd);
              lastLogOffset = stat.size;

              const text = buf.toString('utf-8');
              const matches = [...text.matchAll(/progress:\s*([0-9.]+)(?:\s*\(\s*([0-9]+)\s*\/\s*([0-9]+)\s*\))?/gi)];
              if (matches.length > 0) {
                const lastMatch = matches[matches.length - 1];
                const rawPct = parseFloat(lastMatch[1]);
                const isVerifying = text.includes('verifying') || text.includes('validating');
                const isPreallocating = text.includes('preallocating');

                let byteDetails = '';
                if (lastMatch[2] && lastMatch[3]) {
                  const cur = parseInt(lastMatch[2], 10);
                  const tot = parseInt(lastMatch[3], 10);
                  byteDetails = `${formatBytes(cur)} / ${formatBytes(tot)}`;
                }

                const stageName = isVerifying
                  ? "Verifying Garry's Mod server files..."
                  : isPreallocating
                  ? 'Preallocating disk space for server files...'
                  : "Downloading Garry's Mod Dedicated Server...";

                sendProgress(stageName, rawPct, byteDetails);
              }
            }
          } catch {}
        }, 250);

        child.stdout.on('data', (chunk) => {
          const text = chunk.toString();
          // Backup check from stdout
          const matches = [...text.matchAll(/progress:\s*([0-9.]+)(?:\s*\(\s*([0-9]+)\s*\/\s*([0-9]+)\s*\))?/gi)];
          if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            const rawPct = parseFloat(lastMatch[1]);
            const isVerifying = text.includes('verifying') || text.includes('validating');
            const isPreallocating = text.includes('preallocating');

            let byteDetails = '';
            if (lastMatch[2] && lastMatch[3]) {
              const cur = parseInt(lastMatch[2], 10);
              const tot = parseInt(lastMatch[3], 10);
              byteDetails = `${formatBytes(cur)} / ${formatBytes(tot)}`;
            }

            const stageName = isVerifying
              ? "Verifying Garry's Mod server files..."
              : isPreallocating
              ? 'Preallocating disk space for server files...'
              : "Downloading Garry's Mod Dedicated Server...";

            sendProgress(stageName, rawPct, byteDetails);
          } else if (text.includes('Loading Steam API') || text.includes('Logging in user') || text.includes('Waiting for user info') || text.includes('Connecting anonymously')) {
            sendProgress('Connecting anonymously to Steam...', undefined, text.trim());
          }
        });

        child.stderr.on('data', (chunk) => {
          console.warn('SteamCMD stderr:', chunk.toString());
        });

        child.on('close', async (code) => {
          clearInterval(pollInterval);
          const srcdsPath = path.join(server.path, 'srcds.exe');
          if (fs.existsSync(srcdsPath)) {
            resolve();
            return;
          }

          // SteamCMD exits with code 7 when updating itself and requesting a restart,
          // or may need an additional pass to finish app installation.
          if (attempt < 3) {
            console.log(`SteamCMD closed with code ${code}, retrying attempt ${attempt + 1}...`);
            sendProgress(`SteamCMD update completed, continuing installation (Attempt ${attempt + 1})...`, 16);
            try {
              await runSteamCmdInstall(attempt + 1);
              resolve();
            } catch (retryErr) {
              reject(retryErr);
            }
          } else {
            reject(new Error(`SteamCMD exited with code ${code} and srcds.exe was not found. Please verify your internet connection.`));
          }
        });

        child.on('error', (err) => {
          reject(err);
        });
      });
    };

    await runSteamCmdInstall(1);

    sendProgress("Setting up Garry's Mod directories & default configuration...", 96);

    const cfgDir = path.join(server.path, 'garrysmod', 'cfg');
    if (!fs.existsSync(cfgDir)) {
      fs.mkdirSync(cfgDir, { recursive: true });
    }
    const addonsDir = path.join(server.path, 'garrysmod', 'addons');
    if (!fs.existsSync(addonsDir)) {
      fs.mkdirSync(addonsDir, { recursive: true });
    }

    const serverCfgPath = path.join(cfgDir, 'server.cfg');
    if (!fs.existsSync(serverCfgPath)) {
      const defaultCfg = [
        `// Garry's Mod Server Configuration generated by Game Server Builder`,
        `hostname "${server.name}"`,
        `sv_password ""`,
        `rcon_password ""`,
        ``,
        `// Network & Download settings`,
        `sv_loadingurl ""`,
        `sv_allowdownload 1`,
        `sv_allowupload 1`,
        `net_maxfilesize 64`,
        ``,
        `// Sandbox & Gameplay Settings`,
        `sbox_allownpcs 1`,
        `sbox_godmode 0`,
        `sbox_plpldamage 0`,
        `sbox_noclip 1`,
        ``,
        `// Voice & Chat`,
        `sv_voiceenable 1`,
        `sv_alltalk 1`
      ].join('\n');
      fs.writeFileSync(serverCfgPath, defaultCfg, 'utf-8');
    }

    // Create start.bat for Windows
    const batContent = `@echo off\r\ntitle Garry's Mod Dedicated Server - ${server.name}\r\nsrcds.exe -game garrysmod -console -port ${server.port || 27015} +maxplayers ${maxPlayers || 16} +map ${defaultMap || 'gm_construct'} +gamemode ${gamemode || 'sandbox'} -tickrate ${tickrate || 66} +hostname "${server.name}"\r\npause\r\n`;
    fs.writeFileSync(path.join(server.path, 'start.bat'), batContent, 'utf-8');

    // Save server instance
    const gmodServer: ServerInstance = {
      ...server,
      game: 'gmod',
      gmodConfig: {
        gamemode: gamemode || 'sandbox',
        defaultMap: defaultMap || 'gm_construct',
        maxPlayers: maxPlayers || 16,
        tickrate: tickrate || 66,
        workshopCollectionId: workshopCollectionId?.trim() || undefined,
        steamApiKey: steamApiKey?.trim() || undefined
      }
    };

    const servers = loadServers();
    const existingIdx = servers.findIndex(s => s.id === gmodServer.id);
    if (existingIdx >= 0) {
      servers[existingIdx] = gmodServer;
    } else {
      servers.push(gmodServer);
    }
    saveServersToDisk(servers);

    sendProgress('Server installation complete!', 100);
    return { success: true };
  } catch (err: any) {
    console.error('GMod setup failed:', err);
    return { success: false, error: err.message || "Failed to setup Garry's Mod server" };
  }
});

ipcMain.handle('gmod:getAddons', async (_, serverPath: string): Promise<GModAddonInfo[]> => {
  const addonsDir = path.join(serverPath, 'garrysmod', 'addons');
  if (!fs.existsSync(addonsDir)) return [];

  const results: GModAddonInfo[] = [];
  try {
    const entries = fs.readdirSync(addonsDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(addonsDir, entry.name);
      const isFolder = entry.isDirectory();
      const isGma = entry.name.toLowerCase().endsWith('.gma') || entry.name.toLowerCase().endsWith('.gma.disabled');
      const isDisabled = entry.name.endsWith('.disabled');

      if (!isFolder && !isGma) continue;

      let sizeBytes = 0;
      try {
        if (!isFolder) {
          sizeBytes = fs.statSync(fullPath).size;
        } else {
          const getDirSize = (dir: string): number => {
            let total = 0;
            try {
              const files = fs.readdirSync(dir, { withFileTypes: true });
              for (const f of files) {
                const p = path.join(dir, f.name);
                if (f.isDirectory()) total += getDirSize(p);
                else total += fs.statSync(p).size;
              }
            } catch {}
            return total;
          };
          sizeBytes = getDirSize(fullPath);
        }
      } catch {}

      let cleanName = entry.name;
      if (cleanName.endsWith('.disabled')) {
        cleanName = cleanName.slice(0, -9);
      }
      if (cleanName.toLowerCase().endsWith('.gma')) {
        cleanName = cleanName.slice(0, -4);
      }
      cleanName = cleanName.replace(/[-_]/g, ' ');

      results.push({
        name: cleanName,
        fileName: entry.name,
        filePath: fullPath,
        isFolder,
        enabled: !isDisabled,
        sizeBytes
      });
    }
  } catch (err) {
    console.error('Failed to read GMod addons:', err);
  }
  return results;
});

ipcMain.handle('gmod:toggleAddon', async (_, { serverPath, fileName, enable }: { serverPath: string; fileName: string; enable: boolean }) => {
  const addonsDir = path.join(serverPath, 'garrysmod', 'addons');
  const source = path.join(addonsDir, fileName);
  if (!fs.existsSync(source)) return false;

  let targetName = fileName;
  if (enable && fileName.endsWith('.disabled')) {
    targetName = fileName.slice(0, -9);
  } else if (!enable && !fileName.endsWith('.disabled')) {
    targetName = fileName + '.disabled';
  }

  const target = path.join(addonsDir, targetName);
  try {
    fs.renameSync(source, target);
    return true;
  } catch (err) {
    console.error('Failed to toggle GMod addon:', err);
    return false;
  }
});

ipcMain.handle('gmod:deleteAddon', async (_, { serverPath, fileName }: { serverPath: string; fileName: string }) => {
  const target = path.join(serverPath, 'garrysmod', 'addons', fileName);
  if (!fs.existsSync(target)) return false;
  try {
    fs.rmSync(target, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.error('Failed to delete GMod addon:', err);
    return false;
  }
});

ipcMain.handle('gmod:readServerCfg', async (_, serverPath: string) => {
  const cfgPath = path.join(serverPath, 'garrysmod', 'cfg', 'server.cfg');
  if (fs.existsSync(cfgPath)) {
    return fs.readFileSync(cfgPath, 'utf-8');
  }
  return '';
});

ipcMain.handle('gmod:saveServerCfg', async (_, { serverPath, content }: { serverPath: string; content: string }) => {
  const cfgDir = path.join(serverPath, 'garrysmod', 'cfg');
  if (!fs.existsSync(cfgDir)) {
    fs.mkdirSync(cfgDir, { recursive: true });
  }
  const cfgPath = path.join(cfgDir, 'server.cfg');
  try {
    fs.writeFileSync(cfgPath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write server.cfg:', err);
    return false;
  }
});



