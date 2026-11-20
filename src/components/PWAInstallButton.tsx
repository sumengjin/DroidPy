import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useI18n } from '../services/i18n';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useI18n();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    if (compact) return null;
    return (
      <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--ide-accent-text)]">
        <CheckCircle2 className="w-4 h-4" />
        <span>{t('pwa_installed')}</span>
      </div>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white font-medium transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{t('pwa_install_android')}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] text-[var(--ide-text)] hover:border-[var(--ide-accent)] font-medium transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
        }`}
      >
        <Smartphone className="w-4 h-4 shrink-0 text-[var(--ide-accent)]" />
        <span>{isIOS ? t('pwa_guide_ios') : t('pwa_guide_android')}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--ide-surface)] border border-[var(--ide-border)] p-6 shadow-xl text-[var(--ide-text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">
                {isIOS ? t('pwa_modal_ios') : t('pwa_modal_android')}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label={t('pwa_got_it')}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:bg-[var(--ide-accent-soft)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-sm text-[var(--ide-text-muted)] list-decimal pl-5">
                <li>{t('pwa_ios_1')}</li>
                <li>{t('pwa_ios_2')}</li>
                <li>{t('pwa_ios_3')}</li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-sm text-[var(--ide-text-muted)] list-decimal pl-5">
                <li>{t('pwa_and_1')}</li>
                <li>{t('pwa_and_2')}</li>
                <li>{t('pwa_and_3')}</li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-sm font-medium transition-colors"
            >
              {t('pwa_got_it')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
