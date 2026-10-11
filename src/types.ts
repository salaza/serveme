export type GameType = 'minecraft';

export type MinecraftLoader = 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'paper' | 'purpur';

export interface ServerInstance {
  id: string;
  name: string;
  game: GameType;
  path: string;
  version: string;
  loader: MinecraftLoader;
  loaderVersion?: string;
  port: number;
  ramMin: number; // In GB
  ramMax: number; // In GB
  javaPath?: string;
  jvmArgs?: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping';
  createdAt: number;
}

export type ModProvider = 'modrinth' | 'curseforge';

export interface ModItem {
  id: string;
  slug: string;
  name: string;
  summary: string;
  iconUrl?: string;
  author: string;
  downloads: number;
  provider: ModProvider;
  installed: boolean;
  installedFileName?: string;
  installedVersion?: string;
  enabled?: boolean;
  categories?: string[];
  websiteUrl?: string;
  serverSide?: 'required' | 'optional' | 'unsupported' | string;
  clientSide?: 'required' | 'optional' | 'unsupported' | string;
  isClientOnly?: boolean;
}

export interface InstalledMod {
  fileName: string;
  name: string;
  enabled: boolean;
  provider?: ModProvider;
  modId?: string;
  version?: string;
  fileSize?: number;
}

export interface ModlistFile {
  schemaVersion: 1;
  name: string;
  game: GameType;
  gameVersion: string;
  loader: MinecraftLoader;
  exportedAt: string;
  mods: Array<{
    id: string;
    slug?: string;
    name: string;
    provider: ModProvider;
    versionId?: string;
    fileName: string;
    downloadUrl: string;
  }>;
}

export interface ServerConfig {
  properties: Record<string, string>;
  jvmArgs: string;
  ramMin: number;
  ramMax: number;
  javaPath: string;
}

export interface AppSettings {
  defaultServersDir: string;
  defaultJavaPath: string;
  curseForgeApiKey: string;
  preferredModProvider: ModProvider;
}

export interface SystemInfo {
  javaVersions: Array<{ path: string; version: string; isDefault: boolean }>;
  totalMemoryGb: number;
  freeMemoryGb: number;
}
