import React, { useState, useEffect } from 'react';
import { ServerInstance, InstalledMod, AppSettings, ModlistFile } from '../types';
import { ModBrowserModal } from './ModBrowserModal';
import {
  Package,
  Plus,
  Upload,
  Download,
  Trash2,
  FolderOpen,
  Search,
  CheckCircle2,
  XCircle,
  FileJson,
  Loader2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { getModrinthProjectVersions } from '../services/mod-providers/modrinth';

interface ModsTabProps {
  server: ServerInstance;
  settings: AppSettings;
}

export const ModsTab: React.FC<ModsTabProps> = ({ server, settings }) => {
  const [mods, setMods] = useState<InstalledMod[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Batch import progress state
  const [importingBatch, setImportingBatch] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  const fetchMods = async () => {
    setIsLoading(true);
    try {
      const list = await window.electronAPI.getInstalledMods(server.path);
      setMods(list);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMods();
  }, [server.id, server.path]);

  const handleToggle = async (mod: InstalledMod) => {
    try {
      const success = await window.electronAPI.toggleMod(server.path, mod.fileName, !mod.enabled);
      if (success) {
        fetchMods();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (mod: InstalledMod) => {
    if (!confirm(`Are you sure you want to delete ${mod.fileName}?`)) return;
    try {
      const success = await window.electronAPI.deleteMod(server.path, mod.fileName);
      if (success) {
        fetchMods();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportJson = async () => {
    try {
      const filePath = await window.electronAPI.exportModlist(server.path, server.name.toLowerCase().replace(/\s+/g, '-'));
      if (filePath) {
        setMessage({ text: `Modlist exported successfully to: ${filePath}`, type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: `Export failed: ${err.message}`, type: 'error' });
    }
  };

  const handleImportJson = async () => {
    try {
      const imported = await window.electronAPI.importModlist();
      if (!imported) return;

      if (!imported.mods || imported.mods.length === 0) {
        setMessage({ text: 'Selected JSON contains no mods to import.', type: 'error' });
        return;
      }

      setImportingBatch(true);
      setMessage({ text: `Starting import of ${imported.mods.length} mods...`, type: 'info' });

      let count = 0;
      for (const item of imported.mods) {
        count++;
        setImportProgress({ current: count, total: imported.mods.length, name: item.name || item.fileName });

        try {
          if (item.downloadUrl) {
            await window.electronAPI.installMod({
              serverPath: server.path,
              downloadUrl: item.downloadUrl,
              fileName: item.fileName,
              modId: item.id,
              name: item.name
            });
          } else {
            // Resolve from Modrinth
            const versions = await getModrinthProjectVersions(item.id || item.name, server.version, server.loader);
            if (versions.length > 0) {
              const file = versions[0].files.find(f => f.primary) || versions[0].files[0];
              if (file) {
                await window.electronAPI.installMod({
                  serverPath: server.path,
                  downloadUrl: file.url,
                  fileName: file.filename,
                  modId: item.id,
                  name: item.name
                });
              }
            }
          }
        } catch (itemErr) {
          console.warn(`Could not install ${item.name}:`, itemErr);
        }
      }

      await fetchMods();
      setMessage({ text: `Successfully processed import of ${imported.mods.length} mods!`, type: 'success' });
    } catch (err: any) {
      setMessage({ text: `Import failed: ${err.message}`, type: 'error' });
    } finally {
      setImportingBatch(false);
      setImportProgress(null);
    }
  };

  const handleOpenModsFolder = () => {
    const sep = window.navigator.userAgent.includes('Windows') ? '\\' : '/';
    window.electronAPI.openFolder(`${server.path}${sep}mods`);
  };

  const filteredMods = mods.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Bar / Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Package className="w-4 h-4 text-emerald-400" />
            <span>Installed Mods</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 text-xs font-mono">
              {mods.length}
            </span>
          </div>

          <button
            onClick={fetchMods}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white transition hover:bg-slate-800"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleImportJson}
            disabled={importingBatch}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition flex items-center gap-1.5 border border-slate-700"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Import JSON</span>
          </button>

          <button
            onClick={handleExportJson}
            disabled={mods.length === 0}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition flex items-center gap-1.5 border border-slate-700 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={handleOpenModsFolder}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition flex items-center gap-1.5 border border-slate-700"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>Open Folder</span>
          </button>

          <button
            onClick={() => setIsBrowserOpen(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Mods</span>
          </button>
        </div>
      </div>

      {/* Message / Import status banner */}
      {importingBatch && importProgress && (
        <div className="p-3 bg-blue-950/70 border border-blue-800/80 rounded-xl flex items-center gap-3 text-blue-200 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span>Importing ({importProgress.current} / {importProgress.total}): {importProgress.name}</span>
              <span className="font-mono">{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-blue-900/50 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-400 h-full transition-all duration-300"
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
          message.type === 'success'
            ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
            : message.type === 'error'
            ? 'bg-rose-950/60 border-rose-800/80 text-rose-300'
            : 'bg-slate-900 border-slate-800 text-slate-300'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white text-xs ml-2">Dismiss</button>
        </div>
      )}

      {/* Local Filter Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter installed mods..."
          className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
        />
      </div>

      {/* Installed Mods Table */}
      <div className="flex-1 overflow-y-auto bg-slate-950/60 border border-slate-800/80 rounded-xl">
        {filteredMods.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
            <Package className="w-8 h-8 text-slate-600 stroke-1" />
            <p>No mods found in your <span className="font-mono">mods/</span> directory.</p>
            <button
              onClick={() => setIsBrowserOpen(true)}
              className="mt-2 text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Browse and install mods</span>
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-[11px] text-slate-400 border-b border-slate-800 uppercase font-mono tracking-wider sticky top-0">
              <tr>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">File Name</th>
                <th className="py-2.5 px-4">Size</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredMods.map((mod) => (
                <tr key={mod.fileName} className="hover:bg-slate-900/40 transition group">
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleToggle(mod)}
                      className="flex items-center gap-1.5 focus:outline-none"
                      title={mod.enabled ? 'Click to disable' : 'Click to enable'}
                    >
                      {mod.enabled ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-medium text-[11px]">Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-500 font-medium text-[11px]">Disabled</span>
                        </>
                      )}
                    </button>
                  </td>

                  <td className="py-3 px-4 font-mono text-xs">
                    <span className={mod.enabled ? 'text-white' : 'text-slate-500 line-through'}>
                      {mod.fileName}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                    {formatFileSize(mod.fileSize)}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDelete(mod)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                      title="Delete mod"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mod Browser Modal */}
      <ModBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        server={server}
        settings={settings}
        onModInstalled={fetchMods}
      />
    </div>
  );
};
