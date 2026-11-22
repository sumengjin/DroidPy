import React, { useState } from 'react';
import {
  Terminal,
  PlugZap,
  Copy,
  Check,
  Download,
  Play,
  PackagePlus,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Loader2,
  Cpu,
} from 'lucide-react';
import {
  ExecutionEngine,
  PythonFile,
  TermuxConfig,
  TermuxConnectionState,
  TermuxHealthInfo,
} from '../types/ide';
import {
  buildTermuxBridgeScript,
  buildTermuxOneLineCommand,
} from '../services/termuxBridge';
import { useI18n } from '../services/i18n';
import { downloadBlob } from '../utils/downloadBlob';

interface TermuxIntegrationPanelProps {
  engine: ExecutionEngine;
  onChangeEngine: (engine: ExecutionEngine) => void;
  config: TermuxConfig;
  onUpdateConfig: (patch: Partial<TermuxConfig>) => void;
  connectionState: TermuxConnectionState;
  connectionError: string | null;
  healthInfo: TermuxHealthInfo | null;
  activeFile: PythonFile;
  onTestConnection: () => Promise<void>;
  onInstallInTermux: (mode: 'pip' | 'pkg', target: string) => Promise<void>;
  onRunInTermux: () => Promise<void>;
  onRunShellInTermux: (cmd: string) => Promise<void>;
  onInitializeEmbeddedEnv: (includeBaseSystem: boolean) => Promise<void>;
  onNotify: (msg: string) => void;
}

const TERMUX_QUICK_ITEMS: { mode: 'pkg' | 'pip'; target: string; desc: string }[] = [
  { mode: 'pip', target: 'requests', desc: '爬蟲 / HTTP 網路請求核心' },
  { mode: 'pip', target: 'beautifulsoup4', desc: '網頁 HTML 爬蟲結構解析' },
  { mode: 'pip', target: 'httpx', desc: '非同步高速爬蟲請求庫' },
  { mode: 'pip', target: 'yt-dlp', desc: '多媒體串流擷取工具' },
  { mode: 'pkg', target: 'ffmpeg', desc: '原生 C/C++ 影音處理核心' },
  { mode: 'pkg', target: 'clang', desc: 'Android 原生 C/C++ 編譯器' },
  { mode: 'pkg', target: 'cmake', desc: '原生擴充套件建置系統' },
  { mode: 'pip', target: 'fastapi', desc: '高效能非同步 Web 框架' },
];

export const TermuxIntegrationPanel: React.FC<TermuxIntegrationPanelProps> = ({
  engine,
  onChangeEngine,
  config,
  onUpdateConfig,
  connectionState,
  connectionError,
  healthInfo,
  activeFile,
  onTestConnection,
  onInstallInTermux,
  onRunInTermux,
  onRunShellInTermux,
  onInitializeEmbeddedEnv,
  onNotify,
}) => {
  const { t } = useI18n();
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [installMode, setInstallMode] = useState<'pip' | 'pkg'>('pip');
  const [pkgTarget, setPkgTarget] = useState('');
  const [shellCmd, setShellCmd] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const oneLineCmd = buildTermuxOneLineCommand(config.token);

  const handleCopyBootstrap = async () => {
    try {
      await navigator.clipboard.writeText(oneLineCmd);
      setCopiedCmd(true);
      onNotify(t('tmx_copied_cmd'));
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      onNotify(t('files_clipboard_err'));
    }
  };

  const handleDownloadBridgePy = async () => {
    const content = buildTermuxBridgeScript(config.token);
    const blob = new Blob([content], { type: 'text/x-python;charset=utf-8' });
    await downloadBlob(blob, 'droidpy_bridge.py');
    onNotify('droidpy_bridge.py');
  };

  const handleInstallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pkgTarget.trim();
    if (!clean || busyAction) return;
    setBusyAction(`install:${clean}`);
    try {
      await onInstallInTermux(installMode, clean);
      setPkgTarget('');
    } finally {
      setBusyAction(null);
    }
  };

  const handleQuickInstall = async (mode: 'pkg' | 'pip', target: string) => {
    if (busyAction) return;
    setBusyAction(`install:${target}`);
    try {
      await onInstallInTermux(mode, target);
    } finally {
      setBusyAction(null);
    }
  };

  const handleShellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = shellCmd.trim();
    if (!clean || busyAction) return;
    setBusyAction('shell');
    try {
      await onRunShellInTermux(clean);
      setShellCmd('');
    } finally {
      setBusyAction(null);
    }
  };

  const handleInitEmbedded = async (includeBaseSystem: boolean) => {
    if (busyAction) return;
    setBusyAction(includeBaseSystem ? 'init:full' : 'init:crawler');
    try {
      await onInitializeEmbeddedEnv(includeBaseSystem);
    } finally {
      setBusyAction(null);
    }
  };

  const isConnected = connectionState === 'connected';
  const isChecking = connectionState === 'checking';

  return (
    <section className="space-y-5">
      {/* Section Header + Engine Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Terminal className="w-5 h-5 text-[var(--ide-accent)]" />
            <span>{t('tmx_title')}</span>
          </h2>
          <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">
            {t('tmx_desc')}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ide-surface-alt)] border border-[var(--ide-border)]">
          <button
            type="button"
            onClick={() => onChangeEngine('pyodide')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              engine === 'pyodide'
                ? 'bg-[var(--ide-surface)] text-[var(--ide-text)] shadow-sm'
                : 'text-[var(--ide-text-muted)]'
            }`}
          >
            {t('tmx_engine_py')}
          </button>
          <button
            type="button"
            onClick={() => onChangeEngine('termux')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              engine === 'termux'
                ? 'bg-[var(--ide-accent)] text-white shadow-sm'
                : 'text-[var(--ide-text-muted)]'
            }`}
          >
            {t('tmx_engine_tmx')}
          </button>
        </div>
      </div>

      {/* Connection Config & Live Health Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <PlugZap className="w-4 h-4 text-[var(--ide-accent)]" />
              <span>{t('tmx_conn_title')}</span>
            </h3>
            <span
              className={`text-xs font-medium whitespace-nowrap ${
                isConnected
                  ? 'text-[var(--ide-accent-text)]'
                  : connectionState === 'error'
                  ? 'text-red-500'
                  : 'text-[var(--ide-text-muted)]'
              }`}
            >
              {isConnected
                ? t('tmx_state_ok')
                : isChecking
                ? t('tmx_state_checking')
                : connectionState === 'error'
                ? t('tmx_state_err')
                : t('tmx_state_off')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-[var(--ide-text-muted)] mb-1">
                {t('tmx_endpoint_label')}
              </label>
              <input
                type="url"
                value={config.endpointUrl}
                onChange={(e) => onUpdateConfig({ endpointUrl: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--ide-text-muted)] mb-1">
                {t('tmx_token_label')}
              </label>
              <input
                type="text"
                value={config.token}
                onChange={(e) => onUpdateConfig({ token: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono"
              />
            </div>
          </div>

          {connectionError && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{connectionError}</span>
            </div>
          )}

          {healthInfo && isConnected && (
            <div className="rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] p-3 text-xs space-y-1 font-mono tabular-nums">
              <div className="text-[var(--ide-accent-text)] font-sans font-medium">
                {healthInfo.embedded ? t('tmx_env_embedded') : t('tmx_env_external')}
                <span aria-hidden="true"> · </span>
                {healthInfo.hasPython === false ? t('tmx_py_missing') : t('tmx_py_ready')}
              </div>
              <div>Python : {healthInfo.pythonVersion} ({healthInfo.arch})</div>
              <div>Clang  : {healthInfo.hasClang ? t('tmx_ready') : t('tmx_not_installed')}</div>
              <div>FFmpeg : {healthInfo.hasFfmpeg ? t('tmx_ready') : t('tmx_not_installed')}</div>
              <div className="truncate">{t('tmx_dir')} : {healthInfo.workspaceDir}</div>
              {healthInfo.installedPipPackages && healthInfo.installedPipPackages.length > 0 && (
                <div className="pt-1.5 mt-1.5 border-t border-[var(--ide-border)] font-sans">
                  <div className="text-[11px] font-medium text-[var(--ide-text-muted)]">
                    {t('tmx_installed_pkgs')}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-[var(--ide-text)] leading-relaxed break-words">
                    {healthInfo.installedPipPackages.join(' · ')}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onTestConnection}
              disabled={isChecking}
              className="min-h-[42px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{t('tmx_test_btn')}</span>
            </button>
            <button
              type="button"
              onClick={onRunInTermux}
              disabled={!!busyAction}
              className="min-h-[42px] px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium inline-flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
              <span>{t('tmx_run_file_btn', { name: activeFile.name })}</span>
            </button>
          </div>
        </div>

        {/* One-line Bootstrap Setup Card */}
        <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t('tmx_bootstrap_title')}</h3>
            <a
              href="termux://"
              className="text-xs font-medium text-[var(--ide-accent-text)] inline-flex items-center gap-1 hover:underline"
            >
              <span>{t('tmx_open_app')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <ol className="text-xs text-[var(--ide-text-muted)] space-y-1.5 list-decimal pl-4 leading-relaxed">
            <li>{t('tmx_step1')}</li>
            <li>{t('tmx_step2')}</li>
            <li>{t('tmx_step3')}</li>
          </ol>

          <div className="rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] p-3 font-mono text-[11px] text-[var(--ide-text-muted)] break-all max-h-24 overflow-y-auto ide-scroll">
            {oneLineCmd}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyBootstrap}
              className="min-h-[42px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-2 transition-colors"
            >
              {copiedCmd ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCmd ? t('tmx_copied_cmd') : t('tmx_copy_cmd')}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadBridgePy}
              className="min-h-[42px] px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-xs font-medium inline-flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{t('tmx_dl_bridge')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* One-Tap Embedded APK Python + Crawler Initialization Card */}
      <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-5 space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--ide-accent)]" />
            <span>{t('tmx_init_title')}</span>
          </h3>
          <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">
            {t('tmx_init_desc')}
          </p>
        </div>

        <div className="rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] px-3.5 py-2.5 font-mono text-[11px] text-[var(--ide-text-muted)] overflow-x-auto no-scrollbar whitespace-nowrap">
          pkg update -y && pkg install -y python clang libxml2 libxslt && pip install requests beautifulsoup4 lxml httpx
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!!busyAction}
            onClick={() => void handleInitEmbedded(true)}
            className="min-h-[44px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors"
          >
            {busyAction === 'init:full' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {busyAction === 'init:full' ? t('tmx_init_running') : t('tmx_init_btn_full')}
            </span>
          </button>

          <button
            type="button"
            disabled={!!busyAction}
            onClick={() => void handleInitEmbedded(false)}
            className="min-h-[44px] px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] disabled:opacity-50 text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors"
          >
            {busyAction === 'init:crawler' ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-accent)]" />
            ) : (
              <PackagePlus className="w-4 h-4 text-[var(--ide-accent)]" />
            )}
            <span>{t('tmx_init_btn_crawler')}</span>
          </button>
        </div>
      </div>

      {/* Termux Remote Package & Tool Installer */}
      <div className="rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-[var(--ide-accent)]" />
              <span>{t('tmx_pkg_title')}</span>
            </h3>
            <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">
              {t('tmx_pkg_desc')}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ide-surface-alt)] border border-[var(--ide-border)]">
            <button
              type="button"
              onClick={() => setInstallMode('pip')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-mono font-medium transition-colors ${
                installMode === 'pip'
                  ? 'bg-[var(--ide-surface)] text-[var(--ide-text)] shadow-sm'
                  : 'text-[var(--ide-text-muted)]'
              }`}
            >
              pip
            </button>
            <button
              type="button"
              onClick={() => setInstallMode('pkg')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-mono font-medium transition-colors ${
                installMode === 'pkg'
                  ? 'bg-[var(--ide-surface)] text-[var(--ide-text)] shadow-sm'
                  : 'text-[var(--ide-text-muted)]'
              }`}
            >
              pkg
            </button>
          </div>
        </div>

        <form onSubmit={handleInstallSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={pkgTarget}
            onChange={(e) => setPkgTarget(e.target.value)}
            placeholder={
              installMode === 'pkg'
                ? t('tmx_pkg_placeholder_pkg')
                : t('tmx_pkg_placeholder_pip')
            }
            className="flex-1 min-w-0 min-h-[44px] px-4 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
          />
          <button
            type="submit"
            disabled={!pkgTarget.trim() || !!busyAction}
            className="min-h-[44px] px-5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-sm font-medium disabled:opacity-40 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            {busyAction?.startsWith('install:') ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{t('tmx_install_btn')}</span>
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {TERMUX_QUICK_ITEMS.map((item) => {
            const isBusy = busyAction === `install:${item.target}`;
            const pipInstalled =
              item.mode === 'pip' &&
              Boolean(
                healthInfo?.installedPipPackages?.some(
                  (p) => p.toLowerCase().replace(/_/g, '-') === item.target.toLowerCase().replace(/_/g, '-')
                )
              );
            const pkgInstalled =
              item.mode === 'pkg' &&
              ((item.target === 'clang' && Boolean(healthInfo?.hasClang)) ||
                (item.target === 'ffmpeg' && Boolean(healthInfo?.hasFfmpeg)) ||
                Boolean(
                  healthInfo?.installedPkgPackages?.some(
                    (p) => p.toLowerCase() === item.target.toLowerCase()
                  )
                ));
            const alreadyInstalled = pipInstalled || pkgInstalled;
            return (
              <button
                key={`${item.mode}-${item.target}`}
                type="button"
                disabled={!!busyAction}
                onClick={() => handleQuickInstall(item.mode, item.target)}
                className={`p-3 rounded-xl border text-left transition-colors disabled:opacity-50 ${
                  alreadyInstalled
                    ? 'border-[var(--ide-accent)]/50 bg-[var(--ide-accent-soft)]/50'
                    : 'border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[var(--ide-text)]">
                    {item.mode} {item.target}
                  </span>
                  {isBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--ide-accent)]" />
                  ) : alreadyInstalled ? (
                    <Check className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
                  ) : null}
                </div>
                <div className="text-[11px] text-[var(--ide-text-muted)] mt-1 truncate">
                  {item.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Direct Termux Shell Command Runner */}
        <form onSubmit={handleShellSubmit} className="pt-2 border-t border-[var(--ide-border)] flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[var(--ide-accent-text)] shrink-0">
            $
          </span>
          <input
            type="text"
            value={shellCmd}
            onChange={(e) => setShellCmd(e.target.value)}
            placeholder={t('tmx_shell_placeholder')}
            className="flex-1 min-w-0 min-h-[42px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
          />
          <button
            type="submit"
            disabled={!shellCmd.trim() || !!busyAction}
            className="min-h-[42px] px-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-xs font-medium whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            {busyAction === 'shell' ? t('tmx_shell_running') : t('tmx_shell_btn')}
          </button>
        </form>
      </div>
    </section>
  );
};
