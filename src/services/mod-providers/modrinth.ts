import { ModItem, MinecraftLoader } from '../../types';

export interface ModrinthSearchResult {
  hits: Array<{
    project_id: string;
    slug: string;
    title: string;
    description: string;
    categories: string[];
    client_side: string;
    server_side: string;
    icon_url: string;
    downloads: number;
    author: string;
  }>;
  total_hits: number;
}

export interface ModrinthVersionFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

export interface ModrinthVersionDependency {
  version_id: string | null;
  project_id: string | null;
  file_name: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: ModrinthVersionFile[];
  dependencies: ModrinthVersionDependency[];
}

export async function searchModrinth(
  query: string,
  gameVersion?: string,
  loader?: MinecraftLoader,
  limit: number = 20,
  offset: number = 0
): Promise<{ mods: ModItem[]; total: number }> {
  const facets: string[][] = [
    ['project_type:mod'],
    ['server_side:required', 'server_side:optional']
  ];

  if (loader && loader !== 'vanilla') {
    // Paper/Purpur use plugins, fabric/forge/neoforge use mods
    const loaderName = loader === 'neoforge' ? 'neoforge' : loader;
    facets.push([`categories:${loaderName}`]);
  }

  if (gameVersion) {
    facets.push([`versions:${gameVersion}`]);
  }

  const facetParam = encodeURIComponent(JSON.stringify(facets));
  const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=${facetParam}&limit=${limit}&offset=${offset}&index=relevance`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GameServerBuilder/1.0.0 (contact@example.com)'
    }
  });

  if (!response.ok) {
    throw new Error(`Modrinth API error: ${response.statusText}`);
  }

  const data: ModrinthSearchResult = await response.json();

  const mods: ModItem[] = data.hits.map(hit => ({
    id: hit.project_id,
    slug: hit.slug,
    name: hit.title,
    summary: hit.description,
    iconUrl: hit.icon_url,
    author: hit.author,
    downloads: hit.downloads,
    provider: 'modrinth',
    installed: false,
    categories: hit.categories,
    websiteUrl: `https://modrinth.com/mod/${hit.slug}`
  }));

  return { mods, total: data.total_hits };
}

export async function getModrinthProjectVersions(
  projectIdOrSlug: string,
  gameVersion?: string,
  loader?: MinecraftLoader
): Promise<ModrinthVersion[]> {
  const params = new URLSearchParams();
  if (loader && loader !== 'vanilla') {
    params.append('loaders', JSON.stringify([loader]));
  }
  if (gameVersion) {
    params.append('game_versions', JSON.stringify([gameVersion]));
  }

  const url = `https://api.modrinth.com/v2/project/${projectIdOrSlug}/version?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GameServerBuilder/1.0.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch versions for ${projectIdOrSlug}`);
  }

  return response.json();
}

export async function getModrinthProject(projectIdOrSlug: string): Promise<any> {
  const url = `https://api.modrinth.com/v2/project/${projectIdOrSlug}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GameServerBuilder/1.0.0'
    }
  });
  if (!response.ok) throw new Error(`Project ${projectIdOrSlug} not found`);
  return response.json();
}
