import React, { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { 
  Download, 
  Monitor, 
  CheckCircle2, 
  Copy, 
  ShieldCheck, 
  FolderCheck, 
  Terminal, 
  Sparkles
} from 'lucide-react';

interface DownloadDesktopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadDesktopModal: React.FC<DownloadDesktopModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleDownloadPackage = () => {
    window.open('http://localhost:3001/api/download/desktop', '_blank');
  };

  const handleDownloadLauncher = () => {
    window.open('http://localhost:3001/api/download/exe', '_blank');
  };

  /**
   * The launcher by name, not by one machine's path.
   *
   * This copied `C:\Users\Lloyd\Documents\Projects\Capstone\Alpha-v2\start-alpha.bat`
   * to every user's clipboard — a directory nobody else has. The browser cannot
   * know where someone cloned Alpha, and the file sits at the root of that
   * checkout, so naming it is the honest answer.
   */
  const LAUNCHER_FILE = 'start-alpha.bat';

  const handleCopyPath = () => {
    navigator.clipboard.writeText(LAUNCHER_FILE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Download Alpha Desktop (Windows .exe)"
      subtitle="Run Alpha natively with full filesystem access, 1-click execution, and direct folder selection."
    >
      <div className="space-y-5 text-xs text-gray-300">
        {/* Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-600/20 via-indigo-600/15 to-purple-600/20 border border-brand-500/30 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 flex-shrink-0">
            <Monitor className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              Alpha v2 Desktop Standalone
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Ready for Windows
              </span>
            </div>
            <p className="text-gray-400 text-[11px] leading-relaxed">
              Eliminates browser sandbox limits. AI agents read & write code directly into your local repositories with zero upload dialogs.
            </p>
          </div>
        </div>

        {/* Action Download Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Primary .EXE / Full Platform Bundle */}
          <div className="p-4 rounded-xl bg-well border border-white/10 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-xs">Full Desktop Bundle</span>
                <span className="text-[10px] font-mono text-brand-400">v2.0.0</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Includes full runtime engine, SQLite database, and complete offline frontend bundle.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadPackage}
              className="w-full py-2.5 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 font-semibold text-on-accent transition-all shadow-glow-brand flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Full Package (.zip)</span>
            </button>
          </div>

          {/* 1-Click Launcher .BAT */}
          <div className="p-4 rounded-xl bg-well border border-white/10 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-xs">1-Click Local Launcher</span>
                <span className="text-[10px] font-mono text-emerald-400">Instant</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Starts both frontend & backend daemons simultaneously on your machine.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadLauncher}
              className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 font-medium text-white transition-colors flex items-center justify-center gap-2 border border-white/10"
            >
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Download start-alpha.bat</span>
            </button>
          </div>
        </div>

        {/* Feature Comparison / Highlights */}
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Why Use Native Desktop Mode
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="p-3 rounded-xl bg-surface border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-white">
                <FolderCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Native Folders</span>
              </div>
              <p className="text-gray-400 text-[10px]">Direct path selection without browser "Upload" prompts.</p>
            </div>
            <div className="p-3 rounded-xl bg-surface border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-white">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>Zero Latency</span>
              </div>
              <p className="text-gray-400 text-[10px]">Instant IPC communication with local AI subagents.</p>
            </div>
            <div className="p-3 rounded-xl bg-surface border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-white">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Allowlist Sandbox</span>
              </div>
              <p className="text-gray-400 text-[10px]">Tree-kill safety & rate-limiting protection on all runs.</p>
            </div>
          </div>
        </div>

        {/* Local File Path Reference */}
        <div className="p-3 rounded-xl bg-well border border-white/5 flex items-center justify-between gap-2 font-mono text-[11px]">
          <div className="truncate text-gray-400">
            <span className="text-gray-500">Launcher: </span>
            <span>{LAUNCHER_FILE}</span>
            <span className="text-gray-600"> — in your Alpha folder</span>
          </div>
          <button
            type="button"
            onClick={handleCopyPath}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 transition-colors flex-shrink-0"
            title="Copy launcher path"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </Modal>
  );
};
