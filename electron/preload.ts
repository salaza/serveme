import { contextBridge, ipcRenderer } from 'electron';
import { ServerInstance, ModlistFile, AppSettings, PortCheckResult } from '../src/types';

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
  detectJava: (): Promise<Array<{ path: string; version: string; isDefault: boolean }>> =>
    ipcRenderer.invoke('system:detectJava'),

  // Network & Router Gateway
  checkPort: (port: number): Promise<PortCheckResult> =>
    ipcRenderer.invoke('network:checkPort', port),
  openRouterSettings: (gatewayIp: string): Promise<void> =>
    ipcRenderer.invoke('network:openRouter', gatewayIp)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
