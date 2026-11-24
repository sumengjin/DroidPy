import React, { useEffect, useMemo, useState } from 'react';
import {
  Globe,
  RotateCw,
  ExternalLink,
  Cookie,
  FileCode2,
  Copy,
  Check,
  Plus,
  Trash2,
  Terminal,
  Smartphone,
  Monitor,
  Loader2,
  FileJson,
  ClipboardPaste,
  Bookmark,
  ShieldCheck,
} from 'lucide-react';
import {
  CrawlerSessionData,
  TermuxConfig,
  UrlProbeResult,
} from '../types/ide';
import { probeUrlViaTermux } from '../services/termuxBridge';
import { useI18n } from '../services/i18n';
import { copyTextReliable } from '../utils/clipboard';
import {
  DESKTOP_CHROME_UA,
  MOBILE_ANDROID_UA,
  buildBookmarkletCode,
  buildCookieHeaderString,
  buildCookiesJsonContent,
  buildPythonCrawlerScript,
  mergeCookieLists,
  normalizeUrlInput,
  parseRawCrawlerInput,
  parseSetCookieLines,
} from '../utils/crawlerSession';

interface CrawlerBrowserPanelProps {
  session: CrawlerSessionData;
  onChangeSession: (next: CrawlerSessionData) => void;
  termuxConfig: TermuxConfig;
  termuxConnected: boolean;
  onSaveWorkspaceFile: (filename: string, content: string, openInEditor?: boolean) => void;
  onNotify: (msg: string) => void;
}

type BrowserSubTab = 'preview' | 'cookies' | 'import';

const QUICK_PRESETS = [
  { label: 'Quotes Scrape', url: 'https://quotes.toscrape.com/' },
  { label: 'HTTPBin Cookies', url: 'https://httpbin.org/cookies' },
  { label: 'HTTPBin Headers', url: 'https://httpbin.org/headers' },
];

export const CrawlerBrowserPanel: React.FC<CrawlerBrowserPanelProps> = ({
  session,
  onChangeSession,
  termuxConfig,
  termuxConnected,
  onSaveWorkspaceFile,
  onNotify,
}) => {
  const { t } = useI18n();
  const [subTab, setSubTab] = useState<BrowserSubTab>('preview');
  const [urlInput, setUrlInput] = useState<string>(session.url);
  const [loadedUrl, setLoadedUrl] = useState<string>(session.url);
  const [iframeNonce, setIframeNonce] = useState<number>(0);
  const [probing, setProbing] = useState<boolean>(false);
  const [probeResult, setProbeResult] = useState<UrlProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  const [newCookieName, setNewCookieName] = useState('');
  const [newCookieValue, setNewCookieValue] = useState('');
  const [rawImportText, setRawImportText] = useState('');
  const [copiedKey, setCopiedKey] = useState<'py' | 'bookmarklet' | null>(null);

  const isNativeApk = useMemo(
    () => typeof window !== 'undefined' && Boolean(window.DroidPyNative?.openCrawlerBrowser),
    []
  );

  const isDesktopUa = session.userAgent === DESKTOP_CHROME_UA;
  const enabledCookiesCount = session.cookies.filter((c) => c.enabled).length;
  const bookmarkletCode = useMemo(() => buildBookmarkletCode(), []);

  useEffect(() => {
    setUrlInput(session.url);
    setLoadedUrl(session.url);
  }, [session.url]);

  const navigateTo = (rawUrl: string) => {
    const clean = normalizeUrlInput(rawUrl);
    setUrlInput(clean);
    setLoadedUrl(clean);
    setIframeNonce((n) => n + 1);
    onChangeSession({ ...session, url: clean });
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(urlInput);
  };

  const handleToggleUa = () => {
    const nextUa = isDesktopUa ? MOBILE_ANDROID_UA : DESKTOP_CHROME_UA;
    onChangeSession({ ...session, userAgent: nextUa });
  };

  const handleOpenNativeBrowser = () => {
    const clean = normalizeUrlInput(urlInput);
    onChangeSession({ ...session, url: clean });
    window.DroidPyNative?.openCrawlerBrowser?.(clean, isDesktopUa);
  };

  const handleProbeViaTermux = async () => {
    const clean = normalizeUrlInput(urlInput);
    setUrlInput(clean);
    setProbing(true);
    setProbeError(null);
    try {
      const result = await probeUrlViaTermux(termuxConfig, {
        url: clean,
        userAgent: session.userAgent,
        cookieHeader: buildCookieHeaderString(session.cookies),
        extraHeaders: session.extraHeaders,
      });
      setProbeResult(result);
      onChangeSession({ ...session, url: result.finalUrl || clean });
      onNotify(
        t('brw_toast_probed', {
          code: result.statusCode,
          count: result.setCookies.length,
        })
      );
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : String(err));
    } finally {
      setProbing(false);
    }
  };

  const handleImportProbeSetCookies = () => {
    if (!probeResult || probeResult.setCookies.length === 0) return;
    const parsed = parseSetCookieLines(probeResult.setCookies);
    if (parsed.length === 0) return;
    const merged = mergeCookieLists(session.cookies, parsed);
    onChangeSession({
      ...session,
      cookies: merged,
      capturedAt: Date.now(),
    });
    onNotify(t('brw_toast_imported', { count: parsed.length }));
    setSubTab('cookies');
  };

  const handleAddCookie = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCookieName.trim();
    if (!name) return;
    const merged = mergeCookieLists(session.cookies, [
      { name, value: newCookieValue, enabled: true },
    ]);
    onChangeSession({
      ...session,
      cookies: merged,
      capturedAt: Date.now(),
    });
    setNewCookieName('');
    setNewCookieValue('');
  };

  const handleToggleCookie = (index: number) => {
    const next = session.cookies.map((item, idx) =>
      idx === index ? { ...item, enabled: !item.enabled } : item
    );
    onChangeSession({ ...session, cookies: next });
  };

  const handleDeleteCookie = (index: number) => {
    const next = session.cookies.filter((_, idx) => idx !== index);
    onChangeSession({ ...session, cookies: next });
  };

  const handleSaveCookiesJson = () => {
    const content = buildCookiesJsonContent(session);
    onSaveWorkspaceFile('cookies.json', content, false);
    onNotify(t('brw_toast_saved_json', { count: enabledCookiesCount }));
  };

  const handleGenerateCrawlerPy = () => {
    const cookiesContent = buildCookiesJsonContent(session);
    onSaveWorkspaceFile('cookies.json', cookiesContent, false);
    const pyContent = buildPythonCrawlerScript(session);
    onSaveWorkspaceFile('crawler_session.py', pyContent, true);
    onNotify(t('brw_toast_gen_py'));
  };

  const handleCopyPython = async () => {
    const ok = await copyTextReliable(buildPythonCrawlerScript(session));
    if (ok) {
      setCopiedKey('py');
      onNotify(t('brw_toast_copied_py'));
      window.setTimeout(() => setCopiedKey(null), 1800);
    } else {
      onNotify(t('files_clipboard_err'));
    }
  };

  const handleCopyBookmarklet = async () => {
    const ok = await copyTextReliable(bookmarkletCode);
    if (ok) {
      setCopiedKey('bookmarklet');
      onNotify(t('brw_toast_copied_bookmarklet'));
      window.setTimeout(() => setCopiedKey(null), 1800);
    } else {
      onNotify(t('files_clipboard_err'));
    }
  };

  const handleParseImport = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseRawCrawlerInput(rawImportText);
    if (
      parsed.cookies.length === 0 &&
      !parsed.url &&
      !parsed.userAgent &&
      Object.keys(parsed.extraHeaders).length === 0
    ) {
      onNotify(t('brw_toast_import_empty'));
      return;
    }

    const nextUrl = parsed.url ? normalizeUrlInput(parsed.url) : session.url;
    const mergedCookies = mergeCookieLists(session.cookies, parsed.cookies);
    onChangeSession({
      url: nextUrl,
      userAgent: parsed.userAgent ?? session.userAgent,
      cookies: mergedCookies,
      extraHeaders: { ...session.extraHeaders, ...parsed.extraHeaders },
      capturedAt: Date.now(),
    });
    if (parsed.url) {
      setUrlInput(nextUrl);
      setLoadedUrl(nextUrl);
    }
    setRawImportText('');
    onNotify(t('brw_toast_imported', { count: parsed.cookies.length }));
    setSubTab('cookies');
  };

  return (
    <div className="h-full flex flex-col bg-[var(--ide-surface)] text-[var(--ide-text)] overflow-hidden">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 sm:px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface-alt)] shrink-0">
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] overflow-x-auto no-scrollbar max-w-full">
          <button
            type="button"
            onClick={() => setSubTab('preview')}
            className={`min-h-[32px] px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              subTab === 'preview'
                ? 'bg-[var(--ide-accent)] text-white'
                : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{t('brw_tab_preview')}</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('cookies')}
            className={`min-h-[32px] px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors tabular-nums ${
              subTab === 'cookies'
                ? 'bg-[var(--ide-accent)] text-white'
                : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
            }`}
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>{t('brw_tab_cookies', { count: enabledCookiesCount })}</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('import')}
            className={`min-h-[32px] px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              subTab === 'import'
                ? 'bg-[var(--ide-accent)] text-white'
                : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>{t('brw_tab_import')}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleToggleUa}
          className="min-h-[34px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[11px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:border-[var(--ide-accent)]"
          title={session.userAgent}
        >
          {isDesktopUa ? (
            <Monitor className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
          ) : (
            <Smartphone className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
          )}
          <span>{isDesktopUa ? t('brw_ua_desktop') : t('brw_ua_mobile')}</span>
        </button>
      </div>

      {/* URL Address Bar */}
      <div className="px-2.5 sm:px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] space-y-2 shrink-0">
        <form onSubmit={handleUrlSubmit} className="flex items-center gap-1.5">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={t('brw_url_placeholder')}
            className="flex-1 min-w-0 min-h-[38px] px-2.5 sm:px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
          />
          <button
            type="submit"
            className="min-h-[42px] px-3 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            {t('brw_go')}
          </button>
          <button
            type="button"
            onClick={() => setIframeNonce((n) => n + 1)}
            aria-label={t('brw_reload')}
            title={t('brw_reload')}
            className="min-h-[38px] min-w-[36px] flex items-center justify-center rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <a
            href={normalizeUrlInput(urlInput)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('brw_open_tab')}
            title={t('brw_open_tab')}
            className="min-h-[38px] min-w-[36px] flex items-center justify-center rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </form>

        {/* Quick Presets & Native / Termux Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.url}
                type="button"
                onClick={() => navigateTo(preset.url)}
                className="min-h-[28px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[11px] font-medium text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[var(--ide-accent)] whitespace-nowrap shrink-0"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {isNativeApk && (
              <button
                type="button"
                onClick={handleOpenNativeBrowser}
                className="min-h-[32px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{t('brw_open_native')}</span>
              </button>
            )}
            {termuxConnected && (
              <button
                type="button"
                onClick={() => void handleProbeViaTermux()}
                disabled={probing}
                className="min-h-[32px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 hover:opacity-90 disabled:opacity-50"
              >
                {probing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Terminal className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{probing ? t('brw_probing') : t('brw_probe_termux')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Body */}
      {subTab === 'preview' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {isNativeApk && (
            <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-accent-soft)] text-[11px] text-[var(--ide-accent-text)] shrink-0">
              {t('brw_native_hint')}
            </div>
          )}

          {probeError && (
            <div className="px-3 py-2 border-b border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300 text-xs shrink-0">
              {probeError}
            </div>
          )}

          {probeResult ? (
            <div className="flex-1 min-h-0 overflow-y-auto ide-scroll p-3 space-y-3 bg-[var(--ide-bg)]">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--ide-border)]">
                <div className="min-w-0">
                  <div className="text-xs font-semibold flex items-center gap-2">
                    <span>{t('brw_probe_result')}</span>
                    <span className="font-mono tabular-nums text-[var(--ide-accent-text)]">
                      HTTP {probeResult.statusCode}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--ide-text-muted)] truncate mt-0.5">
                    {probeResult.title || probeResult.finalUrl}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {probeResult.setCookies.length > 0 && (
                    <button
                      type="button"
                      onClick={handleImportProbeSetCookies}
                      className="min-h-[32px] px-2.5 rounded-lg bg-[var(--ide-accent)] text-white text-[11px] font-medium whitespace-nowrap"
                    >
                      {t('brw_probe_import_cookies', { count: probeResult.setCookies.length })}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setProbeResult(null)}
                    className="min-h-[32px] px-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] text-[11px] font-medium whitespace-nowrap"
                  >
                    {t('brw_tab_preview')}
                  </button>
                </div>
              </div>

              {probeResult.setCookies.length > 0 && (
                <div className="selectable-text rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-2.5 space-y-1">
                  <div className="text-[11px] font-semibold text-[var(--ide-accent-text)]">
                    Set-Cookie
                  </div>
                  {probeResult.setCookies.map((sc, i) => (
                    <div
                      key={i}
                      className="font-mono text-[11px] text-[var(--ide-text)] break-all"
                    >
                      {sc}
                    </div>
                  ))}
                </div>
              )}

              <pre className="selectable-text rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] p-3 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all text-[var(--ide-text-muted)]">
                {probeResult.bodyPreview}
              </pre>
            </div>
          ) : isNativeApk ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-5 text-center bg-[var(--ide-surface-alt)]">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
                <p className="text-sm font-semibold">{t('brw_open_native')}</p>
                <p className="max-w-md text-xs leading-relaxed text-[var(--ide-text-muted)]">
                  {t('brw_iframe_note')}
                </p>
                <button
                  type="button"
                  onClick={handleOpenNativeBrowser}
                  className="min-h-[38px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  {t('brw_open_native')}
                </button>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="px-3 py-1.5 border-b border-[var(--ide-border)] bg-[var(--ide-surface-alt)] text-[11px] text-[var(--ide-text-muted)] shrink-0">
                  {t('brw_iframe_note')}
                </div>
                <div className="flex-1 min-h-0 bg-white">
                  <iframe
                    key={`${loadedUrl}-${iframeNonce}`}
                    src={loadedUrl}
                    title={t('brw_title')}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-forms allow-popups"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}
        </div>
      )}

      {subTab === 'cookies' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto ide-scroll p-3 space-y-4">
            {/* User-Agent Editor */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[var(--ide-text-muted)]">
                {t('brw_ua_label')}
              </label>
              <input
                type="text"
                value={session.userAgent}
                onChange={(e) => onChangeSession({ ...session, userAgent: e.target.value })}
                className="w-full min-h-[38px] px-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
              />
            </div>

            {/* Add Cookie Row */}
            <form onSubmit={handleAddCookie} className="flex items-center gap-1.5">
              <input
                type="text"
                value={newCookieName}
                onChange={(e) => setNewCookieName(e.target.value)}
                placeholder={t('brw_cookie_name')}
                className="w-1/3 min-w-0 min-h-[38px] px-2.5 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
              />
              <input
                type="text"
                value={newCookieValue}
                onChange={(e) => setNewCookieValue(e.target.value)}
                placeholder={t('brw_cookie_val')}
                className="flex-1 min-w-0 min-h-[38px] px-2.5 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
              />
              <button
                type="submit"
                disabled={!newCookieName.trim()}
                className="min-h-[38px] px-3 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-40 text-white text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('brw_cookie_add')}</span>
              </button>
            </form>

            {/* Cookie List */}
            {session.cookies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--ide-border)] p-4 text-xs text-[var(--ide-text-muted)] leading-relaxed">
                {t('brw_cookie_empty')}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--ide-border)] divide-y divide-[var(--ide-border)] bg-[var(--ide-bg)]">
                {session.cookies.map((cookie, idx) => (
                  <div
                    key={`${cookie.name}-${idx}`}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={cookie.enabled}
                      onChange={() => handleToggleCookie(idx)}
                      className="w-4 h-4 accent-[var(--ide-accent)] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-semibold text-[var(--ide-text)] truncate">
                        {cookie.name}
                        {cookie.httpOnly && (
                          <span className="ml-2 text-[10px] font-normal text-[var(--ide-accent-text)]">
                            HttpOnly
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={cookie.value}
                        onChange={(e) => {
                          const next = session.cookies.map((c, i) =>
                            i === idx ? { ...c, value: e.target.value } : c
                          );
                          onChangeSession({ ...session, cookies: next });
                        }}
                        className="w-full mt-1 px-2 py-1 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] font-mono text-[11px] text-[var(--ide-text-muted)] focus:outline-none focus:border-[var(--ide-accent)]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCookie(idx)}
                      aria-label={t('files_delete')}
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-red-500 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="p-3 border-t border-[var(--ide-border)] bg-[var(--ide-surface-alt)] flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveCookiesJson}
              className="min-h-[38px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileJson className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
              <span>{t('brw_save_json')}</span>
            </button>
            <button
              type="button"
              onClick={handleGenerateCrawlerPy}
              className="min-h-[38px] px-3 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>{t('brw_gen_py')}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleCopyPython()}
              className="min-h-[38px] px-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {copiedKey === 'py' ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{t('brw_copy_py')}</span>
            </button>
            {session.cookies.length > 0 && (
              <button
                type="button"
                onClick={() => onChangeSession({ ...session, cookies: [] })}
                className="min-h-[38px] px-2.5 rounded-xl text-xs font-medium text-[var(--ide-text-muted)] hover:text-red-500 ml-auto whitespace-nowrap"
              >
                {t('brw_cookie_clear')}
              </button>
            )}
          </div>
        </div>
      )}

      {subTab === 'import' && (
        <div className="flex-1 min-h-0 overflow-y-auto ide-scroll p-3 space-y-4">
          <form onSubmit={handleParseImport} className="space-y-2.5">
            <label className="block text-xs font-medium text-[var(--ide-text)]">
              {t('brw_import_label')}
            </label>
            <textarea
              value={rawImportText}
              onChange={(e) => setRawImportText(e.target.value)}
              placeholder={t('brw_import_placeholder')}
              rows={7}
              className="w-full p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--ide-accent)]"
            />
            <button
              type="submit"
              disabled={!rawImportText.trim()}
              className="min-h-[40px] px-4 rounded-xl bg-[var(--ide-accent)] hover:bg-[var(--ide-accent-hover)] disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>{t('brw_import_parse')}</span>
            </button>
          </form>

          {/* Chrome Bookmarklet Helper */}
          <div className="md-card p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ide-text)]">
              <Bookmark className="w-4 h-4 text-[var(--ide-accent)]" />
              <span>{t('brw_bookmarklet_title')}</span>
            </div>
            <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">
              {t('brw_bookmarklet_desc')}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={bookmarkletCode}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 min-h-[36px] px-2.5 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] font-mono text-[11px] text-[var(--ide-text-muted)]"
              />
              <button
                type="button"
                onClick={() => void handleCopyBookmarklet()}
                className="min-h-[36px] px-3 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-accent)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {copiedKey === 'bookmarklet' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{t('brw_bookmarklet_copy')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
