import React, { useState, useEffect } from 'react';
import { ServerInstance, AppSettings } from './types';
import { Sidebar } from './components/Sidebar';
import { ServerDashboard } from './components/ServerDashboard';
import { CreateServerModal } from './components/CreateServerModal';
import { SettingsModal } from './components/SettingsModal';
import { Plus, Server, Layers, Cpu, Terminal, Sparkles } from 'lucide-react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col items-center justify-center">
          <div className="max-w-md w-full bg-slate-900 border border-rose-900/60 p-6 rounded-2xl shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold text-xl">
              ⚠️
            </div>
            <h2 className="text-base font-bold text-white">Something went wrong</h2>
            <p className="text-xs text-rose-300 font-mono p-3 bg-rose-950/40 rounded-xl border border-rose-900/40 break-all text-left">
              {this.state.error?.message || 'Unknown render error'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition"
            >
              Dismiss & Continue
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AppContent: React.FC = () => {
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    defaultServersDir: '',
    defaultJavaPath: 'java',
    curseForgeApiKey: '',
    preferredModProvider: 'modrinth'
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load initial data
  const loadData = async () => {
    try {
      const [loadedServers, loadedSettings] = await Promise.all([
        window.electronAPI.getServers(),
        window.electronAPI.getSettings()
      ]);
      setServers(loadedServers);
      setSettings(loadedSettings);

      if (loadedServers.length > 0 && !selectedServerId) {
        setSelectedServerId(loadedServers[0].id);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for server status changes
    const unsub = window.electronAPI.onServerStatusChange(({ serverId, status }) => {
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, status: status as any } : s))
      );
    });

    return () => {
      unsub();
    };
  }, []);

  const selectedServer = servers.find((s) => s.id === selectedServerId) || null;

  const handleServerCreated = (newServer: ServerInstance) => {
    setServers((prev) => [...prev, newServer]);
    setSelectedServerId(newServer.id);
  };

  const handleServerUpdated = (updatedServer: ServerInstance) => {
    setServers((prev) =>
      prev.map((s) => (s.id === updatedServer.id ? updatedServer : s))
    );
  };

  const handleServerDeleted = (deletedId: string) => {
    setServers((prev) => prev.filter((s) => s.id !== deletedId));
    if (selectedServerId === deletedId) {
      const remaining = servers.filter((s) => s.id !== deletedId);
      setSelectedServerId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await window.electronAPI.saveSettings(newSettings);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        servers={servers}
        selectedServer={selectedServer}
        onSelectServer={(srv) => setSelectedServerId(srv.id)}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedServer ? (
          <ServerDashboard
            server={selectedServer}
            settings={settings}
            onServerUpdated={handleServerUpdated}
            onServerDeleted={handleServerDeleted}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
            <div className="max-w-md space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/20">
                <Server className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Welcome to Game Server Builder
                </h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Easily build and manage dedicated servers for Minecraft and more. Support for Fabric, Forge, NeoForge, Paper, Modrinth & CurseForge integrations, JSON modlists, and full configuration editors.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                  <Layers className="w-4 h-4 text-emerald-400 mb-1.5" />
                  <h3 className="text-xs font-semibold text-white">Mods & Modlists</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Modrinth & CurseForge search with JSON import/export.</p>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                  <Terminal className="w-4 h-4 text-emerald-400 mb-1.5" />
                  <h3 className="text-xs font-semibold text-white">Live Console</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Interactive terminal logs with command execution.</p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition shadow-lg shadow-emerald-950/40 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Server</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <CreateServerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onServerCreated={handleServerCreated}
        settings={settings}
        existingServers={servers}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
};

export const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);
