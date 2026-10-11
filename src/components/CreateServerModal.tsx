import React, { useState, useEffect } from 'react';
import { ServerInstance, GameType, MinecraftLoader, AppSettings, JavaVersionInfo } from '../types';
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
import {
  X,
  Folder,
  Server,
  Check,
  Loader2,
  Sparkles,
  AlertCircle,
  Cpu,
  HardDrive,
  Coffee,
  ExternalLink,
  Gamepad2,
  Layers,
  Shield,
  Gauge
} from 'lucide-react';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerCreated: (server: ServerInstance) => void;
  settings: AppSettings;
  existingServers?: ServerInstance[];
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  onServerCreated,
  settings,
  existingServers = []
}) => {
  const [gameType, setGameType] = useState<GameType>('minecraft');
  const [serverName, setServerName] = useState('My Minecraft Server');
  const [serverPath, setServerPath] = useState('');
  const [port, setPort] = useState(25565);

  const isDuplicateName = existingServers.some(
    (s) => s.name.trim().toLowerCase() === serverName.trim().toLowerCase()
  );

  // Minecraft specific state
  const [loader, setLoader] = useState<MinecraftLoader>('fabric');
  const [mcVersion, setMcVersion] = useState('1.20.1');
  const [loaderVersion, setLoaderVersion] = useState('');
  const [ramMin, setRamMin] = useState(2);
  const [ramMax, setRamMax] = useState(4);
  const [acceptEula, setAcceptEula] = useState(true);
  const [detectedJavas, setDetectedJavas] = useState<JavaVersionInfo[]>([]);
  const [selectedJavaPath, setSelectedJavaPath] = useState('');

  // Garry's Mod specific state
  const [gmodGamemode, setGmodGamemode] = useState('sandbox');
  const [gmodDefaultMap, setGmodDefaultMap] = useState('gm_construct');
  const [gmodMaxPlayers, setGmodMaxPlayers] = useState(16);
  const [gmodTickrate, setGmodTickrate] = useState(66);
  const [gmodWorkshopCollectionId, setGmodWorkshopCollectionId] = useState('');
  const [gmodSteamApiKey, setGmodSteamApiKey] = useState('');

  // Data fetching state (Minecraft)
  const [mcVersions, setMcVersions] = useState<MinecraftVersionItem[]>([]);
  const [fabricLoaders, setFabricLoaders] = useState<Array<{ version: string; stable: boolean }>>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingLoaders, setLoadingLoaders] = useState(false);

  // Setup / creation progress state
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState('');
  const [installPercent, setInstallPercent] = useState<number | null>(null);
  const [installDetails, setInstallDetails] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Handle Game Type Switch
  const handleSelectGameType = (type: GameType) => {
    setGameType(type);
    if (type === 'gmod') {
      if (serverName === 'My Minecraft Server') {
        setServerName("My Garry's Mod Server");
      }
      setPort(27015);
    } else {
      if (serverName === "My Garry's Mod Server") {
        setServerName('My Minecraft Server');
      }
      setPort(25565);
    }
  };

  // Initialize default path
  useEffect(() => {
    if (settings.defaultServersDir) {
      const sanitizedName = serverName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'GameServer';
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
          setMcVersions(versions.filter((v) => v.type === 'release'));
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
      const match = detectedJavas.find((j) => {
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
    if (!serverName.trim()) {
      setError('Server name cannot be empty.');
      return;
    }
    if (isDuplicateName) {
      setError(`A server named "${serverName.trim()}" already exists. Please choose a unique name.`);
      return;
    }

    let unsubscribeProgress: (() => void) | null = null;
    try {
      setError(null);
      setIsInstalling(true);
      setInstallPercent(null);
      setInstallDetails('');

      unsubscribeProgress = window.electronAPI.onServerSetupProgress((data) => {
        setInstallStatus(data.stage);
        if (typeof data.percent === 'number') {
          setInstallPercent(data.percent);
        }
        if (data.details) {
          setInstallDetails(data.details);
        }
      });

      // ==========================================
      // Garry's Mod Server Creation Flow
      // ==========================================
      if (gameType === 'gmod') {
        setInstallStatus("Preparing SteamCMD for Garry's Mod dedicated server...");

        const newServer: ServerInstance = {
          id: `srv-${Date.now()}`,
          name: serverName,
          game: 'gmod',
          path: serverPath,
          port,
          status: 'stopped',
          createdAt: Date.now(),
          gmodConfig: {
            gamemode: gmodGamemode || 'sandbox',
            defaultMap: gmodDefaultMap || 'gm_construct',
            maxPlayers: gmodMaxPlayers || 16,
            tickrate: gmodTickrate || 66,
            workshopCollectionId: gmodWorkshopCollectionId.trim() || undefined,
            steamApiKey: gmodSteamApiKey.trim() || undefined
          }
        };

        const result = await window.electronAPI.setupGModServer({
          server: newServer,
          gamemode: gmodGamemode,
          defaultMap: gmodDefaultMap,
          maxPlayers: gmodMaxPlayers,
          tickrate: gmodTickrate,
          workshopCollectionId: gmodWorkshopCollectionId,
          steamApiKey: gmodSteamApiKey
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to setup Garry's Mod server");
        }

        setInstallStatus('Server ready!');
        onServerCreated(newServer);
        onClose();
        return;
      }

      // ==========================================
      // Minecraft Server Creation Flow
      // ==========================================
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
      if (unsubscribeProgress) {
        unsubscribeProgress();
      }
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                gameType === 'gmod'
                  ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              }`}
            >
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create Dedicated Server</h2>
              <p className="text-xs text-slate-400">
                {gameType === 'gmod' ? "Garry's Mod (Steam Dedicated Server)" : 'Minecraft Java Edition'}
              </p>
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

        {/* Game Selection Selector */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-slate-400">Game:</span>
          <button
            type="button"
            onClick={() => handleSelectGameType('minecraft')}
            disabled={isInstalling}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              gameType === 'minecraft'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            <span>Minecraft (Java Edition)</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectGameType('gmod')}
            disabled={isInstalling}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              gameType === 'gmod'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-950/50'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Garry&apos;s Mod (SRCDS)</span>
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
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Server Name</label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                disabled={isInstalling}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition ${
                  isDuplicateName
                    ? 'border-rose-500/80 focus:border-rose-500 ring-1 ring-rose-500/20'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
                placeholder={gameType === 'gmod' ? "My Garry's Mod Server" : 'Survival SMP'}
              />
              {isDuplicateName && (
                <p className="text-[11px] text-rose-400 font-medium mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>A server named &quot;{serverName.trim()}&quot; already exists.</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Server Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || (gameType === 'gmod' ? 27015 : 25565))}
                disabled={isInstalling}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {gameType === 'gmod' ? 'Standard GMod port: 27015 (UDP/TCP)' : 'Standard Minecraft port: 25565'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Installation Directory</label>
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

          {/* ======================================================== */}
          {/* GARRY'S MOD CONFIGURATION FIELDS                        */}
          {/* ======================================================== */}
          {gameType === 'gmod' && (
            <div className="space-y-4 pt-1">
              <div className="p-3 bg-blue-950/30 border border-blue-900/40 rounded-xl text-xs text-blue-300 flex items-start gap-2.5">
                <Layers className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-200">Automated SteamCMD Setup</p>
                  <p className="text-blue-300/80 mt-0.5 text-[11px]">
                    Game Server Builder will automatically bootstrap SteamCMD and download official Garry&apos;s Mod dedicated server files (App ID 4020) anonymously.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Gamemode</label>
                  <select
                    value={gmodGamemode}
                    onChange={(e) => setGmodGamemode(e.target.value)}
                    disabled={isInstalling}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value="sandbox">Sandbox (Default)</option>
                    <option value="darkrp">DarkRP</option>
                    <option value="terrortown">Trouble in Terrorist Town (TTT)</option>
                    <option value="prop_hunt">Prop Hunt</option>
                    <option value="murder">Murder</option>
                    <option value="cinema">Cinema</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Default Map</label>
                  <input
                    type="text"
                    value={gmodDefaultMap}
                    onChange={(e) => setGmodDefaultMap(e.target.value)}
                    disabled={isInstalling}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="gm_construct"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Max Players</label>
                  <input
                    type="number"
                    min="1"
                    max="128"
                    value={gmodMaxPlayers}
                    onChange={(e) => setGmodMaxPlayers(parseInt(e.target.value, 10) || 16)}
                    disabled={isInstalling}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tickrate</label>
                  <select
                    value={gmodTickrate}
                    onChange={(e) => setGmodTickrate(parseInt(e.target.value, 10) || 66)}
                    disabled={isInstalling}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value="33">33 (Low CPU / Heavy scripts)</option>
                    <option value="66">66 (Standard / Recommended)</option>
                    <option value="100">100 (Competitive / Tick 100)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Steam Workshop Collection ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={gmodWorkshopCollectionId}
                    onChange={(e) => setGmodWorkshopCollectionId(e.target.value)}
                    disabled={isInstalling}
                    placeholder="e.g. 123456789"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Adds <code className="text-blue-400">+host_workshop_collection &lt;ID&gt;</code>. Addons and maps in the collection will be automatically downloaded by the server.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Steam Web API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={gmodSteamApiKey}
                    onChange={(e) => setGmodSteamApiKey(e.target.value)}
                    disabled={isInstalling}
                    placeholder="Your Steam Web API Key"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Needed to fetch Workshop collections (<code className="text-blue-400">-authkey</code>).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* MINECRAFT CONFIGURATION FIELDS                          */}
          {/* ======================================================== */}
          {gameType === 'minecraft' && (
            <>
              {/* Loader Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Select Mod Loader / Server Type
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {loaderOptions.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => !isInstalling && setLoader(opt.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                        loader === opt.id
                          ? 'bg-emerald-950/30 border-emerald-500/80 text-white shadow-sm'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-slate-200">{opt.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                              loader === opt.id
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2">{opt.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Version & Java Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Minecraft Version
                  </label>
                  <select
                    value={mcVersion}
                    onChange={(e) => setMcVersion(e.target.value)}
                    disabled={isInstalling || loadingVersions}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition font-mono"
                  >
                    {mcVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Java Runtime Environment
                  </label>
                  <select
                    value={selectedJavaPath}
                    onChange={(e) => setSelectedJavaPath(e.target.value)}
                    disabled={isInstalling}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition font-mono"
                  >
                    {detectedJavas.map((j) => (
                      <option key={j.path} value={j.path}>
                        Java {j.major} ({j.version}) {j.isDefault ? '[Default]' : ''}
                      </option>
                    ))}
                    <option value="java">System PATH &apos;java&apos;</option>
                  </select>
                </div>
              </div>

              {/* RAM Allocations */}
              <div className="space-y-3 bg-slate-950/40 p-4 border border-slate-800 rounded-xl">
                <span className="text-xs font-semibold text-slate-300 block">Memory Allocation (RAM)</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Minimum RAM (-Xms)</span>
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 shrink-0">
          {isInstalling ? (
            <div className="space-y-2.5 w-full">
              <div className="flex items-center justify-between gap-3 text-xs font-medium">
                <span className={`flex items-center gap-2 min-w-0 ${gameType === 'gmod' ? 'text-blue-400' : 'text-emerald-400'}`}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="truncate font-semibold">{installStatus}</span>
                </span>
                {typeof installPercent === 'number' && (
                  <span className="font-mono text-white font-bold text-xs shrink-0 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                    {installPercent.toFixed(1)}%
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800 shadow-inner">
                <div
                  className={`h-full transition-all duration-200 ${
                    gameType === 'gmod'
                      ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400'
                      : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(typeof installPercent === 'number' ? installPercent : 5, 2))}%`
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span className="truncate">{installDetails || 'Downloading files...'}</span>
                <span className="shrink-0 text-slate-500 ml-2">
                  {gameType === 'gmod' ? "Garry's Mod Dedicated Server" : 'Minecraft Java Edition'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs text-slate-400 min-w-0">
                {isDuplicateName && (
                  <span className="text-rose-400 flex items-center gap-1 font-medium truncate">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>A server with this name already exists</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!serverPath.trim() || !serverName.trim() || isDuplicateName}
                  className={`px-5 py-2 text-xs font-semibold text-white disabled:opacity-40 disabled:pointer-events-none rounded-xl transition flex items-center gap-2 shadow-lg ${
                    gameType === 'gmod'
                      ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/40'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Build & Create Server</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
