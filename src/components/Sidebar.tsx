import React from 'react';
import { ServerInstance } from '../types';
import { Plus, Server, Settings, Terminal, Shield, FolderOpen, Play, Square, Circle } from 'lucide-react';

interface SidebarProps {
  servers: ServerInstance[];
  selectedServer: ServerInstance | null;
  onSelectServer: (server: ServerInstance) => void;
  onOpenCreateModal: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  servers,
  selectedServer,
  onSelectServer,
  onOpenCreateModal,
  onOpenSettings
}) => {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shadow-sm">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-slate-100 flex items-center gap-1.5">
              SERVER <span className="text-emerald-400 font-extrabold">BUILDER</span>
            </h1>
            <span className="text-[10px] text-slate-400 block font-mono">Dedicated Server Hub</span>
          </div>
        </div>
      </div>

      {/* Action Button: Create Server */}
      <div className="p-3">
        <button
          onClick={onOpenCreateModal}
          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/40 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Server</span>
        </button>
      </div>

      {/* Server List */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5">
        <div className="px-2 py-1 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          Servers ({servers.length})
        </div>

        {servers.length === 0 ? (
          <div className="text-center py-8 px-3 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
            <p>No servers yet.</p>
            <p className="mt-1 text-[11px] text-slate-600">Click &quot;Create New Server&quot; to begin.</p>
          </div>
        ) : (
          servers.map((srv) => {
            const isSelected = selectedServer?.id === srv.id;
            const isRunning = srv.status === 'running';

            return (
              <div
                key={srv.id}
                onClick={() => onSelectServer(srv)}
                className={`group p-2.5 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900/40 hover:bg-slate-800/50 border-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {srv.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isRunning ? (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-600"></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="capitalize text-slate-400 font-mono text-[10px]">
                    {srv.loader} {srv.version}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    :{srv.port}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Global Settings */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Global Settings</span>
        </button>
      </div>
    </aside>
  );
};
