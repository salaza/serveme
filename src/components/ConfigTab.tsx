import React, { useState, useEffect } from 'react';
import { ServerInstance } from '../types';
import { Sliders, Save, FileCode, CheckCircle2, HardDrive, Cpu, Shield, Globe } from 'lucide-react';

interface ConfigTabProps {
  server: ServerInstance;
  onServerUpdated: (server: ServerInstance) => void;
}

export const ConfigTab: React.FC<ConfigTabProps> = ({ server, onServerUpdated }) => {
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [activeSubTab, setActiveSubTab] = useState<'visual' | 'jvm' | 'raw'>('visual');
  const [rawText, setRawText] = useState('');
  const [ramMin, setRamMin] = useState(server.ramMin || 2);
  const [ramMax, setRamMax] = useState(server.ramMax || 4);
  const [jvmArgs, setJvmArgs] = useState(server.jvmArgs || '');
  const [javaPath, setJavaPath] = useState(server.javaPath || 'java');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProperties();
  }, [server.id, server.path]);

  const loadProperties = async () => {
    const props = await window.electronAPI.readServerProperties(server.path);
    setProperties(props);

    // Also load raw text
    const sep = window.navigator.userAgent.includes('Windows') ? '\\' : '/';
    const raw = await window.electronAPI.readRawFile(`${server.path}${sep}server.properties`);
    setRawText(raw);
  };

  const updateProp = (key: string, value: string) => {
    setProperties((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyAikarFlags = () => {
    // Standard Aikar's flags optimized for Minecraft Java servers
    const aikar = '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1';
    setJvmArgs(aikar);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (activeSubTab === 'raw') {
        const sep = window.navigator.userAgent.includes('Windows') ? '\\' : '/';
        await window.electronAPI.writeRawFile(`${server.path}${sep}server.properties`, rawText);
        await loadProperties();
      } else {
        await window.electronAPI.saveServerProperties(server.path, properties);
      }

      // Update server instance settings (RAM and JVM args)
      const updatedServer: ServerInstance = {
        ...server,
        ramMin,
        ramMax,
        jvmArgs,
        javaPath
      };

      await window.electronAPI.saveServer(updatedServer);
      onServerUpdated(updatedServer);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Config Sub-Nav Bar */}
      <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('visual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeSubTab === 'visual'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Server Properties</span>
          </button>

          <button
            onClick={() => setActiveSubTab('jvm')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeSubTab === 'jvm'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>JVM & Performance</span>
          </button>

          <button
            onClick={() => setActiveSubTab('raw')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeSubTab === 'raw'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Raw server.properties</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved!</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto bg-slate-950/60 border border-slate-800/80 rounded-xl p-5">
        {activeSubTab === 'visual' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
            {/* MOTD */}
            <div className="col-span-full">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Server Message of the Day (MOTD)
              </label>
              <input
                type="text"
                value={properties['motd'] || ''}
                onChange={(e) => updateProp('motd', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Gamemode & Difficulty */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Default Gamemode</label>
              <select
                value={properties['gamemode'] || 'survival'}
                onChange={(e) => updateProp('gamemode', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="survival">Survival</option>
                <option value="creative">Creative</option>
                <option value="adventure">Adventure</option>
                <option value="spectator">Spectator</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Difficulty</label>
              <select
                value={properties['difficulty'] || 'easy'}
                onChange={(e) => updateProp('difficulty', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="peaceful">Peaceful</option>
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            {/* Max Players & Port */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Max Players</label>
              <input
                type="number"
                value={properties['max-players'] || '20'}
                onChange={(e) => updateProp('max-players', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Server Port</label>
              <input
                type="number"
                value={properties['server-port'] || '25565'}
                onChange={(e) => updateProp('server-port', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* View Distance & Simulation Distance */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                View Distance ({properties['view-distance'] || '10'} chunks)
              </label>
              <input
                type="range"
                min="4"
                max="32"
                value={parseInt(properties['view-distance'] || '10')}
                onChange={(e) => updateProp('view-distance', e.target.value)}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Simulation Distance ({properties['simulation-distance'] || '10'} chunks)
              </label>
              <input
                type="range"
                min="4"
                max="32"
                value={parseInt(properties['simulation-distance'] || '10')}
                onChange={(e) => updateProp('simulation-distance', e.target.value)}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* World Seed */}
            <div className="col-span-full">
              <label className="block text-xs font-semibold text-slate-300 mb-1">World Seed (Leave empty for random)</label>
              <input
                type="text"
                value={properties['level-seed'] || ''}
                onChange={(e) => updateProp('level-seed', e.target.value)}
                placeholder="Optional seed string or number"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Toggles */}
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {[
                { key: 'pvp', label: 'Player vs Player (PvP)' },
                { key: 'online-mode', label: 'Online Mode (Mojang Auth)' },
                { key: 'white-list', label: 'Enforce Whitelist' },
                { key: 'hardcore', label: 'Hardcore Mode' },
                { key: 'enable-command-block', label: 'Enable Command Blocks' },
                { key: 'allow-flight', label: 'Allow Flight' },
                { key: 'allow-nether', label: 'Allow Nether Dimension' },
                { key: 'spawn-animals', label: 'Spawn Animals' },
                { key: 'spawn-monsters', label: 'Spawn Monsters' }
              ].map((toggle) => {
                const isChecked = properties[toggle.key] === 'true';
                return (
                  <label
                    key={toggle.key}
                    className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700 transition"
                  >
                    <span className="text-xs text-slate-300 font-medium">{toggle.label}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => updateProp(toggle.key, e.target.checked ? 'true' : 'false')}
                      className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {activeSubTab === 'jvm' && (
          <div className="space-y-6 max-w-3xl">
            {/* RAM Steppers */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-4">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Memory Allocation</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Initial Memory (-Xms)</span>
                    <span className="font-mono text-emerald-400">{ramMin} GB</span>
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
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Maximum Memory (-Xmx)</span>
                    <span className="font-mono text-emerald-400">{ramMax} GB</span>
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
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Custom JVM Arguments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Custom JVM Flags & Arguments
                </label>
                <button
                  type="button"
                  onClick={handleApplyAikarFlags}
                  className="text-xs text-emerald-400 hover:underline font-medium"
                >
                  Apply Aikar&apos;s High-Performance Flags Preset
                </button>
              </div>
              <textarea
                value={jvmArgs}
                onChange={(e) => setJvmArgs(e.target.value)}
                placeholder="-XX:+UseG1GC ..."
                rows={4}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                These arguments are passed directly to Java on server startup.
              </p>
            </div>

            {/* Java Executable Path */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Java Executable Path</label>
              <input
                type="text"
                value={javaPath}
                onChange={(e) => setJavaPath(e.target.value)}
                placeholder="java or C:\Program Files\Java\jdk-21\bin\java.exe"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {activeSubTab === 'raw' && (
          <div className="h-full flex flex-col space-y-2">
            <p className="text-[11px] text-slate-400">
              Directly edit raw <span className="font-mono text-slate-300">server.properties</span>. Click &quot;Save Changes&quot; above to commit.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full flex-1 min-h-[400px] bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs text-emerald-400/90 font-mono focus:outline-none focus:border-emerald-500 leading-relaxed resize-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};
