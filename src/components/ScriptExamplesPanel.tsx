import React, { useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { PythonFile } from '../types/ide';
import { SNIPPET_CATEGORIES, SNIPPET_TEMPLATES, STARTER_EXAMPLES, SnippetCategoryId } from '../data/defaultFiles';
import { useI18n } from '../services/i18n';

interface ScriptExamplesPanelProps {
  files: PythonFile[];
  onCreateFile: (name: string, content: string) => void;
  onSelectFile: (id: string) => void;
  onClose: () => void;
  onNotify: (message: string) => void;
}

type ExampleItem = {
  id: string;
  title: string;
  filename: string;
  category: Exclude<SnippetCategoryId, 'all'>;
  desc: string;
  code: string;
  existingFileId: string | null;
};

/** Editor-owned examples workspace. It never changes the Files navigation destination. */
export const ScriptExamplesPanel: React.FC<ScriptExamplesPanelProps> = ({
  files,
  onCreateFile,
  onSelectFile,
  onClose,
  onNotify,
}) => {
  const { t } = useI18n();
  const [category, setCategory] = useState<SnippetCategoryId>('all');
  const examples = useMemo<ExampleItem[]>(() => [
    ...STARTER_EXAMPLES.map((example) => ({
      id: example.id,
      title: example.title,
      filename: example.name,
      category: example.category,
      desc: example.desc,
      code: example.content,
      existingFileId: example.id,
    })),
    ...SNIPPET_TEMPLATES.map((template) => ({
      ...template,
      existingFileId: null,
    })),
  ], []);

  return (
    <section
      aria-label={t('files_templates_btn')}
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent"
    >
      <div className="flex min-h-[48px] shrink-0 items-center gap-2 border-b border-[var(--ide-border)] px-3">
        <BookOpen className="h-4 w-4 text-[var(--ide-accent)]" />
        <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--ide-text)]">
          {t('files_templates_btn')}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[40px] px-3 text-xs font-medium text-[var(--ide-accent-text)]"
        >
          {t('files_collapse')}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto ide-scroll p-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {SNIPPET_CATEGORIES.map((item) => {
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                aria-pressed={active}
                className={`min-h-[44px] px-3 rounded-xl text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[var(--ide-accent)] text-white font-semibold'
                    : 'bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:border-[var(--ide-accent)]'
                }`}
              >
                {t(item.labelKey as Parameters<typeof t>[0])}
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 space-y-2">
          {examples.filter(
            (template) => category === 'all' || template.category === category
          ).map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                const existing = template.existingFileId
                  ? files.find((file) => file.id === template.existingFileId) ?? files.find((file) => file.name.toLowerCase() === template.filename.toLowerCase())
                  : undefined;
                if (existing) {
                  onSelectFile(existing.id);
                  onClose();
                  return;
                }
                let name = template.filename;
                if (files.some((file) => file.name.toLowerCase() === name.toLowerCase())) {
                  const stem = template.filename.replace(/\.py$/i, '');
                  let suffix = 1;
                  do {
                    name = `${stem}_${suffix++}.py`;
                  } while (files.some((file) => file.name.toLowerCase() === name.toLowerCase()));
                }
                onCreateFile(name, template.code);
                onNotify(t('files_template_added', { name }));
                onClose();
              }}
              className="w-full text-left p-3.5 dp-panel hover:border-[var(--ide-accent)] transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--ide-text)] truncate">{template.title}</span>
                <span className="font-mono text-[10px] text-[var(--ide-accent-text)] shrink-0">{template.filename}</span>
              </div>
              <div className="text-[11px] text-[var(--ide-text-muted)] mt-0.5 leading-snug">
                {template.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
