import React, { useState } from 'react';
import { ServerInstance, AppSettings } from '../types';
import { ConsoleTab } from './ConsoleTab';
import { ModsTab } from './ModsTab';
import { ConfigTab } from './ConfigTab';
import {
  Terminal,
  Package,
  Sliders,
  Play,
  Square,
  RotateCw,
  FolderOpen,
  Trash2,
  HardDrive,
  Globe,
  Tag,
  AlertCircle
} from 'lucide-react';

import { PortCheckResult, JavaValidationResult } from '../types';
import { PortWarningModal } from './PortWarningModal';
import { JavaVersionModal } from './JavaVersionModal';

interface ServerDashboardProps {
  server: ServerInstance;
  settings: AppSettings;
  onServerUpdated: (server: ServerInstance) => void;
  onServerDeleted: (serverId: string) => void;
}

export const ServerDashboard: React.FC<ServerDashboardProps> = ({
  server,
  settings,
  onServerUpdated,
  onServerDeleted
}) => {
  const [activeTab, setActiveTab] = useState<'console' | 'mods' | 'config'>('console');
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [portWarningResult, setPortWarningResult] = useState<PortCheckResult | null>(null);
  const [isPortModalOpen, setIsPortModalOpen] = useState(false);
  const [javaValidation, setJavaValidation] = useState<JavaValidationResult | null>(null);
  const [isJavaModalOpen, setIsJavaModalOpen] = useState(false);

  const isRunning = server.status === 'running';

  const initiateStart = async () => {
    setIsStarting(true);
    try {
      // 1. Check Java Version compatibility
      const javaVal = await window.electronAPI.validateServerJava({
        mcVersion: server.version,
        javaPath: server.javaPath || 'java'
      });

      if (!javaVal.valid) {
        setJavaValidation(javaVal);
        setIsJavaModalOpen(true);
        setIsStarting(false);
        return;
      }

      // 2. Check Port forwarding
      setIsCheckingPort(true);
      try {
        const check = await window.electronAPI.checkPort(server.port);
        if (!check.isOpen) {
          setPortWarningResult(check);
          setIsPortModalOpen(true);
          setIsStarting(false);
          setIsCheckingPort(false);
          return;
        }
      } catch (err) {
        console.warn('Port check skipped:', err);
      } finally {
        setIsCheckingPort(false);
      }

      await executeStart();
    } catch (e: any) {
      alert(`Error starting server: ${e.message}`);
      setIsStarting(false);
    }
  };

  const handleSwitchJavaAndLaunch = async (newJavaPath: string) => {
    setIsJavaModalOpen(false);
    const updatedServer: ServerInstance = {
      ...server,
      javaPath: newJavaPath
    };
    await window.electronAPI.saveServer(updatedServer);
    onServerUpdated(updatedServer);

    // Proceed with port check & launch
    setIsCheckingPort(true);
    try {
      const check = await window.electronAPI.checkPort(server.port);
      if (!check.isOpen) {
        setPortWarningResult(check);
        setIsPortModalOpen(true);
        setIsCheckingPort(false);
        return;
      }
    } catch (err) {
      console.warn('Port check skipped:', err);
    } finally {
      setIsCheckingPort(false);
    }

    await executeStart();
  };

  const executeStart = async () => {
    setIsPortModalOpen(false);
    setIsStarting(true);
    try {
      const res = await window.electronAPI.startServer(server.id);
      if (!res.success) {
        alert(`Failed to start server: ${res.error}`);
      } else {
        onServerUpdated({ ...server, status: 'running' });
      }
    } catch (e: any) {
      alert(`Error starting server: ${e.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await window.electronAPI.stopServer(server.id);
      onServerUpdated({ ...server, status: 'stopping' });
    } catch (e: any) {
      alert(`Error stopping server: ${e.message}`);
    } finally {
      setIsStopping(false);
    }
  };

  const handleRestart = async () => {
    if (isRunning) {
      await handleStop();
      setTimeout(() => {
        handleStart();
      }, 3000);
    } else {
      handleStart();
    }
  };

  const handleOpenFolder = () => {
    window.electronAPI.openFolder(server.path);
  };

  const handleDelete = async () => {
    const deleteFiles = confirm(`Do you also want to permanently delete the server directory?\n\n${server.path}\n\nClick OK to delete files, or Cancel to just remove from the list.`);
    await window.electronAPI.deleteServer(server.id, deleteFiles);
    onServerDeleted(server.id);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950">
      {/* Top Banner / Server Controls */}
      <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-white tracking-tight">{server.name}</h1>
            {/* Status indicator */}
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
              isRunning
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-800 text-slate-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{server.status}</span>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
            <span className="flex items-center gap-1 text-slate-300 font-mono text-[11px]">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <span className="capitalize">{server.loader}</span> {server.version}
            </span>
            <span className="text-slate-600">&bull;</span>
            <span className="font-mono text-slate-400 text-[11px]">Port: {server.port}</span>
            <span className="text-slate-600">&bull;</span>
            <span className="font-mono text-slate-400 text-[11px]">{server.ramMin}-{server.ramMax} GB RAM</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={isStopping}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-md shadow-rose-950/40 disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isStopping ? 'Stopping...' : 'Stop Server'}</span>
            </button>
          ) : (
            <button
              onClick={initiateStart}
              disabled={isStarting || isCheckingPort}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-md shadow-emerald-950/40 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isCheckingPort ? 'Checking Port...' : isStarting ? 'Starting...' : 'Start Server'}</span>
            </button>
          )}

          <button
            onClick={handleRestart}
            className="p-2 rounded-xl border border-slate-800 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
            title="Restart Server"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleOpenFolder}
            className="p-2 rounded-xl border border-slate-800 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
            title="Open Server Directory in Explorer"
          >
            <FolderOpen className="w-4 h-4" />
          </button>

          <button
            onClick={handleDelete}
            className="p-2 rounded-xl border border-slate-800 bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-400 hover:border-rose-900/60 text-slate-400 transition"
            title="Delete Server"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('console')}
          className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'console'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Console & Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('mods')}
          className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'mods'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Mods & Modlists</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'config'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Configuration & JVM</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-hidden">
        {activeTab === 'console' && (
          <ConsoleTab
            server={server}
            onStart={initiateStart}
            onStop={handleStop}
            isStarting={isStarting || isCheckingPort}
            isStopping={isStopping}
          />
        )}
        {activeTab === 'mods' && (
          <ModsTab
            server={server}
            settings={settings}
          />
        )}
        {activeTab === 'config' && (
          <ConfigTab
            server={server}
            onServerUpdated={onServerUpdated}
          />
        )}
      </div>

      {/* Port Forwarding Warning Modal */}
      <PortWarningModal
        isOpen={isPortModalOpen}
        onClose={() => setIsPortModalOpen(false)}
        onLaunchAnyway={executeStart}
        portResult={portWarningResult}
        serverName={server.name}
      />

      {/* Java Version Warning & Switcher Modal */}
      <JavaVersionModal
        isOpen={isJavaModalOpen}
        onClose={() => setIsJavaModalOpen(false)}
        validation={javaValidation}
        onSwitchAndLaunch={handleSwitchJavaAndLaunch}
        serverName={server.name}
        mcVersion={server.version}
      />
    </div>
  );
};
