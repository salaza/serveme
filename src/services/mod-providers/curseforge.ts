import { ModItem, MinecraftLoader } from '../../types';

export function getCurseForgeLoaderType(loader?: MinecraftLoader): number {
  switch (loader) {
    case 'forge': return 1; // Or 4
    case 'fabric': return 4;
    case 'neoforge': return 6;
    default: return 0;
  }
}

export async function searchCurseForge(
  query: string,
  apiKey: string,
  gameVersion?: string,
  loader?: MinecraftLoader,
  pageSize: number = 20,
  index: number = 0
): Promise<{ mods: ModItem[]; total: number }> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('CurseForge API Key is not configured. Please add your key in Settings or switch to Modrinth (no key required).');
  }

  const params = new URLSearchParams({
    gameId: '432', // Minecraft
    classId: '6',  // Mods
    pageSize: pageSize.toString(),
    index: index.toString(),
    sortField: '2', // Popularity
    sortOrder: 'desc'
  });

  if (query.trim()) {
    params.append('searchFilter', query.trim());
  }
  if (gameVersion) {
    params.append('gameVersion', gameVersion);
  }
  if (loader && loader !== 'vanilla') {
    const modLoaderType = getCurseForgeLoaderType(loader);
    if (modLoaderType > 0) {
      params.append('modLoaderType', modLoaderType.toString());
    }
  }

  const response = await fetch(`https://api.curseforge.com/v1/mods/search?${params.toString()}`, {
    headers: {
      'Accept': 'application/json',
      'x-api-key': apiKey.trim()
    }
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 401) {
      throw new Error('Invalid or unauthorized CurseForge API Key.');
    }
    throw new Error(`CurseForge API error: ${response.statusText}`);
  }

  const data = await response.json();
  const mods: ModItem[] = (data.data || []).map((m: any) => ({
    id: m.id.toString(),
    slug: m.slug,
    name: m.name,
    summary: m.summary || '',
    iconUrl: m.logo?.thumbnailUrl || m.logo?.url,
    author: m.authors?.[0]?.name || 'Unknown',
    downloads: m.downloadCount || 0,
    provider: 'curseforge',
    installed: false,
    categories: (m.categories || []).map((c: any) => c.name),
    websiteUrl: m.links?.websiteUrl || `https://www.curseforge.com/minecraft/mc-mods/${m.slug}`
  }));

  return { mods, total: data.pagination?.totalCount || mods.length };
}

export async function getCurseForgeModFiles(
  modId: string,
  apiKey: string,
  gameVersion?: string,
  loader?: MinecraftLoader
): Promise<any[]> {
  if (!apiKey) throw new Error('CurseForge API Key required');

  const params = new URLSearchParams({
    pageSize: '20'
  });
  if (gameVersion) params.append('gameVersion', gameVersion);
  if (loader && loader !== 'vanilla') {
    const modLoaderType = getCurseForgeLoaderType(loader);
    if (modLoaderType > 0) params.append('modLoaderType', modLoaderType.toString());
  }

  const res = await fetch(`https://api.curseforge.com/v1/mods/${modId}/files?${params.toString()}`, {
    headers: {
      'Accept': 'application/json',
      'x-api-key': apiKey.trim()
    }
  });

  if (!res.ok) throw new Error('Failed to fetch files from CurseForge');
  const data = await res.json();
  return data.data || [];
}
