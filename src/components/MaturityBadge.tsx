/**
 * MaturityBadge — Build 006
 *
 * Renders an Alpha / Beta / Production pill badge on feature cards.
 * Tapping opens a small popover with all three options + sub-descriptions.
 *
 * Colors per spec:
 *   Alpha      — gray  (#f3f4f6 / #374151)
 *   Beta       — amber (#ffedd5 / #c2410c)
 *   Production — green (#dcfce7 / #15803d)
 *
 * When readOnly=true (default false), the popover is suppressed.
 */

import { useState, useRef, useEffect } from 'react';
import type { FeatureMaturity } from '@/types/db';

interface Props {
  maturity:  FeatureMaturity;
  readOnly?: boolean;
  onChange?: (m: FeatureMaturity) => void;
}

export const MATURITY_STYLE: Record<FeatureMaturity, { bg: string; text: string; dot: string; label: string }> = {
  alpha:      { bg: '#f3f4f6', text: '#374151', dot: '#9ca3af', label: 'Alpha'      },
  beta:       { bg: '#ffedd5', text: '#c2410c', dot: '#fb923c', label: 'Beta'       },
  production: { bg: '#dcfce7', text: '#15803d', dot: '#4ade80', label: 'Production' },
};

const MATURITY_DESC: Record<FeatureMaturity, string> = {
  alpha:      'Early development — not yet stable.',
  beta:       'Feature-complete, in testing.',
  production: 'Fully released and stable.',
};

const MATURITY_ORDER: FeatureMaturity[] = ['alpha', 'beta', 'production'];

export default function MaturityBadge({ maturity, readOnly = false, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);

  const style = MATURITY_STYLE[maturity];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Badge pill */}
      <button
        data-testid={`phase-badge-${maturity}`}
        onClick={e => {
          if (readOnly) return;
          e.stopPropagation();
          setOpen(v => !v);
        }}
        style={{
          display:       'inline-flex',
          alignItems:    'center',
          gap:            4,
          padding:       '2px 7px',
          borderRadius:   20,
          border:        'none',
          background:     style.bg,
          color:          style.text,
          fontSize:       10,
          fontWeight:     700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          cursor:         readOnly ? 'default' : 'pointer',
        }}
      >
        <span style={{
          width:        5,
          height:       5,
          borderRadius: '50%',
          background:   style.dot,
          flexShrink:    0,
        }} />
        {style.label}
      </button>

      {/* Popover */}
      {open && !readOnly && (
        <div
          style={{
            position:     'absolute',
            bottom:       'calc(100% + 6px)',
            left:         '50%',
            transform:    'translateX(-50%)',
            zIndex:        50,
            background:   '#fff',
            borderRadius:  12,
            boxShadow:    '0 4px 20px rgba(0,0,0,0.14)',
            border:       '1px solid #e5e7eb',
            padding:       8,
            minWidth:      200,
          }}
          onClick={e => e.stopPropagation()}
        >
          {MATURITY_ORDER.map(m => {
            const s = MATURITY_STYLE[m];
            const active = m === maturity;
            return (
              <button
                key={m}
                data-testid={`phase-option-${m}`}
                onClick={() => { onChange?.(m); setOpen(false); }}
                style={{
                  display:        'flex',
                  alignItems:     'flex-start',
                  gap:             10,
                  width:          '100%',
                  padding:        '8px 10px',
                  borderRadius:    8,
                  border:         'none',
                  background:      active ? s.bg : 'transparent',
                  cursor:         'pointer',
                  textAlign:      'left',
                }}
              >
                {/* Dot */}
                <span style={{
                  width:        8,
                  height:       8,
                  borderRadius: '50%',
                  background:   s.dot,
                  flexShrink:    0,
                  marginTop:     3,
                }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: s.text }}>
                    {s.label}
                    {active && <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                    {MATURITY_DESC[m]}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
