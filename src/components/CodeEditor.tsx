import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  undo as cmUndo,
  redo as cmRedo,
} from '@codemirror/commands';
import {
  bracketMatching,
  foldGutter,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
  HighlightStyle,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches, openSearchPanel, closeSearchPanel } from '@codemirror/search';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { linter, lintGutter, Diagnostic, forceLinting } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import { ThemeId, getThemeMeta } from '../services/themes';
import { checkPythonSyntax } from '../services/pyodideRuntime';

export interface CodeEditorHandle {
  insertText: (text: string, cursorOffset?: number) => void;
  moveCursor: (delta: number) => void;
  undo: () => void;
  redo: () => void;
  focus: () => void;
  openSearch: () => void;
  formatCode: () => boolean;
}

interface CodeEditorProps {
  value: string;
  filename?: string;
  onChange: (nextValue: string) => void;
  onRunShortcut: () => void;
  onCursorChange?: (line: number, col: number) => void;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  theme: ThemeId;
  pyodideReady?: boolean;
  transparentBg?: boolean;
}

const HIGHLIGHT_PRESETS: Record<ThemeId, HighlightStyle> = {
  dark: HighlightStyle.define([
    { tag: tags.keyword, color: '#34D399', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#E2E8F0' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#38BDF8' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#FBBF24' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#F8FAFC' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#FB7185' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#94A3B8' },
    { tag: [tags.meta, tags.comment], color: '#64748B', fontStyle: 'italic' },
    { tag: tags.string, color: '#FBBF24' },
    { tag: [tags.bool, tags.atom], color: '#FB7185', fontWeight: '600' },
  ]),
  light: HighlightStyle.define([
    { tag: tags.keyword, color: '#059669', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#0F172A' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#0284C7' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#D97706' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#0F172A' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#E11D48' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#475569' },
    { tag: [tags.meta, tags.comment], color: '#94A3B8', fontStyle: 'italic' },
    { tag: tags.string, color: '#B45309' },
    { tag: [tags.bool, tags.atom], color: '#E11D48', fontWeight: '600' },
  ]),
  rose: HighlightStyle.define([
    { tag: tags.keyword, color: '#DB2777', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#3B1626' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#7C3AED' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#C2410C' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#3B1626' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#0F766E' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#8C566E' },
    { tag: [tags.meta, tags.comment], color: '#B58399', fontStyle: 'italic' },
    { tag: tags.string, color: '#B45309' },
    { tag: [tags.bool, tags.atom], color: '#E11D48', fontWeight: '600' },
  ]),
  lavender: HighlightStyle.define([
    { tag: tags.keyword, color: '#7C3AED', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#271C47' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#DB2777' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#0D9488' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#271C47' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#2563EB' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#6E5F96' },
    { tag: [tags.meta, tags.comment], color: '#9D8EC7', fontStyle: 'italic' },
    { tag: tags.string, color: '#B45309' },
    { tag: [tags.bool, tags.atom], color: '#E11D48', fontWeight: '600' },
  ]),
  berry: HighlightStyle.define([
    { tag: tags.keyword, color: '#F472B6', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#FAEEF5' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#C084FC' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#FBBF24' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#FFF5F9' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#5EEAD4' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#C4A3B8' },
    { tag: [tags.meta, tags.comment], color: '#8A677D', fontStyle: 'italic' },
    { tag: tags.string, color: '#FCD34D' },
    { tag: [tags.bool, tags.atom], color: '#FB7185', fontWeight: '600' },
  ]),
  milktea: HighlightStyle.define([
    { tag: tags.keyword, color: '#C26A3A', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#3D281D' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#9A3412' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#0F766E' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#3D281D' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#B45309' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#866B5B' },
    { tag: [tags.meta, tags.comment], color: '#A38B7B', fontStyle: 'italic' },
    { tag: tags.string, color: '#15803D' },
    { tag: [tags.bool, tags.atom], color: '#BE123C', fontWeight: '600' },
  ]),
  matcha: HighlightStyle.define([
    { tag: tags.keyword, color: '#15803D', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#1B3322' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#0F766E' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#B45309' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#1B3322' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#BE185D' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#587862' },
    { tag: [tags.meta, tags.comment], color: '#7D9B85', fontStyle: 'italic' },
    { tag: tags.string, color: '#C2410C' },
    { tag: [tags.bool, tags.atom], color: '#BE185D', fontWeight: '600' },
  ]),
  sky: HighlightStyle.define([
    { tag: tags.keyword, color: '#0284C7', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#172554' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#6D28D9' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#0D9488' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#172554' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#DB2777' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#577199' },
    { tag: [tags.meta, tags.comment], color: '#839BC2', fontStyle: 'italic' },
    { tag: tags.string, color: '#B45309' },
    { tag: [tags.bool, tags.atom], color: '#E11D48', fontWeight: '600' },
  ]),
  rosegold: HighlightStyle.define([
    { tag: tags.keyword, color: '#F4B4BC', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#F8EDE9' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#FDBA74' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#FDE68A' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#FFF7F5' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#FDA4AF' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#C7A8A4' },
    { tag: [tags.meta, tags.comment], color: '#8F716F', fontStyle: 'italic' },
    { tag: tags.string, color: '#FCD34D' },
    { tag: [tags.bool, tags.atom], color: '#FB7185', fontWeight: '600' },
  ]),
  starry: HighlightStyle.define([
    { tag: tags.keyword, color: '#C4B5FD', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#EEF2FF' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#F472B6' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#67E8F9' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#FFFFFF' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#93C5FD' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#A5B0D6' },
    { tag: [tags.meta, tags.comment], color: '#707CA8', fontStyle: 'italic' },
    { tag: tags.string, color: '#FDE68A' },
    { tag: [tags.bool, tags.atom], color: '#F9A8D4', fontWeight: '600' },
  ]),
  peony: HighlightStyle.define([
    { tag: tags.keyword, color: '#E11D48', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#3F1220' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#9333EA' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#C2410C' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#3F1220' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#0F766E' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#935368' },
    { tag: [tags.meta, tags.comment], color: '#BD7D91', fontStyle: 'italic' },
    { tag: tags.string, color: '#B45309' },
    { tag: [tags.bool, tags.atom], color: '#BE123C', fontWeight: '600' },
  ]),
  champagne: HighlightStyle.define([
    { tag: tags.keyword, color: '#B45309', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#38271A' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#BE185D' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#0F766E' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#38271A' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#7C3AED' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#7F6956' },
    { tag: [tags.meta, tags.comment], color: '#A58F7B', fontStyle: 'italic' },
    { tag: tags.string, color: '#15803D' },
    { tag: [tags.bool, tags.atom], color: '#C2410C', fontWeight: '600' },
  ]),
  moonrose: HighlightStyle.define([
    { tag: tags.keyword, color: '#F9A8D4', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#FDF2F8' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#C4B5FD' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#FDE68A' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#FFFFFF' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#67E8F9' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#CDA5C3' },
    { tag: [tags.meta, tags.comment], color: '#94678A', fontStyle: 'italic' },
    { tag: tags.string, color: '#FDBA74' },
    { tag: [tags.bool, tags.atom], color: '#FB7185', fontWeight: '600' },
  ]),
  aurorapink: HighlightStyle.define([
    { tag: tags.keyword, color: '#FB7185', fontWeight: '600' },
    { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#F5F3FF' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#5EEAD4' },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#FDE68A' },
    { tag: [tags.definition(tags.name), tags.separator], color: '#FFFFFF' },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#C4B5FD' },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#B6ADD8' },
    { tag: [tags.meta, tags.comment], color: '#7D74A6', fontStyle: 'italic' },
    { tag: tags.string, color: '#FDE047' },
    { tag: [tags.bool, tags.atom], color: '#F472B6', fontWeight: '600' },
  ]),
};

const EDITOR_SURFACE_TOKENS: Record<
  ThemeId,
  {
    bg: string;
    fg: string;
    gutterBg: string;
    gutterFg: string;
    gutterBorder: string;
    activeGutterBg: string;
    activeLineBg: string;
    accent: string;
    selectionBg: string;
    panelBg: string;
  }
> = {
  dark: {
    bg: '#0B0F17',
    fg: '#E2E8F0',
    gutterBg: '#0B0F17',
    gutterFg: '#475569',
    gutterBorder: '#1E293B',
    activeGutterBg: '#121826',
    activeLineBg: 'rgba(30, 41, 59, 0.35)',
    accent: '#10B981',
    selectionBg: 'rgba(16, 185, 129, 0.22)',
    panelBg: '#121826',
  },
  light: {
    bg: '#FFFFFF',
    fg: '#0F172A',
    gutterBg: '#F8FAFC',
    gutterFg: '#94A3B8',
    gutterBorder: '#E2E8F0',
    activeGutterBg: '#F1F5F9',
    activeLineBg: 'rgba(241, 245, 249, 0.8)',
    accent: '#059669',
    selectionBg: 'rgba(16, 185, 129, 0.18)',
    panelBg: '#F8FAFC',
  },
  rose: {
    bg: '#FFFFFF',
    fg: '#3B1626',
    gutterBg: '#FFF7F9',
    gutterFg: '#C08BA2',
    gutterBorder: '#FBCFE8',
    activeGutterBg: '#FFEAF2',
    activeLineBg: 'rgba(255, 228, 236, 0.45)',
    accent: '#DB2777',
    selectionBg: 'rgba(219, 39, 119, 0.16)',
    panelBg: '#FFF0F4',
  },
  lavender: {
    bg: '#FFFFFF',
    fg: '#271C47',
    gutterBg: '#F7F5FF',
    gutterFg: '#9B8CC2',
    gutterBorder: '#DDD6FE',
    activeGutterBg: '#EFEAFC',
    activeLineBg: 'rgba(237, 233, 254, 0.5)',
    accent: '#7C3AED',
    selectionBg: 'rgba(124, 58, 237, 0.16)',
    panelBg: '#EFEAFC',
  },
  milktea: {
    bg: '#FFFFFF',
    fg: '#3D281D',
    gutterBg: '#FBF7F2',
    gutterFg: '#B39682',
    gutterBorder: '#E8D7C5',
    activeGutterBg: '#F5ECE2',
    activeLineBg: 'rgba(243, 232, 220, 0.5)',
    accent: '#C26A3A',
    selectionBg: 'rgba(194, 106, 58, 0.16)',
    panelBg: '#F5ECE2',
  },
  matcha: {
    bg: '#FFFFFF',
    fg: '#1B3322',
    gutterBg: '#F5FAF6',
    gutterFg: '#7AA386',
    gutterBorder: '#C7E3CE',
    activeGutterBg: '#EBF5ED',
    activeLineBg: 'rgba(227, 242, 231, 0.5)',
    accent: '#15803D',
    selectionBg: 'rgba(21, 128, 61, 0.16)',
    panelBg: '#EBF5ED',
  },
  sky: {
    bg: '#FFFFFF',
    fg: '#172554',
    gutterBg: '#F3F9FF',
    gutterFg: '#7D9BC7',
    gutterBorder: '#BFDBFE',
    activeGutterBg: '#E8F3FF',
    activeLineBg: 'rgba(224, 240, 255, 0.55)',
    accent: '#0284C7',
    selectionBg: 'rgba(2, 132, 199, 0.16)',
    panelBg: '#E8F3FF',
  },
  berry: {
    bg: '#170E19',
    fg: '#FAEEF5',
    gutterBg: '#170E19',
    gutterFg: '#7D5870',
    gutterBorder: '#3B2442',
    activeGutterBg: '#221526',
    activeLineBg: 'rgba(59, 36, 66, 0.42)',
    accent: '#EC4899',
    selectionBg: 'rgba(236, 72, 153, 0.24)',
    panelBg: '#221526',
  },
  rosegold: {
    bg: '#151013',
    fg: '#F8EDE9',
    gutterBg: '#151013',
    gutterFg: '#8C6B6C',
    gutterBorder: '#3D2B33',
    activeGutterBg: '#22191E',
    activeLineBg: 'rgba(61, 43, 51, 0.42)',
    accent: '#E28C97',
    selectionBg: 'rgba(226, 140, 151, 0.24)',
    panelBg: '#22191E',
  },
  starry: {
    bg: '#101024',
    fg: '#EEF2FF',
    gutterBg: '#101024',
    gutterFg: '#6A76A6',
    gutterBorder: '#2C2E57',
    activeGutterBg: '#181933',
    activeLineBg: 'rgba(44, 46, 87, 0.45)',
    accent: '#A78BFA',
    selectionBg: 'rgba(167, 139, 250, 0.24)',
    panelBg: '#181933',
  },
  peony: {
    bg: '#FFFFFF',
    fg: '#3F1220',
    gutterBg: '#FFF5F6',
    gutterFg: '#C17D92',
    gutterBorder: '#FECDD6',
    activeGutterBg: '#FFE8EC',
    activeLineBg: 'rgba(255, 228, 233, 0.5)',
    accent: '#E11D48',
    selectionBg: 'rgba(225, 29, 72, 0.16)',
    panelBg: '#FFECEF',
  },
  champagne: {
    bg: '#FFFFFF',
    fg: '#38271A',
    gutterBg: '#FCF9F4',
    gutterFg: '#AD947D',
    gutterBorder: '#E8D9C5',
    activeGutterBg: '#F6EFE6',
    activeLineBg: 'rgba(243, 233, 220, 0.55)',
    accent: '#B45309',
    selectionBg: 'rgba(180, 83, 9, 0.16)',
    panelBg: '#F6EFE6',
  },
  moonrose: {
    bg: '#140C14',
    fg: '#FDF2F8',
    gutterBg: '#140C14',
    gutterFg: '#8E5F83',
    gutterBorder: '#42243F',
    activeGutterBg: '#211321',
    activeLineBg: 'rgba(66, 36, 63, 0.45)',
    accent: '#F472B6',
    selectionBg: 'rgba(244, 114, 182, 0.24)',
    panelBg: '#211321',
  },
  aurorapink: {
    bg: '#0F1123',
    fg: '#F5F3FF',
    gutterBg: '#0F1123',
    gutterFg: '#7771A6',
    gutterBorder: '#32315E',
    activeGutterBg: '#181A33',
    activeLineBg: 'rgba(50, 49, 94, 0.45)',
    accent: '#F43F5E',
    selectionBg: 'rgba(244, 63, 94, 0.24)',
    panelBg: '#181A33',
  },
};

function createEditorTheme(themeId: ThemeId, fontSize: number, transparentBg = false) {
  const meta = getThemeMeta(themeId);
  const t = EDITOR_SURFACE_TOKENS[themeId] ?? EDITOR_SURFACE_TOKENS.rose;
  // The workspace paper already provides the shared translucent surface.
  // Keep the editor canvas transparent like the terminal instead of stacking
  // a second tinted layer above the paper.
  const editorBg = transparentBg ? 'transparent' : t.bg;
  const gutterBg = transparentBg ? 'transparent' : t.gutterBg;
  const panelBg = transparentBg ? 'var(--ide-workspace-surface, transparent)' : t.panelBg;
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        fontSize: `${fontSize}px`,
        backgroundColor: editorBg,
        color: t.fg,
      },
      '.cm-scroller': {
        fontFamily: 'var(--font-mono)',
        lineHeight: '1.65',
        overflow: 'auto',
        paddingTop: '8px',
        paddingBottom: '24px',
      },
      '.cm-content': {
        caretColor: t.accent,
        paddingRight: '16px',
      },
      '.cm-gutters': {
        backgroundColor: gutterBg,
        color: t.gutterFg,
        borderRight: transparentBg ? 'none' : `1px solid ${t.gutterBorder}`,
        paddingLeft: '1px',
        paddingRight: '1px',
        fontVariantNumeric: 'tabular-nums',
        userSelect: 'none',
      },
      '.cm-gutterElement': {
        padding: '0 2px',
        fontSize: '0.82em',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        minWidth: '0',
        paddingLeft: '2px',
        paddingRight: '2px',
      },
      '.cm-activeLineGutter': {
        backgroundColor: transparentBg ? 'transparent' : t.activeGutterBg,
        color: t.accent,
        fontWeight: '600',
      },
      '.cm-activeLine': {
        backgroundColor: t.activeLineBg,
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: `${t.selectionBg} !important`,
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: t.accent,
        borderLeftWidth: '2px',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-matchingBracket': {
        backgroundColor: t.selectionBg,
        outline: `1px solid ${t.accent}`,
      },
      '.cm-panels': {
        backgroundColor: panelBg,
        color: t.fg,
        borderBottom: `1px solid ${t.gutterBorder}`,
      },
      '.cm-textfield': {
        backgroundColor: t.bg,
        color: t.fg,
        border: `1px solid ${t.gutterBorder}`,
        borderRadius: '6px',
        padding: '4px 8px',
      },
      '.cm-button': {
        backgroundImage: 'none',
        backgroundColor: t.activeGutterBg,
        color: t.fg,
        border: 'none',
        borderRadius: '6px',
        padding: '4px 10px',
      },
    },
    { dark: meta.isDark }
  );
}

function localizeSearchPanel(root: HTMLElement): void {
  const panel = root.querySelector<HTMLElement>('.cm-search');
  if (!panel) return;

  const translations: Record<string, string> = {
    find: '尋找',
    'find:': '尋找：',
    replace: '取代',
    'replace:': '取代：',
    next: '下一個',
    previous: '上一個',
    'replace all': '全部取代',
    replaceall: '全部取代',
    select: '選取',
    'select all': '全部選取',
    close: '關閉',
    search: '搜尋',
    'search:': '搜尋：',
    'match case': '符合大小寫',
    'match case:': '符合大小寫：',
    regexp: '正規表達式',
    'regexp:': '正規表達式：',
    'by word': '整字匹配',
    'by word:': '整字匹配：',
  };
  const translate = (value: string) =>
    translations[value.trim().toLowerCase().replace(/\\s+/g, ' ')] ?? value;

  panel.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
    if (input.placeholder) input.placeholder = translate(input.placeholder);
    if (input.getAttribute('aria-label')) {
      input.setAttribute('aria-label', translate(input.getAttribute('aria-label') || ''));
    }
    if (input.title) input.title = translate(input.title);
  });

  // Translate visible text nodes rather than assigning element.textContent:
  // CodeMirror nests checkbox inputs inside labels, and replacing textContent
  // would accidentally remove those working controls.
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
  let textNode: Node | null;
  while ((textNode = walker.nextNode())) {
    const original = textNode.nodeValue ?? '';
    const trimmed = original.trim();
    if (!trimmed) continue;
    const localized = translate(trimmed);
    if (localized !== trimmed) {
      const leading = original.match(/^\\s*/)?.[0] ?? '';
      const trailing = original.match(/\\s*$/)?.[0] ?? '';
      textNode.nodeValue = leading + localized + trailing;
    }
  }

  panel.querySelectorAll<HTMLElement>('button, label, [aria-label], [title]').forEach((element) => {
    const label = element.getAttribute('aria-label');
    const title = element.getAttribute('title');
    if (label) element.setAttribute('aria-label', translate(label));
    if (title) element.setAttribute('title', translate(title));
    const text = element.textContent?.trim() ?? '';
    if (text === '×' || /^(close|關閉)$/i.test(label || title || '')) {
      element.classList.add('dp-search-close');
      element.setAttribute('aria-label', '關閉搜尋／取代');
      element.setAttribute('title', '關閉搜尋／取代');
    }
  });
}

function getLanguageMode(filename?: string): 'python' | 'json' | 'plain' {
  const lower = (filename ?? 'main.py').toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.py')) return 'python';
  return 'plain';
}

function buildSyntaxLinter(filenameRef: React.MutableRefObject<string | undefined>) {
  return linter(
    (view): Diagnostic[] => {
      const mode = getLanguageMode(filenameRef.current);
      const docText = view.state.doc.toString();
      if (!docText.trim()) return [];

      if (mode === 'json') {
        try {
          JSON.parse(docText);
          return [];
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Invalid JSON';
          const posMatch = msg.match(/position\s+(\d+)/i);
          const pos = posMatch ? Math.min(docText.length, Number(posMatch[1])) : 0;
          return [
            {
              from: Math.max(0, pos - 1),
              to: Math.min(docText.length, Math.max(1, pos + 1)),
              severity: 'error',
              message: msg,
            },
          ];
        }
      }

      if (mode === 'python') {
        const syntaxErr = checkPythonSyntax(docText);
        if (syntaxErr) {
          const lineCount = view.state.doc.lines;
          const clampedLine = Math.min(Math.max(1, syntaxErr.line), lineCount);
          const lineObj = view.state.doc.line(clampedLine);
          const from = Math.min(
            lineObj.to,
            lineObj.from + Math.max(0, (syntaxErr.col || 1) - 1)
          );
          const to = Math.min(lineObj.to, Math.max(from + 1, lineObj.to));
          return [
            {
              from,
              to: Math.max(from, to),
              severity: 'error',
              message: syntaxErr.message,
            },
          ];
        }
      }
      return [];
    },
    { delay: 450 }
  );
}

export const CodeEditor = React.forwardRef<CodeEditorHandle, CodeEditorProps>(
  ({ value, filename, onChange, onRunShortcut, onCursorChange, fontSize, tabSize, wordWrap, theme, pyodideReady, transparentBg = false }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onRunRef = useRef(onRunShortcut);
    const onCursorRef = useRef(onCursorChange);
    const filenameRef = useRef(filename);
    const isExternalSyncRef = useRef(false);

    const themeCompartment = useRef(new Compartment()).current;
    const highlightCompartment = useRef(new Compartment()).current;
    const wrapCompartment = useRef(new Compartment()).current;
    const tabCompartment = useRef(new Compartment()).current;
    const langCompartment = useRef(new Compartment()).current;

    onChangeRef.current = onChange;
    onRunRef.current = onRunShortcut;
    onCursorRef.current = onCursorChange;
    filenameRef.current = filename;

    useEffect(() => {
      if (!containerRef.current) return;

      const initialMode = getLanguageMode(filename);
      const initialLangExt =
        initialMode === 'json' ? json() : initialMode === 'python' ? python() : [];

      const state = EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          lintGutter(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          langCompartment.of(initialLangExt),
          buildSyntaxLinter(filenameRef),
          tabCompartment.of(indentUnit.of(' '.repeat(tabSize))),
          wrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
          themeCompartment.of(createEditorTheme(theme, fontSize, transparentBg)),
          highlightCompartment.of(syntaxHighlighting(HIGHLIGHT_PRESETS[theme] ?? HIGHLIGHT_PRESETS.rose)),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                onRunRef.current();
                return true;
              },
            },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !isExternalSyncRef.current) {
              onChangeRef.current(update.state.doc.toString());
            }
            if (update.selectionSet && onCursorRef.current) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              onCursorRef.current(line.number, head - line.from + 1);
            }
          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;

      // Mount CodeMirror's real search form in a pane-sized overlay owned by
      // this React editor container. Moving the live panel preserves its
      // built-in find/replace behavior while giving it a reliable editor-local
      // centering reference on Android.
      const editorContainer = containerRef.current;
      const searchOverlay = document.createElement('div');
      searchOverlay.className = 'dp-search-overlay';
      editorContainer.appendChild(searchOverlay);

      const getSearchPanel = () =>
        editorContainer.querySelector<HTMLElement>('.cm-search');

      // CodeMirror's built-in search panel is kept for its proven find/replace
      // behavior; localize its generated controls as soon as the panel is mounted.
      let searchHistoryPushed = false;
      const closeSearchDialog = () => {
        if (getSearchPanel()) closeSearchPanel(view);
      };
      const handleSearchBack = () => {
        searchHistoryPushed = false;
        closeSearchDialog();
      };
      const handleSearchKeydown = (event: KeyboardEvent) => {
        if (!getSearchPanel()) return;
        if (event.key === 'Escape' || event.key === 'BrowserBack' || event.key === 'GoBack' || event.keyCode === 4) {
          event.preventDefault();
          event.stopPropagation();
          closeSearchDialog();
          if (searchHistoryPushed) {
            searchHistoryPushed = false;
            window.history.back();
          }
        }
      };
      const handleSearchOutsideClick = (event: PointerEvent) => {
        const panel = getSearchPanel();
        if (panel && event.target instanceof Node && !panel.contains(event.target)) {
          closeSearchDialog();
          if (searchHistoryPushed) {
            searchHistoryPushed = false;
            window.history.back();
          }
        }
      };
      const searchPanelObserver = new MutationObserver(() => {
        const panel = getSearchPanel();
        if (panel) {
          if (panel.parentElement !== searchOverlay) searchOverlay.appendChild(panel);
          localizeSearchPanel(editorContainer);
          if (!searchHistoryPushed) {
            window.history.pushState({ ...(window.history.state || {}), dpSearchDialog: true }, '');
            searchHistoryPushed = true;
          }
        } else if (searchHistoryPushed) {
          searchHistoryPushed = false;
          window.history.back();
        }
      });
      searchPanelObserver.observe(editorContainer, { childList: true, subtree: true });
      window.addEventListener('popstate', handleSearchBack);
      document.addEventListener('keydown', handleSearchKeydown, true);
      document.addEventListener('pointerdown', handleSearchOutsideClick, true);
      localizeSearchPanel(editorContainer);

      return () => {
        searchPanelObserver.disconnect();
        searchOverlay.remove();
        window.removeEventListener('popstate', handleSearchBack);
        document.removeEventListener('keydown', handleSearchKeydown, true);
        document.removeEventListener('pointerdown', handleSearchOutsideClick, true);
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const currentDoc = view.state.doc.toString();
      if (currentDoc !== value) {
        isExternalSyncRef.current = true;
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
        });
        isExternalSyncRef.current = false;
      }
    }, [value]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: [
          themeCompartment.reconfigure(createEditorTheme(theme, fontSize, transparentBg)),
          highlightCompartment.reconfigure(syntaxHighlighting(HIGHLIGHT_PRESETS[theme] ?? HIGHLIGHT_PRESETS.rose)),
        ],
      });
    }, [theme, fontSize, transparentBg, themeCompartment, highlightCompartment]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: wrapCompartment.reconfigure(wordWrap ? EditorView.lineWrapping : []),
      });
    }, [wordWrap, wrapCompartment]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: tabCompartment.reconfigure(indentUnit.of(' '.repeat(tabSize))),
      });
    }, [tabSize, tabCompartment]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const mode = getLanguageMode(filename);
      view.dispatch({
        effects: langCompartment.reconfigure(
          mode === 'json' ? json() : mode === 'python' ? python() : []
        ),
      });
      forceLinting(view);
    }, [filename, langCompartment]);

    useEffect(() => {
      if (pyodideReady && viewRef.current) {
        forceLinting(viewRef.current);
      }
    }, [pyodideReady]);

    useImperativeHandle(ref, () => ({
      insertText: (text: string, cursorOffset = 0) => {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        const nextCursor = from + text.length + cursorOffset;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: Math.max(0, nextCursor) },
          scrollIntoView: true,
        });
        view.focus();
      },
      moveCursor: (delta: number) => {
        const view = viewRef.current;
        if (!view) return;
        const head = view.state.selection.main.head;
        const max = view.state.doc.length;
        const next = Math.min(max, Math.max(0, head + delta));
        view.dispatch({
          selection: { anchor: next },
          scrollIntoView: true,
        });
        view.focus();
      },
      undo: () => {
        if (viewRef.current) {
          cmUndo(viewRef.current);
          viewRef.current.focus();
        }
      },
      redo: () => {
        if (viewRef.current) {
          cmRedo(viewRef.current);
          viewRef.current.focus();
        }
      },
      focus: () => {
        viewRef.current?.focus();
      },
      openSearch: () => {
        if (viewRef.current) {
          openSearchPanel(viewRef.current);
        }
      },
      formatCode: () => {
        const view = viewRef.current;
        if (!view) return false;
        const current = view.state.doc.toString();
        const mode = getLanguageMode(filenameRef.current);
        let formatted = current;
        if (mode === 'json') {
          try {
            formatted = JSON.stringify(JSON.parse(current), null, 2) + '\n';
          } catch {
            return false;
          }
        } else {
          const indentStr = ' '.repeat(tabSize);
          formatted =
            current
              .replace(/\r\n/g, '\n')
              .split('\n')
              .map((line) => {
                const match = line.match(/^(\s*)(.*)$/);
                if (!match) return line.trimEnd();
                const leading = match[1].replace(/\t/g, indentStr);
                return leading + match[2].trimEnd();
              })
              .join('\n')
              .replace(/\n{3,}/g, '\n\n')
              .trimEnd() + '\n';
        }
        if (formatted !== current) {
          view.dispatch({
            changes: { from: 0, to: current.length, insert: formatted },
          });
        }
        return true;
      },
    }));

    return <div ref={containerRef} className="dp-code-editor-container h-full w-full overflow-hidden" />;
  }
);

CodeEditor.displayName = 'CodeEditor';
