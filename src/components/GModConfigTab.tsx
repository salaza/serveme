import React, { useState, useEffect } from 'react';
import { ServerInstance, GModServerConfig } from '../types';
import {
  Save,
  FolderOpen,
  Sliders,
  FileCode,
  Shield,
  Layers,
  Key,
  Users,
  Gauge,
  Radio,
  Gamepad2,
  Check,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface GModConfigTabProps {
  server: ServerInstance;
  onServerUpdated: (server: ServerInstance) => void;
}

export const GModConfigTab: React.FC<GModConfigTabProps> = ({ server, onServerUpdated }) => {
  const [activeSubTab, setActiveSubTab] = useState<'visual' | 'raw'>('visual');
  const [rawCfg, setRawCfg] = useState('');
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form state
  const [hostname, setHostname] = useState(server.name);
  const [port, setPort] = useState(server.port || 27015);
  const [gamemode, setGamemode] = useState(server.gmodConfig?.gamemode || 'sandbox');
  const [defaultMap, setDefaultMap] = useState(server.gmodConfig?.defaultMap || 'gm_construct');
  const [maxPlayers, setMaxPlayers] = useState(server.gmodConfig?.maxPlayers || 16);
  const [tickrate, setTickrate] = useState(server.gmodConfig?.tickrate || 66);
  const [workshopCollectionId, setWorkshopCollectionId] = useState(server.gmodConfig?.workshopCollectionId || '');
  const [steamApiKey, setSteamApiKey] = useState(server.gmodConfig?.steamApiKey || '');
  const [rconPassword, setRconPassword] = useState(server.gmodConfig?.rconPassword || '');
  const [serverPassword, setServerPassword] = useState(server.gmodConfig?.serverPassword || '');

  // Cfg parsed options
  const [allowNpcs, setAllowNpcs] = useState(true);
  const [godmode, setGodmode] = useState(false);
  const [pvpDamage, setPvpDamage] = useState(false);
  const [noclip, setNoclip] = useState(true);
  const [voiceEnable, setVoiceEnable] = useState(true);
  const [allTalk, setAllTalk] = useState(true);

  // Load server.cfg
  const loadRawCfg = async () => {
    setLoadingCfg(true);
    try {
      const content = await window.electronAPI.readGModServerCfg(server.path);
      setRawCfg(content);

      // Parse some common values
      if (content) {
        if (/sbox_allownpcs\s+([01])/i.test(content)) {
          setAllowNpcs(RegExp.$1 === '1');
        }
        if (/sbox_godmode\s+([01])/i.test(content)) {
          setGodmode(RegExp.$1 === '1');
        }
        if (/sbox_plpldamage\s+([01])/i.test(content)) {
          setPvpDamage(RegExp.$1 === '1');
        }
        if (/sbox_noclip\s+([01])/i.test(content)) {
          setNoclip(RegExp.$1 === '1');
        }
        if (/sv_voiceenable\s+([01])/i.test(content)) {
          setVoiceEnable(RegExp.$1 === '1');
        }
        if (/sv_alltalk\s+([01])/i.test(content)) {
          setAllTalk(RegExp.$1 === '1');
        }
      }
    } catch (err) {
      console.error('Failed to load server.cfg:', err);
    } finally {
      setLoadingCfg(false);
    }
  };

  useEffect(() => {
    loadRawCfg();
  }, [server.path]);

  const handleSaveVisual = async () => {
    setSaving(true);
    try {
      // 1. Update ServerInstance and gmodConfig
      const updatedGmodConfig: GModServerConfig = {
        ...server.gmodConfig,
        gamemode,
        defaultMap,
        maxPlayers,
        tickrate,
        workshopCollectionId: workshopCollectionId.trim() || undefined,
        steamApiKey: steamApiKey.trim() || undefined,
        rconPassword: rconPassword.trim() || undefined,
        serverPassword: serverPassword.trim() || undefined
      };

      const updatedServer: ServerInstance = {
        ...server,
        name: hostname,
        port,
        gmodConfig: updatedGmodConfig
      };

      await window.electronAPI.saveServer(updatedServer);
      onServerUpdated(updatedServer);

      // 2. Update or generate server.cfg
      let newCfg = rawCfg;
      const replaceOrAppend = (key: string, val: string | number) => {
        const regex = new RegExp(`^\\s*${key}\\s+.*$`, 'm');
        if (regex.test(newCfg)) {
          newCfg = newCfg.replace(regex, `${key} ${typeof val === 'string' && val.includes(' ') ? `"${val}"` : val}`);
        } else {
          newCfg += `\n${key} ${typeof val === 'string' && val.includes(' ') ? `"${val}"` : val}`;
        }
      };

      replaceOrAppend('hostname', `"${hostname}"`);
      replaceOrAppend('sv_password', `"${serverPassword.trim()}"`);
      replaceOrAppend('rcon_password', `"${rconPassword.trim()}"`);
      replaceOrAppend('sbox_allownpcs', allowNpcs ? 1 : 0);
      replaceOrAppend('sbox_godmode', godmode ? 1 : 0);
      replaceOrAppend('sbox_plpldamage', pvpDamage ? 1 : 0);
      replaceOrAppend('sbox_noclip', noclip ? 1 : 0);
      replaceOrAppend('sv_voiceenable', voiceEnable ? 1 : 0);
      replaceOrAppend('sv_alltalk', allTalk ? 1 : 0);

      await window.electronAPI.saveGModServerCfg(server.path, newCfg.trim() + '\n');
      setRawCfg(newCfg.trim() + '\n');

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error saving server settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRaw = async () => {
    setSaving(true);
    try {
      await window.electronAPI.saveGModServerCfg(server.path, rawCfg);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error saving server.cfg: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCfgFolder = () => {
    const sep = window.navigator.userAgent.includes('Windows') ? '\\' : '/';
    window.electronAPI.openFolder(`${server.path}${sep}garrysmod${sep}cfg`);
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Tab Switcher & Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('visual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'visual'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Interactive Settings</span>
          </button>
          <button
            onClick={() => setActiveSubTab('raw')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'raw'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Raw server.cfg</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <Check className="w-3.5 h-3.5" />
              <span>Saved successfully!</span>
            </span>
          )}
          <button
            onClick={activeSubTab === 'visual' ? handleSaveVisual : handleSaveRaw}
            disabled={saving}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
          <button
            onClick={handleOpenCfgFolder}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open cfg Folder</span>
          </button>
        </div>
      </div>

      {/* Main Settings Area */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        {activeSubTab === 'visual' ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* General Server Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-emerald-400" />
                <span>General Server Parameters</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Server Hostname</label>
                  <input
                    type="text"
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Displayed in the Steam server browser.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Server Port (UDP/TCP)</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value, 10) || 27015)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Default for Garry&apos;s Mod is 27015.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Gamemode</label>
                  <input
                    type="text"
                    value={gamemode}
                    onChange={(e) => setGamemode(e.target.value)}
                    placeholder="sandbox, darkrp, terrortown, prop_hunt"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Examples: sandbox, darkrp, terrortown, murder</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Default Map</label>
                  <input
                    type="text"
                    value={defaultMap}
                    onChange={(e) => setDefaultMap(e.target.value)}
                    placeholder="gm_construct, gm_flatgrass"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Map to load when server starts.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Max Players</label>
                  <input
                    type="number"
                    min="1"
                    max="128"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(parseInt(e.target.value, 10) || 16)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Maximum player capacity.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Tickrate</label>
                  <select
                    value={tickrate}
                    onChange={(e) => setTickrate(parseInt(e.target.value, 10) || 66)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="33">33 (Low CPU / Heavy DarkRP)</option>
                    <option value="66">66 (Standard / Recommended)</option>
                    <option value="100">100 (Competitive / High Performance)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">Server tickrate updates per second.</p>
                </div>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Steam Workshop & Auth */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Steam Workshop & Authentication</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Workshop Collection ID</label>
                  <input
                    type="text"
                    value={workshopCollectionId}
                    onChange={(e) => setWorkshopCollectionId(e.target.value)}
                    placeholder="e.g. 123456789"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Adds <code className="text-blue-400">+host_workshop_collection &lt;ID&gt;</code> to startup.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Steam Web API Key</label>
                  <input
                    type="password"
                    value={steamApiKey}
                    onChange={(e) => setSteamApiKey(e.target.value)}
                    placeholder="Steam Web API Key"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Required by Valve to download Workshop collections on dedicated servers (<code className="text-blue-400">-authkey</code>).
                  </p>
                </div>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Passwords & Security */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Passwords & Security</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Server Password (sv_password)</label>
                  <input
                    type="password"
                    value={serverPassword}
                    onChange={(e) => setServerPassword(e.target.value)}
                    placeholder="Leave empty for public server"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Password required for players to join.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">RCON Remote Password</label>
                  <input
                    type="password"
                    value={rconPassword}
                    onChange={(e) => setRconPassword(e.target.value)}
                    placeholder="Leave empty to disable RCON"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Password for remote server console administration.</p>
                </div>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Gameplay & Sandbox Rules */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Radio className="w-4 h-4 text-purple-400" />
                <span>Gameplay, Voice & Physics</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={noclip}
                    onChange={(e) => setNoclip(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">Allow Noclip</span>
                    <span className="text-[11px] text-slate-500">sbox_noclip</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={allowNpcs}
                    onChange={(e) => setAllowNpcs(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">Allow Spawning NPCs</span>
                    <span className="text-[11px] text-slate-500">sbox_allownpcs</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={godmode}
                    onChange={(e) => setGodmode(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">Global Godmode</span>
                    <span className="text-[11px] text-slate-500">sbox_godmode</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={pvpDamage}
                    onChange={(e) => setPvpDamage(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">Player vs Player Damage</span>
                    <span className="text-[11px] text-slate-500">sbox_plpldamage</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={voiceEnable}
                    onChange={(e) => setVoiceEnable(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">Enable Voice Chat</span>
                    <span className="text-[11px] text-slate-500">sv_voiceenable</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={allTalk}
                    onChange={(e) => setAllTalk(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">Alltalk (Hear Everyone)</span>
                    <span className="text-[11px] text-slate-500">sv_alltalk</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4">
            <p className="text-xs text-slate-400 mb-2 font-mono">
              Editing: <span className="text-emerald-400">{server.path}\garrysmod\cfg\server.cfg</span>
            </p>
            <textarea
              value={rawCfg}
              onChange={(e) => setRawCfg(e.target.value)}
              disabled={loadingCfg}
              spellCheck={false}
              className="flex-1 w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 resize-none focus:outline-none focus:border-emerald-500 transition leading-relaxed"
              placeholder="// Garry's Mod server.cfg"
            />
          </div>
        )}
      </div>
    </div>
  );
};
