export interface MinecraftVersionItem {
  id: string;
  type: 'release' | 'snapshot';
  url: string;
  releaseTime: string;
}

export interface PaperBuild {
  build: number;
  time: string;
  downloads: {
    application: {
      name: string;
      sha256: string;
    };
  };
}

// Cache results in memory to make UI instant
let cachedMcVersions: MinecraftVersionItem[] | null = null;

export async function fetchMinecraftVersions(): Promise<MinecraftVersionItem[]> {
  if (cachedMcVersions) return cachedMcVersions;
  try {
    const res = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
    if (!res.ok) throw new Error('Failed to fetch Mojang version manifest');
    const data = await res.json();
    cachedMcVersions = data.versions;
    return data.versions;
  } catch (err) {
    console.error('Error fetching Minecraft versions:', err);
    // Fallback to recent popular versions if offline
    return [
      { id: '1.21.4', type: 'release', url: '', releaseTime: '2024-12-03' },
      { id: '1.21.3', type: 'release', url: '', releaseTime: '2024-10-23' },
      { id: '1.21.1', type: 'release', url: '', releaseTime: '2024-08-08' },
      { id: '1.21', type: 'release', url: '', releaseTime: '2024-06-13' },
      { id: '1.20.4', type: 'release', url: '', releaseTime: '2023-12-07' },
      { id: '1.20.2', type: 'release', url: '', releaseTime: '2023-09-21' },
      { id: '1.20.1', type: 'release', url: '', releaseTime: '2023-06-12' },
      { id: '1.19.4', type: 'release', url: '', releaseTime: '2023-03-14' },
      { id: '1.19.2', type: 'release', url: '', releaseTime: '2022-08-05' },
      { id: '1.18.2', type: 'release', url: '', releaseTime: '2022-02-28' },
      { id: '1.16.5', type: 'release', url: '', releaseTime: '2021-01-15' },
      { id: '1.12.2', type: 'release', url: '', releaseTime: '2017-09-18' }
    ];
  }
}

export async function fetchFabricLoaders(gameVersion: string): Promise<Array<{ version: string; stable: boolean }>> {
  try {
    const res = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`);
    if (!res.ok) throw new Error('Failed to fetch Fabric loader versions');
    const data = await res.json();
    return data.map((item: any) => ({
      version: item.loader.version,
      stable: item.loader.stable ?? true
    }));
  } catch (err) {
    console.error('Error fetching Fabric loaders:', err);
    return [
      { version: '0.16.10', stable: true },
      { version: '0.16.9', stable: true },
      { version: '0.15.11', stable: true }
    ];
  }
}

export async function fetchPaperBuilds(gameVersion: string): Promise<number[]> {
  try {
    const res = await fetch(`https://api.papermc.io/v2/projects/paper/versions/${gameVersion}/builds`);
    if (!res.ok) throw new Error('Paper version not found');
    const data = await res.json();
    return (data.builds || []).map((b: any) => b.build).reverse();
  } catch (err) {
    console.warn(`Could not fetch Paper builds for ${gameVersion}:`, err);
    return [];
  }
}

export function getFabricServerDownloadUrl(gameVersion: string, loaderVersion: string): string {
  // Fabric provides direct installer server jar!
  // Format: https://meta.fabricmc.net/v2/versions/loader/{game_version}/{loader_version}/1.0.1/server/jar
  return `https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVersion}/1.0.1/server/jar`;
}

export function getPaperServerDownloadUrl(gameVersion: string, build: number): string {
  return `https://api.papermc.io/v2/projects/paper/versions/${gameVersion}/builds/${build}/downloads/paper-${gameVersion}-${build}.jar`;
}

export function getPurpurServerDownloadUrl(gameVersion: string): string {
  return `https://api.purpurmc.org/v2/purpur/${gameVersion}/latest/download`;
}

export async function getVanillaServerDownloadUrl(gameVersion: string): Promise<string | null> {
  try {
    const versions = await fetchMinecraftVersions();
    const target = versions.find(v => v.id === gameVersion);
    if (!target || !target.url) return null;
    const res = await fetch(target.url);
    const data = await res.json();
    return data.downloads?.server?.url || null;
  } catch (err) {
    console.error('Failed to get vanilla server jar url:', err);
    return null;
  }
}
