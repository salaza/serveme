import React, { useState, useEffect, useCallback } from 'react';
import { ServerInstance, WorldInfo, WorldBackup, CreateWorldOptions, RegenerateWorldOptions } from '../types';
import {
  Globe,
  Archive,
  RefreshCw,
  Plus,
  Copy,
  Trash2,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Dices,
  Clock,
  Layers,
  Check,
  X,
  FileArchive,
  RotateCcw,
  Compass,
  Mountain
} from 'lucide-react';

interface WorldsTabProps {
  server: ServerInstance;
  onServerUpdated: (server: ServerInstance) => void;
  isServerRunning: boolean;
}

// Helpers for seed randomization
const SEED_ADJECTIVES = [
  'ancient', 'cosmic', 'crimson', 'emerald', 'frozen', 'golden', 'hidden', 'mystic',
  'silent', 'whispering', 'shadow', 'celestial', 'crystal', 'wild', 'infinite', 'radiant',
  'dark', 'abyssal', 'stormy', 'verdant', 'blazing', 'lunar', 'obsidian', 'spectral'
];
const SEED_NOUNS = [
  'valley', 'peak', 'canyon', 'forest', 'ocean', 'spire', 'glade', 'tundra',
  'cavern', 'realm', 'citadel', 'sanctuary', 'badlands', 'archipelago', 'jungle',
  'bastion', 'summit', 'oasis', 'crater', 'highland', 'haven', 'horizon'
];
const SEED_CREATURES = [
  'dragon', 'phoenix', 'wolf', 'titan', 'voyager', 'aurora', 'ember',
  'tempest', 'blossom', 'monolith', 'beacon', 'echo', 'wanderer'
];

function generateRandomNumericSeed(): string {
  const high = BigInt(Math.floor(Math.random() * 0xffffffff));
  const low = BigInt(Math.floor(Math.random() * 0xffffffff));
  const sign = Math.random() < 0.5 ? -1n : 1n;
  const raw = ((high << 32n) | low) % 9223372036854775807n;
  return (raw * sign).toString();
}

function generateRandomWordSeed(): string {
  const a = SEED_ADJECTIVES[Math.floor(Math.random() * SEED_ADJECTIVES.length)];
  const b = (Math.random() < 0.5 ? SEED_ADJECTIVES : SEED_CREATURES)[
    Math.floor(Math.random() * (Math.random() < 0.5 ? SEED_ADJECTIVES.length : SEED_CREATURES.length))
  ];
  const c = SEED_NOUNS[Math.floor(Math.random() * SEED_NOUNS.length)];
  return `${a}-${b}-${c}`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const WorldsTab: React.FC<WorldsTabProps> = ({ server, onServerUpdated, isServerRunning }) => {
  const [activeSubView, setActiveSubView] = useState<'worlds' | 'backups'>('worlds');
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [activeWorldName, setActiveWorldName] = useState('world');
  const [backups, setBackups] = useState<WorldBackup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Modals state
  const [regenTargetWorld, setRegenTargetWorld] = useState<string | null>(null);
  const [regenSeed, setRegenSeed] = useState('');
  const [regenAutoBackup, setRegenAutoBackup] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorldName, setNewWorldName] = useState('');
  const [newWorldSeed, setNewWorldSeed] = useState('');
  const [newWorldType, setNewWorldType] = useState('minecraft:normal');
  const [newWorldDifficulty, setNewWorldDifficulty] = useState('easy');
  const [newWorldHardcore, setNewWorldHardcore] = useState(false);
  const [newWorldSwitchActive, setNewWorldSwitchActive] = useState(true);

  const [dupSourceWorld, setDupSourceWorld] = useState<string | null>(null);
  const [dupTargetName, setDupTargetName] = useState('');

  const [backupTargetWorld, setBackupTargetWorld] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState('');

  const [restoreTargetBackup, setRestoreTargetBackup] = useState<WorldBackup | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [worldsData, backupsData] = await Promise.all([
        window.electronAPI.getWorlds(server.path),
        window.electronAPI.getWorldBackups(server.path)
      ]);
      setWorlds(worldsData.worlds);
      setActiveWorldName(worldsData.activeWorld);
      setBackups(backupsData);
    } catch (err) {
      console.error('Failed to load worlds data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [server.path]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 3500);
  };

  const handleSwitchActiveWorld = async (worldName: string) => {
    if (worldName === activeWorldName) return;
    setActionLoading(true);
    try {
      const ok = await window.electronAPI.setActiveWorld(server.path, worldName);
      if (ok) {
        setActiveWorldName(worldName);
        setWorlds((prev) =>
          prev.map((w) => ({
            ...w,
            isActive: w.name === worldName
          }))
        );
        showSuccess(
          `Switched active world to "${worldName}"! ${
            isServerRunning ? 'Restart the server for changes to take effect.' : ''
          }`
        );
      }
    } catch (err: any) {
      alert(`Failed to switch world: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenFolder = (subPath?: string) => {
    const sep = window.navigator.userAgent.includes('Windows') ? '\\' : '/';
    const p = subPath ? `${server.path}${sep}${subPath}` : server.path;
    window.electronAPI.openFolder(p);
  };

  // Regeneration
  const handleRegenerateConfirm = async () => {
    if (!regenTargetWorld) return;
    if (isServerRunning) {
      alert('Cannot regenerate world while the server is running! Please stop the server first.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await window.electronAPI.regenerateWorld(server.path, regenTargetWorld, {
        createBackupFirst: regenAutoBackup,
        newSeed: regenSeed.trim() || undefined
      });

      if (!res.success) {
        alert(`Failed to regenerate world: ${res.error}`);
      } else {
        showSuccess(`World "${regenTargetWorld}" was cleared and will generate freshly upon server start!`);
        setRegenTargetWorld(null);
        setRegenSeed('');
        await loadData();
      }
    } catch (err: any) {
      alert(`Error regenerating world: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Create World
  const handleCreateWorldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newWorldName.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    if (!clean) return;

    setActionLoading(true);
    try {
      const res = await window.electronAPI.createWorld(server.path, {
        name: clean,
        seed: newWorldSeed.trim() || undefined,
        generatorType: newWorldType,
        difficulty: newWorldDifficulty,
        hardcore: newWorldHardcore,
        switchActive: newWorldSwitchActive
      });

      if (!res.success) {
        alert(`Failed to create world: ${res.error}`);
      } else {
        showSuccess(`World "${clean}" created successfully!`);
        setIsCreateModalOpen(false);
        setNewWorldName('');
        setNewWorldSeed('');
        await loadData();
      }
    } catch (err: any) {
      alert(`Error creating world: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Duplicate World
  const handleDuplicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dupSourceWorld || !dupTargetName.trim()) return;

    setActionLoading(true);
    try {
      const res = await window.electronAPI.duplicateWorld(server.path, dupSourceWorld, dupTargetName.trim());
      if (!res.success) {
        alert(`Failed to duplicate world: ${res.error}`);
      } else {
        showSuccess(`Duplicated world as "${dupTargetName.trim()}"!`);
        setDupSourceWorld(null);
        setDupTargetName('');
        await loadData();
      }
    } catch (err: any) {
      alert(`Error duplicating world: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete World
  const handleDeleteWorld = async (worldName: string) => {
    if (worldName === activeWorldName) {
      alert('Cannot delete the active world! Please switch to another world first.');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to PERMANENTLY delete world "${worldName}" and all its chunk data?\n\nThis cannot be undone!`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await window.electronAPI.deleteWorld(server.path, worldName);
      if (!res.success) {
        alert(`Failed to delete world: ${res.error}`);
      } else {
        showSuccess(`World "${worldName}" was deleted.`);
        await loadData();
      }
    } catch (err: any) {
      alert(`Error deleting world: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Create Backup
  const handleCreateBackupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupTargetWorld) return;

    setActionLoading(true);
    try {
      const res = await window.electronAPI.createWorldBackup(server.path, backupTargetWorld, backupNote.trim());
      if (!res.success) {
        alert(`Failed to create backup: ${res.error}`);
      } else {
        showSuccess(`Backup for "${backupTargetWorld}" created successfully!`);
        setBackupTargetWorld(null);
        setBackupNote('');
        await loadData();
      }
    } catch (err: any) {
      alert(`Error creating backup: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Restore Backup
  const handleRestoreConfirm = async () => {
    if (!restoreTargetBackup) return;
    if (isServerRunning) {
      alert('Cannot restore a backup while the server is running! Please stop the server first to prevent world corruption.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await window.electronAPI.restoreWorldBackup(
        server.path,
        restoreTargetBackup.fileName,
        restoreTargetBackup.worldName
      );

      if (!res.success) {
        alert(`Failed to restore backup: ${res.error}`);
      } else {
        showSuccess(`Backup "${restoreTargetBackup.fileName}" restored successfully!`);
        setRestoreTargetBackup(null);
        await loadData();
      }
    } catch (err: any) {
      alert(`Error restoring backup: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Backup
  const handleDeleteBackup = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete backup file "${fileName}"?`)) return;

    try {
      await window.electronAPI.deleteWorldBackup(server.path, fileName);
      showSuccess('Backup deleted.');
      await loadData();
    } catch (err: any) {
      alert(`Failed to delete backup: ${err.message}`);
    }
  };

  const activeWorldInfo = worlds.find((w) => w.isActive) || worlds[0];
  const totalStorageBytes = worlds.reduce((acc, w) => acc + w.sizeBytes, 0);
  const totalBackupBytes = backups.reduce((acc, b) => acc + b.sizeBytes, 0);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Banner / Actions Bar */}
      <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubView('worlds')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeSubView === 'worlds'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Worlds Manager ({worlds.length})</span>
          </button>

          <button
            onClick={() => setActiveSubView('backups')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeSubView === 'backups'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Backups & Snapshots ({backups.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {successBanner && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successBanner}</span>
            </div>
          )}

          {activeSubView === 'worlds' ? (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New World</span>
            </button>
          ) : (
            <button
              onClick={() => setBackupTargetWorld(activeWorldName)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Take Backup Now</span>
            </button>
          )}

          <button
            onClick={loadData}
            disabled={isLoading || actionLoading}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh worlds and backups"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content View */}
      <div className="flex-1 overflow-y-auto bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 space-y-6">
        {/* ==================== 1. WORLDS VIEW ==================== */}
        {activeSubView === 'worlds' && (
          <div className="space-y-6">
            {/* Active World Spotlight Card */}
            {activeWorldInfo && (
              <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-lg space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Active World
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">level-name: {activeWorldInfo.name}</span>
                      </div>
                      <h2 className="text-lg font-bold text-white mt-0.5 font-mono">{activeWorldInfo.name}</h2>
                    </div>
                  </div>

                  {/* Actions on Active World */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setRegenTargetWorld(activeWorldInfo.name);
                        setRegenSeed('');
                      }}
                      className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                      title="Clear chunks and regenerate a fresh world"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                      <span>Regenerate World</span>
                    </button>

                    <button
                      onClick={() => setBackupTargetWorld(activeWorldInfo.name)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                      title="Take snapshot backup"
                    >
                      <Archive className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Backup</span>
                    </button>

                    <button
                      onClick={() => {
                        setDupSourceWorld(activeWorldInfo.name);
                        setDupTargetName(`${activeWorldInfo.name}_copy`);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                      title="Clone world"
                    >
                      <Copy className="w-3.5 h-3.5 text-blue-400" />
                      <span>Duplicate</span>
                    </button>

                    <button
                      onClick={() => handleOpenFolder(activeWorldInfo.name)}
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
                      title="Open folder in File Explorer"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* World stats badge bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">World Size</span>
                    <span className="font-mono text-emerald-400 font-bold">{formatBytes(activeWorldInfo.sizeBytes)}</span>
                  </div>

                  <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Dimensions</span>
                    <div className="flex items-center gap-1 font-mono text-[11px] text-slate-300 mt-0.5">
                      <span className="text-emerald-400">Overworld</span>
                      {activeWorldInfo.hasNether && <span className="text-rose-400">&bull; Nether</span>}
                      {activeWorldInfo.hasEnd && <span className="text-amber-400">&bull; End</span>}
                    </div>
                  </div>

                  <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Last Saved</span>
                    <span className="font-mono text-slate-300 text-[11px]">
                      {activeWorldInfo.lastModified ? new Date(activeWorldInfo.lastModified).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Server Status</span>
                    <span className={`font-semibold ${isServerRunning ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {isServerRunning ? 'Online (Serving World)' : 'Server Offline'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* List of All Worlds */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Available Worlds on Server ({worlds.length})</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">Total World Storage: {formatBytes(totalStorageBytes)}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {worlds.map((w) => {
                  const isActive = w.name === activeWorldName;

                  return (
                    <div
                      key={w.name}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                        isActive
                          ? 'bg-slate-900/90 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-white">{w.name}</span>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Active
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono text-slate-400">{formatBytes(w.sizeBytes)}</span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {w.lastModified ? new Date(w.lastModified).toLocaleDateString() : 'N/A'}
                          </span>
                          <span>&bull;</span>
                          <span>
                            {[
                              'Overworld',
                              w.hasNether ? 'Nether' : null,
                              w.hasEnd ? 'End' : null
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                      </div>

                      {/* Card Bottom Actions */}
                      <div className="pt-3 border-t border-slate-800/60 mt-3 flex items-center justify-between gap-2">
                        {isActive ? (
                          <span className="text-[11px] text-emerald-400/90 font-medium flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Currently loaded</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSwitchActiveWorld(w.name)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-emerald-600/30 text-emerald-400 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <Globe className="w-3 h-3" />
                            <span>Switch to World</span>
                          </button>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setRegenTargetWorld(w.name);
                              setRegenSeed('');
                            }}
                            className="p-1.5 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-lg transition"
                            title="Regenerate this world"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setBackupTargetWorld(w.name)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition"
                            title="Create backup"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDupSourceWorld(w.name);
                              setDupTargetName(`${w.name}_copy`);
                            }}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-blue-400 rounded-lg transition"
                            title="Duplicate world"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenFolder(w.name)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                            title="Open in Explorer"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                          </button>

                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleDeleteWorld(w.name)}
                              className="p-1.5 hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 rounded-lg transition"
                              title="Delete world"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. BACKUPS VIEW ==================== */}
        {activeSubView === 'backups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Archive className="w-4 h-4 text-emerald-400" />
                  <span>Server Backups Archive ({backups.length})</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Full world zip archives stored in &quot;backups/&quot; folder.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">Archive Size: {formatBytes(totalBackupBytes)}</span>
            </div>

            {backups.length === 0 ? (
              <div className="py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl space-y-3">
                <FileArchive className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                <p className="text-xs">No backups found yet.</p>
                <button
                  type="button"
                  onClick={() => setBackupTargetWorld(activeWorldName)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-sm"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Create Your First Backup</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <FileArchive className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-mono font-semibold text-white block truncate">{b.fileName}</span>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                          <span className="text-emerald-400 font-semibold font-mono">World: {b.worldName}</span>
                          <span>&bull;</span>
                          <span className="font-mono">{formatBytes(b.sizeBytes)}</span>
                          <span>&bull;</span>
                          <span>{new Date(b.createdAt).toLocaleString()}</span>
                          {b.note && (
                            <>
                              <span>&bull;</span>
                              <span className="italic text-slate-500">{b.note}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Backup Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setRestoreTargetBackup(b)}
                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                        title="Restore this backup"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenFolder('backups')}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                        title="Open backups folder"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBackup(b.fileName)}
                        className="p-1.5 hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 rounded-lg transition"
                        title="Delete backup archive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== MODALS ==================== */}

      {/* 1. REGENERATE WORLD MODAL */}
      {regenTargetWorld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-rose-950/30 border-b border-rose-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Regenerate World: {regenTargetWorld}</h3>
              </div>
              <button
                onClick={() => setRegenTargetWorld(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Regenerating world <strong className="text-white font-mono">{regenTargetWorld}</strong> will delete its existing chunk files, terrain data, and player progress. The Minecraft server will generate a fresh, pristine world next time it boots up.
              </p>

              {/* Seed Configuration */}
              <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <label className="block text-xs font-semibold text-slate-300">
                  New Generation Seed (Optional):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={regenSeed}
                    onChange={(e) => setRegenSeed(e.target.value)}
                    placeholder="Leave empty to use existing / random seed"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                  />
                  {regenSeed && (
                    <button
                      type="button"
                      onClick={() => setRegenSeed('')}
                      className="p-1.5 text-slate-500 hover:text-white rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Randomize:</span>
                  <button
                    type="button"
                    onClick={() => setRegenSeed(generateRandomWordSeed())}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Word Chain</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegenSeed(generateRandomNumericSeed())}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium flex items-center gap-1 transition"
                  >
                    <Dices className="w-3 h-3 text-cyan-400" />
                    <span>Number Seed</span>
                  </button>
                </div>
              </div>

              {/* Auto-backup checkbox */}
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={regenAutoBackup}
                  onChange={(e) => setRegenAutoBackup(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium text-slate-200">
                  Create automatic safety backup before regenerating (Recommended)
                </span>
              </label>

              {isServerRunning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>The server is currently running! Please stop it first before regenerating.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRegenTargetWorld(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateConfirm}
                  disabled={actionLoading || isServerRunning}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-rose-950/40 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span>{actionLoading ? 'Regenerating...' : 'Regenerate World Now'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CREATE NEW WORLD MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-emerald-950/30 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Create New Minecraft World</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorldSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  World Name / Folder Name *
                </label>
                <input
                  type="text"
                  required
                  value={newWorldName}
                  onChange={(e) => setNewWorldName(e.target.value)}
                  placeholder="e.g. survival_s2, creative_hub"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Seed with randomizer */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  World Seed (Optional):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newWorldSeed}
                    onChange={(e) => setNewWorldSeed(e.target.value)}
                    placeholder="Random seed (leave empty for random world)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  {newWorldSeed && (
                    <button
                      type="button"
                      onClick={() => setNewWorldSeed('')}
                      className="p-1.5 text-slate-500 hover:text-white rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Randomize:</span>
                  <button
                    type="button"
                    onClick={() => setNewWorldSeed(generateRandomWordSeed())}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Word Chain</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewWorldSeed(generateRandomNumericSeed())}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium flex items-center gap-1 transition"
                  >
                    <Dices className="w-3 h-3 text-cyan-400" />
                    <span>Number Seed</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">World Type</label>
                  <select
                    value={newWorldType}
                    onChange={(e) => setNewWorldType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="minecraft:normal">Default / Normal</option>
                    <option value="minecraft:flat">Flat World</option>
                    <option value="minecraft:large_biomes">Large Biomes</option>
                    <option value="minecraft:amplified">Amplified</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Difficulty</label>
                  <select
                    value={newWorldDifficulty}
                    onChange={(e) => setNewWorldDifficulty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="peaceful">Peaceful</option>
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="pt-1 space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newWorldHardcore}
                    onChange={(e) => setNewWorldHardcore(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Hardcore Mode (Permadeath)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newWorldSwitchActive}
                    onChange={(e) => setNewWorldSwitchActive(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium text-emerald-400">Set as active world in server.properties</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Create World</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. DUPLICATE WORLD MODAL */}
      {dupSourceWorld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Copy className="w-4 h-4 text-blue-400" />
                <span>Duplicate World &quot;{dupSourceWorld}&quot;</span>
              </h3>
              <button onClick={() => setDupSourceWorld(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDuplicateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Cloned World Name:
                </label>
                <input
                  type="text"
                  required
                  value={dupTargetName}
                  onChange={(e) => setDupTargetName(e.target.value)}
                  placeholder="e.g. world_backup_copy"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDupSourceWorld(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Duplicate World</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. TAKE BACKUP MODAL */}
      {backupTargetWorld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-emerald-950/20 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Archive className="w-4 h-4 text-emerald-400" />
                <span>Create Backup of &quot;{backupTargetWorld}&quot;</span>
              </h3>
              <button onClick={() => setBackupTargetWorld(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBackupSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Optional Backup Note / Description:
                </label>
                <input
                  type="text"
                  value={backupNote}
                  onChange={(e) => setBackupNote(e.target.value)}
                  placeholder="e.g. Before beating the Ender Dragon"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBackupTargetWorld(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                  <span>{actionLoading ? 'Creating Backup...' : 'Create Backup Now'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. RESTORE BACKUP CONFIRMATION MODAL */}
      {restoreTargetBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-amber-950/30 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Restore World Backup</h3>
              </div>
              <button
                onClick={() => setRestoreTargetBackup(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to restore backup{' '}
                <strong className="text-white font-mono">{restoreTargetBackup.fileName}</strong>?
              </p>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <div>Target World: <strong className="text-emerald-400 font-mono">{restoreTargetBackup.worldName}</strong></div>
                <div>Created: <span className="text-slate-400">{new Date(restoreTargetBackup.createdAt).toLocaleString()}</span></div>
                <div>Size: <span className="text-slate-400 font-mono">{formatBytes(restoreTargetBackup.sizeBytes)}</span></div>
              </div>

              {isServerRunning && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>The server is currently running! Please stop it before restoring a backup to prevent file locks.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestoreTargetBackup(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRestoreConfirm}
                  disabled={actionLoading || isServerRunning}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span>{actionLoading ? 'Restoring...' : 'Confirm Restore'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
