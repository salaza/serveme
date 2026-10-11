export interface PropertyDefinition {
  key: string;
  label: string;
  category: 'gameplay' | 'players' | 'network' | 'chat' | 'remote' | 'packs' | 'management';
  type: 'boolean' | 'number' | 'string' | 'select';
  description: string;
  defaultValue: string;
  minVersion?: string; // Introduced in this MC version
  maxVersion?: string; // Removed / deprecated in this MC version
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export const PROPERTY_CATEGORIES = [
  { id: 'all', label: 'All Properties', icon: 'SlidersHorizontal' },
  { id: 'gameplay', label: 'Gameplay & World', icon: 'Gamepad2' },
  { id: 'players', label: 'Players & Security', icon: 'Users' },
  { id: 'network', label: 'Network & Performance', icon: 'Cpu' },
  { id: 'chat', label: 'Chat & Moderation', icon: 'MessageSquare' },
  { id: 'remote', label: 'RCON & Query', icon: 'Radio' },
  { id: 'packs', label: 'Resource & Data Packs', icon: 'Package' },
  { id: 'management', label: 'Management API (26+)', icon: 'ServerCog' },
  { id: 'custom', label: 'Custom & Other', icon: 'Wrench' }
] as const;

export type PropertyCategory = typeof PROPERTY_CATEGORIES[number]['id'];

export const MINECRAFT_PROPERTIES: PropertyDefinition[] = [
  // ==================== 1. GAMEPLAY & WORLD ====================
  {
    key: 'motd',
    label: 'Server MOTD',
    category: 'chat',
    type: 'string',
    defaultValue: 'A Minecraft Server',
    description: 'Message of the day displayed in the multiplayer server list menu.',
    placeholder: 'Enter server description'
  },
  {
    key: 'gamemode',
    label: 'Default Gamemode',
    category: 'gameplay',
    type: 'select',
    defaultValue: 'survival',
    description: 'The game mode given to players upon joining the server.',
    options: [
      { value: 'survival', label: 'Survival' },
      { value: 'creative', label: 'Creative' },
      { value: 'adventure', label: 'Adventure' },
      { value: 'spectator', label: 'Spectator' }
    ]
  },
  {
    key: 'force-gamemode',
    label: 'Force Gamemode',
    category: 'gameplay',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Force players to join in the default gamemode, resetting any previous modes.'
  },
  {
    key: 'difficulty',
    label: 'Difficulty',
    category: 'gameplay',
    type: 'select',
    defaultValue: 'easy',
    description: 'Server difficulty level controlling hostile mob damage and hunger depletion.',
    options: [
      { value: 'peaceful', label: 'Peaceful' },
      { value: 'easy', label: 'Easy' },
      { value: 'normal', label: 'Normal' },
      { value: 'hard', label: 'Hard' }
    ]
  },
  {
    key: 'hardcore',
    label: 'Hardcore Mode',
    category: 'gameplay',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Locks difficulty to hard and bans or converts players to spectator upon death.'
  },
  {
    key: 'pvp',
    label: 'Player vs Player (PvP)',
    category: 'gameplay',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Allow players to damage and fight each other.'
  },
  {
    key: 'allow-flight',
    label: 'Allow Flying',
    category: 'gameplay',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Allows survival players to fly if using mods or jetpacks without being kicked.'
  },
  {
    key: 'allow-nether',
    label: 'Allow Nether Dimension',
    category: 'gameplay',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Allows players to build and enter Nether portals.'
  },
  {
    key: 'spawn-animals',
    label: 'Spawn Animals',
    category: 'gameplay',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Determines whether passive animals can naturally spawn.'
  },
  {
    key: 'spawn-monsters',
    label: 'Spawn Monsters',
    category: 'gameplay',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Determines whether hostile monsters can naturally spawn.'
  },
  {
    key: 'spawn-npcs',
    label: 'Spawn Villagers & NPCs',
    category: 'gameplay',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Determines whether villagers and wanderers can spawn.'
  },
  {
    key: 'spawn-protection',
    label: 'Spawn Protection Radius',
    category: 'gameplay',
    type: 'number',
    defaultValue: '16',
    min: 0,
    max: 128,
    description: 'Block radius around world spawn protected from non-OP player edits (0 to disable).'
  },
  {
    key: 'level-name',
    label: 'World Name / Folder',
    category: 'gameplay',
    type: 'string',
    defaultValue: 'world',
    description: 'Directory name where world terrain, nether, and the end are saved.',
    placeholder: 'world'
  },
  {
    key: 'level-seed',
    label: 'World Generation Seed',
    category: 'gameplay',
    type: 'string',
    defaultValue: '',
    description: 'Random terrain seed for new world generation. Leave blank for random.',
    placeholder: 'Random seed or number'
  },
  {
    key: 'level-type',
    label: 'World Generator Type',
    category: 'gameplay',
    type: 'select',
    defaultValue: 'minecraft:normal',
    description: 'Determines the generator type for new worlds.',
    options: [
      { value: 'minecraft:normal', label: 'Default / Normal' },
      { value: 'minecraft:flat', label: 'Flat World' },
      { value: 'minecraft:large_biomes', label: 'Large Biomes' },
      { value: 'minecraft:amplified', label: 'Amplified' },
      { value: 'minecraft:single_biome_surface', label: 'Single Biome' }
    ]
  },
  {
    key: 'generate-structures',
    label: 'Generate Structures',
    category: 'gameplay',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Controls generation of villages, dungeons, temples, and nether fortresses.'
  },
  {
    key: 'generator-settings',
    label: 'Generator Settings JSON',
    category: 'gameplay',
    type: 'string',
    defaultValue: '{}',
    description: 'JSON settings used by flat and custom world presets.',
    placeholder: '{}'
  },
  {
    key: 'max-world-size',
    label: 'Max World Border Radius',
    category: 'gameplay',
    type: 'number',
    defaultValue: '29999984',
    min: 1000,
    max: 29999984,
    description: 'Maximum radius in blocks before hitting the world border.'
  },

  // ==================== 2. PLAYERS & SECURITY ====================
  {
    key: 'max-players',
    label: 'Max Concurrent Players',
    category: 'players',
    type: 'number',
    defaultValue: '20',
    min: 1,
    max: 1000,
    description: 'Maximum player capacity for the server.'
  },
  {
    key: 'online-mode',
    label: 'Online Mode (Mojang Auth)',
    category: 'players',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Verifies player accounts against Mojang session servers (disable for offline/LAN).'
  },
  {
    key: 'white-list',
    label: 'Enable Whitelist',
    category: 'players',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Only players listed in whitelist.json can connect to the server.'
  },
  {
    key: 'enforce-whitelist',
    label: 'Enforce Whitelist On Reload',
    category: 'players',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Immediately kicks connected players if removed from whitelist.'
  },
  {
    key: 'hide-online-players',
    label: 'Hide Online Player List',
    category: 'players',
    type: 'boolean',
    defaultValue: 'false',
    minVersion: '1.18',
    description: 'Hides player count and usernames from the multiplayer server browser.'
  },
  {
    key: 'player-idle-timeout',
    label: 'AFK / Idle Kick Timeout',
    category: 'players',
    type: 'number',
    defaultValue: '0',
    min: 0,
    max: 1440,
    description: 'Minutes an idle/AFK player can stay before being kicked (0 = disabled).'
  },
  {
    key: 'op-permission-level',
    label: 'OP Permission Level',
    category: 'players',
    type: 'select',
    defaultValue: '4',
    description: 'Default power level granted to operators.',
    options: [
      { value: '1', label: 'Level 1 - Bypass spawn protection' },
      { value: '2', label: 'Level 2 - Cheats & Command Blocks' },
      { value: '3', label: 'Level 3 - Ban, Kick, and OP others' },
      { value: '4', label: 'Level 4 - Full Admin & Server Stop' }
    ]
  },
  {
    key: 'function-permission-level',
    label: 'Function Permission Level',
    category: 'players',
    type: 'select',
    defaultValue: '2',
    description: 'Permission level required to execute functions from datapacks.',
    options: [
      { value: '1', label: 'Level 1' },
      { value: '2', label: 'Level 2' },
      { value: '3', label: 'Level 3' },
      { value: '4', label: 'Level 4' }
    ]
  },
  {
    key: 'enforce-secure-profile',
    label: 'Enforce Signed Chat Profiles',
    category: 'players',
    type: 'boolean',
    defaultValue: 'true',
    minVersion: '1.19',
    description: 'Requires players to have a Mojang-signed public key for secure chat.'
  },
  {
    key: 'log-ips',
    label: 'Log Player IP Addresses',
    category: 'players',
    type: 'boolean',
    defaultValue: 'true',
    minVersion: '1.19.4',
    description: 'Logs client IP addresses in the console when players join.'
  },
  {
    key: 'prevent-proxy-connections',
    label: 'Prevent Proxy / VPN Connections',
    category: 'players',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Prevents players connecting via public VPNs or proxies from joining.'
  },
  {
    key: 'enable-code-of-conduct',
    label: 'Enable Code of Conduct Prompt',
    category: 'players',
    type: 'boolean',
    defaultValue: 'false',
    minVersion: '26.0',
    description: 'Displays server code of conduct modal to joining players.'
  },

  // ==================== 3. NETWORK & PERFORMANCE ====================
  {
    key: 'server-port',
    label: 'Server Port',
    category: 'network',
    type: 'number',
    defaultValue: '25565',
    min: 1024,
    max: 65535,
    description: 'TCP port the Minecraft server listens on for player connections.'
  },
  {
    key: 'server-ip',
    label: 'Server Bind IP',
    category: 'network',
    type: 'string',
    defaultValue: '',
    description: 'Specific network interface IP to bind to. Leave blank to listen on all interfaces (0.0.0.0).',
    placeholder: 'Leave blank for all interfaces'
  },
  {
    key: 'view-distance',
    label: 'View Distance (Chunks)',
    category: 'network',
    type: 'number',
    defaultValue: '10',
    min: 3,
    max: 32,
    description: 'Maximum chunk radius sent to players from their position.'
  },
  {
    key: 'simulation-distance',
    label: 'Simulation Distance (Chunks)',
    category: 'network',
    type: 'number',
    defaultValue: '10',
    min: 3,
    max: 32,
    minVersion: '1.18',
    description: 'Chunk radius around players where mobs, water, and redstone are actively updated.'
  },
  {
    key: 'network-compression-threshold',
    label: 'Network Compression Threshold (Bytes)',
    category: 'network',
    type: 'number',
    defaultValue: '256',
    min: -1,
    max: 1024,
    description: 'Packet size threshold for gzip compression (-1 disables compression).'
  },
  {
    key: 'max-tick-time',
    label: 'Watchdog Max Tick Time (ms)',
    category: 'network',
    type: 'number',
    defaultValue: '60000',
    min: -1,
    max: 300000,
    description: 'Maximum milliseconds a single server tick may take before watchdog terminates server (-1 = disabled).'
  },
  {
    key: 'max-chained-neighbor-updates',
    label: 'Max Chained Neighbor Updates',
    category: 'network',
    type: 'number',
    defaultValue: '1000000',
    min: 1000,
    max: 10000000,
    minVersion: '1.19',
    description: 'Limits chain reaction block updates (e.g. huge redstone cascades) to prevent lag crashes.'
  },
  {
    key: 'sync-chunk-writes',
    label: 'Sync Chunk Writes',
    category: 'network',
    type: 'boolean',
    defaultValue: 'true',
    minVersion: '1.16',
    description: 'Forces synchronous file writes when saving chunks, preventing world corruption.'
  },
  {
    key: 'region-file-compression',
    label: 'Region File Compression',
    category: 'network',
    type: 'select',
    defaultValue: 'deflate',
    minVersion: '1.20.5',
    description: 'Compression algorithm used for saving world region (.mca) files.',
    options: [
      { value: 'deflate', label: 'Deflate (Standard zlib)' },
      { value: 'lz4', label: 'LZ4 (Ultra-Fast)' },
      { value: 'none', label: 'None (Uncompressed)' }
    ]
  },
  {
    key: 'pause-when-empty-seconds',
    label: 'Pause When Empty (Seconds)',
    category: 'network',
    type: 'number',
    defaultValue: '60',
    min: -1,
    max: 3600,
    minVersion: '1.21.2',
    description: 'Seconds without players before server pauses game ticks to save CPU (-1 = never pause).'
  },
  {
    key: 'use-native-transport',
    label: 'Use Native Transport',
    category: 'network',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Optimizes packet networking using Netty native epoll (Linux) or kqueue (macOS).'
  },
  {
    key: 'entity-broadcast-range-percentage',
    label: 'Entity Broadcast Range (%)',
    category: 'network',
    type: 'number',
    defaultValue: '100',
    min: 10,
    max: 1000,
    minVersion: '1.16',
    description: 'Controls entity visibility distance percentage relative to player view distance.'
  },
  {
    key: 'rate-limit',
    label: 'Packet Rate Limit',
    category: 'network',
    type: 'number',
    defaultValue: '0',
    min: 0,
    max: 10000,
    description: 'Maximum packets a client can send per second before being kicked (0 = disabled).'
  },
  {
    key: 'accepts-transfers',
    label: 'Accept Player Server Transfers',
    category: 'network',
    type: 'boolean',
    defaultValue: 'false',
    minVersion: '1.20.5',
    description: 'Allows players to be redirected to this server from proxy networks using transfer packets.'
  },

  // ==================== 4. CHAT & MODERATION ====================
  {
    key: 'enable-command-block',
    label: 'Enable Command Blocks',
    category: 'chat',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Allows command blocks in world to execute server commands.'
  },
  {
    key: 'broadcast-console-to-ops',
    label: 'Broadcast Console Output to OPs',
    category: 'chat',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Echoes console command executions to online server operators.'
  },
  {
    key: 'broadcast-rcon-to-ops',
    label: 'Broadcast RCON to OPs',
    category: 'chat',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Echoes commands executed via remote console (RCON) to online operators.'
  },
  {
    key: 'chat-spam-threshold-seconds',
    label: 'Chat Spam Threshold (Seconds)',
    category: 'chat',
    type: 'number',
    defaultValue: '10',
    min: 0,
    max: 60,
    minVersion: '26.0',
    description: 'Anti-spam time window enforced between rapid chat messages.'
  },
  {
    key: 'command-spam-threshold-seconds',
    label: 'Command Spam Threshold (Seconds)',
    category: 'chat',
    type: 'number',
    defaultValue: '10',
    min: 0,
    max: 60,
    minVersion: '26.0',
    description: 'Anti-spam time window enforced between rapid command executions.'
  },
  {
    key: 'text-filtering-config',
    label: 'Text Filtering Config File',
    category: 'chat',
    type: 'string',
    defaultValue: '',
    minVersion: '1.17',
    description: 'File path for custom Microsoft text moderation filtering config.',
    placeholder: 'Optional path'
  },
  {
    key: 'text-filtering-version',
    label: 'Text Filtering Version',
    category: 'chat',
    type: 'number',
    defaultValue: '0',
    min: 0,
    max: 10,
    minVersion: '1.17',
    description: 'Protocol version for server text filtering service.'
  },
  {
    key: 'bug-report-link',
    label: 'Custom Bug Report Link',
    category: 'chat',
    type: 'string',
    defaultValue: '',
    minVersion: '1.20.5',
    description: 'Custom URL displayed to players in the client pause menu to report bugs.',
    placeholder: 'https://example.com/bugs'
  },

  // ==================== 5. RCON & REMOTE QUERY ====================
  {
    key: 'enable-rcon',
    label: 'Enable Remote Console (RCON)',
    category: 'remote',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Enables remote password-authenticated TCP console access.'
  },
  {
    key: 'rcon.port',
    label: 'RCON Port',
    category: 'remote',
    type: 'number',
    defaultValue: '25575',
    min: 1024,
    max: 65535,
    description: 'TCP port for incoming RCON connections.'
  },
  {
    key: 'rcon.password',
    label: 'RCON Password',
    category: 'remote',
    type: 'string',
    defaultValue: '',
    description: 'Secret password required to authenticate to RCON console.',
    placeholder: 'Choose a strong secret password'
  },
  {
    key: 'enable-query',
    label: 'Enable GameSpy4 Query',
    category: 'remote',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Enables GameSpy4 UDP protocol to poll server statistics.'
  },
  {
    key: 'query.port',
    label: 'Query Port',
    category: 'remote',
    type: 'number',
    defaultValue: '25565',
    min: 1024,
    max: 65535,
    description: 'UDP port for GameSpy4 query service.'
  },
  {
    key: 'enable-status',
    label: 'Enable Server List Status Ping',
    category: 'remote',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Makes the server visible and pingable in Minecraft multiplayer server list.'
  },
  {
    key: 'status-heartbeat-interval',
    label: 'Status Heartbeat Interval',
    category: 'remote',
    type: 'number',
    defaultValue: '0',
    min: 0,
    max: 300,
    minVersion: '1.21',
    description: 'Interval in seconds between server status heartbeats (0 = default).'
  },
  {
    key: 'enable-jmx-monitoring',
    label: 'Enable JMX Monitoring',
    category: 'remote',
    type: 'boolean',
    defaultValue: 'false',
    minVersion: '1.16',
    description: 'Exposes JVM and server tick performance metrics via JMX.'
  },

  // ==================== 6. RESOURCE & DATA PACKS ====================
  {
    key: 'resource-pack',
    label: 'Resource Pack Direct URL',
    category: 'packs',
    type: 'string',
    defaultValue: '',
    description: 'Direct HTTP/HTTPS link to download a .zip resource pack on join.',
    placeholder: 'https://example.com/pack.zip'
  },
  {
    key: 'resource-pack-sha1',
    label: 'Resource Pack SHA-1 Hash',
    category: 'packs',
    type: 'string',
    defaultValue: '',
    description: '40-character hexadecimal SHA-1 checksum verifying pack integrity.',
    placeholder: 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
  },
  {
    key: 'resource-pack-id',
    label: 'Resource Pack UUID',
    category: 'packs',
    type: 'string',
    defaultValue: '',
    minVersion: '1.20.3',
    description: 'Unique UUID string identifying the server resource pack.',
    placeholder: 'e.g. 550e8400-e29b-41d4-a716-446655440000'
  },
  {
    key: 'resource-pack-prompt',
    label: 'Resource Pack Prompt Message',
    category: 'packs',
    type: 'string',
    defaultValue: '',
    minVersion: '1.17',
    description: 'Custom message shown to players asking if they want to download the pack.',
    placeholder: 'Welcome! Please accept our custom resource pack.'
  },
  {
    key: 'require-resource-pack',
    label: 'Require Resource Pack',
    category: 'packs',
    type: 'boolean',
    defaultValue: 'false',
    minVersion: '1.17',
    description: 'Disconnects and kicks any player who declines the server resource pack.'
  },
  {
    key: 'initial-enabled-packs',
    label: 'Initial Enabled Data Packs',
    category: 'packs',
    type: 'string',
    defaultValue: 'vanilla',
    minVersion: '1.19.3',
    description: 'Comma-separated datapacks enabled by default upon new world creation.',
    placeholder: 'vanilla,bundle'
  },
  {
    key: 'initial-disabled-packs',
    label: 'Initial Disabled Data Packs',
    category: 'packs',
    type: 'string',
    defaultValue: '',
    minVersion: '1.19.3',
    description: 'Comma-separated datapacks disabled upon world creation.',
    placeholder: 'Optional datapack ids'
  },

  // ==================== 7. MANAGEMENT SERVER (26+) ====================
  {
    key: 'management-server-enabled',
    label: 'Enable Management Server',
    category: 'management',
    type: 'boolean',
    defaultValue: 'false',
    minVersion: '26.0',
    description: 'Enables official Minecraft HTTP/REST management API.'
  },
  {
    key: 'management-server-host',
    label: 'Management Server Host',
    category: 'management',
    type: 'string',
    defaultValue: 'localhost',
    minVersion: '26.0',
    description: 'Host interface for management server binding.',
    placeholder: 'localhost'
  },
  {
    key: 'management-server-port',
    label: 'Management Server Port',
    category: 'management',
    type: 'number',
    defaultValue: '0',
    min: 0,
    max: 65535,
    minVersion: '26.0',
    description: 'Port for management API (0 = auto-assign random available port).'
  },
  {
    key: 'management-server-secret',
    label: 'Management API Secret Token',
    category: 'management',
    type: 'string',
    defaultValue: '',
    minVersion: '26.0',
    description: 'Bearer token secret required to authenticate management requests.',
    placeholder: 'API secret key'
  },
  {
    key: 'management-server-allowed-origins',
    label: 'Management CORS Allowed Origins',
    category: 'management',
    type: 'string',
    defaultValue: '',
    minVersion: '26.0',
    description: 'Comma-separated browser origins allowed by CORS headers.',
    placeholder: 'https://admin.example.com'
  },
  {
    key: 'management-server-tls-enabled',
    label: 'Management TLS Encryption',
    category: 'management',
    type: 'boolean',
    defaultValue: 'true',
    minVersion: '26.0',
    description: 'Require HTTPS / TLS encryption for the management API.'
  },
  {
    key: 'management-server-tls-keystore',
    label: 'Management TLS Keystore Path',
    category: 'management',
    type: 'string',
    defaultValue: '',
    minVersion: '26.0',
    description: 'File path to Java keystore containing certificate.',
    placeholder: 'path/to/keystore.jks'
  },
  {
    key: 'management-server-tls-keystore-password',
    label: 'Management Keystore Password',
    category: 'management',
    type: 'string',
    defaultValue: '',
    minVersion: '26.0',
    description: 'Password protecting the management TLS keystore.',
    placeholder: 'Keystore password'
  }
];

/**
 * Compare two Minecraft version strings.
 * Snapshot versions starting with 25+, 26+ are treated as newer than 1.x.
 */
export function compareMcVersions(v1: string, v2: string): number {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const clean1 = v1.trim().replace(/^v/i, '');
  const clean2 = v2.trim().replace(/^v/i, '');

  const isV1Snapshot = /^(25|26|27)\./.test(clean1);
  const isV2Snapshot = /^(25|26|27)\./.test(clean2);

  if (isV1Snapshot && !isV2Snapshot) return 1;
  if (!isV1Snapshot && isV2Snapshot) return -1;

  const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const n1 = parts1[i] ?? 0;
    const n2 = parts2[i] ?? 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }

  return 0;
}

/**
 * Checks whether a property definition is valid for a given Minecraft version.
 */
export function isPropertySupported(prop: PropertyDefinition, mcVersion: string): boolean {
  if (!mcVersion) return true;

  if (prop.minVersion) {
    if (compareMcVersions(mcVersion, prop.minVersion) < 0) {
      return false;
    }
  }

  if (prop.maxVersion) {
    if (compareMcVersions(mcVersion, prop.maxVersion) > 0) {
      return false;
    }
  }

  return true;
}

/**
 * Returns a human-friendly version requirement badge for the property, if any.
 */
export function getPropertyVersionNotice(prop: PropertyDefinition, mcVersion: string): string | null {
  if (prop.minVersion) {
    const isSupported = compareMcVersions(mcVersion, prop.minVersion) >= 0;
    if (!isSupported) {
      return `Requires MC ${prop.minVersion}+ (Server is ${mcVersion})`;
    }
  }
  if (prop.maxVersion) {
    const isSupported = compareMcVersions(mcVersion, prop.maxVersion) <= 0;
    if (!isSupported) {
      return `Deprecated after MC ${prop.maxVersion}`;
    }
  }
  return null;
}
