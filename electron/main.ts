import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, execSync, ChildProcess } from 'child_process';
import http from 'http';
import https from 'https';
import net from 'net';
import { ServerInstance, AppSettings, ModlistFile, PortCheckResult, JavaVersionInfo, JavaValidationResult } from '../src/types';

let mainWindow: BrowserWindow | null = null;
const runningProcesses = new Map<string, ChildProcess>();

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

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith('https') ? https : http;

    const request = client.get(url, (response) => {
      // Handle redirects
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        reject(new Error(`Download failed with status: ${response.statusCode}`));
        return;
      }

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
      await downloadFile(downloadUrl, destJar);
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

  // Find server jar file
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

  mainWindow?.webContents.send('server:status', { serverId, status: 'stopping' });
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
  const child = runningProcesses.get(serverId);
  if (child && child.stdin) {
    child.stdin.write(command + '\n');
    mainWindow?.webContents.send('server:log', {
      serverId,
      log: `> ${command}\n`,
      type: 'system'
    });
  }
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

ipcMain.handle('network:checkPort', async (_, port: number): Promise<PortCheckResult> => {
  const { gatewayIp, localIp } = getNetworkGatewayInfo();

  // 1. Check if the port is already bound locally
  const isLocalPortFree = await new Promise<boolean>((resolve) => {
    const tester = net.createServer();
    tester.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, '0.0.0.0');
  });

  if (!isLocalPortFree) {
    return {
      port,
      isOpen: false,
      isLocalPortFree: false,
      gatewayIp,
      localIp,
      message: `Port ${port} is already in use by another program on this computer.`
    };
  }

  // 2. Start a temporary lightweight listener to test external port accessibility
  const tempServer = net.createServer((socket) => {
    socket.end('PING');
  });

  let tempBound = false;
  try {
    await new Promise<void>((resolve, reject) => {
      tempServer.listen(port, '0.0.0.0', () => {
        tempBound = true;
        resolve();
      });
      tempServer.on('error', reject);
    });
  } catch {
    return {
      port,
      isOpen: false,
      isLocalPortFree: false,
      gatewayIp,
      localIp,
      message: `Could not bind port ${port} locally for testing.`
    };
  }

  let isOpen = false;
  let publicIp = '';

  try {
    // Fetch public IP with 3.5s timeout
    const ipCtrl = new AbortController();
    const ipTimeout = setTimeout(() => ipCtrl.abort(), 3500);
    const ipRes = await fetch('https://api.ipify.org?format=json', { signal: ipCtrl.signal });
    clearTimeout(ipTimeout);

    if (ipRes.ok) {
      const ipData = await ipRes.json();
      publicIp = ipData.ip;

      // Test external reachability via public check
      const mcCtrl = new AbortController();
      const mcTimeout = setTimeout(() => mcCtrl.abort(), 3500);
      const checkRes = await fetch(`https://api.mcstatus.io/v2/status/java/${publicIp}:${port}`, {
        signal: mcCtrl.signal
      });
      clearTimeout(mcTimeout);

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        // If the service saw a response from this port
        if (checkData.online) {
          isOpen = true;
        }
      }
    }
  } catch (err) {
    // Port closed or probe timed out (not forwarded)
    isOpen = false;
  } finally {
    if (tempBound) {
      await new Promise<void>((resolve) => tempServer.close(() => resolve()));
    }
  }

  return {
    port,
    isOpen,
    isLocalPortFree: true,
    gatewayIp,
    localIp,
    publicIp
  };
});

ipcMain.handle('network:openRouter', async (_, gatewayIp: string) => {
  const url = gatewayIp.startsWith('http') ? gatewayIp : `http://${gatewayIp}`;
  await shell.openExternal(url);
});

