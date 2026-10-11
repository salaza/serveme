import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ServerInstance, ModItem, ModProvider, AppSettings } from '../types';
import {
  searchModrinth,
  getModrinthProjectVersions,
  POPULAR_MOD_CATEGORIES
} from '../services/mod-providers/modrinth';
import { searchCurseForge, getCurseForgeModFiles } from '../services/mod-providers/curseforge';
import {
  Search,
  Download,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  Layers,
  Filter,
  EyeOff,
  AlertTriangle,
  Server,
  ShieldCheck
} from 'lucide-react';

interface ModBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: ServerInstance;
  settings: AppSettings;
  onModInstalled: () => void;
}

const PAGE_SIZE = 20;

export const ModBrowserModal: React.FC<ModBrowserModalProps> = ({
  isOpen,
  onClose,
  server,
  settings,
  onModInstalled
}) => {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<ModProvider>(settings.preferredModProvider || 'modrinth');
  const [category, setCategory] = useState<string>('all');
  const [hideClientOnly, setHideClientOnly] = useState<boolean>(true);

  // Results & pagination state
  const [results, setResults] = useState<ModItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Installing specific mod state: map of modId -> boolean
  const [installingMods, setInstallingMods] = useState<Record<string, boolean>>({});
  const [installedModIds, setInstalledModIds] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch mods function
  const fetchMods = useCallback(
    async (searchTerm: string, currentCategory: string, hideClient: boolean, currentProvider: ModProvider, fetchOffset: number, isInitial: boolean) => {
      if (isInitial) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        let fetchedMods: ModItem[] = [];
        let total = 0;

        if (currentProvider === 'modrinth') {
          const res = await searchModrinth(
            searchTerm,
            server.version,
            server.loader,
            currentCategory,
            hideClient,
            PAGE_SIZE,
            fetchOffset
          );
          fetchedMods = res.mods;
          total = res.total;
        } else {
          if (!settings.curseForgeApiKey) {
            throw new Error(
              'CurseForge API Key is not configured. Add your key in Global Settings or switch to Modrinth (open & keyless).'
            );
          }
          const res = await searchCurseForge(
            searchTerm,
            settings.curseForgeApiKey,
            server.version,
            server.loader,
            currentCategory,
            hideClient,
            PAGE_SIZE,
            fetchOffset
          );
          fetchedMods = res.mods;
          total = res.total;
        }

        if (isInitial) {
          setResults(fetchedMods);
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
          }
        } else {
          setResults((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newUnique = fetchedMods.filter((m) => !existingIds.has(m.id));
            return [...prev, ...newUnique];
          });
        }

        setTotalCount(total);
        const newOffset = fetchOffset + fetchedMods.length;
        setOffset(newOffset);
        setHasMore(newOffset < total && fetchedMods.length > 0);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to search mods');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [server.version, server.loader, settings.curseForgeApiKey]
  );

  // Trigger search on mount and when filters change
  useEffect(() => {
    if (isOpen) {
      setOffset(0);
      setHasMore(true);
      fetchMods(query, category, hideClientOnly, provider, 0, true);
    }
  }, [isOpen, provider, category, hideClientOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setHasMore(true);
    fetchMods(query, category, hideClientOnly, provider, 0, true);
  };

  // Infinite scroll trigger
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (isLoading || isLoadingMore || !hasMore) return;

    // Trigger load when scrolled within 200px of bottom
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 200) {
      fetchMods(query, category, hideClientOnly, provider, offset, false);
    }
  };

  const handleInstallMod = async (mod: ModItem) => {
    setInstallingMods((prev) => ({ ...prev, [mod.id]: true }));
    setStatusMessage(`Resolving compatible version for ${mod.name}...`);

    try {
      if (mod.provider === 'modrinth') {
        const versions = await getModrinthProjectVersions(mod.id, server.version, server.loader);
        if (versions.length === 0) {
          throw new Error(`No compatible version found for Minecraft ${server.version} with loader ${server.loader}`);
        }

        const targetVersion = versions[0];
        const primaryFile = targetVersion.files.find((f) => f.primary) || targetVersion.files[0];
        if (!primaryFile) throw new Error('No downloadable file in release');

        setStatusMessage(`Downloading ${primaryFile.filename}...`);
        const installRes = await window.electronAPI.installMod({
          serverPath: server.path,
          downloadUrl: primaryFile.url,
          fileName: primaryFile.filename,
          modId: mod.id,
          name: mod.name
        });

        if (!installRes.success) throw new Error(installRes.error || 'Failed to save mod');

        // Check for required dependencies (like Fabric API, Architectury, etc.)
        if (targetVersion.dependencies && targetVersion.dependencies.length > 0) {
          for (const dep of targetVersion.dependencies) {
            if (dep.dependency_type === 'required' && dep.project_id) {
              try {
                setStatusMessage(`Resolving required dependency (${dep.project_id})...`);
                const depVersions = await getModrinthProjectVersions(dep.project_id, server.version, server.loader);
                if (depVersions.length > 0) {
                  const depFile = depVersions[0].files.find((f) => f.primary) || depVersions[0].files[0];
                  if (depFile) {
                    await window.electronAPI.installMod({
                      serverPath: server.path,
                      downloadUrl: depFile.url,
                      fileName: depFile.filename,
                      modId: dep.project_id
                    });
                  }
                }
              } catch (depErr) {
                console.warn('Could not auto-install dependency:', depErr);
              }
            }
          }
        }
      } else {
        // CurseForge installation
        const files = await getCurseForgeModFiles(mod.id, settings.curseForgeApiKey, server.version, server.loader);
        if (files.length === 0) {
          throw new Error(`No compatible file found on CurseForge for ${server.version}`);
        }
        const file = files[0];
        if (!file.downloadUrl) {
          throw new Error('This mod author has disabled third-party downloads on CurseForge');
        }

        setStatusMessage(`Downloading ${file.fileName}...`);
        const installRes = await window.electronAPI.installMod({
          serverPath: server.path,
          downloadUrl: file.downloadUrl,
          fileName: file.fileName,
          modId: mod.id,
          name: mod.name
        });

        if (!installRes.success) throw new Error(installRes.error);
      }

      setInstalledModIds((prev) => new Set(prev).add(mod.id));
      setStatusMessage(`Installed ${mod.name} successfully!`);
      onModInstalled();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to install mod');
    } finally {
      setInstallingMods((prev) => ({ ...prev, [mod.id]: false }));
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Mod Browser & Installer</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Targeting <span className="text-emerald-400 font-mono font-semibold capitalize">{server.loader}</span> for Minecraft{' '}
              <span className="text-emerald-400 font-mono font-semibold">{server.version}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search, Category, Provider, and Client-Only Filter Bar */}
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search mods (e.g. Lithium, Chunky, Essentials, Dynmap)..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-20 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
              >
                Search
              </button>
            </form>

            {/* Provider Toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setProvider('modrinth')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  provider === 'modrinth'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Modrinth</span>
                <span className="text-[9px] px-1 py-0.2 bg-emerald-700 rounded text-emerald-100 font-normal">Free</span>
              </button>
              <button
                type="button"
                onClick={() => setProvider('curseforge')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  provider === 'curseforge'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>CurseForge</span>
              </button>
            </div>
          </div>

          {/* Sub-Filters: Category Selector + Hide Client-Only Checkbox */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                <Filter className="w-3.5 h-3.5 text-emerald-400" />
                Category:
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              >
                {POPULAR_MOD_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Hide Client-Only Mods Toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs select-none bg-slate-900/90 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-xl transition">
              <input
                type="checkbox"
                checked={hideClientOnly}
                onChange={(e) => setHideClientOnly(e.target.checked)}
                className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
              />
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hide Client-Only Mods</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">(Dedicated server recommended)</span>
            </label>
          </div>
        </div>

        {/* Status / Error Banner */}
        {statusMessage && (
          <div className="bg-emerald-950/60 border-b border-emerald-800/60 px-4 py-2 text-xs text-emerald-300 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}
        {error && (
          <div className="bg-rose-950/60 border-b border-rose-800/60 px-4 py-2 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Mod List with Infinite Scrolling */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-xs">Searching mods from {provider === 'modrinth' ? 'Modrinth' : 'CurseForge'}...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-24 text-slate-500 text-xs">
              <p>No mods found matching your query and filters.</p>
              {hideClientOnly && (
                <button
                  type="button"
                  onClick={() => setHideClientOnly(false)}
                  className="mt-2 text-emerald-400 hover:underline"
                >
                  Try unchecking &quot;Hide Client-Only Mods&quot;
                </button>
              )}
            </div>
          ) : (
            <>
              {results.map((mod) => {
                const isInstalling = installingMods[mod.id];
                const isInstalled = installedModIds.has(mod.id);

                return (
                  <div
                    key={`${mod.provider}-${mod.id}`}
                    className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl hover:border-slate-700/80 transition flex items-start gap-4"
                  >
                    {/* Mod Icon */}
                    {mod.iconUrl ? (
                      <img
                        src={mod.iconUrl}
                        alt={mod.name}
                        className="w-12 h-12 rounded-xl object-cover bg-slate-900 border border-slate-800 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                        <Sparkles className="w-5 h-5 text-slate-500" />
                      </div>
                    )}

                    {/* Mod Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-white truncate">{mod.name}</h3>
                        <span className="text-[10px] text-slate-500 font-medium">by {mod.author}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">
                          {mod.provider}
                        </span>

                        {/* Environment badges */}
                        {mod.isClientOnly ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 flex items-center gap-1 font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Client Only</span>
                          </span>
                        ) : mod.serverSide === 'required' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Server Required</span>
                          </span>
                        ) : mod.serverSide === 'optional' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/70 text-blue-400 border border-blue-800/40">
                            Server Optional
                          </span>
                        ) : null}
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-2">
                        {mod.summary}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-mono">
                          {(mod.downloads || 0).toLocaleString()} downloads
                        </span>
                        {mod.categories?.slice(0, 4).map((cat) => (
                          <span
                            key={cat}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 capitalize"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Install Button & External Link */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        onClick={() => handleInstallMod(mod)}
                        disabled={isInstalling}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                          isInstalled
                            ? 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-400'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                        }`}
                      >
                        {isInstalling ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Installing...</span>
                          </>
                        ) : isInstalled ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Installed</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Install</span>
                          </>
                        )}
                      </button>

                      {mod.websiteUrl && (
                        <a
                          href={mod.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
                        >
                          <span>View Page</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Infinite Scroll Indicator */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-6 text-slate-400 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Loading more mods...</span>
                </div>
              )}

              {!hasMore && results.length > 0 && (
                <div className="text-center py-6 text-slate-500 text-xs border-t border-slate-800/60 mt-4">
                  Showing all {results.length} mods
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
