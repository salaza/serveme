import React, { useState, useEffect, useRef } from 'react';
import { ServerInstance } from '../types';
import { Terminal, Send, Trash2, ArrowDown, Play, Square, RefreshCw } from 'lucide-react';

interface ConsoleTabProps {
  server: ServerInstance;
  onStart: () => void;
  onStop: () => void;
  isStarting: boolean;
  isStopping: boolean;
}

export const ConsoleTab: React.FC<ConsoleTabProps> = ({
  server,
  onStart,
  onStop,
  isStarting,
  isStopping
}) => {
  const [logs, setLogs] = useState<Array<{ id: number; text: string; type: 'stdout' | 'stderr' | 'system' }>>([]);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to electron server logs
  useEffect(() => {
    const unsubscribe = window.electronAPI.onServerLog((data) => {
      if (data.serverId === server.id) {
        setLogs((prev) => [
          ...prev.slice(-1500), // Keep last 1500 lines for optimal performance
          { id: Date.now() + Math.random(), text: data.log, type: data.type }
        ]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [server.id]);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleSendCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!command.trim() || server.status !== 'running') return;

    window.electronAPI.sendServerCommand(server.id, command.trim());
    setHistory((prev) => [...prev, command.trim()]);
    setHistoryIdx(-1);
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setCommand(history[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(-1);
        setCommand('');
      } else {
        setHistoryIdx(nextIdx);
        setCommand(history[nextIdx] || '');
      }
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const isRunning = server.status === 'running';

  return (
    <div className="flex flex-col h-full bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-hidden shadow-inner">
      {/* Console Top Bar */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold">Server Console</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
            isRunning ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
          }`}>
            {server.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Start / Stop buttons */}
          {isRunning ? (
            <button
              onClick={onStop}
              disabled={isStopping}
              className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg flex items-center gap-1.5 font-medium transition text-xs disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isStopping ? 'Stopping...' : 'Stop Server'}</span>
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={isStarting}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 font-medium transition text-xs disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isStarting ? 'Starting...' : 'Start Server'}</span>
            </button>
          )}

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-lg border text-xs transition ${
              autoScroll ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Toggle Auto-scroll"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={clearLogs}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition text-xs"
            title="Clear Console Output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto console-bg text-slate-200 text-xs font-mono select-text space-y-0.5 leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic select-none py-12 text-center">
            {isRunning ? 'Listening for server logs...' : 'Server is offline. Press "Start Server" to boot up.'}
          </div>
        ) : (
          logs.map((item) => {
            const isErr = item.type === 'stderr';
            const isSys = item.type === 'system';
            return (
              <div
                key={item.id}
                className={`whitespace-pre-wrap break-all ${
                  isErr ? 'text-rose-400' : isSys ? 'text-amber-400 font-semibold' : 'text-slate-300'
                }`}
              >
                {item.text}
              </div>
            );
          })
        )}
      </div>

      {/* Command Input Bar */}
      <form onSubmit={handleSendCommand} className="p-2.5 bg-slate-900/95 border-t border-slate-800 flex items-center gap-2">
        <span className="text-slate-500 font-mono text-xs pl-2 font-bold">&gt;</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isRunning}
          placeholder={isRunning ? "Type command (e.g., 'say Hello', 'op Player', 'help')..." : "Server must be running to execute commands"}
          className="flex-1 bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none font-mono py-1"
        />
        <button
          type="submit"
          disabled={!isRunning || !command.trim()}
          className="px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
