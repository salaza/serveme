import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ServerInstance, PortCheckResult, JavaVersionInfo } from '../types';
import {
  Sliders,
  FileCode,
  CheckCircle2,
  HardDrive,
  Cpu,
  Shield,
  Globe,
  Network,
  Loader2,
  Coffee,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
  Gamepad2,
  Users,
  MessageSquare,
  Radio,
  Package,
  Wrench,
  X,
  Dices
} from 'lucide-react';
import { PortWarningModal } from './PortWarningModal';
import { getRequiredJavaVersion } from '../services/minecraft-meta';
import {
  MINECRAFT_PROPERTIES,
  PROPERTY_CATEGORIES,
  PropertyCategory,
  PropertyDefinition,
  isPropertySupported,
  getPropertyVersionNotice
} from '../constants/minecraftProperties';

interface ConfigTabProps {
  server: ServerInstance;
  onServerUpdated: (server: ServerInstance) => void;
}

// Word lists for readable seed generation
const SEED_ADJECTIVES = [
  'ancient', 'cosmic', 'crimson', 'emerald', 'frozen', 'golden', 'hidden', 'mystic',
  'silent', 'whispering', 'shadow', 'celestial', 'crystal', 'wild', 'infinite', 'radiant',
  'dark', 'abyssal', 'stormy', 'verdant', 'blazing', 'lunar', 'obsidian', 'spectral',
  'astral', 'shimmering', 'echoing', 'primal', 'mythic', 'velvet', 'iron', 'silver'
];

const SEED_NOUNS = [
  'valley', 'peak', 'canyon', 'forest', 'ocean', 'spire', 'glade', 'tundra',
  'cavern', 'realm', 'citadel', 'sanctuary', 'badlands', 'archipelago', 'jungle',
  'bastion', 'summit', 'oasis', 'crater', 'highland', 'haven', 'horizon', 'delta', 'meadow'
];

const SEED_CREATURES = [
  'dragon', 'phoenix', 'wolf', 'titan', 'voyager', 'aurora', 'ember',
  'tempest', 'blossom', 'monolith', 'beacon', 'echo', 'wanderer', 'keeper', 'sentinel'
];

function generateRandomNumericSeed(): string {
  const high = BigInt(Math.floor(Math.random() * 0xffffffff));
  const low = BigInt(Math.floor(Math.random() * 0xffffffff));
  const sign = Math.random() < 0.5 ? -1n : 1n;
  const raw = ((high << 32n) | low) % 9223372036854775807n;
  return (raw * sign).toString();
}

function generateRandomWordSeed(): string {
  const adj = SEED_ADJECTIVES[Math.floor(Math.random() * SEED_ADJECTIVES.length)];
  const mid = (Math.random() < 0.5 ? SEED_ADJECTIVES : SEED_CREATURES)[
    Math.floor(Math.random() * (Math.random() < 0.5 ? SEED_ADJECTIVES.length : SEED_CREATURES.length))
  ];
  const noun = SEED_NOUNS[Math.floor(Math.random() * SEED_NOUNS.length)];
  return `${adj}-${mid}-${noun}`;
}

export const ConfigTab: React.FC<ConfigTabProps> = ({ server, onServerUpdated }) => {
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [activeSubTab, setActiveSubTab] = useState<'visual' | 'jvm' | 'raw'>('visual');
  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlySupportedVersions, setOnlySupportedVersions] = useState(true);

  // Custom property creation state
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');

  const [rawText, setRawText] = useState('');
  const [ramMin, setRamMin] = useState(server.ramMin || 2);
  const [ramMax, setRamMax] = useState(server.ramMax || 4);
  const [jvmArgs, setJvmArgs] = useState(server.jvmArgs || '');
  const [javaPath, setJavaPath] = useState(server.javaPath || 'java');
  const [detectedJavas, setDetectedJavas] = useState<JavaVersionInfo[]>([]);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stable references to prevent infinite re-render loops
  const serverRef = useRef(server);
  serverRef.current = server;
  const onServerUpdatedRef = useRef(onServerUpdated);
  onServerUpdatedRef.current = onServerUpdated;

  // Port test state
  const [isTestingPort, setIsTestingPort] = useState(false);
  const [portCheckResult, setPortCheckResult] = useState<PortCheckResult | null>(null);
  const [isPortModalOpen, setIsPortModalOpen] = useState(false);
  const [portTestSuccess, setPortTestSuccess] = useState<boolean | null>(null);

  const loadProperties = useCallback(async () => {
    try {
      const props = await window.electronAPI.readServerProperties(serverRef.current.path);
      setProperties(props);

      const sep = window.navigator.userAgent.includes('Windows') ? '\\' : '/';
      const raw = await window.electronAPI.readRawFile(`${serverRef.current.path}${sep}server.properties`);
      setRawText(raw);
    } catch (err) {
      console.error('Failed to read server properties:', err);
    }
  }, []);

  // Load properties on mount or server id change
  useEffect(() => {
    loadProperties();
    window.electronAPI.detectJava().then((list) => {
      setDetectedJavas(list);
    });

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [server.id, server.path, loadProperties]);

  // Clean, debounced save triggered ONLY on explicit user edits
  const scheduleSave = useCallback(
    (
      propsToSave: Record<string, string>,
      minRam: number,
      maxRam: number,
      jvm: string,
      java: string
    ) => {
      setSaveStatus('saving');
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        try {
          const currentSrv = serverRef.current;
          await window.electronAPI.saveServerProperties(currentSrv.path, propsToSave);

          // Synchronize port if changed
          let finalPort = currentSrv.port;
          if (propsToSave['server-port']) {
            const parsed = parseInt(propsToSave['server-port'], 10);
            if (!isNaN(parsed) && parsed > 0) {
              finalPort = parsed;
            }
          }

          const updatedServer: ServerInstance = {
            ...currentSrv,
            port: finalPort,
            ramMin: minRam,
            ramMax: maxRam,
            jvmArgs: jvm,
            javaPath: java
          };

          await window.electronAPI.saveServer(updatedServer);
          onServerUpdatedRef.current(updatedServer);

          setSaveStatus('saved');
          setTimeout(() => {
            setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
          }, 2000);
        } catch (err) {
          console.error('Failed to auto-save properties:', err);
          setSaveStatus('idle');
        }
      }, 500);
    },
    []
  );

  const updateProp = (key: string, value: string) => {
    setProperties((prev) => {
      const next = { ...prev, [key]: value };
      scheduleSave(next, ramMin, ramMax, jvmArgs, javaPath);
      return next;
    });
  };

  const removeProp = (key: string) => {
    setProperties((prev) => {
      const next = { ...prev };
      delete next[key];
      scheduleSave(next, ramMin, ramMax, jvmArgs, javaPath);
      return next;
    });
  };

  const handleAddCustomProp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = customKey.trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleanKey) return;
    updateProp(cleanKey, customValue.trim());
    setCustomKey('');
    setCustomValue('');
    setIsAddingCustom(false);
  };

  const handleRamMinChange = (val: number) => {
    setRamMin(val);
    scheduleSave(properties, val, ramMax, jvmArgs, javaPath);
  };

  const handleRamMaxChange = (val: number) => {
    setRamMax(val);
    scheduleSave(properties, ramMin, val, jvmArgs, javaPath);
  };

  const handleJvmArgsChange = (val: string) => {
    setJvmArgs(val);
    scheduleSave(properties, ramMin, ramMax, val, javaPath);
  };

  const handleJavaPathChange = (val: string) => {
    setJavaPath(val);
    scheduleSave(properties, ramMin, ramMax, jvmArgs, val);
  };

  const handleApplyAikarFlags = () => {
    const aikar =
      '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1';
    setJvmArgs(aikar);
    scheduleSave(properties, ramMin, ramMax, aikar, javaPath);
  };

  const handleRawTextChange = (val: string) => {
    setRawText(val);
    setSaveStatus('saving');
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        const sep = window.navigator.userAgent.includes('Windows') ? '\\' : '/';
        await window.electronAPI.writeRawFile(`${serverRef.current.path}${sep}server.properties`, val);
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 2000);
      } catch (err) {
        console.error('Failed to auto-save raw config:', err);
        setSaveStatus('idle');
      }
    }, 600);
  };

  const handleSubTabChange = (tab: 'visual' | 'jvm' | 'raw') => {
    setActiveSubTab(tab);
    loadProperties();
  };

  const handleTestPort = async () => {
    const port = parseInt(properties['server-port'] || String(server.port), 10) || server.port;
    setIsTestingPort(true);
    setPortTestSuccess(null);
    try {
      const res = await window.electronAPI.checkPort(port, server.id);
      setPortCheckResult(res);
      if (!res.isOpen) {
        setIsPortModalOpen(true);
      } else {
        setPortTestSuccess(true);
        setTimeout(() => setPortTestSuccess(null), 3000);
      }
    } catch (e) {
      console.error('Port check failed:', e);
    } finally {
      setIsTestingPort(false);
    }
  };

  // Known property keys map
  const knownKeys = useMemo(() => new Set(MINECRAFT_PROPERTIES.map((p) => p.key)), []);

  // Extra/custom properties currently in server.properties
  const customProperties = useMemo(() => {
    return Object.entries(properties).filter(([key]) => !knownKeys.has(key));
  }, [properties, knownKeys]);

  // Filtered properties based on category, version compatibility, and search
  const filteredProperties = useMemo(() => {
    return MINECRAFT_PROPERTIES.filter((prop) => {
      // 1. Category filter
      if (selectedCategory !== 'all' && selectedCategory !== 'custom') {
        if (prop.category !== selectedCategory) return false;
      }
      if (selectedCategory === 'custom') {
        return false;
      }

      // 2. Version filter
      if (onlySupportedVersions) {
        if (!isPropertySupported(prop, server.version)) {
          return false;
        }
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesKey = prop.key.toLowerCase().includes(q);
        const matchesLabel = prop.label.toLowerCase().includes(q);
        const matchesDesc = prop.description.toLowerCase().includes(q);
        if (!matchesKey && !matchesLabel && !matchesDesc) return false;
      }

      return true;
    });
  }, [selectedCategory, onlySupportedVersions, searchQuery, server.version]);

  // Counts per category for badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, custom: customProperties.length };
    for (const cat of PROPERTY_CATEGORIES) {
      if (cat.id !== 'all' && cat.id !== 'custom') {
        counts[cat.id] = 0;
      }
    }

    for (const prop of MINECRAFT_PROPERTIES) {
      const supported = !onlySupportedVersions || isPropertySupported(prop, server.version);
      if (supported) {
        counts.all++;
        if (counts[prop.category] !== undefined) {
          counts[prop.category]++;
        }
      }
    }

    return counts;
  }, [onlySupportedVersions, server.version, customProperties.length]);

  const categoryIcons: Record<string, React.ReactNode> = {
    all: <Sliders className="w-3.5 h-3.5" />,
    gameplay: <Gamepad2 className="w-3.5 h-3.5" />,
    players: <Users className="w-3.5 h-3.5" />,
    network: <Cpu className="w-3.5 h-3.5" />,
    chat: <MessageSquare className="w-3.5 h-3.5" />,
    remote: <Radio className="w-3.5 h-3.5" />,
    packs: <Package className="w-3.5 h-3.5" />,
    management: <Sparkles className="w-3.5 h-3.5" />,
    custom: <Wrench className="w-3.5 h-3.5" />
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Config Sub-Nav Bar */}
      <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleSubTabChange('visual')}
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
            onClick={() => handleSubTabChange('jvm')}
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
            onClick={() => handleSubTabChange('raw')}
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

        {/* Clean Auto-save Status (No redundant button or idle text) */}
        <div className="flex items-center pr-1">
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Saving changes...</span>
            </div>
          )}

          {saveStatus === 'saved' && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Visual Properties Tab */}
      {activeSubTab === 'visual' && (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950/60 border border-slate-800/80 rounded-xl overflow-hidden">
          {/* Top Filter and Search Bar */}
          <div className="p-3.5 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search properties by name or description..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Version Filter Toggle & Add Custom Button */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlySupportedVersions}
                  onChange={(e) => setOnlySupportedVersions(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-[11px] font-medium text-slate-300">
                  Only show supported for <strong className="text-emerald-400 font-mono">MC {server.version}</strong>
                </span>
              </label>

              <button
                type="button"
                onClick={() => setIsAddingCustom(!isAddingCustom)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Property</span>
              </button>
            </div>
          </div>

          {/* Inline Add Custom Property Form */}
          {isAddingCustom && (
            <form
              onSubmit={handleAddCustomProp}
              className="p-3 bg-slate-900 border-b border-emerald-500/30 flex flex-wrap items-center gap-3 animate-in fade-in"
            >
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Property Key</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. custom-mod-setting"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Value</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. true or 123"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-4">
                <button
                  type="submit"
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                >
                  Save Property
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Category Tabs Header */}
          <div className="px-3 py-2 bg-slate-900/40 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {PROPERTY_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.id] ?? 0;
              const isActive = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap transition ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  {categoryIcons[cat.id]}
                  <span>{cat.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800/80 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Properties Grid Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Standard Defined Properties */}
            {selectedCategory !== 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProperties.map((prop) => {
                  const currentValue = properties[prop.key] !== undefined ? properties[prop.key] : prop.defaultValue;
                  const versionNotice = getPropertyVersionNotice(prop, server.version);
                  const isSupported = isPropertySupported(prop, server.version);

                  return (
                    <div
                      key={prop.key}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between transition ${
                        !isSupported
                          ? 'bg-slate-900/30 border-slate-800/50 opacity-60'
                          : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Label & Badges */}
                      <div className="mb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-slate-200 block">{prop.label}</span>
                            <span className="text-[10px] font-mono text-slate-400">{prop.key}</span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {prop.key === 'server-port' && (
                              <button
                                type="button"
                                onClick={handleTestPort}
                                disabled={isTestingPort}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition disabled:opacity-50"
                              >
                                {isTestingPort ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Testing...</span>
                                  </>
                                ) : portTestSuccess ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>Port Open!</span>
                                  </>
                                ) : (
                                  <>
                                    <Network className="w-3 h-3" />
                                    <span>Test Reachability</span>
                                  </>
                                )}
                              </button>
                            )}

                            {prop.minVersion && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                                  isSupported
                                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {prop.minVersion}+
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {prop.description}
                        </p>

                        {versionNotice && !isSupported && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{versionNotice}</span>
                          </div>
                        )}
                      </div>

                      {/* Property Input Controls */}
                      <div className="pt-2 border-t border-slate-800/60 mt-1">
                        {prop.type === 'boolean' && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-slate-400">
                              {currentValue === 'true' ? (
                                <span className="text-emerald-400 font-semibold">Enabled (true)</span>
                              ) : (
                                <span className="text-slate-500">Disabled (false)</span>
                              )}
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={currentValue === 'true'}
                                onChange={(e) => updateProp(prop.key, e.target.checked ? 'true' : 'false')}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                          </div>
                        )}

                        {prop.type === 'select' && (
                          <select
                            value={currentValue}
                            onChange={(e) => updateProp(prop.key, e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                          >
                            {prop.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {prop.type === 'number' && (
                          <div className="space-y-1.5">
                            <input
                              type="number"
                              min={prop.min}
                              max={prop.max}
                              step={prop.step || 1}
                              value={currentValue}
                              onChange={(e) => updateProp(prop.key, e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                            />
                            {(prop.key === 'view-distance' || prop.key === 'simulation-distance') && (
                              <input
                                type="range"
                                min={prop.min || 4}
                                max={prop.max || 32}
                                value={parseInt(currentValue, 10) || 10}
                                onChange={(e) => updateProp(prop.key, e.target.value)}
                                className="w-full accent-emerald-500 cursor-pointer"
                              />
                            )}
                          </div>
                        )}

                        {/* Special Custom UI for World Seed with Randomize Generators */}
                        {prop.type === 'string' && prop.key === 'level-seed' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={currentValue}
                                onChange={(e) => updateProp(prop.key, e.target.value)}
                                placeholder="Random seed (leave empty for random world)"
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                              />
                              {currentValue && (
                                <button
                                  type="button"
                                  onClick={() => updateProp(prop.key, '')}
                                  className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition"
                                  title="Clear seed"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Randomize Action Buttons */}
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                Randomize:
                              </span>
                              <button
                                type="button"
                                onClick={() => updateProp(prop.key, generateRandomWordSeed())}
                                className="px-2.5 py-1 bg-slate-800/90 hover:bg-slate-750 hover:border-emerald-500/50 text-slate-200 border border-slate-700/80 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition shadow-sm active:scale-95"
                                title="Generate readable multi-word seed"
                              >
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                <span>Word Chain</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => updateProp(prop.key, generateRandomNumericSeed())}
                                className="px-2.5 py-1 bg-slate-800/90 hover:bg-slate-750 hover:border-cyan-500/50 text-slate-200 border border-slate-700/80 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition shadow-sm active:scale-95"
                                title="Generate 64-bit random number seed"
                              >
                                <Dices className="w-3 h-3 text-cyan-400" />
                                <span>Number Seed</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Standard String Input */}
                        {prop.type === 'string' && prop.key !== 'level-seed' && (
                          <input
                            type="text"
                            value={currentValue}
                            onChange={(e) => updateProp(prop.key, e.target.value)}
                            placeholder={prop.placeholder || 'Empty'}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom & Modded Properties Section */}
            {(selectedCategory === 'all' || selectedCategory === 'custom') && customProperties.length > 0 && (
              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-emerald-400" />
                    <span>Custom & Modded Properties ({customProperties.length})</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {customProperties.map(([key, value]) => (
                    <div
                      key={key}
                      className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-mono font-semibold text-emerald-400 truncate block">{key}</span>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => updateProp(key, e.target.value)}
                          className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProp(key)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                        title="Remove property"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty Search Fallback */}
            {filteredProperties.length === 0 && customProperties.length === 0 && (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <Sliders className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                <p className="text-xs">No properties found matching &quot;{searchQuery}&quot;.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setOnlySupportedVersions(false);
                  }}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* JVM & Performance Tab */}
      {activeSubTab === 'jvm' && (
        <div className="flex-1 overflow-y-auto bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 space-y-6 max-w-3xl">
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
                  <span className="font-mono text-emerald-400 font-semibold">{ramMin} GB</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={ramMin}
                  onChange={(e) => handleRamMinChange(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Maximum Memory (-Xmx)</span>
                  <span className="font-mono text-emerald-400 font-semibold">{ramMax} GB</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="32"
                  value={ramMax}
                  onChange={(e) => handleRamMaxChange(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Java Executable Selection */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Coffee className="w-4 h-4 text-emerald-400" />
                <span>Java Runtime Path</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                Required for MC {server.version}: Java {getRequiredJavaVersion(server.version).major}+
              </span>
            </div>

            {detectedJavas.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 block font-medium">Detected Java Installations:</label>
                <select
                  value={javaPath}
                  onChange={(e) => handleJavaPathChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="java">Default System &quot;java&quot; command</option>
                  {detectedJavas.map((j) => (
                    <option key={j.path} value={j.path}>
                      Java {j.major} ({j.version}) — {j.path}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Custom Java Executable:</label>
              <input
                type="text"
                value={javaPath}
                onChange={(e) => handleJavaPathChange(e.target.value)}
                placeholder="e.g. C:\Program Files\Java\jdk-21\bin\java.exe"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* JVM Flags */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>Custom JVM Arguments</span>
              </h3>
              <button
                type="button"
                onClick={handleApplyAikarFlags}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition"
              >
                <span>Apply Aikar&apos;s Flags</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={jvmArgs}
              onChange={(e) => handleJvmArgsChange(e.target.value)}
              placeholder="-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500">
              Advanced garbage collection and VM optimization flags. Aikar&apos;s flags are recommended for best server tick stability.
            </p>
          </div>
        </div>
      )}

      {/* Raw server.properties Tab */}
      {activeSubTab === 'raw' && (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400">Direct server.properties editor</span>
            <span className="text-[11px] text-slate-500">Changes are automatically saved to disk</span>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => handleRawTextChange(e.target.value)}
            className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
          />
        </div>
      )}

      {/* Port Forwarding Warning Modal */}
      <PortWarningModal
        isOpen={isPortModalOpen}
        onClose={() => setIsPortModalOpen(false)}
        onLaunchAnyway={() => setIsPortModalOpen(false)}
        portResult={portCheckResult}
        serverName={server.name}
      />
    </div>
  );
};
