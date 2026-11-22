export async function copyTextReliable(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for WebView / insecure context restrictions
    }
  }

  if (typeof document !== 'undefined') {
    let textarea: HTMLTextAreaElement | null = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      if (ok) return true;
    } catch {
      // Fallback to native Android ClipboardManager bridge
    } finally {
      if (textarea && textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }
  }

  try {
    const nativeCopy = window.DroidPyNative?.copyToClipboard;
    if (nativeCopy) {
      return Boolean(nativeCopy(text));
    }
  } catch {
    // ignore native clipboard errors
  }

  return false;
}

export function getSelectedTextWithin(container: HTMLElement | null): string {
  if (typeof window === 'undefined' || !container) return '';
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return '';
  const text = sel.toString();
  if (!text) return '';
  const anchorNode = sel.anchorNode;
  const focusNode = sel.focusNode;
  if (
    (anchorNode && container.contains(anchorNode)) ||
    (focusNode && container.contains(focusNode))
  ) {
    return text;
  }
  return '';
}
