/**
 * PushToProductionModal — Build 006
 *
 * Centered 440px confirmation modal shown before the Push to Production action.
 * Lists all Production-maturity features, shows a warning count for Alpha/Beta,
 * and shows downstream triggers as a checklist.
 *
 * Props:
 *   projectName       — displayed in modal title
 *   summary           — ProjectSummary row (contains feature counts)
 *   featuresProduction — names of Production-maturity features (pre-fetched)
 *   onConfirm          — called when user clicks "Push to Production"
 *   onCancel           — called on Cancel or backdrop click
 *   loading            — true while the push request is in-flight
 */

import type { ProjectSummary } from '@/types/db';

interface Props {
  projectName:        string;
  summary:            ProjectSummary;
  featuresProduction: string[];   // names only
  onConfirm:          () => void;
  onCancel:           () => void;
  loading:            boolean;
}

export default function PushToProductionModal({
  projectName,
  summary,
  featuresProduction,
  onConfirm,
  onCancel,
  loading,
}: Props) {
  const notIncluded = (summary.features_alpha ?? 0) + (summary.features_beta ?? 0);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.50)',
          zIndex: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      />

      {/* Modal */}
      <div
        data-testid="launch-modal"
        style={{
          position:     'fixed',
          top:          '50%',
          left:         '50%',
          transform:    'translate(-50%, -50%)',
          zIndex:        901,
          width:         440,
          maxWidth:     'calc(100vw - 32px)',
          background:   '#fff',
          borderRadius:  16,
          boxShadow:    '0 8px 40px rgba(0,0,0,0.22)',
          padding:      '28px 28px 24px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <h2 style={{
          fontSize: 17, fontWeight: 700, color: '#111',
          marginBottom: 4, letterSpacing: '-0.3px',
        }}>
          Launch "{projectName}"?
        </h2>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
          This opens your product to the public and triggers your configured launch actions.
        </p>

        {/* Production features list */}
        <div style={{
          background: '#f8f9fa', borderRadius: 10, padding: '12px 14px', marginBottom: 16,
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            ✅ Production features ({featuresProduction.length})
          </p>
          {featuresProduction.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9ca3af' }}>No features — push will be blocked.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc' }}>
              {featuresProduction.map(name => (
                <li key={name} style={{ fontSize: 12, color: '#374151', marginBottom: 3 }}>
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Info: features still in Alpha / Beta (informational only — not a blocker) */}
        {notIncluded > 0 && (
          <div style={{
            background: '#f8f9fa', borderRadius: 10, padding: '10px 14px',
            border: '1px solid #e5e7eb', marginBottom: 16,
          }}>
            <p style={{ fontSize: 12, color: '#6b7280' }}>
              ℹ️ {notIncluded} feature{notIncluded !== 1 ? 's' : ''} still in Alpha or Beta — just so you know before you open the doors.
            </p>
          </div>
        )}

        {/* Downstream triggers checklist */}
        <div style={{
          background: '#f0fdf4', borderRadius: 10, padding: '12px 14px', marginBottom: 24,
          border: '1px solid #bbf7d0',
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 8 }}>
            Automatic after push:
          </p>
          {['🗺 Onboarding Tour generated (Build 008)', '✨ What\'s New entries generated (Build 009)'].map(item => (
            <div key={item} style={{
              fontSize: 12, color: '#166534', marginBottom: 4,
              display: 'flex', alignItems: 'flex-start', gap: 6,
            }}>
              <span>⚡</span> {item}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            data-testid="push-cancel"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '9px 18px', borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            data-testid="push-confirm"
            onClick={onConfirm}
            disabled={loading || featuresProduction.length === 0}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: featuresProduction.length === 0 || loading ? '#9ca3af' : '#16a34a',
              color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: featuresProduction.length === 0 || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Launching…' : '🚀 Launch'}
          </button>
        </div>
      </div>
    </>
  );
}
