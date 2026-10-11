export type GameType = 'minecraft' | 'gmod';

export type MinecraftLoader = 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'paper' | 'purpur';

export interface GModServerConfig {
  gamemode: string;
  defaultMap: string;
  maxPlayers: number;
  tickrate: number;
  workshopCollectionId?: string;
  steamApiKey?: string;
  rconPassword?: string;
  serverPassword?: string;
}

export interface GModAddonInfo {
  name: string;
  fileName: string;
  filePath: string;
  isFolder: boolean;
  enabled: boolean;
  sizeBytes: number;
}

export interface CreateGModServerOptions {
  server: ServerInstance;
  gamemode: string;
  defaultMap: string;
  maxPlayers: number;
  tickrate: number;
  workshopCollectionId?: string;
  steamApiKey?: string;
}

export interface ServerInstance {
  id: string;
  name: string;
  game: GameType;
  path: string;
  // Minecraft specific
  version?: string;
  loader?: MinecraftLoader;
  loaderVersion?: string;
  ramMin?: number; // In GB
  ramMax?: number; // In GB
  javaPath?: string;
  jvmArgs?: string;
  // GMod specific
  gmodConfig?: GModServerConfig;

  port: number;
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

export interface JavaVersionInfo {
  path: string;
  version: string;
  major: number;
  isDefault: boolean;
}

export interface JavaValidationResult {
  valid: boolean;
  currentMajor: number;
  requiredMajor: number;
  currentJavaPath: string;
  compatibleJavaPath?: string;
  compatibleVersionName?: string;
  allDetectedJavas: JavaVersionInfo[];
  downloadUrl?: string;
  reason: string;
}

export interface SystemInfo {
  javaVersions: JavaVersionInfo[];
  totalMemoryGb: number;
  freeMemoryGb: number;
}

export interface PortCheckResult {
  port: number;
  isOpen: boolean;
  isLocalPortFree: boolean;
  gatewayIp: string;
  localIp: string;
  publicIp?: string;
  message?: string;
}

export interface WorldInfo {
  name: string;
  isActive: boolean;
  isGenerated: boolean;
  sizeBytes: number;
  lastModified: number;
  hasNether: boolean;
  hasEnd: boolean;
}

export interface WorldBackup {
  id: string;
  fileName: string;
  filePath: string;
  worldName: string;
  sizeBytes: number;
  createdAt: number;
  note?: string;
}

export interface CreateWorldOptions {
  name: string;
  seed?: string;
  generatorType?: string;
  difficulty?: string;
  hardcore?: boolean;
  switchActive?: boolean;
}

export interface RegenerateWorldOptions {
  createBackupFirst: boolean;
  newSeed?: string;
}

export interface ClientModToDownload {
  id: string;
  name: string;
  fileName: string;
  downloadUrl: string;
  fileSize?: number;
  iconUrl?: string;
  provider: 'modrinth' | 'curseforge';
  requiredBy?: string;
}

export interface LocalClientMod {
  path: string;
  name: string;
  fileName: string;
  fileSize: number;
}

export interface ExportModpackOptions {
  serverId: string;
  packName: string;
  packVersion: string;
  packAuthor?: string;
  packNotes?: string;
  includeConfigs: boolean;
  selectedServerModFiles: string[];
  clientModsToDownload: ClientModToDownload[];
  localClientModPaths: string[];
  outputPath: string;
}

export interface ExportModpackResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  modsCount?: number;
}

