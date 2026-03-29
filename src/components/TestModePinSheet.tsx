/**
 * TestModePinSheet — Build 007
 *
 * Bottom-sheet PIN entry modal. Renders over the login screen (same URL).
 * Auto-submits when the last digit is entered.
 *
 * Props:
 *   projectId — the project whose PIN is being validated
 *   onSuccess  — called when PIN is verified; parent should activate TestMode
 *   onDismiss  — called when user taps ✕ to close
 */

import { useState } from 'react';
import { TestMode } from '@/utils/testMode';

interface Props {
  projectId:  string;
  onSuccess:  () => void;
  onDismiss:  () => void;
}

const PIN_LENGTH = 6; // default; would ideally be dynamic from config

export default function TestModePinSheet({ projectId, onSuccess, onDismiss }: Props) {
  const [digits, setDigits]   = useState<string[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitPin(pin: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/test-mode/validate-pin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ project_id: projectId, pin }),
      });

      const data: { valid: boolean; reason?: string; error?: string } = await res.json();

      if (res.status === 429) {
        setError('Too many attempts — try again in 1 minute');
        setDigits([]);
        return;
      }

      if (data.reason === 'disabled') {
        setError('Test Mode is disabled for this app');
        setDigits([]);
        return;
      }

      if (data.reason === 'not_configured') {
        setError('Contact the app builder to set up Test Mode');
        setDigits([]);
        return;
      }

      if (data.valid) {
        TestMode.activate(projectId);
        onSuccess();
      } else {
        setError('Incorrect PIN — try again');
        setDigits([]);
      }
    } catch {
      setError('Connection error — try again');
      setDigits([]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(key: string) {
    if (loading) return;

    if (key === '✕') {
      onDismiss();
      return;
    }

    if (key === '⌫') {
      setDigits(prev => prev.slice(0, -1));
      setError(null);
      return;
    }

    if (digits.length >= PIN_LENGTH) return;

    const next = [...digits, key];
    setDigits(next);
    setError(null);

    if (next.length === PIN_LENGTH) {
      submitPin(next.join(''));
    }
  }

  const keypad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['✕', '0', '⌫'],
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onDismiss}
        style={{
          position:   'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex:      800,
        }}
      />

      {/* Bottom sheet */}
      <div
        data-testid="test-mode-pin-sheet"
        style={{
          position:     'fixed',
          bottom:        0,
          left:          0,
          right:         0,
          zIndex:        801,
          background:   '#fff',
          borderRadius: '20px 20px 0 0',
          padding:      '24px 24px 40px',
          maxWidth:      440,
          margin:       '0 auto',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 6 }}>
            Enter Test Mode
          </p>
          <p style={{ fontSize: 13, color: '#888' }}>
            Ask the app builder for the test PIN
          </p>
        </div>

        {/* Dot indicators */}
        <div style={{
          display:        'flex',
          justifyContent: 'center',
          gap:             14,
          marginBottom:    20,
        }}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              style={{
                width:        14,
                height:       14,
                borderRadius: '50%',
                background:    i < digits.length ? '#111' : 'transparent',
                border:       '2px solid',
                borderColor:   i < digits.length ? '#111' : '#ccc',
                transition:   'all 0.15s ease',
              }}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p style={{
            textAlign:    'center',
            color:        '#dc2626',
            fontSize:      12,
            marginBottom:  12,
          }}>
            {error}
          </p>
        )}

        {/* Loading hint */}
        {loading && (
          <p style={{ textAlign: 'center', color: '#888', fontSize: 12, marginBottom: 12 }}>
            Checking…
          </p>
        )}

        {/* Numeric keypad */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap:                  10,
          maxWidth:             280,
          margin:              '0 auto',
        }}>
          {keypad.flat().map(key => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              disabled={loading}
              data-testid={`pin-key-${key === '✕' ? 'dismiss' : key === '⌫' ? 'backspace' : key}`}
              style={{
                padding:      '18px 0',
                borderRadius:  12,
                border:       'none',
                background:    key === '✕' ? 'transparent' : '#f5f5f5',
                color:         key === '✕' ? '#888' : '#111',
                fontSize:      key === '⌫' ? 18 : key === '✕' ? 18 : 22,
                fontWeight:    500,
                cursor:        loading ? 'not-allowed' : 'pointer',
                opacity:       loading ? 0.5 : 1,
                transition:   'background 0.1s',
              }}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
