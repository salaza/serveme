import React, { useState, useEffect } from 'react';
import {
  ServerInstance,
  InstalledMod,
  AppSettings,
  ClientModToDownload,
  LocalClientMod,
  ModItem,
  ExportModpackResult
} from '../types';
import { searchModrinth, getModrinthProjectVersions } from '../services/mod-providers/modrinth';
import {
  Package,
  X,
  Download,
  Search,
  Plus,
  Trash2,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileArchive,
  Layers,
  Sparkles,
  Info,
  CheckSquare,
  Square,
  FileCode,
  HardDrive,
  Copy,
  ExternalLink,
  Zap
} from 'lucide-react';

interface ExportModpackModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: ServerInstance;
  installedMods: InstalledMod[];
  settings: AppSettings;
}

const POPULAR_CLIENT_SHORTCUTS = [
  { name: 'Sodium', query: 'Sodium', icon: '⚡' },
  { name: 'Iris (Shaders)', query: 'Iris Shaders', icon: '✨' },
  { name: 'Xaero\'s Minimap', query: 'Xaeros Minimap', icon: '🗺️' },
  { name: 'Xaero\'s World Map', query: 'Xaeros World Map', icon: '🗺️' },
  { name: 'AppleSkin', query: 'AppleSkin', icon: '🍎' },
  { name: 'Mod Menu', query: 'Mod Menu', icon: '📜' },
  { name: 'JEI', query: 'Just Enough Items', icon: '🔍' },
  { name: 'Zoomify', query: 'Zoomify', icon: '🔎' },
  { name: 'Controlling', query: 'Controlling', icon: '🎮' },
  { name: 'FerriteCore', query: 'FerriteCore', icon: '🚀' }
];

export const ExportModpackModal: React.FC<ExportModpackModalProps> = ({
  isOpen,
  onClose,
  server,
  installedMods,
  settings
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'serverMods' | 'clientMods'>('settings');

  // Modpack details
  const [packName, setPackName] = useState(`${server.name} Client Pack`);
  const [packVersion, setPackVersion] = useState('1.0.0');
  const [packNotes, setPackNotes] = useState(`Client modpack for ${server.name} (Minecraft ${server.version}, ${server.loader})`);
  const [includeConfigs, setIncludeConfigs] = useState(true);

  // Server mods selection
  const [selectedServerMods, setSelectedServerMods] = useState<Set<string>>(new Set());
  const [serverModSearch, setServerModSearch] = useState('');

  // Client mods to add
  const [clientModsToDownload, setClientModsToDownload] = useState<ClientModToDownload[]>([]);
  const [localClientMods, setLocalClientMods] = useState<LocalClientMod[]>([]);

  // Search state for client mods
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<ModItem[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [clientSearchError, setClientSearchError] = useState<string | null>(null);
  const [resolvingModId, setResolvingModId] = useState<string | null>(null);

  // Export progress & result
  const [isExporting, setIsExporting] = useState(false);
  const [exportStep, setExportStep] = useState<string>('');
  const [exportResult, setExportResult] = useState<ExportModpackResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Initialize selected server mods when modal opens
  useEffect(() => {
    if (isOpen) {
      const enabledFiles = installedMods
        .filter(m => m.enabled)
        .map(m => m.fileName);
      setSelectedServerMods(new Set(enabledFiles));
      setPackName(`${server.name} Client Pack`);
      setExportResult(null);
      setStatusMessage(null);
    }
  }, [isOpen, server.id, installedMods]);

  if (!isOpen) return null;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  const handleToggleServerMod = (fileName: string) => {
    setSelectedServerMods(prev => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  };

  const handleSelectAllServerMods = () => {
    const all = installedMods.map(m => m.fileName);
    setSelectedServerMods(new Set(all));
  };

  const handleDeselectAllServerMods = () => {
    setSelectedServerMods(new Set());
  };

  // Search client mods on Modrinth
  const handleSearchClientMods = async (queryToSearch: string) => {
    const term = queryToSearch.trim();
    if (!term) return;

    setIsSearchingClient(true);
    setClientSearchError(null);

    try {
      // Pass hideClientOnly = false so client mods (Sodium, Iris, etc.) appear
      const res = await searchModrinth(
        term,
        server.version,
        server.loader,
        'all',
        false,
        15,
        0
      );
      setClientSearchResults(res.mods);
      if (res.mods.length === 0) {
        setClientSearchError('No matching mods found for this game version and loader.');
      }
    } catch (err: any) {
      setClientSearchError(err.message || 'Failed to search mods.');
    } finally {
      setIsSearchingClient(false);
    }
  };

  // Add a mod from search to client mods list
  const handleAddClientModFromSearch = async (mod: ModItem) => {
    setResolvingModId(mod.id);
    try {
      const versions = await getModrinthProjectVersions(mod.id, server.version, server.loader);
      if (versions.length === 0) {
        setStatusMessage({
          text: `No compatible version file found for ${mod.name} on MC ${server.version} (${server.loader}).`,
          type: 'error'
        });
        return;
      }

      // Pick newest version and primary file
      const latestVer = versions[0];
      const primaryFile = latestVer.files.find(f => f.primary) || latestVer.files[0];
      if (!primaryFile) {
        setStatusMessage({ text: `No download file found for ${mod.name}.`, type: 'error' });
        return;
      }

      // Check if already in list
      const alreadyAdded = clientModsToDownload.some(m => m.id === mod.id || m.fileName === primaryFile.filename);
      if (alreadyAdded) {
        setStatusMessage({ text: `${mod.name} is already in the client mods list.`, type: 'info' });
        return;
      }

      const newClientMod: ClientModToDownload = {
        id: mod.id,
        name: mod.name,
        fileName: primaryFile.filename,
        downloadUrl: primaryFile.url,
        fileSize: primaryFile.size,
        iconUrl: mod.iconUrl,
        provider: 'modrinth'
      };

      setClientModsToDownload(prev => [...prev, newClientMod]);
      setStatusMessage({ text: `Added ${mod.name} to client mods!`, type: 'success' });
    } catch (err: any) {
      setStatusMessage({ text: `Failed to resolve mod file: ${err.message}`, type: 'error' });
    } finally {
      setResolvingModId(null);
    }
  };

  // Add local .jar files
  const handleAddLocalJars = async () => {
    try {
      const selected = await window.electronAPI.selectJarFiles();
      if (!selected || selected.length === 0) return;

      const existingPaths = new Set(localClientMods.map(m => m.path));
      const newItems = selected.filter(s => !existingPaths.has(s.path));

      setLocalClientMods(prev => [...prev, ...newItems]);
      setStatusMessage({ text: `Added ${newItems.length} local mod(s).`, type: 'success' });
    } catch (err: any) {
      setStatusMessage({ text: `Failed to add local jars: ${err.message}`, type: 'error' });
    }
  };

  const handleRemoveClientMod = (fileName: string) => {
    setClientModsToDownload(prev => prev.filter(m => m.fileName !== fileName));
  };

  const handleRemoveLocalMod = (path: string) => {
    setLocalClientMods(prev => prev.filter(m => m.path !== path));
  };

  // Trigger export
  const handleExport = async () => {
    const totalCount = selectedServerMods.size + clientModsToDownload.length + localClientMods.length;
    if (totalCount === 0) {
      alert('Please select at least one server mod or client mod to include in the modpack.');
      return;
    }

    const sanitizedBase = packName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_') || 'modpack';
    const chosenPath = await window.electronAPI.saveZipFileDialog(`${sanitizedBase}.zip`);
    if (!chosenPath) return;

    setIsExporting(true);
    setExportStep('Preparing files and configs...');

    try {
      const result = await window.electronAPI.exportModpack({
        serverId: server.id,
        packName: packName.trim() || server.name,
        packVersion: packVersion.trim() || '1.0.0',
        packNotes: packNotes.trim(),
        includeConfigs,
        selectedServerModFiles: Array.from(selectedServerMods),
        clientModsToDownload,
        localClientModPaths: localClientMods.map(m => m.path),
        outputPath: chosenPath
      });

      setIsExporting(false);
      setExportResult(result);
    } catch (err: any) {
      setIsExporting(false);
      setExportResult({ success: false, error: err.message || 'Export failed' });
    }
  };

  const filteredServerMods = installedMods.filter(m =>
    m.name.toLowerCase().includes(serverModSearch.toLowerCase()) ||
    m.fileName.toLowerCase().includes(serverModSearch.toLowerCase())
  );

  const totalSelectedMods = selectedServerMods.size + clientModsToDownload.length + localClientMods.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Export Modpack for Friends
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  Prism Launcher & MultiMC
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generates an importable <span className="font-mono text-slate-300">.zip</span> instance bundle for {server.name} (MC {server.version}, {server.loader})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        {!exportResult && (
          <div className="px-6 bg-slate-900/90 border-b border-slate-800 flex items-center gap-2 pt-2">
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>1. Modpack Details</span>
            </button>

            <button
              onClick={() => setActiveTab('serverMods')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition flex items-center gap-2 ${
                activeTab === 'serverMods'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>2. Server Mods</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 font-mono text-slate-300">
                {selectedServerMods.size}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('clientMods')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition flex items-center gap-2 ${
                activeTab === 'clientMods'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>3. Add Client Mods</span>
              {(clientModsToDownload.length > 0 || localClientMods.length > 0) && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                  {clientModsToDownload.length + localClientMods.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Status Toast message */}
        {statusMessage && (
          <div className="mx-6 mt-3 p-2.5 rounded-lg flex items-center justify-between text-xs border animate-in fade-in"
               style={{
                 backgroundColor: statusMessage.type === 'success' ? '#064e3b40' : statusMessage.type === 'error' ? '#88133740' : '#1e3a5f40',
                 borderColor: statusMessage.type === 'success' ? '#05966960' : statusMessage.type === 'error' ? '#e11d4860' : '#3b82f660',
                 color: statusMessage.type === 'success' ? '#6ee7b7' : statusMessage.type === 'error' ? '#fda4af' : '#93c5fd'
               }}>
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
              {statusMessage.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* SUCCESS SCREEN */}
          {exportResult && exportResult.success && (
            <div className="py-6 px-4 text-center max-w-xl mx-auto space-y-5 animate-in fade-in">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/50">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">Modpack Generated Successfully!</h3>
                <p className="text-sm text-slate-300 mt-1">
                  Packed <span className="text-emerald-400 font-semibold">{exportResult.modsCount} mods</span> into a ready-to-share ZIP instance archive.
                </p>
              </div>

              {exportResult.outputPath && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-left">
                  <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Output Location</span>
                  <div className="text-xs font-mono text-emerald-300 break-all mt-1">
                    {exportResult.outputPath}
                  </div>
                </div>
              )}

              {/* Instructions for Friends */}
              <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 text-left space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>How your friends import it</span>
                </div>
                <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Send this <code className="text-emerald-400 font-mono">.zip</code> file to your friend (via Discord, Google Drive, USB, etc.).
                  </li>
                  <li>
                    In <span className="text-white font-medium">Prism Launcher</span> or <span className="text-white font-medium">MultiMC</span>, click <span className="text-emerald-400 font-semibold">Add Instance</span>.
                  </li>
                  <li>
                    Select <span className="text-emerald-400 font-semibold">Import from zip</span> and choose this file.
                  </li>
                  <li>
                    Click <span className="text-white font-medium">OK</span> — Prism/MultiMC automatically installs Minecraft {server.version}, {server.loader}, all mods, and configs!
                  </li>
                </ol>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                {exportResult.outputPath && (
                  <button
                    onClick={() => window.electronAPI.showItemInFolder(exportResult.outputPath!)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                    <span>Show in Folder</span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-emerald-950/40"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* ERROR SCREEN */}
          {exportResult && !exportResult.success && (
            <div className="py-8 text-center max-w-lg mx-auto space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Export Failed</h3>
              <p className="text-xs text-rose-300 font-mono p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl break-all">
                {exportResult.error || 'An unexpected error occurred.'}
              </p>
              <button
                onClick={() => setExportResult(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-xl border border-slate-700"
              >
                Go Back & Try Again
              </button>
            </div>
          )}

          {/* TAB 1: MODPACK SETTINGS */}
          {!exportResult && activeTab === 'settings' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Modpack Display Name
                  </label>
                  <input
                    type="text"
                    value={packName}
                    onChange={e => setPackName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                    placeholder="e.g. Survival SMP Pack"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    This name will appear as the instance title in Prism Launcher or MultiMC.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Modpack Version
                  </label>
                  <input
                    type="text"
                    value={packVersion}
                    onChange={e => setPackVersion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                    placeholder="1.0.0"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Increment this version when releasing updates to friends.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Modpack Notes / Instructions for Friends
                </label>
                <textarea
                  value={packNotes}
                  onChange={e => setPackNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 transition resize-none"
                  placeholder="Notes or instructions displayed in the launcher instance..."
                />
              </div>

              {/* Include Configs Toggle */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="includeConfigs"
                  checked={includeConfigs}
                  onChange={e => setIncludeConfigs(e.target.checked)}
                  className="mt-1 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <div>
                  <label htmlFor="includeConfigs" className="text-xs font-semibold text-white cursor-pointer select-none">
                    Include Server Mod Configurations (<span className="font-mono text-emerald-400">config/</span> folder)
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Recommended. Automatically copies mod configs so friends have synced keybinds, HUD positions, and custom mod mechanics matching the server.
                  </p>
                </div>
              </div>

              {/* Instance summary specs */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-slate-900/60 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Minecraft</span>
                  <div className="text-xs font-semibold text-white mt-0.5">{server.version}</div>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Loader</span>
                  <div className="text-xs font-semibold text-white mt-0.5 capitalize">
                    {server.loader} {server.loaderVersion || ''}
                  </div>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Total Mods</span>
                  <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                    {totalSelectedMods} Mods
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SERVER MODS SELECTION */}
          {!exportResult && activeTab === 'serverMods' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={serverModSearch}
                    onChange={e => setServerModSearch(e.target.value)}
                    placeholder="Filter server mods..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllServerMods}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAllServerMods}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60 max-h-[380px] overflow-y-auto">
                {filteredServerMods.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No mods match your search.
                  </div>
                ) : (
                  filteredServerMods.map(mod => {
                    const isSelected = selectedServerMods.has(mod.fileName);
                    return (
                      <div
                        key={mod.fileName}
                        onClick={() => handleToggleServerMod(mod.fileName)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition ${
                          isSelected ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'bg-slate-900/40 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="text-emerald-400"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                          <div>
                            <div className="text-xs font-semibold text-white">{mod.name}</div>
                            <div className="text-[11px] font-mono text-slate-500">{mod.fileName}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-mono text-slate-400">{formatFileSize(mod.fileSize)}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            isSelected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {isSelected ? 'Included' : 'Excluded'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CLIENT MODS SECTION */}
          {!exportResult && activeTab === 'clientMods' && (
            <div className="space-y-5 animate-in fade-in">
              {/* Quick info banner */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Client-Only Mods</span>
                  <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                    Add performance mods (Sodium/Iris), HUD maps, or UI tweaks for your friends without installing them on the server.
                  </p>
                </div>
              </div>

              {/* Quick shortcut pills */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Quick Add Popular Client Mods
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_CLIENT_SHORTCUTS.map(sc => (
                    <button
                      key={sc.name}
                      type="button"
                      onClick={() => {
                        setClientSearchQuery(sc.query);
                        handleSearchClientMods(sc.query);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 flex items-center gap-1.5 transition"
                    >
                      <span>{sc.icon}</span>
                      <span>{sc.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar & Local file button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onChange={e => setClientSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSearchClientMods(clientSearchQuery);
                    }}
                    placeholder={`Search client mods for MC ${server.version} (${server.loader})...`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-20 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                  <button
                    onClick={() => handleSearchClientMods(clientSearchQuery)}
                    disabled={isSearchingClient || !clientSearchQuery.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition"
                  >
                    {isSearchingClient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddLocalJars}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5 shrink-0"
                  title="Browse local .jar files on your PC"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Add Local .jar</span>
                </button>
              </div>

              {/* Search Results Display */}
              {isSearchingClient && (
                <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Searching Modrinth for compatible client mods...</span>
                </div>
              )}

              {clientSearchError && !isSearchingClient && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 text-center">
                  {clientSearchError}
                </div>
              )}

              {clientSearchResults.length > 0 && !isSearchingClient && (
                <div className="border border-slate-800 rounded-xl divide-y divide-slate-800/60 max-h-[220px] overflow-y-auto bg-slate-950/40">
                  {clientSearchResults.map(hit => {
                    const isAdded = clientModsToDownload.some(m => m.id === hit.id);
                    const isResolving = resolvingModId === hit.id;

                    return (
                      <div key={hit.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          {hit.iconUrl ? (
                            <img src={hit.iconUrl} alt={hit.name} className="w-8 h-8 rounded-lg object-contain bg-slate-900 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 font-bold shrink-0">
                              {hit.name[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{hit.name}</div>
                            <div className="text-[11px] text-slate-400 truncate">{hit.summary}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddClientModFromSearch(hit)}
                          disabled={isAdded || isResolving}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition shrink-0 flex items-center gap-1.5 ${
                            isAdded
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 cursor-default'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                          }`}
                        >
                          {isResolving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isAdded ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add to Pack</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* LIST OF CURRENTLY ADDED CLIENT MODS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Selected Client Mods ({clientModsToDownload.length + localClientMods.length})</span>
                  </span>
                </div>

                {clientModsToDownload.length === 0 && localClientMods.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                    No client-only mods added yet. Search above or click "Add Local .jar" to bundle client mods like Sodium, Iris, or Minimap.
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-xl divide-y divide-slate-800/60 max-h-[220px] overflow-y-auto">
                    {/* Downloaded from Search */}
                    {clientModsToDownload.map(mod => (
                      <div key={mod.fileName} className="p-3 flex items-center justify-between gap-3 bg-slate-900/60 hover:bg-slate-800/40 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          {mod.iconUrl ? (
                            <img src={mod.iconUrl} alt={mod.name} className="w-7 h-7 rounded-lg object-contain bg-slate-950 shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                              ⚡
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate flex items-center gap-2">
                              <span>{mod.name}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/25">
                                Modrinth
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 truncate">{mod.fileName}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-400">{formatFileSize(mod.fileSize)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveClientMod(mod.fileName)}
                            className="p-1 hover:bg-rose-950/60 hover:text-rose-400 text-slate-500 rounded transition"
                            title="Remove from client mods"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Local Files */}
                    {localClientMods.map(mod => (
                      <div key={mod.path} className="p-3 flex items-center justify-between gap-3 bg-slate-900/60 hover:bg-slate-800/40 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                            💾
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate flex items-center gap-2">
                              <span>{mod.name}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/15 text-purple-400 border border-purple-500/25">
                                Local File
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 truncate">{mod.fileName}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-400">{formatFileSize(mod.fileSize)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLocalMod(mod.path)}
                            className="p-1 hover:bg-rose-950/60 hover:text-rose-400 text-slate-500 rounded transition"
                            title="Remove from client mods"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!exportResult && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold text-white">{selectedServerMods.size}</span> server mods
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-white">{clientModsToDownload.length + localClientMods.length}</span> client mods
              </span>
              <span>&bull;</span>
              <span>
                Configs: <span className={includeConfigs ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>{includeConfigs ? 'Included' : 'None'}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isExporting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || totalSelectedMods === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-emerald-950/40 flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{exportStep || 'Exporting Modpack...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Export Modpack ZIP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
