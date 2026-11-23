import React from 'react';

const ANSI_FG_STANDARD_DARK: Record<number, string> = {
  30: '#64748B',
  31: '#EF4444',
  32: '#10B981',
  33: '#F59E0B',
  34: '#3B82F6',
  35: '#EC4899',
  36: '#06B6D4',
  37: '#E2E8F0',
};

const ANSI_FG_BRIGHT_DARK: Record<number, string> = {
  90: '#94A3B8',
  91: '#F87171',
  92: '#34D399',
  93: '#FBBF24',
  94: '#60A5FA',
  95: '#F472B6',
  96: '#22D3EE',
  97: '#F8FAFC',
};

const ANSI_FG_STANDARD_LIGHT: Record<number, string> = {
  30: '#1E293B',
  31: '#DC2626',
  32: '#059669',
  33: '#D97706',
  34: '#2563EB',
  35: '#DB2777',
  36: '#0891B2',
  37: '#475569',
};

const ANSI_FG_BRIGHT_LIGHT: Record<number, string> = {
  90: '#64748B',
  91: '#E11D48',
  92: '#047857',
  93: '#B45309',
  94: '#1D4ED8',
  95: '#BE185D',
  96: '#0E7490',
  97: '#0F172A',
};

function isDarkModeActive(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

const ANSI_BG_STANDARD: Record<number, string> = {
  40: 'rgba(15, 23, 42, 0.7)',
  41: 'rgba(239, 68, 68, 0.2)',
  42: 'rgba(16, 185, 129, 0.2)',
  43: 'rgba(245, 158, 11, 0.2)',
  44: 'rgba(59, 130, 246, 0.2)',
  45: 'rgba(236, 72, 153, 0.2)',
  46: 'rgba(6, 182, 212, 0.2)',
  47: 'rgba(226, 232, 240, 0.2)',
};

const ANSI_BG_BRIGHT: Record<number, string> = {
  100: 'rgba(100, 116, 139, 0.25)',
  101: 'rgba(248, 113, 113, 0.25)',
  102: 'rgba(52, 211, 153, 0.25)',
  103: 'rgba(251, 191, 36, 0.25)',
  104: 'rgba(96, 165, 250, 0.25)',
  105: 'rgba(244, 114, 182, 0.25)',
  106: 'rgba(34, 211, 238, 0.25)',
  107: 'rgba(248, 250, 252, 0.25)',
};

function xterm256ToCss(n: number, dark: boolean): string {
  const std = dark ? ANSI_FG_STANDARD_DARK : ANSI_FG_STANDARD_LIGHT;
  const br = dark ? ANSI_FG_BRIGHT_DARK : ANSI_FG_BRIGHT_LIGHT;
  if (n < 8) return std[30 + n] ?? '#E2E8F0';
  if (n < 16) return br[90 + (n - 8)] ?? '#F8FAFC';
  if (n < 232) {
    const idx = n - 16;
    const r = Math.floor(idx / 36);
    const g = Math.floor((idx % 36) / 6);
    const b = idx % 6;
    const step = (v: number) => (v === 0 ? 0 : 55 + v * 40);
    return `rgb(${step(r)}, ${step(g)}, ${step(b)})`;
  }
  const gray = 8 + (n - 232) * 10;
  return `rgb(${gray}, ${gray}, ${gray})`;
}

function normalizeTerminalText(raw: string): string {
  // Normalize CRLF -> LF and strip OSC, DCS, charset, CSI, and truncated/orphaned SGR fragments
  let cleaned = raw.replace(/\r\n/g, '\n');
  // Strip OSC sequences like \x1b]...\x07 or \x1b]...\x1b\\ or C1 0x9d...
  cleaned = cleaned.replace(/(?:\x1b\]|\x9d)[^\x07\x1b\x9c]*(?:\x07|\x1b\\|\x9c)/g, '');
  // Strip DCS / SOS / PM / APC sequences (\x1bP, \x1bX, \x1b^, \x1b_)
  cleaned = cleaned.replace(/\x1b[PX^_][\s\S]*?(?:\x07|\x1b\\|\x9c)/g, '');
  // Strip character set / 2-byte ESC sequences such as \x1b(B, \x1b)0, \x1b=, \x1b>
  cleaned = cleaned.replace(/\x1b[()#][0-9A-Za-z]/g, '');
  cleaned = cleaned.replace(/\x1b[=>NOM78c]/g, '');
  // Strip non-SGR CSI sequences including private/intermediate sequences (ending in letters/symbols other than 'm')
  cleaned = cleaned.replace(/(?:\x1b\[|\x9b)[0-9;:<=>?]*[\x20-\x2f]*[A-LN-Za-ln-z~@^`|]/g, '');
  // Strip dangling incomplete ESC/CSI/OSC sequences at end of chunk or string
  cleaned = cleaned.replace(/\x1b(?:\][^\x07\x1b]*|\[[0-9;:<=>?]*)?$/g, '');
  // Strip lone ESC not followed by '[' or ']' (prevents "\x1b部" rendering tofu "□" boxes)
  cleaned = cleaned.replace(/\x1b(?![\[\]])/g, '');
  // Strip orphaned bracketed SGR fragments missing ESC (e.g. "[0m", "[38;5;88m", "[38;5;129mm")
  cleaned = cleaned.replace(/\[(?:[0-9]{1,3}(?:;[0-9]{1,3})*)m{1,2}/g, (match, offset: number, full: string) => {
    const prev = offset > 0 ? full[offset - 1] : '';
    if (prev === '\x1b' || prev === '\u001b') return match;
    return '';
  });
  // Strip orphaned truncated SGR tail fragments like ";88m", ";5;208m", "8;5;129mm", "38;5;88m" caused by upstream slice
  cleaned = cleaned.replace(/(?:^|(?<=[\s\]|:]))(?:[34]?8;[25])?(?:;[0-9]{1,3})+m{1,2}/g, '');
  cleaned = cleaned.replace(/(?:^|(?<=\s))(?:0|1|2|3|4|22|24|3[0-79]|4[0-79]|9[0-7]|10[0-7])m{1,2}(?=[A-Za-z0-9\u4e00-\u9fff\[\(]|$)/g, '');
  // Resolve remaining standalone \r carriage-return overwrites per line
  cleaned = cleaned
    .split('\n')
    .map((line) => {
      if (!line.includes('\r')) return line;
      const parts = line.split('\r');
      return parts[parts.length - 1];
    })
    .join('\n');
  return cleaned;
}

function stripOtherControlChars(text: string): string {
  // Keep \n (0x0A) and \t (0x09), remove all leftover C0 (including stray \x1b), DEL, C1 (0x80-0x9f), and U+FFFD
  return text.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f\uFFFD]/g, '');
}

export function stripAnsi(raw: string): string {
  if (!raw) return '';
  const normalized = normalizeTerminalText(raw);
  const withoutSgr = normalized.replace(/(?:\x1b|\u001b|\x9b)\[[0-9;?]*m/g, '');
  return stripOtherControlChars(withoutSgr);
}

/**
 * Buffers trailing incomplete ESC/CSI/OSC sequences across streaming chunks so
 * truncated SGR fragments like ";88m" never leak into rendered terminal output.
 */
export function createAnsiStreamBuffer(): {
  push: (chunk: string) => string;
  flush: () => string;
} {
  let pending = '';
  const partialEscRegex = /\x1b(?:\[[^\x40-\x7e]*|\][^\x07\x1b]*|[PX^_][^\x07\x1b]*|[()#]?)?$/;

  return {
    push(chunk: string): string {
      if (!chunk) return '';
      const combined = pending + chunk;
      pending = '';
      const match = combined.match(partialEscRegex);
      if (match && match[0].length < 48) {
        pending = match[0];
        return combined.slice(0, combined.length - pending.length);
      }
      return combined;
    },
    flush(): string {
      const rem = pending;
      pending = '';
      return rem;
    },
  };
}

interface AnsiStyleState {
  color?: string;
  backgroundColor?: string;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
}

export function renderAnsiText(raw: string, cleanTextMode = false): React.ReactNode {
  if (cleanTextMode) {
    return stripAnsi(raw);
  }
  const dark = isDarkModeActive();
  const fgStandard = dark ? ANSI_FG_STANDARD_DARK : ANSI_FG_STANDARD_LIGHT;
  const fgBright = dark ? ANSI_FG_BRIGHT_DARK : ANSI_FG_BRIGHT_LIGHT;
  const normalized = normalizeTerminalText(raw);
  const sgrRegex = /(?:\x1b|\u001b|\x9b)\[([0-9;]*)m/g;

  const nodes: React.ReactNode[] = [];
  let state: AnsiStyleState = {
    bold: false,
    dim: false,
    italic: false,
    underline: false,
  };

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segmentKey = 0;

  const pushSegment = (chunk: string) => {
    const safeText = stripOtherControlChars(chunk);
    if (!safeText) return;

    const hasStyle =
      state.color ||
      state.backgroundColor ||
      state.bold ||
      state.dim ||
      state.italic ||
      state.underline;

    if (!hasStyle) {
      nodes.push(<React.Fragment key={segmentKey++}>{safeText}</React.Fragment>);
      return;
    }

    const style: React.CSSProperties = {};
    if (state.color) style.color = state.color;
    if (state.backgroundColor) style.backgroundColor = state.backgroundColor;
    if (state.bold) style.fontWeight = 600;
    if (state.dim) style.opacity = 0.72;
    if (state.italic) style.fontStyle = 'italic';
    if (state.underline) style.textDecoration = 'underline';

    nodes.push(
      <span key={segmentKey++} style={style}>
        {safeText}
      </span>
    );
  };

  while ((match = sgrRegex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      pushSegment(normalized.slice(lastIndex, match.index));
    }

    const rawParams = match[1];
    const codes = rawParams === '' ? [0] : rawParams.split(';').map((c) => Number(c) || 0);

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (code === 0) {
        state = { bold: false, dim: false, italic: false, underline: false };
      } else if (code === 1) {
        state = { ...state, bold: true };
      } else if (code === 2) {
        state = { ...state, dim: true };
      } else if (code === 3) {
        state = { ...state, italic: true };
      } else if (code === 4) {
        state = { ...state, underline: true };
      } else if (code === 22) {
        state = { ...state, bold: false, dim: false };
      } else if (code === 23) {
        state = { ...state, italic: false };
      } else if (code === 24) {
        state = { ...state, underline: false };
      } else if (code === 39) {
        state = { ...state, color: undefined };
      } else if (code === 49) {
        state = { ...state, backgroundColor: undefined };
      } else if (code >= 30 && code <= 37) {
        state = { ...state, color: fgStandard[code] };
      } else if (code >= 90 && code <= 97) {
        state = { ...state, color: fgBright[code] };
      } else if (code >= 40 && code <= 47) {
        state = { ...state, backgroundColor: ANSI_BG_STANDARD[code] };
      } else if (code >= 100 && code <= 107) {
        state = { ...state, backgroundColor: ANSI_BG_BRIGHT[code] };
      } else if (code === 38 && codes[i + 1] === 5 && codes[i + 2] !== undefined) {
        state = { ...state, color: xterm256ToCss(codes[i + 2], dark) };
        i += 2;
      } else if (code === 48 && codes[i + 1] === 5 && codes[i + 2] !== undefined) {
        state = { ...state, backgroundColor: xterm256ToCss(codes[i + 2], dark) };
        i += 2;
      } else if (
        code === 38 &&
        codes[i + 1] === 2 &&
        codes[i + 4] !== undefined
      ) {
        state = { ...state, color: `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})` };
        i += 4;
      } else if (
        code === 48 &&
        codes[i + 1] === 2 &&
        codes[i + 4] !== undefined
      ) {
        state = {
          ...state,
          backgroundColor: `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})`,
        };
        i += 4;
      }
    }

    lastIndex = sgrRegex.lastIndex;
  }

  if (lastIndex < normalized.length) {
    pushSegment(normalized.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : null;
}
