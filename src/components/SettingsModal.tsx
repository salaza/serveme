import React, { useState, useEffect } from 'react';
import { AppSettings, ModProvider } from '../types';
import { Settings, Folder, Key, Coffee, Save, X, Check, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings
}) => {
  const [defaultDir, setDefaultDir] = useState(settings.defaultServersDir);
  const [curseKey, setCurseKey] = useState(settings.curseForgeApiKey);
  const [preferredProvider, setPreferredProvider] = useState<ModProvider>(settings.preferredModProvider || 'modrinth');
  const [defaultJava, setDefaultJava] = useState(settings.defaultJavaPath || 'java');
  const [detectedJavas, setDetectedJavas] = useState<Array<{ path: string; version: string; isDefault: boolean }>>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDefaultDir(settings.defaultServersDir);
      setCurseKey(settings.curseForgeApiKey);
      setPreferredProvider(settings.preferredModProvider || 'modrinth');
      setDefaultJava(settings.defaultJavaPath || 'java');

      window.electronAPI.detectJava().then((list) => {
        setDetectedJavas(list);
      });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    const selected = await window.electronAPI.selectDirectory();
    if (selected) {
      setDefaultDir(selected);
    }
  };

  const handleSave = () => {
    const newSettings: AppSettings = {
      defaultServersDir: defaultDir,
      curseForgeApiKey: curseKey,
      preferredModProvider: preferredProvider,
      defaultJavaPath: defaultJava
    };
    onSaveSettings(newSettings);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Global Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Default Servers Directory */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Default Servers Directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={defaultDir}
                onChange={(e) => setDefaultDir(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleSelectFolder}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition"
              >
                <Folder className="w-4 h-4" />
                <span>Browse</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              New dedicated server folders will be placed here by default.
            </p>
          </div>

          {/* Preferred Mod Provider */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Preferred Mod Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPreferredProvider('modrinth')}
                className={`p-3 rounded-xl border text-left transition ${
                  preferredProvider === 'modrinth'
                    ? 'bg-emerald-500/10 border-emerald-500/60 ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-white">Modrinth</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-medium">
                    No Key Needed
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Open community repository with high download speeds and open APIs.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPreferredProvider('curseforge')}
                className={`p-3 rounded-xl border text-left transition ${
                  preferredProvider === 'curseforge'
                    ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-white">CurseForge</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 font-medium">
                    API Key
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Large catalog of legacy and classic mods. Requires a free API key below.
                </p>
              </button>
            </div>
          </div>

          {/* CurseForge API Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>CurseForge API Key (Optional)</span>
              </span>
              <a
                href="https://console.curseforge.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Get Free API Key &rarr;
              </a>
            </label>
            <input
              type="password"
              value={curseKey}
              onChange={(e) => setCurseKey(e.target.value)}
              placeholder="e.g. $2a$10$..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Required only if you wish to download mods directly from CurseForge.
            </p>
          </div>

          {/* Detected Java Versions */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-emerald-400" />
              <span>Detected Java Runtimes</span>
            </label>
            <div className="space-y-2">
              {detectedJavas.map((j) => (
                <div
                  key={j.path}
                  onClick={() => setDefaultJava(j.path)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    defaultJava === j.path
                      ? 'bg-emerald-950/40 border-emerald-500/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-200">
                      Java {j.version}
                    </span>
                    <p className="text-[10px] text-slate-500 font-mono truncate max-w-sm">
                      {j.path}
                    </p>
                  </div>
                  {defaultJava === j.path && (
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Selected
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition flex items-center gap-2 shadow-sm"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
