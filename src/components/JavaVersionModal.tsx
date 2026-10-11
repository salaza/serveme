import React from 'react';
import { JavaValidationResult } from '../types';
import {
  Coffee,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Zap,
  X,
  Play,
  HardDrive
} from 'lucide-react';

interface JavaVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  validation: JavaValidationResult | null;
  onSwitchAndLaunch: (newJavaPath: string) => void;
  serverName: string;
  mcVersion: string;
}

export const JavaVersionModal: React.FC<JavaVersionModalProps> = ({
  isOpen,
  onClose,
  validation,
  onSwitchAndLaunch,
  serverName,
  mcVersion
}) => {
  if (!isOpen || !validation) return null;

  const hasCompatible = !!validation.compatibleJavaPath;

  const handleOpenDownload = () => {
    if (validation.downloadUrl) {
      window.electronAPI.openExternalUrl(validation.downloadUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden ring-1 ring-amber-500/20">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-amber-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Java Version Incompatible</h2>
              <p className="text-xs text-amber-400 font-medium">
                Minecraft {mcVersion} requires Java {validation.requiredMajor}+
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

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            The server <strong className="text-white">{serverName}</strong> is currently configured to use{' '}
            <strong className="text-amber-400 font-mono">Java {validation.currentMajor || 'Unknown'}</strong>, but{' '}
            Minecraft <strong className="text-white">{mcVersion}</strong> was compiled for{' '}
            <strong className="text-emerald-400 font-mono">Java {validation.requiredMajor}</strong>.
          </p>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Configured Java Runtime:</span>
              <span className="font-mono text-rose-400 font-semibold">Java {validation.currentMajor || 'Unknown'}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Required Java Runtime:</span>
              <span className="font-mono text-emerald-400 font-semibold">Java {validation.requiredMajor}+</span>
            </div>
            <p className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 mt-2">
              {validation.reason}
            </p>
          </div>

          {/* Compatible Java Found banner */}
          {hasCompatible ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Compatible Java {validation.requiredMajor} detected on your PC!</span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono break-all bg-slate-950/60 p-2 rounded-lg border border-emerald-900/40">
                {validation.compatibleJavaPath}
              </p>
              <p className="text-[11px] text-slate-400">
                Click below to automatically update this server to use this Java path and launch.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-rose-950/40 border border-rose-800/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>No Java {validation.requiredMajor} found on your PC</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                You must install a Java {validation.requiredMajor} JDK (e.g. Microsoft OpenJDK or Eclipse Temurin) to launch this version of Minecraft.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            Cancel
          </button>

          {hasCompatible ? (
            <button
              type="button"
              onClick={() => onSwitchAndLaunch(validation.compatibleJavaPath!)}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Switch to Java {validation.requiredMajor} & Start Server</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenDownload}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition flex items-center gap-2 shadow-lg shadow-blue-950/40"
            >
              <span>Download Java {validation.requiredMajor}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
