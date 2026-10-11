import React, { useState, useEffect } from 'react';
import { ServerInstance, GModAddonInfo } from '../types';
import {
  Package,
  FolderOpen,
  RotateCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Folder,
  FileCode,
  Layers,
  ExternalLink,
  Info,
  Search,
  HardDrive
} from 'lucide-react';

interface GModAddonsTabProps {
  server: ServerInstance;
}

export const GModAddonsTab: React.FC<GModAddonsTabProps> = ({ server }) => {
  const [addons, setAddons] = useState<GModAddonInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingFile, setTogglingFile] = useState<string | null>(null);

  const loadAddons = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getGModAddons(server.path);
      setAddons(data);
    } catch (err) {
      console.error('Failed to load GMod addons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddons();
  }, [server.path]);

  const handleToggle = async (addon: GModAddonInfo) => {
    setTogglingFile(addon.fileName);
    try {
      const success = await window.electronAPI.toggleGModAddon(
        server.path,
        addon.fileName,
        !addon.enabled
      );
      if (success) {
        await loadAddons();
      }
    } catch (err) {
      console.error('Failed to toggle addon:', err);
    } finally {
      setTogglingFile(null);
    }
  };

  const handleDelete = async (addon: GModAddonInfo) => {
    const confirmDelete = confirm(`Are you sure you want to permanently delete "${addon.name}"?`);
    if (!confirmDelete) return;

    try {
      const success = await window.electronAPI.deleteGModAddon(server.path, addon.fileName);
      if (success) {
        await loadAddons();
      } else {
        alert('Failed to delete addon');
      }
    } catch (err: any) {
      alert(`Error deleting addon: ${err.message}`);
    }
  };

  const handleOpenAddonsFolder = () => {
    const sep = window.navigator.userAgent.includes('Windows') ? '\\' : '/';
    window.electronAPI.openFolder(`${server.path}${sep}garrysmod${sep}addons`);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredAddons = addons.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Workshop Collection Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Steam Workshop Collection</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Recommended for GMod
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Garry&apos;s Mod servers automatically download workshop maps, gamemodes, and addons via Workshop Collections at launch.
            </p>
            {server.gmodConfig?.workshopCollectionId ? (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-300 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  Collection ID: {server.gmodConfig.workshopCollectionId}
                </span>
                <button
                  onClick={() => window.electronAPI.openExternalUrl(`https://steamcommunity.com/sharedfiles/filedetails/?id=${server.gmodConfig?.workshopCollectionId}`)}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View on Steam Workshop</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-400/90 mt-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>No Workshop Collection configured. You can configure one in the Server Config tab.</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Local Addons Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search local addons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-56 transition"
            />
          </div>
          <span className="text-xs text-slate-400">
            {filteredAddons.length} {filteredAddons.length === 1 ? 'addon' : 'addons'} installed
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAddons}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleOpenAddonsFolder}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open Addons Folder</span>
          </button>
        </div>
      </div>

      {/* Addons List */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
            <RotateCw className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs">Scanning garrysmod/addons directory...</span>
          </div>
        ) : filteredAddons.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-3">
            <Package className="w-12 h-12 text-slate-600 stroke-1" />
            <div>
              <p className="text-sm font-semibold text-slate-300">
                {searchQuery ? 'No matching addons found' : 'No local addons installed'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                {searchQuery
                  ? 'Try adjusting your search query.'
                  : 'Place .gma addon files or extracted addon folders directly into the garrysmod/addons folder, or configure a Steam Workshop Collection.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={handleOpenAddonsFolder}
                className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition"
              >
                <FolderOpen className="w-4 h-4 text-emerald-400" />
                <span>Open garrysmod/addons Folder</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {filteredAddons.map((addon) => {
              const isToggling = togglingFile === addon.fileName;
              return (
                <div
                  key={addon.fileName}
                  className={`px-4 py-3 flex items-center justify-between gap-4 transition hover:bg-slate-800/40 ${
                    !addon.enabled ? 'opacity-60 bg-slate-950/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        addon.isFolder
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {addon.isFolder ? <Folder className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">{addon.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                          {addon.isFolder ? 'Folder' : '.gma'}
                        </span>
                        {!addon.enabled && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Disabled
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                        <span>{addon.fileName}</span>
                        <span>&bull;</span>
                        <span>{formatSize(addon.sizeBytes)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggle(addon)}
                      disabled={isToggling}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                        addon.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'
                      }`}
                      title={addon.enabled ? 'Click to disable' : 'Click to enable'}
                    >
                      {addon.enabled ? (
                        <>
                          <ToggleRight className="w-4 h-4 text-emerald-400" />
                          <span>Enabled</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4 text-slate-500" />
                          <span>Disabled</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(addon)}
                      className="p-1.5 rounded-lg border border-slate-800 hover:bg-rose-950/60 hover:text-rose-400 hover:border-rose-900/60 text-slate-400 transition"
                      title="Delete Addon"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
