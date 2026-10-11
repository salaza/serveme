import { contextBridge, ipcRenderer } from 'electron';
import {
  ServerInstance,
  ModlistFile,
  AppSettings,
  PortCheckResult,
  JavaVersionInfo,
  JavaValidationResult,
  WorldInfo,
  WorldBackup,
  CreateWorldOptions,
  RegenerateWorldOptions
} from '../src/types';

export const electronAPI = {
  // Server management
  getServers: (): Promise<ServerInstance[]> => ipcRenderer.invoke('servers:get'),
  saveServer: (server: ServerInstance): Promise<void> => ipcRenderer.invoke('servers:save', server),
  deleteServer: (serverId: string, deleteFiles: boolean): Promise<void> =>
    ipcRenderer.invoke('servers:delete', { serverId, deleteFiles }),
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory'),
  
  // Server installation & setup
  setupMinecraftServer: (payload: {
    server: ServerInstance;
    downloadUrl: string;
    jarName: string;
    acceptEula: boolean;
  }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('server:setup', payload),

  // Server lifecycle
  startServer: (serverId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('server:start', serverId),
  stopServer: (serverId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('server:stop', serverId),
  sendServerCommand: (serverId: string, command: string): Promise<void> =>
    ipcRenderer.invoke('server:command', { serverId, command }),
  onServerLog: (callback: (data: { serverId: string; log: string; type: 'stdout' | 'stderr' | 'system' }) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('server:log', subscription);
    return () => ipcRenderer.removeListener('server:log', subscription);
  },
  onServerStatusChange: (callback: (data: { serverId: string; status: string }) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('server:status', subscription);
    return () => ipcRenderer.removeListener('server:status', subscription);
  },

  // Mod management
  getInstalledMods: (serverPath: string): Promise<Array<{
    fileName: string;
    name: string;
    enabled: boolean;
    fileSize: number;
    modId?: string;
  }>> => ipcRenderer.invoke('mods:getInstalled', serverPath),
  installMod: (payload: {
    serverPath: string;
    downloadUrl: string;
    fileName: string;
    modId?: string;
    name?: string;
  }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('mods:install', payload),
  toggleMod: (serverPath: string, fileName: string, enable: boolean): Promise<boolean> =>
    ipcRenderer.invoke('mods:toggle', { serverPath, fileName, enable }),
  deleteMod: (serverPath: string, fileName: string): Promise<boolean> =>
    ipcRenderer.invoke('mods:delete', { serverPath, fileName }),

  // Modlist import/export
  exportModlist: (serverPath: string, defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('modlist:export', { serverPath, defaultName }),
  importModlist: (): Promise<ModlistFile | null> =>
    ipcRenderer.invoke('modlist:import'),

  // Config files
  readServerProperties: (serverPath: string): Promise<Record<string, string>> =>
    ipcRenderer.invoke('config:readProperties', serverPath),
  saveServerProperties: (serverPath: string, properties: Record<string, string>): Promise<boolean> =>
    ipcRenderer.invoke('config:saveProperties', { serverPath, properties }),
  readRawFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('files:readRaw', filePath),
  writeRawFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('files:writeRaw', { filePath, content }),
  openFolder: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke('shell:openPath', dirPath),

  // Settings & System
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings): Promise<void> => ipcRenderer.invoke('settings:save', settings),
  detectJava: (): Promise<JavaVersionInfo[]> =>
    ipcRenderer.invoke('system:detectJava'),
  validateServerJava: (payload: { mcVersion: string; javaPath: string }): Promise<JavaValidationResult> =>
    ipcRenderer.invoke('system:validateJava', payload),
  openExternalUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:openExternal', url),

  // Network & Router Gateway
  checkPort: (port: number, serverId?: string): Promise<PortCheckResult> =>
    ipcRenderer.invoke('network:checkPort', { port, serverId }),
  openRouterSettings: (gatewayIp: string): Promise<void> =>
    ipcRenderer.invoke('network:openRouter', gatewayIp),

  // Worlds & Backups
  getWorlds: (serverPath: string): Promise<{ activeWorld: string; worlds: WorldInfo[] }> =>
    ipcRenderer.invoke('worlds:list', serverPath),
  setActiveWorld: (serverPath: string, worldName: string): Promise<boolean> =>
    ipcRenderer.invoke('worlds:setActive', { serverPath, worldName }),
  createWorld: (serverPath: string, options: CreateWorldOptions): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('worlds:create', { serverPath, options }),
  duplicateWorld: (serverPath: string, sourceWorldName: string, targetWorldName: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('worlds:duplicate', { serverPath, sourceWorldName, targetWorldName }),
  deleteWorld: (serverPath: string, worldName: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('worlds:delete', { serverPath, worldName }),
  regenerateWorld: (serverPath: string, worldName: string, options: RegenerateWorldOptions): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('worlds:regenerate', { serverPath, worldName, options }),

  getWorldBackups: (serverPath: string): Promise<WorldBackup[]> =>
    ipcRenderer.invoke('worlds:getBackups', serverPath),
  createWorldBackup: (serverPath: string, worldName: string, note?: string): Promise<{ success: boolean; backup?: WorldBackup; error?: string }> =>
    ipcRenderer.invoke('worlds:createBackup', { serverPath, worldName, note }),
  restoreWorldBackup: (serverPath: string, backupFileName: string, targetWorldName?: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('worlds:restoreBackup', { serverPath, backupFileName, targetWorldName }),
  deleteWorldBackup: (serverPath: string, backupFileName: string): Promise<boolean> =>
    ipcRenderer.invoke('worlds:deleteBackup', { serverPath, backupFileName })
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
