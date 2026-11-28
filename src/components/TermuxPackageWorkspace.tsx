import React, { useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  Check,
  Download,
  Loader2,
  PackagePlus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { TermuxHealthInfo } from '../types/ide';
import { useI18n, TranslationKey } from '../services/i18n';
import {
  CORE_TERMUX_PIP_PACKAGES,
  CORE_TERMUX_PKG_PACKAGES,
  normalizeTermuxPkgName,
} from '../services/termuxBridge';
import {
  PACKAGE_CATALOG,
  PACKAGE_CATEGORIES,
  PackageCategoryId,
  PackageTier,
  TERMUX_PKG_NAME_HINTS,
  fuzzyMatchPackages,
} from '../data/packageCatalog';

interface TermuxPackageWorkspaceProps {
  healthInfo: TermuxHealthInfo | null;
  onInstallInTermux: (mode: 'pip' | 'pkg', target: string) => Promise<void>;
  onUpgradeAllTermux?: (kind: 'pip' | 'pkg') => Promise<void>;
  onUpgradeAllPackages?: () => Promise<void>;
  onUninstallInTermux?: (mode: 'pip' | 'pkg', target: string) => Promise<void>;
  upgradingTermux?: boolean;
  termuxRunning?: boolean;
  activeTermuxTask?: string | null;
  busyAction: string | null;
  onBusyActionChange: (action: string | null) => void;
}

export const TermuxPackageWorkspace: React.FC<TermuxPackageWorkspaceProps> = ({
  healthInfo,
  onInstallInTermux,
  onUpgradeAllTermux,
  onUpgradeAllPackages,
  onUninstallInTermux,
  upgradingTermux = false,
  termuxRunning = false,
  activeTermuxTask = null,
  busyAction,
  onBusyActionChange,
}) => {
  const { t } = useI18n();
  const setBusyAction = onBusyActionChange;
  const [installMode, setInstallMode] = useState<'pip' | 'pkg'>('pip');
  const [pkgTarget, setPkgTarget] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | PackageTier>('all');
  const [catFilter, setCatFilter] = useState<PackageCategoryId>('all');

  const termuxCatalogItems = useMemo(
    () => PACKAGE_CATALOG.filter((item) => Boolean(item.termux)),
    []
  );
  const filteredCatalog = useMemo(
    () =>
      termuxCatalogItems.filter((item) => {
        if (tierFilter !== 'all' && item.tier !== tierFilter) return false;
        if (catFilter !== 'all' && item.category !== catFilter) return false;
        return true;
      }),
    [termuxCatalogItems, tierFilter, catFilter]
  );
  const fuzzyResults = useMemo(() => {
    const query = pkgTarget.trim();
    if (!query) return [];
    return fuzzyMatchPackages(query, termuxCatalogItems, { runtime: 'all', limit: 6 });
  }, [pkgTarget, termuxCatalogItems]);
  const termuxNameHint = useMemo(() => {
    const key = pkgTarget.trim().toLowerCase();
    return key ? TERMUX_PKG_NAME_HINTS[key] ?? null : null;
  }, [pkgTarget]);

  const handleInstallSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = pkgTarget.trim();
    if (!clean || busyAction || termuxRunning || upgradingTermux) return;
    setBusyAction(`install:${clean}`);
    try {
      await onInstallInTermux(installMode, clean);
      setPkgTarget('');
    } finally {
      setBusyAction(null);
    }
  };

  const handleQuickInstall = async (mode: 'pkg' | 'pip', target: string) => {
    if (busyAction || termuxRunning || upgradingTermux) return;
    setBusyAction(`install:${target}`);
    try {
      await onInstallInTermux(mode, target);
      setPkgTarget('');
    } finally {
      setBusyAction(null);
    }
  };

  const handleUninstallTarget = async (mode: 'pkg' | 'pip', target: string) => {
    const clean = target.trim();
    if (!clean || !onUninstallInTermux || busyAction || termuxRunning || upgradingTermux) return;
    setBusyAction(`uninstall:${clean}`);
    try {
      await onUninstallInTermux(mode, clean);
      if (pkgTarget.trim() === clean) setPkgTarget('');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
        <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-[var(--ide-accent)] shrink-0" />
              <span>{t('tmx_pkg_title')}</span>
            </h3>
            <p className="text-xs text-[var(--ide-text-muted)] mt-0.5">
              {t('tmx_pkg_desc')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 max-w-full">
            {onUpgradeAllPackages && (
              <button
                type="button"
                disabled={!!busyAction || termuxRunning || upgradingTermux}
                onClick={() => void onUpgradeAllPackages()}
                className="min-h-[44px] px-3 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {upgradingTermux ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{t('tmx_upgrade_all_btn')}</span>
              </button>
            )}
            {onUpgradeAllTermux && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={!!busyAction || termuxRunning || upgradingTermux}
                  onClick={() => void onUpgradeAllTermux('pip')}
                  className="min-h-[44px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  {upgradingTermux ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--ide-accent)] shrink-0" />
                  ) : (
                    <ArrowUpCircle className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
                  )}
                  <span>{t('tmx_upgrade_pip_btn')}</span>
                </button>
                <button
                  type="button"
                  disabled={!!busyAction || termuxRunning || upgradingTermux}
                  onClick={() => void onUpgradeAllTermux('pkg')}
                  className="min-h-[44px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-accent)] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
                  <span>{t('tmx_upgrade_pkg_btn')}</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ide-surface-alt)] border border-[var(--ide-border)]">
              <button
                type="button"
                onClick={() => setInstallMode('pip')}
                className={`min-h-[44px] px-3 rounded-lg text-xs font-mono font-medium transition-colors ${
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
                className={`min-h-[44px] px-3 rounded-lg text-xs font-mono font-medium transition-colors ${
                  installMode === 'pkg'
                    ? 'bg-[var(--ide-surface)] text-[var(--ide-text)] shadow-sm'
                    : 'text-[var(--ide-text-muted)]'
                }`}
              >
                pkg
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <form onSubmit={handleInstallSubmit} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="relative flex-1 min-w-0 w-full sm:w-auto">
              <Search className="w-4 h-4 text-[var(--ide-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={pkgTarget}
                onChange={(e) => setPkgTarget(e.target.value)}
                placeholder={
                  installMode === 'pkg'
                    ? t('tmx_pkg_placeholder_pkg')
                    : t('tmx_pkg_placeholder_pip')
                }
                className="w-full min-w-0 min-h-[44px] pl-10 pr-4 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={!pkgTarget.trim() || !!busyAction || termuxRunning || upgradingTermux}
                className="min-h-[44px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-sm font-medium disabled:opacity-40 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                {(busyAction?.startsWith('install:') || activeTermuxTask?.startsWith('install:')) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{t('tmx_install_btn')}</span>
              </button>
              {onUninstallInTermux && (
                <button
                  type="button"
                  disabled={!pkgTarget.trim() || !!busyAction || termuxRunning || upgradingTermux}
                  onClick={() => void handleUninstallTarget(installMode, pkgTarget)}
                  className="min-h-[44px] px-3.5 rounded-xl border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-medium disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  {busyAction?.startsWith('uninstall:') ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>{t('tmx_uninstall_btn')}</span>
                </button>
              )}
            </div>
          </form>

          {/* Termux Prebuilt APT Naming Hint */}
          {termuxNameHint && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1 text-amber-900 dark:text-amber-200">
                <span className="font-semibold">{t('pkg_termux_hint_title')}</span>
                <span>{termuxNameHint.reason}</span>
              </div>
              <button
                type="button"
                disabled={!!busyAction || termuxRunning || upgradingTermux}
                onClick={() => void handleQuickInstall(termuxNameHint.suggestedMode, termuxNameHint.suggestedTarget)}
                className="min-h-[44px] px-3 rounded-lg bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold shrink-0 max-w-full text-center transition-colors"
              >
                {t('pkg_termux_hint_btn', { target: termuxNameHint.suggestedTarget })}
              </button>
            </div>
          )}

          {/* Fuzzy Autocomplete Suggestions */}
          {pkgTarget.trim().length > 0 && fuzzyResults.length > 0 && (
            <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] overflow-hidden divide-y divide-[var(--ide-border)]">
              <div className="px-3.5 py-2 bg-[var(--ide-surface-alt)] text-[11px] font-medium text-[var(--ide-text-muted)]">
                {t('pkg_fuzzy_header')}
              </div>
              {fuzzyResults.map(({ item, matchedAlias }) => {
                const tmx = item.termux!;
                const isBusy = busyAction === `install:${tmx.targetName}`;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-[var(--ide-surface)] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setInstallMode(tmx.mode);
                        setPkgTarget(tmx.targetName);
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--ide-text)]">
                        <span>{tmx.targetName}</span>
                        <span className="text-[10px] font-semibold tracking-wide rounded-md px-2 py-1 bg-[var(--ide-surface-alt)] text-[var(--ide-accent-text)] shrink-0">
                          {tmx.mode === 'pkg' ? 'Termux APT' : item.id === 'polars' ? 'TUR 第三方' : 'PyPI 預設'}
                        </span>
                        {matchedAlias && (
                          <span className="font-sans font-normal text-[11px] text-[var(--ide-accent-text)]">
                            · {t('pkg_fuzzy_alias', { alias: matchedAlias })}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--ide-text-muted)] truncate mt-0.5">
                        {item.desc}
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={!!busyAction || termuxRunning || upgradingTermux}
                      onClick={() => void handleQuickInstall(tmx.mode, tmx.targetName)}
                      className="min-h-[44px] px-3 rounded-lg bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-40 text-white text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>{t('pkg_install_short')}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Popular/Niche Tier Toggle + Category Strip */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ide-surface-alt)] border border-[var(--ide-border)]">
              {(['all', 'popular', 'niche'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTierFilter(tier)}
                  className={`min-h-[44px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    tierFilter === tier
                      ? 'bg-[var(--ide-surface)] text-[var(--ide-accent-text)] font-semibold shadow-xs'
                      : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                  }`}
                >
                  {t(`pkg_tier_${tier}` as TranslationKey)}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[var(--ide-text-muted)] tabular-nums">
              {t('pkg_loaded_count', { count: filteredCatalog.length })}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {PACKAGE_CATEGORIES.map((cat) => {
              const active = catFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCatFilter(cat.id)}
                  className={`min-h-[44px] px-3 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'border-[var(--ide-accent)] bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] font-semibold'
                      : 'border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
                  }`}
                >
                  {t(cat.labelKey as TranslationKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pr-0.5">
          {filteredCatalog.map((item) => {
            const tmx = item.termux!;
            const isBusyInstall = busyAction === `install:${tmx.targetName}` || activeTermuxTask === `install:${tmx.targetName}`;
            const isBusyUninstall = busyAction === `uninstall:${tmx.targetName}` || activeTermuxTask === `uninstall:${tmx.targetName}`;
            const normTarget = normalizeTermuxPkgName(tmx.targetName);
            const pipInstalled =
              tmx.mode === 'pip' &&
              Boolean(
                healthInfo?.installedPipPackages?.some(
                  (p) => normalizeTermuxPkgName(p) === normTarget
                )
              );
            const nativePkgTarget = item.id === 'polars' ? 'python-polars' : tmx.targetName;
            const pkgInstalled =
              (tmx.mode === 'pkg' || item.id === 'polars') &&
              ((nativePkgTarget === 'clang' && Boolean(healthInfo?.hasClang)) ||
                (nativePkgTarget === 'ffmpeg' && Boolean(healthInfo?.hasFfmpeg)) ||
                Boolean(
                  healthInfo?.installedPkgPackages?.some(
                    (p) => p.toLowerCase() === nativePkgTarget.toLowerCase()
                  )
                ));
            const alreadyInstalled = pipInstalled || pkgInstalled;
            const isCorePkg =
              tmx.mode === 'pip'
                ? CORE_TERMUX_PIP_PACKAGES.has(tmx.targetName.toLowerCase())
                : CORE_TERMUX_PKG_PACKAGES.has(tmx.targetName.toLowerCase());
            return (
              <div
                key={item.id}
                className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-colors ${
                  alreadyInstalled
                    ? 'border-[var(--ide-accent)]/50 bg-[var(--ide-accent-soft)]/50'
                    : 'border-[var(--ide-border)] bg-[var(--ide-bg)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--ide-text)] truncate">
                      {tmx.targetName}
                    </span>
                    <span className="text-[10px] font-semibold tracking-wide rounded-md px-2 py-1 bg-[var(--ide-surface-alt)] text-[var(--ide-accent-text)] shrink-0">
                      {tmx.mode === 'pkg' ? 'Termux APT' : item.id === 'polars' ? 'TUR 第三方' : 'PyPI 預設'}
                    </span>
                    {alreadyInstalled && (
                      <Check className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--ide-text-muted)] mt-1 line-clamp-2 leading-relaxed">
                    {item.desc}
                  </div>
                  <div className="text-[10px] text-[var(--ide-text-muted)] mt-1 line-clamp-2 leading-relaxed">
                    {item.runtimeHint}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] text-[var(--ide-text-muted)] truncate">
                    {item.tier === 'popular' ? t('pkg_tier_popular') : t('pkg_tier_niche')}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {alreadyInstalled && !isCorePkg && onUninstallInTermux && (
                      <button
                        type="button"
                        disabled={!!busyAction || termuxRunning || upgradingTermux}
                        onClick={() => void handleUninstallTarget(tmx.mode, tmx.targetName)}
                        className="min-h-[44px] px-3 rounded-lg border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-[11px] font-medium whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-40"
                      >
                        {isBusyUninstall ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        <span>{t('pkg_uninstall_btn')}</span>
                      </button>
                    )}
                    {!alreadyInstalled && (
                      <button
                        type="button"
                        disabled={!!busyAction || termuxRunning || upgradingTermux}
                        onClick={() => void handleQuickInstall(tmx.mode, tmx.targetName)}
                        className="min-h-[44px] px-3 rounded-lg bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-[11px] font-medium whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-40"
                      >
                        {isBusyInstall ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>{t('pkg_install_short')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>

    </>
  );
};
