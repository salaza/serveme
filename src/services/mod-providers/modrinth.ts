import { ModItem, MinecraftLoader, ClientModToDownload } from '../../types';

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

export interface ModCategoryOption {
  id: string;
  name: string;
}

export const POPULAR_MOD_CATEGORIES: ModCategoryOption[] = [
  { id: 'all', name: 'All Categories' },
  { id: 'optimization', name: 'Optimization' },
  { id: 'technology', name: 'Technology' },
  { id: 'magic', name: 'Magic' },
  { id: 'adventure', name: 'Adventure & RPG' },
  { id: 'worldgen', name: 'World Generation' },
  { id: 'storage', name: 'Storage' },
  { id: 'decoration', name: 'Decoration' },
  { id: 'utility', name: 'Utility & Tools' },
  { id: 'management', name: 'Server Management' },
  { id: 'library', name: 'APIs & Libraries' },
  { id: 'equipment', name: 'Equipment' },
  { id: 'economy', name: 'Economy' },
  { id: 'gameplay', name: 'Gameplay' }
];

export async function searchModrinth(
  query: string,
  gameVersion?: string,
  loader?: MinecraftLoader,
  category?: string,
  hideClientOnly: boolean = true,
  limit: number = 20,
  offset: number = 0
): Promise<{ mods: ModItem[]; total: number }> {
  const facets: string[][] = [
    ['project_type:mod']
  ];

  if (hideClientOnly) {
    facets.push(['server_side:required', 'server_side:optional']);
  }

  if (category && category !== 'all') {
    facets.push([`categories:${category}`]);
  }

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
    websiteUrl: `https://modrinth.com/mod/${hit.slug}`,
    serverSide: hit.server_side,
    clientSide: hit.client_side,
    isClientOnly: hit.server_side === 'unsupported'
  }));

  // Extra safety filter in case any unsupported mods slipped through
  const filtered = hideClientOnly ? mods.filter(m => !m.isClientOnly) : mods;

  return { mods: filtered, total: data.total_hits };
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

export async function getModrinthVersion(versionId: string): Promise<ModrinthVersion> {
  const url = `https://api.modrinth.com/v2/version/${versionId}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GameServerBuilder/1.0.0'
    }
  });
  if (!response.ok) throw new Error(`Version ${versionId} not found`);
  return response.json();
}

/**
 * Recursively resolves all required dependencies for a Modrinth version
 */
export async function resolveModDependencies(
  version: ModrinthVersion,
  parentModName: string,
  gameVersion?: string,
  loader?: MinecraftLoader,
  alreadyIncluded: Set<string> = new Set(),
  visitedVersions: Set<string> = new Set()
): Promise<ClientModToDownload[]> {
  const resolvedDeps: ClientModToDownload[] = [];

  if (!version.dependencies || version.dependencies.length === 0) {
    return resolvedDeps;
  }

  if (visitedVersions.has(version.id)) {
    return resolvedDeps;
  }
  visitedVersions.add(version.id);

  const requiredDeps = version.dependencies.filter(d => d.dependency_type === 'required');
  if (requiredDeps.length === 0) return resolvedDeps;

  for (const dep of requiredDeps) {
    let depVersion: ModrinthVersion | null = null;
    let projectId = dep.project_id;

    // 1. If specific version_id is pinned
    if (dep.version_id) {
      try {
        depVersion = await getModrinthVersion(dep.version_id);
        if (depVersion) {
          projectId = depVersion.project_id;
        }
      } catch (err) {
        console.warn('Could not fetch version by version_id:', dep.version_id, err);
      }
    }

    // 2. If project_id is provided and we still need the compatible version
    if (!depVersion && projectId) {
      if (alreadyIncluded.has(projectId.toLowerCase())) {
        continue;
      }

      try {
        const versions = await getModrinthProjectVersions(projectId, gameVersion, loader);
        if (versions.length > 0) {
          depVersion = versions[0];
        }
      } catch (err) {
        console.warn('Could not fetch versions for dependency project:', projectId, err);
      }
    }

    if (!depVersion || !depVersion.files || depVersion.files.length === 0) {
      continue;
    }

    const primaryFile = depVersion.files.find(f => f.primary) || depVersion.files[0];
    if (!primaryFile) continue;

    const cleanFileName = primaryFile.filename.toLowerCase();
    if (alreadyIncluded.has(cleanFileName) || (projectId && alreadyIncluded.has(projectId.toLowerCase()))) {
      continue;
    }

    // Fetch project title and icon
    let projectTitle = depVersion.name;
    let iconUrl: string | undefined = undefined;
    if (projectId) {
      try {
        const proj = await getModrinthProject(projectId);
        if (proj) {
          projectTitle = proj.title || projectTitle;
          iconUrl = proj.icon_url;
          if (proj.slug) {
            alreadyIncluded.add(proj.slug.toLowerCase());
          }
        }
      } catch {}
    }

    alreadyIncluded.add(cleanFileName);
    if (projectId) alreadyIncluded.add(projectId.toLowerCase());

    const clientMod: ClientModToDownload = {
      id: projectId || depVersion.id,
      name: projectTitle,
      fileName: primaryFile.filename,
      downloadUrl: primaryFile.url,
      fileSize: primaryFile.size,
      iconUrl,
      provider: 'modrinth',
      requiredBy: parentModName
    };

    resolvedDeps.push(clientMod);

    // Recursively resolve dependencies of this dependency
    const transitive = await resolveModDependencies(
      depVersion,
      projectTitle,
      gameVersion,
      loader,
      alreadyIncluded,
      visitedVersions
    );
    resolvedDeps.push(...transitive);
  }

  return resolvedDeps;
}

