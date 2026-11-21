import { CapturedCookieItem, CrawlerSessionData } from '../types/ide';

export const DESKTOP_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const MOBILE_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

export const DEFAULT_CRAWLER_SESSION: CrawlerSessionData = {
  url: 'https://quotes.toscrape.com/',
  userAgent: MOBILE_ANDROID_UA,
  cookies: [],
  extraHeaders: {},
  capturedAt: 0,
};

export function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'https://quotes.toscrape.com/';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function mergeCookieLists(
  existing: CapturedCookieItem[],
  incoming: CapturedCookieItem[]
): CapturedCookieItem[] {
  const map = new Map<string, CapturedCookieItem>();
  for (const item of existing) {
    if (item.name.trim()) {
      map.set(item.name.trim(), item);
    }
  }
  for (const item of incoming) {
    const name = item.name.trim();
    if (!name) continue;
    map.set(name, { ...item, name });
  }
  return Array.from(map.values());
}

export function parseCookieHeaderPairs(headerValue: string): CapturedCookieItem[] {
  const clean = headerValue.replace(/^cookie\s*:\s*/i, '').trim();
  if (!clean) return [];
  const items: CapturedCookieItem[] = [];
  for (const part of clean.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (name) {
      items.push({ name, value, enabled: true });
    }
  }
  return items;
}

export function parseSetCookieLines(setCookies: string[]): CapturedCookieItem[] {
  const out: CapturedCookieItem[] = [];
  for (const line of setCookies) {
    const segments = line.split(';').map((s) => s.trim());
    const first = segments[0];
    if (!first) continue;
    const eq = first.indexOf('=');
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    let domain: string | undefined;
    let path: string | undefined;
    let httpOnly = false;
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      const low = seg.toLowerCase();
      if (low === 'httponly') httpOnly = true;
      else if (low.startsWith('domain=')) domain = seg.slice(7).trim();
      else if (low.startsWith('path=')) path = seg.slice(5).trim();
    }
    if (name) {
      out.push({ name, value, enabled: true, domain, path, httpOnly });
    }
  }
  return out;
}

export function parseRawCrawlerInput(rawInput: string): {
  url?: string;
  userAgent?: string;
  cookies: CapturedCookieItem[];
  extraHeaders: Record<string, string>;
} {
  const text = rawInput.trim();
  const extraHeaders: Record<string, string> = {};
  if (!text) {
    return { cookies: [], extraHeaders };
  }

  // 1. Try JSON (Bookmarklet payload, EditThisCookie array, or simple key-value dict)
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        const cookies: CapturedCookieItem[] = [];
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            const name = typeof obj.name === 'string' ? obj.name : '';
            const value = typeof obj.value === 'string' ? obj.value : '';
            if (name) {
              cookies.push({
                name,
                value,
                enabled: true,
                domain: typeof obj.domain === 'string' ? obj.domain : undefined,
                path: typeof obj.path === 'string' ? obj.path : undefined,
                httpOnly: Boolean(obj.httpOnly),
              });
            }
          }
        }
        if (cookies.length > 0) return { cookies, extraHeaders };
      } else if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        const hasCookieObj =
          typeof obj.cookieHeader === 'string' ||
          typeof obj.cookie_header === 'string' ||
          Array.isArray(obj.cookies) ||
          (Boolean(obj.cookies) && typeof obj.cookies === 'object');
        if (hasCookieObj) {
          const url = typeof obj.url === 'string' ? obj.url : undefined;
          const userAgent =
            typeof obj.userAgent === 'string'
              ? obj.userAgent
              : typeof obj.user_agent === 'string'
              ? obj.user_agent
              : obj.headers &&
                typeof obj.headers === 'object' &&
                typeof (obj.headers as Record<string, unknown>)['User-Agent'] === 'string'
              ? String((obj.headers as Record<string, unknown>)['User-Agent'])
              : undefined;
          let cookies: CapturedCookieItem[] = [];
          const rawHeader =
            typeof obj.cookieHeader === 'string'
              ? obj.cookieHeader
              : typeof obj.cookie_header === 'string'
              ? obj.cookie_header
              : null;
          if (Array.isArray(obj.cookies)) {
            cookies = (obj.cookies as Record<string, unknown>[])
              .filter((c) => typeof c?.name === 'string')
              .map((c) => ({
                name: String(c.name),
                value: String(c.value ?? ''),
                enabled: c.enabled !== false,
                domain: typeof c.domain === 'string' ? c.domain : undefined,
                path: typeof c.path === 'string' ? c.path : undefined,
                httpOnly: Boolean(c.httpOnly),
              }));
          } else if (obj.cookies && typeof obj.cookies === 'object') {
            cookies = Object.entries(obj.cookies as Record<string, unknown>).map(([k, v]) => ({
              name: k,
              value: String(v ?? ''),
              enabled: true,
            }));
          } else if (rawHeader) {
            cookies = parseCookieHeaderPairs(rawHeader);
          }
          if (obj.headers && typeof obj.headers === 'object') {
            for (const [hk, hv] of Object.entries(obj.headers as Record<string, unknown>)) {
              const low = hk.toLowerCase();
              if (low !== 'user-agent' && low !== 'cookie' && typeof hv === 'string') {
                extraHeaders[hk] = hv;
              }
            }
          }
          return { url, userAgent, cookies, extraHeaders };
        }
        // Plain JSON cookie map {"session_id": "abc", "token": "xyz"}
        const cookies = Object.entries(obj).map(([k, v]) => ({
          name: k,
          value: typeof v === 'string' ? v : JSON.stringify(v),
          enabled: true,
        }));
        return { cookies, extraHeaders };
      }
    } catch {
      // fall through to cURL / header parser
    }
  }

  // 2. Try cURL command (from Chrome / Edge / Safari DevTools "Copy as cURL")
  if (/^curl\s+/i.test(text)) {
    const normalized = text.replace(/\\\r?\n/g, ' ').replace(/\s\$'/g, " '");
    let url: string | undefined;
    let userAgent: string | undefined;
    let cookies: CapturedCookieItem[] = [];

    const urlMatch = normalized.match(/\s(['"])(https?:\/\/[^'"]+)\1/i);
    if (urlMatch) {
      url = urlMatch[2];
    }

    const headerRegex = /(?:-H|--header)\s+(['"])(.*?)\1/g;
    let hm: RegExpExecArray | null;
    while ((hm = headerRegex.exec(normalized)) !== null) {
      const line = hm[2];
      const colon = line.indexOf(':');
      if (colon <= 0) continue;
      const key = line.slice(0, colon).trim();
      const val = line.slice(colon + 1).trim();
      const low = key.toLowerCase();
      if (low === 'cookie') {
        cookies = mergeCookieLists(cookies, parseCookieHeaderPairs(val));
      } else if (low === 'user-agent') {
        userAgent = val;
      } else if (!['host', 'content-length', 'accept-encoding'].includes(low)) {
        extraHeaders[key] = val;
      }
    }

    const bMatch = normalized.match(/(?:-b|--cookie)\s+(['"])(.*?)\1/);
    if (bMatch) {
      cookies = mergeCookieLists(cookies, parseCookieHeaderPairs(bMatch[2]));
    }

    const uaMatch = normalized.match(/(?:-A|--user-agent)\s+(['"])(.*?)\1/);
    if (uaMatch) {
      userAgent = uaMatch[2];
    }

    return { url, userAgent, cookies, extraHeaders };
  }

  // 3. Try Netscape cookies.txt (7 tab-separated columns)
  const lines = text.split(/\r?\n/);
  const netscapeItems: CapturedCookieItem[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cols = trimmed.split('\t');
    if (cols.length >= 7) {
      netscapeItems.push({
        domain: cols[0],
        path: cols[2],
        name: cols[5],
        value: cols[6],
        enabled: true,
      });
    }
  }
  if (netscapeItems.length > 0) {
    return { cookies: netscapeItems, extraHeaders };
  }

  // 4. Raw HTTP headers block or plain Cookie header line
  let userAgent: string | undefined;
  let cookies: CapturedCookieItem[] = [];
  let matchedHeaderLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(':');
    if (colon > 0 && /^[a-zA-Z0-9-]+$/.test(trimmed.slice(0, colon).trim())) {
      const key = trimmed.slice(0, colon).trim();
      const val = trimmed.slice(colon + 1).trim();
      const low = key.toLowerCase();
      matchedHeaderLines++;
      if (low === 'cookie') {
        cookies = mergeCookieLists(cookies, parseCookieHeaderPairs(val));
      } else if (low === 'user-agent') {
        userAgent = val;
      } else if (!['host', 'content-length', 'accept-encoding'].includes(low)) {
        extraHeaders[key] = val;
      }
    }
  }

  if (matchedHeaderLines === 0) {
    cookies = parseCookieHeaderPairs(text);
  }

  return { userAgent, cookies, extraHeaders };
}

export function buildCookieHeaderString(cookies: CapturedCookieItem[]): string {
  return cookies
    .filter((c) => c.enabled && c.name.trim())
    .map((c) => `${c.name.trim()}=${c.value}`)
    .join('; ');
}

export function buildCookiesJsonContent(session: CrawlerSessionData): string {
  const activeCookies = session.cookies.filter((c) => c.enabled && c.name.trim());
  const cookieDict: Record<string, string> = {};
  for (const c of activeCookies) {
    cookieDict[c.name.trim()] = c.value;
  }

  const payload = {
    url: session.url,
    headers: {
      'User-Agent': session.userAgent,
      ...session.extraHeaders,
    },
    cookies: cookieDict,
    cookie_header: buildCookieHeaderString(activeCookies),
    cookie_list: activeCookies,
    updated_at: new Date(session.capturedAt || Date.now()).toISOString(),
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function buildPythonCrawlerScript(session: CrawlerSessionData): string {
  const targetUrl = session.url || 'https://quotes.toscrape.com/';
  return `"""
DroidPy Cookie Crawler Session
自動載入瀏覽器擷取的 cookies.json 與 User-Agent 進行爬蟲請求
建議於 Termux 原生引擎或獨立 APK 執行（pip install requests beautifulsoup4）
"""
import json
from pathlib import Path
import requests
from bs4 import BeautifulSoup

TARGET_URL = ${JSON.stringify(targetUrl)}
SESSION_FILE = Path("cookies.json")


def create_session() -> tuple[requests.Session, str]:
    sess = requests.Session()
    url = TARGET_URL

    if SESSION_FILE.exists():
        data = json.loads(SESSION_FILE.read_text(encoding="utf-8"))
        url = data.get("url") or url
        sess.headers.update(data.get("headers") or {})
        sess.cookies.update(data.get("cookies") or {})
    else:
        sess.headers.update({
            "User-Agent": ${JSON.stringify(session.userAgent)},
        })

    return sess, url


def main():
    session, url = create_session()
    print(f"發送請求至: {url}")
    print(f"已載入 Cookie 數量: {len(session.cookies)}")

    resp = session.get(url, timeout=20)
    print(f"HTTP 狀態碼: {resp.status_code} | 最終網址: {resp.url}")

    soup = BeautifulSoup(resp.text, "html.parser")
    title = soup.title.get_text(strip=True) if soup.title else "(無標題)"
    print(f"網頁標題: {title}")

    links = [a.get("href") for a in soup.select("a[href]")[:10]]
    print(f"擷取前 {len(links)} 筆連結:")
    for href in links:
        print(" -", href)


if __name__ == "__main__":
    main()
`;
}

export function buildBookmarkletCode(): string {
  const fn = `(function(){var d=JSON.stringify({url:location.href,userAgent:navigator.userAgent,cookieHeader:document.cookie});if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(d).then(function(){alert('DroidPy: 已複製 Cookie 與 User-Agent！請切回 DroidPy 貼上。');}).catch(function(){prompt('請複製以下 JSON 貼回 DroidPy:',d);});}else{prompt('請複製以下 JSON 貼回 DroidPy:',d);}})();`;
  return `javascript:${fn}`;
}
