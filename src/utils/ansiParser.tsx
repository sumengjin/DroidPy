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

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function getCssLuminance(color: string): number | null {
  const rgbMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  let r: number;
  let g: number;
  let b: number;
  if (rgbMatch) {
    r = Number(rgbMatch[1]);
    g = Number(rgbMatch[2]);
    b = Number(rgbMatch[3]);
  } else {
    const hexMatch = color.match(/^#([0-9a-f]{6})$/i);
    if (!hexMatch) return null;
    const hex = hexMatch[1];
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function isOpaqueCssColor(color: string): boolean {
  const rgbaMatch = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\s*\)$/i);
  if (rgbaMatch) {
    return Number(rgbaMatch[1]) >= 0.65;
  }
  return color.startsWith('#') || color.startsWith('rgb(');
}

function xterm256ToCss(rawN: number, dark: boolean): string {
  const n = clampByte(rawN);
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
  const gray = clampByte(8 + (n - 232) * 10);
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
  // Convert Erase in Line (\x1b[2K, \x1b[0K, \x1b[K) into carriage-return / tail-clear markers before stripping CSI
  cleaned = cleaned.replace(/(?:\x1b\[|\x9b)2K/g, '\r');
  cleaned = cleaned.replace(/(?:\x1b\[|\x9b)[01]?K/g, '');
  // Strip remaining non-SGR CSI sequences including private/intermediate sequences (ending in letters/symbols other than 'm')
  cleaned = cleaned.replace(/(?:\x1b\[|\x9b)[0-9;:<=>?]*[\x20-\x2f]*[A-LN-Za-ln-z~@^`|]/g, '');
  // Strip dangling incomplete ESC/CSI/OSC sequences at end of chunk or string
  cleaned = cleaned.replace(/\x1b(?:\][^\x07\x1b]*|\[[0-9;:<=>?]*)?$/g, '');
  // Strip lone ESC not followed by '[' or ']' (prevents "\x1b部" rendering tofu "□" boxes)
  cleaned = cleaned.replace(/\x1b(?![\[\]])/g, '');
  // Strip orphaned bracketed SGR fragments missing ESC (e.g. "[0m", "[38;5;88m", "[38:2::255:0:0m")
  cleaned = cleaned.replace(/\[(?:[0-9]{0,3}(?:[;:][0-9]{0,3})*)m{1,2}/g, (match, offset: number, full: string) => {
    const prev = offset > 0 ? full[offset - 1] : '';
    if (prev === '\x1b' || prev === '\u001b') return match;
    return '';
  });
  // Strip orphaned truncated SGR tail fragments like ";88m", ";5;208m", "8;5;129mm", "38:2::255:0:0m" caused by upstream slice
  cleaned = cleaned.replace(/(?:^|(?<=[\s\]|:;]))(?:[34]?8[;:][25])?(?:[;:][0-9]{0,3})+m{1,2}/g, '');
  cleaned = cleaned.replace(/(?:^|(?<=\s))(?:0|1|2|3|4|7|8|9|2[1-4789]|3[0-79]|4[0-79]|9[0-7]|10[0-7])m{1,2}(?=[A-Za-z0-9\u4e00-\u9fff\[\(]|$)/g, '');
  // Resolve remaining standalone \r carriage-return overwrites per line cleanly
  // (Keep previous content if \r is only at the very end of the line with nothing written after it)
  cleaned = cleaned
    .split('\n')
    .map((line) => {
      if (!line.includes('\r')) return line;
      const parts = line.split('\r');
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].length > 0) return parts[i];
      }
      return '';
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
  const withoutSgr = normalized.replace(/(?:\x1b|\u001b|\x9b)\[[0-9;:?]*m/g, '');
  return stripOtherControlChars(withoutSgr);
}

/**
 * Buffers trailing incomplete ESC/CSI/OSC sequences and lone trailing CR across
 * streaming chunks so truncated SGR fragments (e.g. ";88m") or split CRLF (\r + \n)
 * never leak or erase completed lines.
 */
export function createAnsiStreamBuffer(): {
  push: (chunk: string) => string;
  flush: () => string;
} {
  let pending = '';
  const partialEscRegex = /(?:\x1b(?:\[[^\x40-\x7e]*|\][^\x07\x1b]*|[PX^_][^\x07\x1b]*|[()#]?)?|\r)$/;

  return {
    push(chunk: string): string {
      if (!chunk) return '';
      const combined = pending + chunk;
      pending = '';
      const match = combined.match(partialEscRegex);
      if (match && match[0].length < 512) {
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
  strikethrough: boolean;
  inverse: boolean;
  hidden: boolean;
}

const DEFAULT_STYLE_STATE: AnsiStyleState = {
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  strikethrough: false,
  inverse: false,
  hidden: false,
};

function parseColonSubparams(token: string): number[] {
  return token.split(':').map((part) => (part === '' ? 0 : Number(part) || 0));
}

export function renderAnsiText(
  raw: string,
  cleanTextMode = false,
  darkOverride?: boolean
): React.ReactNode {
  if (cleanTextMode) {
    return stripAnsi(raw);
  }
  const dark = darkOverride ?? isDarkModeActive();
  const fgStandard = dark ? ANSI_FG_STANDARD_DARK : ANSI_FG_STANDARD_LIGHT;
  const fgBright = dark ? ANSI_FG_BRIGHT_DARK : ANSI_FG_BRIGHT_LIGHT;
  const normalized = normalizeTerminalText(raw);
  const sgrRegex = /(?:\x1b|\u001b|\x9b)\[([0-9;:]*)m/g;

  const nodes: React.ReactNode[] = [];
  let state: AnsiStyleState = { ...DEFAULT_STYLE_STATE };

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
      state.underline ||
      state.strikethrough ||
      state.inverse ||
      state.hidden;

    if (!hasStyle) {
      nodes.push(<React.Fragment key={segmentKey++}>{safeText}</React.Fragment>);
      return;
    }

    const style: React.CSSProperties = {};
    const defaultFg = dark ? '#E2E8F0' : '#0F172A';
    const defaultBg = dark ? '#1E293B' : '#E2E8F0';
    let effectiveFg = state.color;
    let effectiveBg = state.backgroundColor;

    if (state.inverse) {
      effectiveFg = state.backgroundColor ?? defaultBg;
      effectiveBg = state.color ?? defaultFg;
      if (effectiveBg && !isOpaqueCssColor(effectiveBg)) {
        effectiveBg = defaultFg;
      }
    }

    if (effectiveBg) {
      style.backgroundColor = effectiveBg;
      style.borderRadius = '2px';
      style.padding = '0 2px';
      if (!effectiveFg && isOpaqueCssColor(effectiveBg)) {
        const lum = getCssLuminance(effectiveBg);
        if (lum !== null) {
          effectiveFg = lum > 0.55 ? '#0F172A' : '#F8FAFC';
        }
      }
    }

    if (effectiveFg) {
      style.color = effectiveFg;
    }
    if (state.bold) style.fontWeight = 600;
    if (state.hidden) {
      style.opacity = 0;
    } else if (state.dim) {
      style.opacity = 0.72;
    }
    if (state.italic) style.fontStyle = 'italic';

    if (state.underline && state.strikethrough) {
      style.textDecorationLine = 'underline line-through';
    } else if (state.underline) {
      style.textDecorationLine = 'underline';
    } else if (state.strikethrough) {
      style.textDecorationLine = 'line-through';
    }

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
    const tokens = rawParams === '' ? ['0'] : rawParams.split(';');

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.includes(':')) {
        const sub = parseColonSubparams(token);
        const head = sub[0];
        if ((head === 38 || head === 48) && sub[1] === 5 && sub[2] !== undefined) {
          const css = xterm256ToCss(sub[2], dark);
          state = head === 38 ? { ...state, color: css } : { ...state, backgroundColor: css };
        } else if ((head === 38 || head === 48) && sub[1] === 2) {
          // Supports both 38:2:r:g:b and 38:2:colorspace:r:g:b
          const hasCs = sub.length >= 6;
          const rIdx = hasCs ? 3 : 2;
          if (sub[rIdx + 2] !== undefined) {
            const css = `rgb(${clampByte(sub[rIdx])}, ${clampByte(sub[rIdx + 1])}, ${clampByte(sub[rIdx + 2])})`;
            state = head === 38 ? { ...state, color: css } : { ...state, backgroundColor: css };
          }
        } else if (head === 4) {
          state = { ...state, underline: (sub[1] ?? 1) !== 0 };
        }
        continue;
      }

      const code = token === '' ? 0 : Number(token) || 0;
      if (code === 0) {
        state = { ...DEFAULT_STYLE_STATE };
      } else if (code === 1) {
        state = { ...state, bold: true };
      } else if (code === 2) {
        state = { ...state, dim: true };
      } else if (code === 3) {
        state = { ...state, italic: true };
      } else if (code === 4 || code === 21) {
        state = { ...state, underline: true };
      } else if (code === 7) {
        state = { ...state, inverse: true };
      } else if (code === 8) {
        state = { ...state, hidden: true };
      } else if (code === 9) {
        state = { ...state, strikethrough: true };
      } else if (code === 22) {
        state = { ...state, bold: false, dim: false };
      } else if (code === 23) {
        state = { ...state, italic: false };
      } else if (code === 24) {
        state = { ...state, underline: false };
      } else if (code === 27) {
        state = { ...state, inverse: false };
      } else if (code === 28) {
        state = { ...state, hidden: false };
      } else if (code === 29) {
        state = { ...state, strikethrough: false };
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
      } else if (code === 38 || code === 48) {
        const mode = Number(tokens[i + 1]);
        if (mode === 5 && tokens[i + 2] !== undefined) {
          const css = xterm256ToCss(Number(tokens[i + 2]) || 0, dark);
          state = code === 38 ? { ...state, color: css } : { ...state, backgroundColor: css };
          i += 2;
        } else if (mode === 2 && tokens[i + 4] !== undefined) {
          const css = `rgb(${clampByte(Number(tokens[i + 2]))}, ${clampByte(Number(tokens[i + 3]))}, ${clampByte(Number(tokens[i + 4]))})`;
          state = code === 38 ? { ...state, color: css } : { ...state, backgroundColor: css };
          i += 4;
        }
      }
    }

    lastIndex = sgrRegex.lastIndex;
  }

  if (lastIndex < normalized.length) {
    pushSegment(normalized.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : null;
}
