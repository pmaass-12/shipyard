/**
 * NewProjectModal — desktop modal / mobile bottom sheet.
 *
 * Fields: Name, Description, GitHub URL, Budget, Tech stack (pill multi-select), Color picker.
 *
 * Engineer note: tech_stack and color are not in contract v1 but are required by the
 * handoff spec. They are submitted to the API; if the DB columns don't exist yet the
 * API layer will attempt the insert and throw. See impl-projects-list.md.
 */

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { X, Github, DollarSign } from 'lucide-react';
import type { NewProjectInput, ProjectColor, TechStackTag } from '@/types/db';
import { COLOR_OPTIONS, getMonogramColors, getMonogram } from './utils';
import { DEFAULT_TECH_STACK, TECH_STACK_LABELS } from '@/types/db';

interface NewProjectModalProps {
  onSubmit: (input: NewProjectInput) => Promise<void>;
  onClose:  () => void;
}

export function NewProjectModal({ onSubmit, onClose }: NewProjectModalProps) {
  const [name,       setName]       = useState('');
  const [desc,       setDesc]       = useState('');
  const [repoUrl,    setRepoUrl]    = useState('');
  const [budget,     setBudget]     = useState('');
  const [color,      setColor]      = useState<ProjectColor>('blue');
  const [techStack,  setTechStack]  = useState<TechStackTag[]>([...DEFAULT_TECH_STACK]);
  const [nameError,  setNameError]  = useState('');
  const [stackError, setStackError] = useState('');
  const [loading,    setLoading]    = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus name on open
  useEffect(() => {
    nameRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const toggleTag = (tag: TechStackTag) => {
    setTechStack(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    setStackError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!name.trim()) {
      setNameError('Project name is required.');
      valid = false;
    } else if (name.trim().length > 60) {
      setNameError('Name must be 60 characters or fewer.');
      valid = false;
    } else {
      setNameError('');
    }

    if (techStack.length === 0) {
      setStackError('Select at least one tech stack item.');
      valid = false;
    }

    if (!valid) return;

    setLoading(true);
    try {
      await onSubmit({
        name:        name.trim(),
        description: desc.trim() || null,
        color,
        repo_url:   repoUrl.trim() || null,
        budget_usd: budget ? parseFloat(budget) : null,
        tech_stack: techStack,
      });
      // onSubmit is responsible for navigation — do not close here
    } catch {
      // Error is shown via toast in parent
    } finally {
      setLoading(false);
    }
  };

  const previewMono = getMonogram(name || 'New');
  const previewColors = getMonogramColors(color);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Sheet / modal */}
      <div
        className="w-full sm:max-w-[480px] border overflow-y-auto
          sm:rounded-2xl rounded-t-[20px] animate-slide-up sm:animate-fade-in"
        style={{
          maxHeight:   '92dvh',
          background:  'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Create new project"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            New project
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Color picker + monogram preview */}
          <div className="flex items-center gap-4">
            <div
              className="w-[46px] h-[46px] flex items-center justify-center text-sm font-bold shrink-0"
              style={{
                background:   previewColors.bg,
                color:        previewColors.text,
                borderRadius: '12px',
              }}
            >
              {previewMono}
            </div>

            <div className="flex gap-2">
              {COLOR_OPTIONS.map(c => {
                const cv = getMonogramColors(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-full transition-transform"
                    style={{
                      background:  cv.bg,
                      border:      color === c ? `2px solid ${cv.text}` : '2px solid transparent',
                      transform:   color === c ? 'scale(1.2)' : 'scale(1)',
                    }}
                    aria-label={`Color: ${c}`}
                    aria-pressed={color === c}
                  />
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--color-text)' }}>
              Project name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              placeholder="e.g. My SaaS App"
              maxLength={60}
              value={name}
              onChange={e => { setName(e.target.value); setNameError(''); }}
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none"
              style={{
                borderColor: nameError ? '#ef4444' : 'var(--color-border)',
                background:  'var(--color-bg)',
                color:       'var(--color-text)',
              }}
              onFocus={e => { if (!nameError) e.target.style.borderColor = 'var(--color-accent)'; }}
              onBlur={e => { if (!nameError) e.target.style.borderColor = 'var(--color-border)'; }}
            />
            <div className="flex justify-between mt-1">
              {nameError
                ? <p className="text-xs text-red-500">{nameError}</p>
                : <span />
              }
              <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                {name.length}/60
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--color-text)' }}>
              Description
              <span className="ml-1 text-xs font-normal" style={{ color: 'var(--color-text-subtle)' }}>
                optional
              </span>
            </label>
            <textarea
              placeholder="What are you building?"
              maxLength={200}
              rows={2}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={{
                borderColor: 'var(--color-border)',
                background:  'var(--color-bg)',
                color:       'var(--color-text)',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
              onBlur={e => (e.target.style.borderColor  = 'var(--color-border)')}
            />
            <div className="flex justify-end mt-1">
              <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                {desc.length}/200
              </span>
            </div>
          </div>

          {/* GitHub repo URL */}
          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--color-text)' }}>
              GitHub repo URL
              <span className="ml-1 text-xs font-normal" style={{ color: 'var(--color-text-subtle)' }}>
                optional
              </span>
            </label>
            <div className="relative">
              <Github size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-subtle)' }} />
              <input
                type="url"
                placeholder="https://github.com/you/repo"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg border text-sm outline-none"
                style={{
                  borderColor: 'var(--color-border)',
                  background:  'var(--color-bg)',
                  color:       'var(--color-text)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
                onBlur={e => (e.target.style.borderColor  = 'var(--color-border)')}
              />
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--color-text)' }}>
              Budget (USD)
              <span className="ml-1 text-xs font-normal" style={{ color: 'var(--color-text-subtle)' }}>
                optional
              </span>
            </label>
            <div className="relative">
              <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-subtle)' }} />
              <input
                type="number"
                placeholder="0"
                min={0}
                step={100}
                value={budget}
                onChange={e => setBudget(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg border text-sm outline-none"
                style={{
                  borderColor: 'var(--color-border)',
                  background:  'var(--color-bg)',
                  color:       'var(--color-text)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
                onBlur={e => (e.target.style.borderColor  = 'var(--color-border)')}
              />
            </div>
          </div>

          {/* Tech stack */}
          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--color-text)' }}>
              Tech stack <span className="text-red-500">*</span>
            </label>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Deselect anything you won't use. This determines what Claude generates.
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TECH_STACK_LABELS) as TechStackTag[]).map(tag => {
                const selected = techStack.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="h-7 px-3 rounded-full text-xs font-medium transition-colors"
                    style={selected
                      ? {
                          background:  'var(--color-accent-light)',
                          color:       'var(--color-accent)',
                          border:      '1.5px solid var(--color-accent)',
                        }
                      : {
                          background:  'var(--color-surface)',
                          color:       'var(--color-text-muted)',
                          border:      '1.5px solid var(--color-border)',
                        }
                    }
                    aria-pressed={selected}
                  >
                    {TECH_STACK_LABELS[tag]}
                  </button>
                );
              })}
            </div>
            {stackError && <p className="text-xs text-red-500 mt-1">{stackError}</p>}
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg text-sm font-medium border transition-colors"
              style={{
                borderColor: 'var(--color-border)',
                color:       'var(--color-text)',
                background:  'var(--color-surface)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-lg text-sm font-semibold text-white
                transition-colors disabled:opacity-60"
              style={{ background: 'var(--color-accent)' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--color-accent-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-accent)'; }}
            >
              {loading ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
