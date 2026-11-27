import React, { useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  Check,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { EditorSettings, ExecutionEngine, InstalledPackage, PyodideStatus } from '../types/ide';
import { useI18n, TranslationKey } from '../services/i18n';
import { PACKAGE_CATALOG, PACKAGE_CATEGORIES, PackageCategoryId, PackageTier, fuzzyMatchPackages } from '../data/packageCatalog';
import { OutdatedPackageInfo, PYODIDE_CORE_PACKAGES, normalizePyPkgName } from '../services/pyodideRuntime';

interface PyodidePackageWorkspaceProps {
  settings: EditorSettings;
  onUpdateSettings: (patch: Partial<EditorSettings>) => void;
  engine: ExecutionEngine;
  onChangeEngine: (engine: ExecutionEngine) => void;
  pyodideStatus: PyodideStatus;
  installedPackages: InstalledPackage[];
  onInstallPackage: (pkg: string) => Promise<void>;
  onRefreshPackages: () => Promise<void>;
  outdatedPackages?: OutdatedPackageInfo[];
  checkingOutdated?: boolean;
  upgradingPackages?: boolean;
  onUpgradePackage?: (pkg: string) => Promise<void>;
  onUninstallPackage?: (pkg: string) => Promise<void>;
  onCheckAndUpgradeAll?: () => Promise<void>;
  onUpgradeAllPackages?: () => Promise<void>;
  upgradingTermux?: boolean;
  activePyodidePackage?: string | null;
  onGenerateRequirements: () => void;
  onInstallRequirements: () => Promise<void>;
}

export const PyodidePackageWorkspace: React.FC<PyodidePackageWorkspaceProps> = ({
  settings,
  onUpdateSettings,
  engine,
  onChangeEngine,
  pyodideStatus,
  installedPackages,
  onInstallPackage,
  onRefreshPackages,
  outdatedPackages = [],
  checkingOutdated = false,
  upgradingPackages = false,
  onUpgradePackage,
  onUninstallPackage,
  onCheckAndUpgradeAll,
  onUpgradeAllPackages,
  upgradingTermux = false,
  activePyodidePackage = null,
  onGenerateRequirements,
  onInstallRequirements,
}) => {
  const { t } = useI18n();
  const [pkgQuery, setPkgQuery] = useState('');
  const [installingPkg, setInstallingPkg] = useState<string | null>(null);
  const [uninstallingPkg, setUninstallingPkg] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<'all' | PackageTier>('all');
  const [catFilter, setCatFilter] = useState<PackageCategoryId>('all');

  const pyodideCatalog = useMemo(
    () => PACKAGE_CATALOG.filter((item) => Boolean(item.pyodide?.supported)),
    []
  );
  const filteredPyCatalog = useMemo(
    () => pyodideCatalog.filter((item) => {
      if (tierFilter !== 'all' && item.tier !== tierFilter) return false;
      if (catFilter !== 'all' && item.category !== catFilter) return false;
      return true;
    }),
    [pyodideCatalog, tierFilter, catFilter]
  );
  const fuzzyPyResults = useMemo(() => {
    const query = pkgQuery.trim();
    if (!query) return [];
    return fuzzyMatchPackages(query, PACKAGE_CATALOG, { runtime: 'pyodide', limit: 6 });
  }, [pkgQuery]);
  const outdatedMap = useMemo(() => {
    const map = new Map<string, OutdatedPackageInfo>();
    for (const item of outdatedPackages) map.set(normalizePyPkgName(item.name), item);
    return map;
  }, [outdatedPackages]);

  const handleInstall = async (target: string) => {
    const clean = target.trim();
    if (!clean || installingPkg || activePyodidePackage || uninstallingPkg) return;
    setInstallingPkg(clean);
    try {
      await onInstallPackage(clean);
      setPkgQuery('');
    } finally {
      setInstallingPkg(null);
    }
  };

  const handleUninstall = async (target: string) => {
    const clean = target.trim();
    if (!clean || !onUninstallPackage || installingPkg || activePyodidePackage || uninstallingPkg) return;
    setUninstallingPkg(clean);
    try {
      await onUninstallPackage(clean);
    } finally {
      setUninstallingPkg(null);
    }
  };

  return (
          <div className="space-y-4">
            {/* Sandbox Add-on Enable / Disable Switch */}
            <div className="dp-panel p-3.5 sm:p-4 flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t('addon_sandbox_title')}</div>
                <div className="text-xs text-[var(--ide-text-muted)] mt-0.5 leading-relaxed">
                  {t('addon_sandbox_desc')}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(settings.enableSandboxAddon)}
                aria-label={t('addon_sandbox_title')}
                onClick={() => {
                  const nextVal = !settings.enableSandboxAddon;
                  onUpdateSettings({ enableSandboxAddon: nextVal });
                  if (!nextVal && engine === 'pyodide') {
                    onChangeEngine('termux');
                  }
                }}
                className="dp-switch min-h-[36px] w-14 rounded-full p-1 flex items-center shrink-0"
              >
                <span className="w-6 h-6 rounded-full" />
              </button>
            </div>

            {!settings.enableSandboxAddon && engine !== 'pyodide' ? (
              <p className="px-1 text-xs text-[var(--ide-text-muted)]">
                {t('pkg_sandbox_disabled_desc')}
              </p>
            ) : (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {(onUpgradeAllPackages || onCheckAndUpgradeAll) && (
                    <button
                      type="button"
                      onClick={() => void (onUpgradeAllPackages ?? onCheckAndUpgradeAll)!()}
                      disabled={
                        checkingOutdated ||
                        upgradingPackages ||
                        upgradingTermux ||
                        pyodideStatus === 'loading'
                      }
                      className="min-h-[40px] px-3.5 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-40 text-white text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                      {checkingOutdated || upgradingPackages || upgradingTermux ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{t('pkg_upgrade_all')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onGenerateRequirements}
                    className="min-h-[40px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors whitespace-nowrap"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                    <span>{t('pkg_req_gen')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onInstallRequirements()}
                    disabled={!!installingPkg || !!activePyodidePackage || !!uninstallingPkg}
                    className="min-h-[40px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium flex items-center gap-2 hover:border-[var(--ide-accent)] disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                    <span>{t('pkg_req_install')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRefreshPackages}
                    disabled={pyodideStatus === 'loading'}
                    className="min-h-[40px] px-3.5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs font-medium flex items-center gap-2 hover:border-[var(--ide-accent)] transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('pkg_refresh')}</span>
                  </button>
                </div>

                {/* Install Input + Fuzzy Autocomplete */}
                <div className="space-y-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleInstall(pkgQuery);
                    }}
                    className="flex items-center gap-2"
                  >
                    <div className="relative flex-1 min-w-0">
                      <Search className="w-4 h-4 text-[var(--ide-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={pkgQuery}
                        onChange={(e) => setPkgQuery(e.target.value)}
                        placeholder={t('pkg_placeholder')}
                        className="w-full min-w-0 min-h-[44px] pl-10 pr-4 rounded-xl bg-[var(--ide-surface)] border border-[var(--ide-border)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!pkgQuery.trim() || !!installingPkg || !!activePyodidePackage}
                      className="min-h-[50px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                    >
                      {installingPkg || activePyodidePackage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>{installingPkg || activePyodidePackage ? t('pkg_installing') : t('pkg_install')}</span>
                    </button>
                  </form>

                  {pkgQuery.trim().length > 0 && fuzzyPyResults.length > 0 && (
                    <div className="divide-y divide-[var(--ide-border)]">
                      <div className="px-1 py-2 text-xs font-medium text-[var(--ide-text-muted)]">
                        {t('pkg_fuzzy_header')}
                      </div>
                      {fuzzyPyResults.map(({ item, matchedAlias }) => {
                        const targetPkg = item.pyodide?.packageName ?? item.name;
                        const normTarget = normalizePyPkgName(targetPkg);
                        const isInstalled = installedPackages.some(
                          (p) => normalizePyPkgName(p.name) === normTarget
                        );
                        const isCoreSystem = PYODIDE_CORE_PACKAGES.has(normTarget);
                        const isBusyInstall = installingPkg === targetPkg || activePyodidePackage === targetPkg;
                        const isBusyUninstall = uninstallingPkg === targetPkg;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-[var(--ide-bg)] transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() => setPkgQuery(targetPkg)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--ide-text)]">
                                <span className="truncate">{targetPkg}</span>
                                {matchedAlias && (
                                  <span className="font-sans font-normal text-[11px] text-[var(--ide-accent-text)] shrink-0">
                                    · {t('pkg_fuzzy_alias', { alias: matchedAlias })}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[var(--ide-text-muted)] truncate mt-0.5">
                                {item.desc}
                              </div>
                            </button>
                            {isInstalled && !isCoreSystem && onUninstallPackage ? (
                              <button
                                type="button"
                                disabled={!!installingPkg || !!activePyodidePackage || !!uninstallingPkg}
                                onClick={() => void handleUninstall(targetPkg)}
                                className="min-h-[34px] px-3 rounded-lg border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 disabled:opacity-40"
                              >
                                {isBusyUninstall ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                                <span>{t('pkg_uninstall_btn')}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isInstalled || !!installingPkg || !!activePyodidePackage || !!uninstallingPkg}
                                onClick={() => void handleInstall(targetPkg)}
                                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                                  isInstalled
                                    ? 'bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)]'
                                    : 'bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white disabled:opacity-40'
                                }`}
                              >
                                {isBusyInstall ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : isInstalled ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {isInstalled ? t('pkg_installed') : t('pkg_install_short')}
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Auto-update Packages on Startup Toggle + C/C++ Note */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="dp-panel p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[var(--ide-text)]">
                        {t('pkg_auto_update_title')}
                      </div>
                      <p className="text-[11px] text-[var(--ide-text-muted)] mt-0.5 leading-relaxed">
                        {t('pkg_auto_update_desc')}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(settings.autoUpdatePackages)}
                      aria-label={t('pkg_auto_update_title')}
                      onClick={() =>
                        onUpdateSettings({ autoUpdatePackages: !settings.autoUpdatePackages })
                      }
                      className="dp-switch min-h-[36px] w-14 rounded-full p-1 flex items-center shrink-0"
                    >
                      <span className="w-6 h-6 rounded-full" />
                    </button>
                  </div>

                  <div className="dp-panel p-4 text-xs text-[var(--ide-text-muted)] space-y-1">
                    <div className="font-semibold text-[var(--ide-text)]">{t('pkg_cpp_title')}</div>
                    <p className="leading-relaxed">{t('pkg_cpp_desc')}</p>
                  </div>
                </div>

                {/* Categorized Popular & Niche Packages Catalog */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {(['all', 'popular', 'niche'] as const).map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => setTierFilter(tier)}
                          aria-pressed={tierFilter === tier}
                          className="dp-nav-item min-h-[36px] px-3 rounded-lg text-xs font-medium whitespace-nowrap"
                        >
                          {t(`pkg_tier_${tier}` as TranslationKey)}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-[var(--ide-text-muted)] tabular-nums">
                      {t('pkg_loaded_count', { count: filteredPyCatalog.length })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain touch-pan-x no-scrollbar pb-0.5">
                    {PACKAGE_CATEGORIES.map((cat) => {
                      const active = catFilter === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCatFilter(cat.id)}
                          aria-pressed={active}
                          className="dp-nav-item min-h-[36px] px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0"
                        >
                          {t(cat.labelKey as TranslationKey)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 pr-0.5">
                    {filteredPyCatalog.map((item) => {
                      const targetName = item.pyodide?.packageName ?? item.name;
                      const normTarget = normalizePyPkgName(targetName);
                      const isInstalled = installedPackages.some(
                        (p) => normalizePyPkgName(p.name) === normTarget
                      );
                      const isCoreSystem = PYODIDE_CORE_PACKAGES.has(normTarget);
                      const isBusyInstall = installingPkg === targetName || activePyodidePackage === targetName;
                      const isBusyUninstall = uninstallingPkg === targetName;
                      return (
                        <div
                          key={item.id}
                          className="dp-workspace-row min-h-[84px] flex items-center justify-between gap-3 py-3"
                        >
                          <div className="min-w-0">
                            <div className="font-mono text-sm font-semibold text-[var(--ide-text)] truncate flex items-center gap-1.5">
                              <span className="truncate">{targetName}</span>
                              {isInstalled && (
                                <Check className="w-3.5 h-3.5 text-[var(--ide-accent)] shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-[var(--ide-text-muted)] line-clamp-2 mt-0.5 leading-relaxed">
                              {item.desc}
                            </div>
                            <div className="text-[11px] text-[var(--ide-text-muted)] truncate mt-1">
                              {item.tier === 'popular'
                                ? t('pkg_tier_popular')
                                : t('pkg_tier_niche')}{' '}
                              · {item.runtimeHint}
                            </div>
                          </div>
                          {isInstalled && !isCoreSystem && onUninstallPackage ? (
                            <button
                              type="button"
                              disabled={!!installingPkg || !!activePyodidePackage || !!uninstallingPkg}
                              onClick={() => void handleUninstall(targetName)}
                              className="min-h-[38px] px-3 rounded-xl border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors disabled:opacity-40"
                            >
                              {isBusyUninstall ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>{t('pkg_uninstall_btn')}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isInstalled || !!installingPkg || !!activePyodidePackage || !!uninstallingPkg}
                              onClick={() => void handleInstall(targetName)}
                              className={`min-h-[40px] px-3 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors ${
                                isInstalled
                                  ? 'bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)]'
                                  : 'bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white disabled:opacity-40'
                              }`}
                            >
                              {isBusyInstall ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isInstalled ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : null}
                              <span>
                                {isInstalled
                                  ? t('pkg_installed')
                                  : isBusyInstall
                                  ? t('pkg_installing')
                                  : t('pkg_install_short')}
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Installed Packages Table */}
                <div className="dp-panel overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--ide-border)] flex items-center justify-between text-xs font-medium text-[var(--ide-text-muted)]">
                    <span>{t('pkg_loaded_title')}</span>
                    <span className="tabular-nums">
                      {t('pkg_loaded_count', { count: installedPackages.length })}
                    </span>
                  </div>
                  {installedPackages.length === 0 ? (
                    <div className="p-4 text-xs text-[var(--ide-text-muted)]">
                      {t('pkg_loaded_empty')}
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--ide-border)] max-h-64 overflow-y-auto ide-scroll">
                      {installedPackages.map((pkg) => {
                        const normName = normalizePyPkgName(pkg.name);
                        const outdated = outdatedMap.get(normName);
                        const isCoreSystem = PYODIDE_CORE_PACKAGES.has(normName);
                        const isBusyUninstall = uninstallingPkg === pkg.name;
                        return (
                          <div
                            key={pkg.name}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-mono font-medium text-[var(--ide-text)] truncate block">
                                {pkg.name}
                              </span>
                              {outdated && (
                                <span className="font-mono text-[11px] text-[var(--ide-accent-text)] font-semibold">
                                  {pkg.version} → {outdated.latestVersion}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono tabular-nums text-[var(--ide-text-muted)]">
                                {pkg.version}
                              </span>
                              {outdated && onUpgradePackage ? (
                                <button
                                  type="button"
                                  disabled={upgradingPackages || !!installingPkg || !!uninstallingPkg}
                                  onClick={() => void onUpgradePackage(pkg.name)}
                                  className="min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors bg-[var(--ide-accent)] text-white hover:bg-[var(--ide-accent-hover)] disabled:opacity-40"
                                >
                                  {t('pkg_upgrade_btn')}
                                </button>
                              ) : !isCoreSystem ? (
                                <span className="text-[11px] text-[var(--ide-text-muted)] whitespace-nowrap">
                                  {t('pkg_status_latest')}
                                </span>
                              ) : null}
                              {!isCoreSystem && onUninstallPackage && (
                                <button
                                  type="button"
                                  disabled={upgradingPackages || !!installingPkg || !!uninstallingPkg}
                                  onClick={() => void handleUninstall(pkg.name)}
                                  aria-label={`${t('pkg_uninstall_btn')} ${pkg.name}`}
                                  className="min-h-[30px] px-2.5 rounded-lg border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-[11px] font-medium whitespace-nowrap inline-flex items-center gap-1 transition-colors disabled:opacity-40"
                                >
                                  {isBusyUninstall ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                  <span>{t('pkg_uninstall_btn')}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

  );
};
