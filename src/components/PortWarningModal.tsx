import React, { useState } from 'react';
import { PortCheckResult } from '../types';
import {
  AlertTriangle,
  Globe,
  ExternalLink,
  Copy,
  Check,
  X,
  Play,
  ShieldAlert,
  Server,
  Network
} from 'lucide-react';

interface PortWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchAnyway: () => void;
  portResult: PortCheckResult | null;
  serverName: string;
}

export const PortWarningModal: React.FC<PortWarningModalProps> = ({
  isOpen,
  onClose,
  onLaunchAnyway,
  portResult,
  serverName
}) => {
  const [copiedIp, setCopiedIp] = useState(false);

  if (!isOpen || !portResult) return null;

  const handleCopyIp = () => {
    navigator.clipboard.writeText(portResult.localIp);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const handleOpenRouter = async () => {
    await window.electronAPI.openRouterSettings(portResult.gatewayIp);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-600/40 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden ring-1 ring-amber-500/20">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-amber-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Port Forwarding Warning</h2>
              <p className="text-xs text-amber-400/90 font-medium">
                Port {portResult.port} is not accessible externally
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-slate-300 leading-relaxed">
            Players outside your home Wi-Fi/LAN won&apos;t be able to connect to{' '}
            <strong className="text-white">{serverName}</strong> because port{' '}
            <span className="font-mono text-amber-400 font-bold">{portResult.port}</span> is not forwarded to this computer on your router.
          </p>

          {/* Network details card */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Network className="w-4 h-4 text-emerald-400" />
                Your Local PC IP:
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-emerald-400 font-semibold">{portResult.localIp}</span>
                <button
                  type="button"
                  onClick={handleCopyIp}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                  title="Copy IP"
                >
                  {copiedIp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-400" />
                Router Gateway IP:
              </span>
              <span className="font-mono text-blue-400 font-semibold">{portResult.gatewayIp}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-amber-400" />
                Server Port:
              </span>
              <span className="font-mono text-amber-400 font-bold">{portResult.port} (TCP/UDP)</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed space-y-1">
            <p className="font-medium text-slate-300">How to forward on your router:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
              <li>Click &quot;Open Router Settings in Browser&quot; below.</li>
              <li>Log in and navigate to <strong className="text-slate-300">Port Forwarding / NAT</strong>.</li>
              <li>Add a rule forwarding port <strong className="text-slate-300">{portResult.port}</strong> to your PC IP <strong className="text-slate-300">{portResult.localIp}</strong>.</li>
            </ol>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onLaunchAnyway}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Anyway (LAN / Local)</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOpenRouter}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-950/40"
            >
              <span>Open Router ({portResult.gatewayIp})</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
