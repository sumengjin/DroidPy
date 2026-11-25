export const APP_VERSION = '1.2.33';
export const APP_VERSION_CODE = 1002033;

export const STORAGE_GITHUB_REPO_KEY = 'droidpy_github_repo_v1';
export const STORAGE_AUTO_UPDATE_PKGS_KEY = 'droidpy_auto_update_pkgs_v1';

export const BUILTIN_GITHUB_REPO: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_GITHUB_REPO) ||
  '';

export function parseGithubRepoSlug(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const urlMatch = trimmed.match(/github\.com[/:]([^/\s]+\/[^/\s#?]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1].replace(/\.git$/i, '').replace(/\/+$/, '');
  }
  const slugMatch = trimmed.match(/^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)$/);
  return slugMatch ? slugMatch[1].replace(/\.git$/i, '') : '';
}

export function getSavedGithubRepo(): string {
  try {
    const saved = localStorage.getItem(STORAGE_GITHUB_REPO_KEY);
    if (saved && saved.trim()) {
      return parseGithubRepoSlug(saved) || saved.trim();
    }
  } catch {
    // ignore storage errors
  }
  return parseGithubRepoSlug(BUILTIN_GITHUB_REPO);
}

export function saveGithubRepo(repo: string): string {
  const parsed = parseGithubRepoSlug(repo) || repo.trim();
  try {
    if (parsed) {
      localStorage.setItem(STORAGE_GITHUB_REPO_KEY, parsed);
    } else {
      localStorage.removeItem(STORAGE_GITHUB_REPO_KEY);
    }
  } catch {
    // ignore
  }
  return parsed;
}

export function getAutoUpdatePackagesPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_AUTO_UPDATE_PKGS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAutoUpdatePackagesPref(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_AUTO_UPDATE_PKGS_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}
