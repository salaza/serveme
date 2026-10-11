import React, { useState, useEffect } from 'react';
import { ServerInstance, MinecraftLoader, AppSettings, JavaVersionInfo } from '../types';
import {
  fetchMinecraftVersions,
  fetchFabricLoaders,
  fetchPaperBuilds,
  getFabricServerDownloadUrl,
  getPaperServerDownloadUrl,
  getPurpurServerDownloadUrl,
  getVanillaServerDownloadUrl,
  getRequiredJavaVersion,
  MinecraftVersionItem
} from '../services/minecraft-meta';
import { X, Folder, Server, Check, Loader2, Sparkles, AlertCircle, Cpu, HardDrive, Coffee, ExternalLink } from 'lucide-react';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerCreated: (server: ServerInstance) => void;
  settings: AppSettings;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  onServerCreated,
  settings
}) => {
  const [serverName, setServerName] = useState('My Minecraft Server');
  const [loader, setLoader] = useState<MinecraftLoader>('fabric');
  const [mcVersion, setMcVersion] = useState('1.20.1');
  const [loaderVersion, setLoaderVersion] = useState('');
  const [serverPath, setServerPath] = useState('');
  const [port, setPort] = useState(25565);
  const [ramMin, setRamMin] = useState(2);
  const [ramMax, setRamMax] = useState(4);
  const [acceptEula, setAcceptEula] = useState(true);
  const [detectedJavas, setDetectedJavas] = useState<JavaVersionInfo[]>([]);
  const [selectedJavaPath, setSelectedJavaPath] = useState('');

  // Data fetching state
  const [mcVersions, setMcVersions] = useState<MinecraftVersionItem[]>([]);
  const [fabricLoaders, setFabricLoaders] = useState<Array<{ version: string; stable: boolean }>>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingLoaders, setLoadingLoaders] = useState(false);

  // Setup / creation progress state
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Initialize default path
  useEffect(() => {
    if (settings.defaultServersDir) {
      const sanitizedName = serverName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'MinecraftServer';
      const sep = window.navigator.userAgent.includes('Windows') ? '\\' : '/';
      setServerPath(`${settings.defaultServersDir}${sep}${sanitizedName}`);
    }
  }, [serverName, settings.defaultServersDir]);

  // Fetch MC versions on mount
  useEffect(() => {
    if (isOpen) {
      setLoadingVersions(true);
      fetchMinecraftVersions()
        .then((versions) => {
          setMcVersions(versions.filter(v => v.type === 'release'));
        })
        .finally(() => setLoadingVersions(false));
    }
  }, [isOpen]);

  // Fetch detected Java versions on mount
  useEffect(() => {
    if (isOpen) {
      window.electronAPI.detectJava().then((list) => {
        setDetectedJavas(list);
      });
    }
  }, [isOpen]);

  // Auto-select best matching Java whenever mcVersion or detectedJavas change
  useEffect(() => {
    if (detectedJavas.length > 0 && mcVersion) {
      const req = getRequiredJavaVersion(mcVersion);
      const match = detectedJavas.find(j => {
        if (req.major === 8) return j.major === 8;
        return j.major >= req.major;
      });
      if (match) {
        setSelectedJavaPath(match.path);
      } else if (!selectedJavaPath) {
        setSelectedJavaPath(settings.defaultJavaPath || 'java');
      }
    }
  }, [mcVersion, detectedJavas]);

  // Fetch loader versions when mcVersion or loader changes
  useEffect(() => {
    if (loader === 'fabric' && mcVersion) {
      setLoadingLoaders(true);
      fetchFabricLoaders(mcVersion)
        .then((loaders) => {
          setFabricLoaders(loaders);
          if (loaders.length > 0) {
            setLoaderVersion(loaders[0].version);
          }
        })
        .finally(() => setLoadingLoaders(false));
    }
  }, [loader, mcVersion]);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    const selected = await window.electronAPI.selectDirectory();
    if (selected) {
      setServerPath(selected);
    }
  };

  const handleCreate = async () => {
    try {
      setError(null);
      setIsInstalling(true);
      setInstallStatus('Resolving server executable download link...');

      let downloadUrl = '';
      let jarName = 'server.jar';

      if (loader === 'fabric') {
        const lVersion = loaderVersion || '0.16.10';
        downloadUrl = getFabricServerDownloadUrl(mcVersion, lVersion);
        jarName = 'fabric-server-launch.jar';
      } else if (loader === 'paper') {
        setInstallStatus('Fetching latest Paper build...');
        const builds = await fetchPaperBuilds(mcVersion);
        if (builds.length === 0) {
          throw new Error(`No Paper builds available for Minecraft ${mcVersion}`);
        }
        const latestBuild = builds[0];
        downloadUrl = getPaperServerDownloadUrl(mcVersion, latestBuild);
        jarName = `paper-${mcVersion}-${latestBuild}.jar`;
      } else if (loader === 'purpur') {
        downloadUrl = getPurpurServerDownloadUrl(mcVersion);
        jarName = `purpur-${mcVersion}.jar`;
      } else if (loader === 'vanilla') {
        setInstallStatus('Fetching official Mojang server jar...');
        const vUrl = await getVanillaServerDownloadUrl(mcVersion);
        if (!vUrl) throw new Error(`Could not find vanilla jar URL for ${mcVersion}`);
        downloadUrl = vUrl;
        jarName = `minecraft_server.${mcVersion}.jar`;
      } else {
        // Forge / NeoForge fallback launcher
        setInstallStatus('Configuring Forge/NeoForge launcher...');
        jarName = 'server.jar';
      }

      setInstallStatus(`Downloading ${jarName} & initializing server environment...`);

      const newServer: ServerInstance = {
        id: `srv-${Date.now()}`,
        name: serverName,
        game: 'minecraft',
        path: serverPath,
        version: mcVersion,
        loader,
        loaderVersion: loader === 'fabric' ? loaderVersion : undefined,
        port,
        ramMin,
        ramMax,
        javaPath: selectedJavaPath || settings.defaultJavaPath || 'java',
        status: 'stopped',
        createdAt: Date.now()
      };

      const result = await window.electronAPI.setupMinecraftServer({
        server: newServer,
        downloadUrl,
        jarName,
        acceptEula
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to setup server');
      }

      setInstallStatus('Server ready!');
      onServerCreated(newServer);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during server creation');
    } finally {
      setIsInstalling(false);
    }
  };

  const loaderOptions: Array<{ id: MinecraftLoader; name: string; desc: string; badge: string }> = [
    { id: 'fabric', name: 'Fabric', desc: 'Lightweight & fast modding platform. Vast ecosystem.', badge: 'Recommended' },
    { id: 'paper', name: 'Paper', desc: 'High-performance Bukkit/Spigot fork for plugins.', badge: 'Plugins' },
    { id: 'neoforge', name: 'NeoForge', desc: 'Modern fork of Forge for modern modpacks.', badge: 'Mods' },
    { id: 'forge', name: 'Forge', desc: 'Classic mod loader supporting extensive modpacks.', badge: 'Mods' },
    { id: 'purpur', name: 'Purpur', desc: 'Highly customizable and optimized Paper fork.', badge: 'Plugins' },
    { id: 'vanilla', name: 'Vanilla', desc: 'Official unmodified Minecraft server from Mojang.', badge: 'Official' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create Dedicated Server</h2>
              <p className="text-xs text-slate-400">Minecraft Java Edition</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isInstalling}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl flex items-center gap-3 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Server Name & Directory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Server Name
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                disabled={isInstalling}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                placeholder="Survival SMP"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Server Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 25565)}
                disabled={isInstalling}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Installation Directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverPath}
                onChange={(e) => setServerPath(e.target.value)}
                disabled={isInstalling}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500 transition"
              />
              <button
                type="button"
                onClick={handleSelectFolder}
                disabled={isInstalling}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition"
              >
                <Folder className="w-4 h-4" />
                <span>Browse</span>
              </button>
            </div>
          </div>

          {/* Loader Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Mod Loader / Server Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {loaderOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLoader(opt.id)}
                  disabled={isInstalling}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    loader === opt.id
                      ? 'bg-emerald-500/10 border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-semibold text-xs text-white">{opt.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight mt-1 line-clamp-2">
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Minecraft Version & Loader Version */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Minecraft Version
              </label>
              <select
                value={mcVersion}
                onChange={(e) => setMcVersion(e.target.value)}
                disabled={isInstalling || loadingVersions}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
              >
                {loadingVersions ? (
                  <option>Loading versions...</option>
                ) : (
                  mcVersions.slice(0, 30).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id}
                    </option>
                  ))
                )}
              </select>
            </div>

            {loader === 'fabric' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Fabric Loader Version
                </label>
                <select
                  value={loaderVersion}
                  onChange={(e) => setLoaderVersion(e.target.value)}
                  disabled={isInstalling || loadingLoaders}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition font-mono"
                >
                  {loadingLoaders ? (
                    <option>Loading loaders...</option>
                  ) : (
                    fabricLoaders.map((fl) => (
                      <option key={fl.version} value={fl.version}>
                        {fl.version} {fl.stable ? '(Stable)' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Java Runtime & Compatibility */}
          {(() => {
            const req = getRequiredJavaVersion(mcVersion);
            const currentSelected = detectedJavas.find(j => j.path === selectedJavaPath);
            const isMatch = currentSelected
              ? (req.major === 8 ? currentSelected.major === 8 : currentSelected.major >= req.major)
              : true;

            return (
              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Coffee className="w-4 h-4 text-emerald-400" />
                    Java Runtime Selection
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    isMatch
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                      : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                  }`}>
                    {req.name} Required
                  </span>
                </div>

                <div className="flex gap-2">
                  <select
                    value={selectedJavaPath}
                    onChange={(e) => setSelectedJavaPath(e.target.value)}
                    disabled={isInstalling}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono transition"
                  >
                    {detectedJavas.map((j) => (
                      <option key={j.path} value={j.path}>
                        {j.version} ({j.path})
                      </option>
                    ))}
                    {!detectedJavas.some(j => j.path === selectedJavaPath) && selectedJavaPath && (
                      <option value={selectedJavaPath}>{selectedJavaPath}</option>
                    )}
                  </select>

                  {!isMatch && (
                    <button
                      type="button"
                      onClick={() => window.electronAPI.openExternalUrl(req.downloadUrl)}
                      className="px-3 py-1.5 bg-blue-600/90 hover:bg-blue-500 text-white rounded-xl text-xs font-medium flex items-center gap-1 transition shrink-0"
                    >
                      <span>Download {req.name}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-400">
                  {req.reason}
                </p>
              </div>
            );
          })()}

          {/* Memory Allocation */}
          <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                RAM Allocation
              </span>
              <span className="text-xs font-mono text-emerald-400">
                {ramMin} GB Min — {ramMax} GB Max
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Initial RAM (-Xms)</span>
                  <span className="font-mono">{ramMin} GB</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={ramMin}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setRamMin(val);
                    if (val > ramMax) setRamMax(val);
                  }}
                  disabled={isInstalling}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Maximum RAM (-Xmx)</span>
                  <span className="font-mono">{ramMax} GB</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="32"
                  value={ramMax}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setRamMax(val);
                    if (val < ramMin) setRamMin(val);
                  }}
                  disabled={isInstalling}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* EULA Agreement */}
          <label className="flex items-start gap-3 p-3 bg-slate-950/40 border border-slate-800 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={acceptEula}
              onChange={(e) => setAcceptEula(e.target.checked)}
              disabled={isInstalling}
              className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
            />
            <div className="text-xs text-slate-300">
              <span className="font-medium">Automatically accept Minecraft EULA</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                By ticking this, you agree to the Mojang Minecraft End User License Agreement (eula.txt).
              </p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {isInstalling && (
              <div className="flex items-center gap-2 text-emerald-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{installStatus}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isInstalling}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isInstalling || !serverPath.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Build & Create Server</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
