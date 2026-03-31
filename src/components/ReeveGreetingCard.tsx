/**
 * ReeveGreetingCard — Build 044
 *
 * Full-width greeting card shown on Project Hub when a project is in first-run mode
 * (new project, 0 features, 0 screens, first_run_completed_at IS NULL).
 *
 * Behaviour:
 *   - On mount: calls generate-reeve-chat-response with is_greeting=true to fetch
 *     a generated greeting (project name + description as context).
 *   - Chat input is autofocused.
 *   - On first message:
 *       1. Reeve responds conversationally
 *       2. Auto-creates a feature + screen
 *       3. Kicks off design generation
 *       4. Shows "Morgan is putting together the design…" inline indicator
 *   - On dismiss: calls onComplete() → sets first_run_completed_at
 *
 * Mobile-first: full-width at 375px, max-w-2xl centred on desktop.
 *
 * data-testid inventory:
 *   reeve-greeting-card           — outer card
 *   reeve-greeting-dismiss-btn    — × dismiss button
 *   reeve-greeting-text           — generated greeting text
 *   reeve-greeting-input          — chat input
 *   reeve-greeting-send-btn       — send button
 *   reeve-greeting-thinking       — "Reeve is thinking…" indicator
 *   reeve-greeting-design-queued  — "Morgan is putting together the design…" inline note
 */

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Avatar } from '@/components/Avatar';
import {
  insertUserPmMessage,
  generateReeveChatResponse,
} from '@/api/namedTeam';
import {
  autoCreateFeatureFromMessage,
  kickOffDesignGeneration,
  completeFirstRun,
} from '@/api/firstRun';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

interface ReeveGreetingCardProps {
  projectId:    string;
  projectName:  string;
  description:  string | null;
  onComplete:   () => void;   // called after first exchange or dismiss
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ReeveGreetingCard({
  projectId, projectName, description, onComplete,
}: ReeveGreetingCardProps) {
  const [greeting,       setGreeting]       = useState<string | null>(null);
  const [loadingGreet,   setLoadingGreet]   = useState(true);
  const [inputText,      setInputText]      = useState('');
  const [sending,        setSending]        = useState(false);
  const [thinking,       setThinking]       = useState(false);
  const [replyText,      setReplyText]      = useState<string | null>(null);
  const [designQueued,   setDesignQueued]   = useState(false);
  const [hasSentFirst,   setHasSentFirst]   = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Generate greeting on mount ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchGreeting = async () => {
      setLoadingGreet(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) return;

        const res = await fetch('/functions/v1/generate-reeve-chat-response', {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            project_id:  projectId,
            is_greeting: true,
          }),
        });

        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) {
          setGreeting(json.message?.content ?? json.greeting_text ?? null);
        }
      } catch (err) {
        console.error('Greeting fetch error:', err);
      } finally {
        if (!cancelled) setLoadingGreet(false);
      }
    };

    fetchGreeting();
    return () => { cancelled = true; };
  }, [projectId, projectName, description]);

  // Autofocus input once greeting is loaded
  useEffect(() => {
    if (!loadingGreet) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loadingGreet]);

  // ── Send first message ──────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || sending || hasSentFirst) return;

    setSending(true);
    setThinking(true);
    setInputText('');
    setHasSentFirst(true);

    try {
      // 1. Generate a new thread ID for this PM chat
      const threadId = crypto.randomUUID();

      // 2. Insert user message and get Reeve's response in parallel with auto-creation
      const [reeveChatResult, featureResult] = await Promise.allSettled([
        (async () => {
          await insertUserPmMessage(projectId, threadId, trimmed);
          return generateReeveChatResponse(projectId, threadId, trimmed);
        })(),
        autoCreateFeatureFromMessage(projectId, trimmed),
      ]);

      // Show Reeve's reply
      if (reeveChatResult.status === 'fulfilled') {
        setReplyText(reeveChatResult.value.message?.content ?? null);
      }

      // Kick off design generation if feature was created
      if (featureResult.status === 'fulfilled') {
        const { featureId } = featureResult.value;
        setDesignQueued(true);
        kickOffDesignGeneration(featureId).catch(console.warn);
      }

      // Mark first-run complete after a short delay so user can read the message
      setTimeout(async () => {
        try {
          await completeFirstRun(projectId);
        } catch (err) {
          console.warn('completeFirstRun error:', err);
        }
        onComplete();
      }, 3000);

    } catch (err) {
      console.error('First message error:', err);
      setSending(false);
      setHasSentFirst(false);
    } finally {
      setThinking(false);
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDismiss = async () => {
    try {
      await completeFirstRun(projectId);
    } catch (err) {
      console.warn('completeFirstRun error on dismiss:', err);
    }
    onComplete();
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      data-testid="reeve-greeting-card"
      style={{
        width:           '100%',
        maxWidth:        672,           // max-w-2xl
        margin:          '0 auto 28px',
        borderRadius:    16,
        border:          '1px solid #C7D2FE',
        backgroundColor: '#F5F3FF',
        overflow:        'hidden',
        position:        'relative',
      }}
    >
      {/* Dismiss */}
      <button
        data-testid="reeve-greeting-dismiss-btn"
        onClick={handleDismiss}
        title="Dismiss"
        style={{
          position:        'absolute',
          top:             12,
          right:           12,
          width:           28,
          height:          28,
          borderRadius:    '50%',
          border:          '1px solid #C7D2FE',
          backgroundColor: 'rgba(255,255,255,0.6)',
          cursor:          'pointer',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        16,
          color:           '#6D28D9',
          lineHeight:      1,
        }}
      >
        ×
      </button>

      {/* Header */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        padding:       '28px 24px 16px',
        gap:           14,
      }}>
        <Avatar member="reeve" size="lg" />

        {/* Greeting text */}
        <div
          data-testid="reeve-greeting-text"
          style={{
            textAlign:  'center',
            maxWidth:   520,
            fontSize:   15,
            lineHeight: 1.65,
            color:      '#3730A3',
            fontWeight: 500,
          }}
        >
          {loadingGreet ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              {[90, 70, 55].map(w => (
                <div key={w} style={{
                  height: 14, width: `${w}%`, maxWidth: 400,
                  borderRadius: 4, backgroundColor: '#C7D2FE',
                  animation: 'pulse 1.5s infinite',
                }} />
              ))}
            </div>
          ) : (
            greeting ?? `I've been looking over ${projectName}. I'm Reeve, your project manager. Tell me about the first thing you want to build and I'll get the team moving.`
          )}
        </div>

        {/* Reeve's reply after first message */}
        {replyText && (
          <div style={{
            maxWidth:        520,
            width:           '100%',
            padding:         '12px 16px',
            borderRadius:    10,
            backgroundColor: '#EEF2FF',
            border:          '1px solid #C7D2FE',
            fontSize:        14,
            color:           '#3730A3',
            lineHeight:      1.6,
            textAlign:       'left',
          }}>
            {replyText}
          </div>
        )}

        {/* "Morgan is on it" note */}
        {designQueued && (
          <div
            data-testid="reeve-greeting-design-queued"
            style={{
              maxWidth:        520,
              width:           '100%',
              padding:         '8px 12px',
              borderRadius:    8,
              backgroundColor: 'rgba(255,255,255,0.7)',
              border:          '1px solid #E0E7FF',
              fontSize:        12,
              color:           '#6D28D9',
              display:         'flex',
              alignItems:      'center',
              gap:             8,
            }}
          >
            <Avatar member="morgan" size="xs" />
            Morgan is putting together the design now — check back in about 30 seconds.
          </div>
        )}
      </div>

      {/* Chat input */}
      {!hasSentFirst && (
        <div style={{
          padding:         '0 24px 20px',
          display:         'flex',
          flexDirection:   'column',
          gap:             8,
        }}>
          <div style={{
            display:         'flex',
            gap:             8,
            alignItems:      'flex-end',
            border:          '1px solid #C7D2FE',
            borderRadius:    12,
            padding:         '8px 10px',
            backgroundColor: '#fff',
          }}>
            <textarea
              ref={inputRef}
              data-testid="reeve-greeting-input"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me what you want to build…"
              rows={2}
              disabled={sending}
              style={{
                flex:        1,
                border:      'none',
                outline:     'none',
                background:  'transparent',
                fontSize:    14,
                color:       '#1E293B',
                lineHeight:  1.5,
                resize:      'none',
                fontFamily:  'inherit',
              }}
            />
            <button
              data-testid="reeve-greeting-send-btn"
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
              title="Send (Enter)"
              style={{
                width:           36,
                height:          36,
                borderRadius:    9,
                backgroundColor: inputText.trim() && !sending ? '#4338CA' : '#E2E8F0',
                border:          'none',
                cursor:          inputText.trim() && !sending ? 'pointer' : 'not-allowed',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                flexShrink:      0,
                transition:      'background-color 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 7L1 13V9L9 7L1 5V1Z" fill={inputText.trim() && !sending ? '#fff' : '#94A3B8'} />
              </svg>
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#A5B4FC', margin: 0, paddingLeft: 2 }}>
            Shift+Enter for newline
          </p>
        </div>
      )}

      {/* Thinking indicator */}
      {thinking && (
        <div
          data-testid="reeve-greeting-thinking"
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            padding:    '0 24px 20px',
            fontSize:   13,
            color:      '#6D28D9',
          }}
        >
          <Avatar member="reeve" size="xs" />
          Reeve is thinking…
        </div>
      )}
    </div>
  );
}
