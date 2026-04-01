/**
 * AdminScreen — Build 003
 *
 * Route: /admin
 * Gated by VITE_SHIPYARD_ADMIN === 'true' at build time.
 * Requires owner or admin role (enforced by edge functions on all writes).
 *
 * Tabs:
 *   1. Users  — searchable list + User Detail panel
 *   2. Audit Log — paginated table with filters
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';  // Build 059: deploy log queries
import {
  listAdminUsers,
  filterUsers,
  changeUserRole,
  suspendUser,
  unsuspendUser,
  sendPasswordReset,
  startImpersonation,
  exportUserData,
  deleteUserRTBF,
  listAuditLog,
  type AuditLogFilters,
} from '@/api/admin';
import {
  updateTestModeEnabled,
  updateTourEnabled,
  updateWhatsNewEnabled,
  updateWaitlistEnabled,
  advanceProjectPhase,
} from '@/api/projects';
import { listTourSteps, updateTourStep }                    from '@/api/tour';
import { listReleaseNotes, updateReleaseNoteItem }          from '@/api/whatsNew';
import {
  listWaitlistSignups,
  getWaitlistStats,
  rejectWaitlistSignup,
  removeWaitlistSignup,
  listWaitlistHighlights,
  upsertWaitlistHighlight,
  deleteWaitlistHighlight,
} from '@/api/waitlist';
import { useToast }          from '@/context/ToastContext';
import type {
  AdminUserProfile,
  AuditLogEntry,
  UserRole,
  TourStep,
  ReleaseNoteWithItems,
  WaitlistSignup,
  WaitlistHighlight,
  WaitlistStats,
  WaitlistStatus,
} from '@/types/db';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

// ── Design tokens (matching dark theme spec) ──────────────────────────────

const T = {
  bg:       '#0f0f10',
  surface:  '#1a1a1c',
  surface2: '#222224',
  surface3: '#2c2c2e',
  border:   '#2c2c2e',
  border2:  '#3a3a3c',
  text:     '#e8e8ea',
  text2:    '#8e8e93',
  text3:    '#636366',
  accent:   '#0a84ff',
  green:    '#30d158',
  red:      '#ff453a',
  orange:   '#ff9f0a',
  purple:   '#6d28d9',
};

// ── Is admin enabled? ─────────────────────────────────────────────────────

const ADMIN_ENABLED = import.meta.env.VITE_SHIPYARD_ADMIN === 'true';

// ── Relative time helper ──────────────────────────────────────────────────

function relTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function absDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Role chip ─────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<UserRole, { bg: string; color: string }> = {
  owner:  { bg: 'rgba(109,40,217,0.15)',  color: '#a78bfa' },
  admin:  { bg: 'rgba(10,132,255,0.12)',  color: '#0a84ff' },
  member: { bg: T.surface3,               color: T.text2   },
  viewer: { bg: T.surface3,               color: T.text3   },
};

function RoleChip({ role }: { role: UserRole }) {
  const s = ROLE_STYLE[role];
  return (
    <span style={{
      background:   s.bg,
      color:        s.color,
      borderRadius:  20,
      fontSize:      11,
      fontWeight:    600,
      padding:       '2px 8px',
      textTransform: 'capitalize',
      letterSpacing: '0.2px',
    }}>
      {role}
    </span>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  active:    T.green,
  suspended: T.red,
  pending:   T.orange,
};

function StatusDot({ status }: { status: string }) {
  return (
    <span style={{
      display:      'inline-block',
      width:         8,
      height:        8,
      borderRadius: '50%',
      background:    STATUS_DOT[status] ?? T.text3,
      flexShrink:    0,
    }} />
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  return (
    <div style={{
      width:           size,
      height:          size,
      borderRadius:   '50%',
      background:      T.surface3,
      color:           T.text2,
      fontSize:        Math.round(size * 0.36),
      fontWeight:      600,
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      flexShrink:       0,
      letterSpacing:   '-0.5px',
    }}>
      {initials || '?'}
    </div>
  );
}

// ── User row ──────────────────────────────────────────────────────────────

function UserRow({ user, selected, onClick }: {
  user:     AdminUserProfile;
  selected: boolean;
  onClick:  () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`user-row-${user.id}`}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:              12,
        width:           '100%',
        padding:         '10px 16px',
        background:       selected ? T.surface2 : 'transparent',
        border:           'none',
        borderBottom:    `1px solid ${T.border}`,
        cursor:           'pointer',
        textAlign:        'left',
        color:            T.text,
      }}
    >
      <Avatar name={user.name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{user.name}</div>
        <div style={{ fontSize: 12, color: T.text2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
        <div style={{ fontSize: 11, color: T.text3 }}>Last active {relTime(user.last_sign_in_at)}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <RoleChip role={user.role} />
        <StatusDot status={user.status} />
      </div>
    </button>
  );
}

// ── RTBF delete flow ──────────────────────────────────────────────────────

type RtbfStep = 'intent' | 'confirm' | 'processing' | 'done';

function RtbfFlow({
  user,
  onDone,
  onCancel,
}: {
  user:     AdminUserProfile;
  onDone:   () => void;
  onCancel: () => void;
}) {
  const [step, setStep]          = useState<RtbfStep>('intent');
  const [input, setInput]        = useState('');
  const [progress, setProgress]  = useState<string[]>([]);
  const { showToast }            = useToast();

  async function runDelete() {
    setStep('processing');
    const steps = [
      'Profile anonymised',
      'Content soft-deleted',
      'Auth account removed',
      'Audit log written',
    ];

    try {
      await deleteUserRTBF(user.id);
      for (const s of steps) {
        await new Promise(r => setTimeout(r, 600));
        setProgress(p => [...p, s]);
      }
      setStep('done');
      setTimeout(onDone, 1800);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Delete failed'), 'error');
      setStep('confirm');
    }
  }

  if (step === 'intent') return (
    <div>
      <p style={{ fontWeight: 600, marginBottom: 10 }}>Delete {user.name}?</p>
      <p style={{ fontSize: 13, color: T.text2, marginBottom: 12 }}>This will permanently:</p>
      <ul style={{ fontSize: 13, color: T.text2, paddingLeft: 18, margin: '0 0 16px' }}>
        <li>Anonymise their profile</li>
        <li>Soft-delete all their content</li>
        <li>Remove their auth account</li>
        <li>Write a RTBF entry to the audit log</li>
      </ul>
      <p style={{ fontSize: 12, color: T.red, marginBottom: 16 }}>This cannot be undone.</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={btn(T.surface3, T.text2)}>Cancel</button>
        <button onClick={() => setStep('confirm')} style={btn(T.surface2, T.text)}>
          I understand, continue →
        </button>
      </div>
    </div>
  );

  if (step === 'confirm') return (
    <div>
      <p style={{ fontSize: 13, marginBottom: 10 }}>Type <strong>DELETE</strong> to confirm:</p>
      <input
        autoFocus
        data-testid="rtbf-confirm-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="DELETE"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: T.surface2, border: `1px solid ${T.border2}`,
          borderRadius: 8, color: T.text, fontSize: 14, padding: '8px 12px',
          outline: 'none', fontFamily: 'monospace', marginBottom: 12,
        }}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={btn(T.surface3, T.text2)}>Cancel</button>
        <button
          data-testid="rtbf-confirm-submit"
          onClick={runDelete}
          disabled={input !== 'DELETE'}
          style={btn(input === 'DELETE' ? T.red : T.surface3, input === 'DELETE' ? '#fff' : T.text3)}
        >
          Delete account and data
        </button>
      </div>
    </div>
  );

  if (step === 'processing') return (
    <div>
      <p style={{ fontWeight: 600, marginBottom: 12 }}>Deleting…</p>
      {['Profile anonymised', 'Content soft-deleted', 'Auth account removed', 'Audit log written'].map(s => (
        <div key={s} style={{ fontSize: 13, color: progress.includes(s) ? T.green : T.text3, marginBottom: 6 }}>
          {progress.includes(s) ? '✓ ' : '  '}{s}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <p style={{ color: T.green, fontWeight: 600 }}>✓ Done — user data has been removed.</p>
    </div>
  );
}

function btn(bg: string, color: string): React.CSSProperties {
  return {
    padding: '7px 14px', background: bg, color, border: 'none',
    borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  };
}

// ── User Detail Panel ─────────────────────────────────────────────────────

type ActionView = 'none' | 'role' | 'suspend' | 'impersonate' | 'rtbf';

function UserDetailPanel({
  user,
  onClose,
  onUserUpdated,
  onUserDeleted,
}: {
  user:          AdminUserProfile;
  onClose:       () => void;
  onUserUpdated: (updated: AdminUserProfile) => void;
  onUserDeleted: (id: string) => void;
}) {
  const [action, setAction]   = useState<ActionView>('none');
  const [roleDraft, setRoleDraft] = useState<UserRole>(user.role);
  const { showToast }         = useToast();

  async function saveRole() {
    try {
      await changeUserRole(user.id, roleDraft);
      onUserUpdated({ ...user, role: roleDraft });
      setAction('none');
      showToast(`Role updated to ${roleDraft}`);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  async function handleSuspend() {
    try {
      if (user.status === 'suspended') {
        await unsuspendUser(user.id);
        onUserUpdated({ ...user, status: 'active' });
        showToast(`${user.name} restored`);
      } else {
        await suspendUser(user.id);
        onUserUpdated({ ...user, status: 'suspended' });
        showToast(`${user.name} suspended`);
      }
      setAction('none');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  async function handleResetPassword() {
    try {
      await sendPasswordReset(user.id);
      showToast(`Reset email sent to ${user.email}`);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  async function handleImpersonate() {
    try {
      const token = await startImpersonation(user.id);
      const url   = `${window.location.origin}/projects?__shipyard_impersonate=${token}`;
      window.open(url, '_blank');
      setAction('none');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  async function handleExport() {
    try {
      const downloadUrl = await exportUserData(user.id);
      window.open(downloadUrl, '_blank');
      showToast('Export ready — opening download link (expires in 5 minutes).');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Export failed'), 'error');
    }
  }

  const actionRow = (icon: string, label: string, key: ActionView, color = T.text) => (
    <button
      key={key}
      data-testid={`${key}-btn`}
      onClick={() => setAction(action === key ? 'none' : key)}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:          10,
        width:       '100%',
        padding:     '10px 16px',
        background:   action === key ? T.surface2 : 'transparent',
        border:       'none',
        cursor:       'pointer',
        color,
        fontSize:     14,
        textAlign:    'left',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div style={{
      width:        340,
      flexShrink:    0,
      background:    T.surface,
      borderLeft:   `1px solid ${T.border}`,
      overflowY:    'auto',
      display:      'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={user.name} size={48} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: T.text2 }}>{user.email}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <RoleChip role={user.role} />
              <StatusDot status={user.status} />
              <span style={{ fontSize: 11, color: T.text3, textTransform: 'capitalize' }}>{user.status}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
      </div>

      {/* Info */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
        {[
          ['User ID',      <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{user.id}</code>],
          ['Joined',       absDate(user.created_at)],
          ['Last active',  relTime(user.last_sign_in_at)],
          ['Auth method',  user.auth_method],
        ].map(([label, value]) => (
          <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: T.text2 }}>{label}</span>
            <span style={{ color: T.text }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div>
        {actionRow('👤', 'Change role', 'role')}
        {action === 'role' && (
          <div style={{ padding: '8px 16px 12px', background: T.surface2 }}>
            {(['owner', 'admin', 'member', 'viewer'] as UserRole[]).map(r => (
              <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13 }}>
                <input type="radio" name="role" value={r} checked={roleDraft === r} onChange={() => setRoleDraft(r)} style={{ accentColor: T.accent }} />
                <span style={{ textTransform: 'capitalize', fontWeight: roleDraft === r ? 600 : 400 }}>{r}</span>
                {r === 'owner' && <span style={{ fontSize: 11, color: T.text3 }}>— Full access, can delete project</span>}
                {r === 'admin' && <span style={{ fontSize: 11, color: T.text3 }}>— Can access admin console</span>}
                {r === 'member' && <span style={{ fontSize: 11, color: T.text3 }}>— Standard access</span>}
                {r === 'viewer' && <span style={{ fontSize: 11, color: T.text3 }}>— Read-only</span>}
              </label>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => setAction('none')} style={btn(T.surface3, T.text2)}>Cancel</button>
              <button onClick={saveRole} style={btn(T.accent, '#fff')}>Save role</button>
            </div>
          </div>
        )}

        {actionRow(user.status === 'suspended' ? '✓' : '🚫', user.status === 'suspended' ? 'Restore account' : 'Suspend account', 'suspend')}
        {action === 'suspend' && (
          <div style={{ padding: '8px 16px 12px', background: T.surface2 }}>
            <p style={{ fontSize: 13, color: T.text2, margin: '0 0 10px' }}>
              {user.status === 'suspended'
                ? `Restore ${user.name}? They'll be able to sign in again.`
                : `Suspend ${user.name}? They will be signed out and blocked from signing back in.`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAction('none')} style={btn(T.surface3, T.text2)}>Cancel</button>
              <button onClick={handleSuspend} style={btn(user.status === 'suspended' ? T.green : T.red, '#fff')}>
                {user.status === 'suspended' ? 'Restore' : 'Suspend'}
              </button>
            </div>
          </div>
        )}

        {user.auth_method === 'email' && (
          <button
            data-testid="reset-password-btn"
            onClick={handleResetPassword}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '10px 16px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: T.text, fontSize: 14, textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 16 }}>🔑</span>
            Send password reset email
          </button>
        )}

        {actionRow('👁', 'Open app as this user', 'impersonate')}
        {action === 'impersonate' && (
          <div style={{ padding: '8px 16px 12px', background: T.surface2 }}>
            <p style={{ fontSize: 13, color: T.text2, margin: '0 0 10px' }}>
              Open app as {user.name}? You'll see their data in read-only mode. This will be logged.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAction('none')} style={btn(T.surface3, T.text2)}>Cancel</button>
              <button onClick={handleImpersonate} style={btn(T.accent, '#fff')}>Open</button>
            </div>
          </div>
        )}

        <button onClick={handleExport} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '10px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: T.text, fontSize: 14, textAlign: 'left',
        }}>
          <span style={{ fontSize: 16 }}>⬇</span>
          Export all data for this user
        </button>

        {/* Divider */}
        <div style={{ height: 1, background: T.border, margin: '8px 0' }} />

        {actionRow('🗑', 'Delete user & all data', 'rtbf', T.red)}
        {action === 'rtbf' && (
          <div style={{ padding: '8px 16px 12px', background: T.surface2 }}>
            <RtbfFlow
              user={user}
              onDone={() => { onUserDeleted(user.id); }}
              onCancel={() => setAction('none')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  role_changed:          'Role changed',
  account_suspended:     'Account suspended',
  account_restored:      'Account restored',
  password_reset_sent:   'Password reset sent',
  impersonation_started: 'Impersonation started',
  impersonation_ended:   'Impersonation ended',
  data_exported:         'Data exported',
  account_deleted_rtbf:  'Account deleted (RTBF)',
  feature_toggled:       'Feature toggled',
};

function AuditLogTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const { showToast }         = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { entries: data, total: t } = await listAuditLog(filters, page);
      setEntries(data);
      setTotal(t);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load audit log'), 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const tdStyle: React.CSSProperties = {
    padding:    '10px 12px',
    fontSize:    13,
    color:       T.text,
    borderBottom: `1px solid ${T.border}`,
    verticalAlign: 'top',
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Filters */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="date"
          onChange={e => setFilters(f => ({ ...f, from: e.target.value || undefined }))}
          style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 8, color: T.text, fontSize: 13, padding: '5px 10px' }}
        />
        <span style={{ color: T.text3 }}>to</span>
        <input
          type="date"
          onChange={e => setFilters(f => ({ ...f, to: e.target.value || undefined }))}
          style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 8, color: T.text, fontSize: 13, padding: '5px 10px' }}
        />
        <span style={{ color: T.text2, fontSize: 13, marginLeft: 'auto' }}>
          {total} entries
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: T.text2 }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: T.text2 }}>No audit log entries yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['When', 'Admin', 'Action', 'Target', 'Details'].map(h => (
                <th key={h} style={{ ...tdStyle, color: T.text2, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', background: T.surface2 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id}>
                <td style={tdStyle} title={new Date(e.performed_at).toLocaleString()}>
                  {relTime(e.performed_at)}
                </td>
                <td style={tdStyle}>
                  {/* admin_name populated from profiles JOIN in listAuditLog() */}
                  <div style={{ fontWeight: 500 }}>{e.admin_name ?? (e as unknown as { admin?: { name?: string } }).admin?.name ?? '—'}</div>
                  <div style={{ fontSize: 11, color: T.text2 }}>{e.admin_email}</div>
                </td>
                <td style={tdStyle}>{ACTION_LABELS[e.action] ?? e.action}</td>
                <td style={tdStyle}>
                  {e.target_user_name
                    ? <><div style={{ fontWeight: 500 }}>{e.target_user_name}</div><div style={{ fontSize: 11, color: T.text2 }}>{e.target_user_email}</div></>
                    : <span style={{ color: T.text3 }}>[deleted]</span>}
                </td>
                <td style={{ ...tdStyle, color: T.text2 }}>{e.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div style={{ padding: '12px 16px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={btn(T.surface2, page === 0 ? T.text3 : T.text)}>← Previous</button>
          <span style={{ color: T.text2, fontSize: 13, alignSelf: 'center' }}>Page {page + 1} of {Math.ceil(total / 50)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * 50 >= total} style={btn(T.surface2, (page + 1) * 50 >= total ? T.text3 : T.text)}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ── Waitlist Signups Tab — Build 011 ─────────────────────────────────────

function WaitlistSignupsTab({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { showToast }                              = useToast();
  const [signups,  setSignups]                     = useState<WaitlistSignup[]>([]);
  const [stats,    setStats]                       = useState<WaitlistStats | null>(null);
  const [filter,   setFilter]                      = useState<WaitlistStatus | 'all'>('all');
  const [loading,  setLoading]                     = useState(true);
  const [actionId, setActionId]                    = useState<string | null>(null); // menu open

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        listWaitlistSignups(projectId, filter),
        getWaitlistStats(projectId),
      ]);
      setSignups(data);
      setStats(s);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load signups'), 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, filter]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(signup: WaitlistSignup) {
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      const res = await fetch('/api/waitlist-approve', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ project_id: projectId, signup_id: signup.id }),
      });
      if (!res.ok) throw new Error('Approval failed');
      showToast(`Approval email sent to ${signup.email}`);
      await load();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Approval failed'), 'error');
    }
  }

  async function handleReject(signupId: string) {
    try {
      await rejectWaitlistSignup(signupId, 'spam');
      showToast('Marked as spam');
      setActionId(null);
      await load();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  async function handleRemove(signupId: string) {
    if (!confirm('Permanently remove this signup? This cannot be undone.')) return;
    try {
      await removeWaitlistSignup(signupId);
      showToast('Removed');
      setActionId(null);
      await load();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  function handleExportCsv() {
    window.location.href = `/api/waitlist-export?project_id=${projectId}`;
  }

  const TABS: Array<{ key: WaitlistStatus | 'all'; label: string }> = [
    { key: 'all',      label: `All${stats ? ` (${stats.total})` : ''}` },
    { key: 'pending',  label: `Pending${stats ? ` (${stats.pending})` : ''}` },
    { key: 'approved', label: `Approved${stats ? ` (${stats.approved})` : ''}` },
  ];

  const thStyle: React.CSSProperties = {
    padding: '9px 12px', fontSize: 11, color: T.text2,
    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px',
    background: T.surface2, borderBottom: `1px solid ${T.border}`,
    textAlign: 'left',
  };

  const tdStyle: React.CSSProperties = {
    padding: '11px 12px', fontSize: 13, color: T.text,
    borderBottom: `1px solid ${T.border}`, verticalAlign: 'middle',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Sub-header */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← Back
        </button>
        <span style={{ color: T.border, fontSize: 14 }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Waitlist Signups</span>
        <button
          onClick={handleExportCsv}
          style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 7, border: `1px solid ${T.border2}`, background: 'transparent', color: T.text2, fontSize: 12, cursor: 'pointer' }}
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ padding: '0 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 20 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding: '10px 0', background: 'none', border: 'none',
              borderBottom: filter === t.key ? `2px solid ${T.accent}` : '2px solid transparent',
              color: filter === t.key ? T.text : T.text2,
              fontSize: 13, fontWeight: filter === t.key ? 600 : 400,
              cursor: 'pointer', marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.text2 }}>Loading…</div>
        ) : signups.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.text3 }}>No signups yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Email', 'How they heard', 'Signed up', 'Status', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signups.map(signup => (
                <tr key={signup.id}>
                  <td style={tdStyle}><span style={{ fontWeight: 500 }}>{signup.name}</span></td>
                  <td style={{ ...tdStyle, color: T.text2 }}>{signup.email}</td>
                  <td style={{ ...tdStyle, color: T.text2, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {signup.source ?? <em style={{ color: T.text3 }}>—</em>}
                  </td>
                  <td style={{ ...tdStyle, color: T.text2 }}>
                    {new Date(signup.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: signup.status === 'approved' ? 'rgba(48,209,88,.12)' : signup.status === 'rejected' ? 'rgba(255,69,58,.1)' : T.surface3,
                      color: signup.status === 'approved' ? T.green : signup.status === 'rejected' ? T.red : T.text2,
                      textTransform: 'capitalize',
                    }}>
                      {signup.status === 'approved' ? '✓ Approved' : signup.status === 'rejected' ? 'Spam' : 'Pending'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {signup.status === 'pending' && (
                        <button
                          onClick={() => handleApprove(signup)}
                          style={{
                            padding: '5px 14px', borderRadius: 7, border: 'none',
                            background: T.green, color: '#fff', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Approve →
                        </button>
                      )}
                      {signup.status === 'approved' && (
                        <span style={{ fontSize: 12, color: T.text3 }}>
                          {signup.invite_sent_at ? `Sent ${new Date(signup.invite_sent_at).toLocaleDateString()}` : 'Email pending'}
                        </span>
                      )}
                      {/* ⋯ menu */}
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setActionId(actionId === signup.id ? null : signup.id)}
                          style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}
                        >⋯</button>
                        {actionId === signup.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: '100%', zIndex: 50,
                            background: T.surface, border: `1px solid ${T.border2}`,
                            borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.18)',
                            minWidth: 160, overflow: 'hidden',
                          }}>
                            {signup.status !== 'rejected' && (
                              <button
                                onClick={() => handleReject(signup.id)}
                                style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: T.text, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                              >
                                Mark as spam
                              </button>
                            )}
                            <button
                              onClick={() => handleRemove(signup.id)}
                              style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: T.red, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                            >
                              Remove from list
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Platform Features Tab ─────────────────────────────────────────────────
// Builds 006–009: Phase control, Test Mode, Onboarding Tour, What's New

interface PlatformFeatureTabProps {
  projectId: string;
}

function ToggleRow({
  label, sub, checked, onChange, testId,
}: {
  label: string; sub?: string; checked: boolean;
  onChange: (v: boolean) => void; testId?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        data-testid={testId}
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
          background: checked ? T.green : T.surface3,
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

function PlatformFeaturesTab({ projectId }: PlatformFeatureTabProps) {
  const { showToast } = useToast();

  // ── 007: Test Mode state ─────────────────────────────────────────────
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [pinDraft,        setPinDraft]        = useState('');
  const [pinSaving,       setPinSaving]       = useState(false);

  // ── 008: Tour state ───────────────────────────────────────────────────
  const [tourEnabled,  setTourEnabled]  = useState(false);
  const [tourSteps,    setTourSteps]    = useState<TourStep[]>([]);
  const [tourLoading,  setTourLoading]  = useState(false);
  const [editingStep,  setEditingStep]  = useState<string | null>(null);
  const [stepDraft,    setStepDraft]    = useState('');
  const [regenLoading, setRegenLoading] = useState(false);

  // ── 009: What's New state ─────────────────────────────────────────────
  const [wnEnabled,    setWnEnabled]    = useState(false);
  const [releases,     setReleases]     = useState<ReleaseNoteWithItems[]>([]);
  const [wnLoading,    setWnLoading]    = useState(false);
  const [editingItem,  setEditingItem]  = useState<string | null>(null);
  const [itemDraft,    setItemDraft]    = useState('');

  // ── 011: Waitlist state ───────────────────────────────────────────────
  const [waitlistEnabled,    setWaitlistEnabled]    = useState(false);
  const [highlights,         setHighlights]         = useState<WaitlistHighlight[]>([]);
  const [hlLoading,          setHlLoading]          = useState(false);
  const [showWaitlistSignups, setShowWaitlistSignups] = useState(false);
  // Highlight editor: draft rows (new or existing)
  const [hlDrafts, setHlDrafts] = useState<Array<{ id?: string; icon: string; title: string; description: string }>>([]);
  const [hlEditing, setHlEditing] = useState(false);

  // ── 056: AI Settings state ────────────────────────────────────────────
  const [apiKey,          setApiKey]          = useState('');
  const [apiKeyVisible,   setApiKeyVisible]   = useState(false);
  const [apiKeySaving,    setApiKeySaving]    = useState(false);
  const [apiKeySavedOk,   setApiKeySavedOk]   = useState(false);
  const [apiKeyStatus,    setApiKeyStatus]    = useState<'idle' | 'testing' | 'connected' | 'invalid'>('idle');
  const [defaultModel,    setDefaultModel]    = useState('claude-sonnet-4-6');
  const [modelSaving,     setModelSaving]     = useState(false);

  // ── 059: Deploy History state ─────────────────────────────────────────
  interface DeployLogEntry {
    id:                    string;
    deployed_at:           string;
    target:                'alpha' | 'beta' | 'production';
    feature_ids:           string[];
    triggered_by:          string | null;
    netlify_response_code: number | null;
    // resolved client-side:
    feature_names?:        string[];
    triggered_by_email?:   string | null;
  }
  const [deployLogs,        setDeployLogs]        = useState<DeployLogEntry[]>([]);
  const [deployLogsLoading, setDeployLogsLoading] = useState(false);
  const [deployLogsPage,    setDeployLogsPage]    = useState(1);
  const DEPLOY_LOGS_PER_PAGE = 10;
  // Expanded "+N more" feature list per log entry
  const [expandedLogIds,    setExpandedLogIds]    = useState<Set<string>>(new Set());

  // Load all panel data on mount
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      // Tour steps
      setTourLoading(true);
      try {
        const steps = await listTourSteps(projectId);
        setTourSteps(steps);
      } catch { /* non-critical */ }
      finally { setTourLoading(false); }

      // Release notes
      setWnLoading(true);
      try {
        const notes = await listReleaseNotes(projectId);
        setReleases(notes);
      } catch { /* non-critical */ }
      finally { setWnLoading(false); }

      // Waitlist highlights (Build 011)
      setHlLoading(true);
      try {
        const hl = await listWaitlistHighlights(projectId);
        setHighlights(hl);
      } catch { /* non-critical */ }
      finally { setHlLoading(false); }

      // AI Settings (Build 056)
      try {
        const { data: aiSettings } = await supabase
          .from('project_settings')
          .select('claude_api_key, default_model')
          .eq('project_id', projectId)
          .maybeSingle();
        if (aiSettings) {
          if (aiSettings.claude_api_key)  setApiKey(aiSettings.claude_api_key);
          if (aiSettings.default_model)   setDefaultModel(aiSettings.default_model);
          if (aiSettings.claude_api_key)  setApiKeyStatus('connected');
        }
      } catch { /* non-critical */ }

      // Deploy History (Build 059)
      setDeployLogsLoading(true);
      try {
        const { data: logs } = await supabase
          .from('deploy_log')
          .select('*')
          .eq('project_id', projectId)
          .order('deployed_at', { ascending: false })
          .limit(50);

        if (logs && logs.length > 0) {
          // Gather all unique feature_ids across all log entries to batch-resolve names
          const allFeatureIds = [...new Set((logs as DeployLogEntry[]).flatMap(l => l.feature_ids))];
          const { data: featRows } = await supabase
            .from('features')
            .select('id, name')
            .in('id', allFeatureIds);
          const featureMap = new Map<string, string>(
            (featRows ?? []).map((f: { id: string; name: string }) => [f.id, f.name])
          );

          const enriched = (logs as DeployLogEntry[]).map(log => ({
            ...log,
            feature_names: log.feature_ids.map(fid => featureMap.get(fid) ?? '[deleted]'),
          }));
          setDeployLogs(enriched);
        }
      } catch { /* non-critical */ }
      finally { setDeployLogsLoading(false); }
    })();
  }, [projectId]);

  // ── 007 handlers ──────────────────────────────────────────────────────
  async function handleTestModeToggle(v: boolean) {
    try {
      await updateTestModeEnabled(projectId, v);
      setTestModeEnabled(v);
      showToast(`Test Mode ${v ? 'enabled' : 'disabled'}`);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  async function handleSetPin() {
    if (!/^\d{4,6}$/.test(pinDraft)) {
      showToast('PIN must be 4–6 digits', 'error');
      return;
    }
    setPinSaving(true);
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      await fetch('/api/test-mode/set-pin', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ project_id: projectId, pin: pinDraft }),
      });
      setPinDraft('');
      showToast('PIN updated');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    } finally {
      setPinSaving(false);
    }
  }

  // ── 008 handlers ──────────────────────────────────────────────────────
  async function handleTourToggle(v: boolean) {
    try {
      await updateTourEnabled(projectId, v);
      setTourEnabled(v);
      showToast(`Onboarding Tour ${v ? 'enabled' : 'disabled'}`);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  async function handleTourRegenerate() {
    setRegenLoading(true);
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      const res = await fetch('/api/generate-tour', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body:    JSON.stringify({ project_id: projectId }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const steps = await listTourSteps(projectId);
      setTourSteps(steps);
      showToast('Tour regenerated');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Tour regeneration failed'), 'error');
    } finally {
      setRegenLoading(false);
    }
  }

  async function handleSaveStep(stepId: string) {
    try {
      const updated = await updateTourStep(stepId, { description: stepDraft });
      setTourSteps(prev => prev.map(s => s.id === stepId ? updated : s));
      setEditingStep(null);
      showToast('Step saved');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  // ── 009 handlers ──────────────────────────────────────────────────────
  async function handleWnToggle(v: boolean) {
    try {
      await updateWhatsNewEnabled(projectId, v);
      setWnEnabled(v);
      showToast(`What's New ${v ? 'enabled' : 'disabled'}`);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  async function handleSaveItem(itemId: string) {
    try {
      const updated = await updateReleaseNoteItem(itemId, itemDraft);
      setReleases(prev => prev.map(r => ({
        ...r,
        items: r.items.map(i => i.id === itemId ? updated : i),
      })));
      setEditingItem(null);
      showToast('Item saved');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  // ── 011 handlers ──────────────────────────────────────────────────────
  async function handleWaitlistToggle(v: boolean) {
    try {
      await updateWaitlistEnabled(projectId, v);
      setWaitlistEnabled(v);
      showToast(`Waitlist ${v ? 'enabled' : 'disabled'}`);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  function startEditHighlights() {
    setHlDrafts(
      highlights.length > 0
        ? highlights.map(h => ({ id: h.id, icon: h.icon, title: h.title, description: h.description }))
        : [{ icon: '✨', title: '', description: '' }]
    );
    setHlEditing(true);
  }

  async function saveHighlights() {
    try {
      for (let i = 0; i < hlDrafts.length; i++) {
        const d = hlDrafts[i];
        if (!d.title.trim()) continue;
        await upsertWaitlistHighlight({
          project_id:  projectId,
          sort_order:  i + 1,
          icon:        d.icon || '✨',
          title:       d.title.trim(),
          description: d.description.trim(),
        });
      }
      const updated = await listWaitlistHighlights(projectId);
      setHighlights(updated);
      setHlEditing(false);
      showToast('Highlights saved');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  async function handleDeleteHighlight(id: string) {
    try {
      await deleteWaitlistHighlight(id);
      setHighlights(prev => prev.filter(h => h.id !== id));
      showToast('Highlight removed');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  // ── 006: Phase advancement ─────────────────────────────────────────────
  async function handleAdvanceToBeta() {
    if (!confirm('Move project to Beta? New features will default to Beta phase.')) return;
    try {
      await advanceProjectPhase(projectId, 'beta');
      showToast('Project moved to Beta phase');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed'), 'error');
    }
  }

  // ── 056 handlers ──────────────────────────────────────────────────────

  async function handleSaveApiKey() {
    if (apiKeySaving) return;
    setApiKeySaving(true);
    setApiKeySavedOk(false);
    try {
      await supabase
        .from('project_settings')
        .upsert(
          { project_id: projectId, claude_api_key: apiKey.trim() || null },
          { onConflict: 'project_id' },
        );
      setApiKeySavedOk(true);
      // Reset "Saved ✓" label after 2s
      setTimeout(() => setApiKeySavedOk(false), 2000);
      // If key was cleared, reset test status
      if (!apiKey.trim()) setApiKeyStatus('idle');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save'), 'error');
    } finally {
      setApiKeySaving(false);
    }
  }

  async function handleTestKey() {
    if (apiKeyStatus === 'testing') return;
    const keyToTest = apiKey.trim();
    if (!keyToTest) return;
    setApiKeyStatus('testing');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key':          keyToTest,
          'anthropic-version':  '2023-06-01',
          'content-type':       'application/json',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages:   [{ role: 'user', content: 'hi' }],
        }),
      });
      setApiKeyStatus(res.ok ? 'connected' : 'invalid');
    } catch {
      setApiKeyStatus('invalid');
    }
  }

  async function handleSaveModel(model: string) {
    if (modelSaving) return;
    setModelSaving(true);
    setDefaultModel(model);
    try {
      await supabase
        .from('project_settings')
        .upsert(
          { project_id: projectId, default_model: model },
          { onConflict: 'project_id' },
        );
      showToast('Model saved');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save'), 'error');
    } finally {
      setModelSaving(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: T.surface2, borderRadius: 12, padding: '16px 20px',
    marginBottom: 20, border: `1px solid ${T.border}`,
  };

  const cardTitle: React.CSSProperties = {
    fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2,
  };

  const cardSub: React.CSSProperties = {
    fontSize: 12, color: T.text2, marginBottom: 14,
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 20 }}>
        Platform Features
      </h2>

      {/* ── Build 006: Phase Control ──────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={cardTitle}>🚀 Project Phase (Build 006)</div>
        <div style={cardSub}>
          Control the phase lifecycle for this project.
          Alpha → Beta is manual; Beta → Live happens at Launch.
        </div>
        <button
          data-testid="advance-to-beta-btn"
          onClick={handleAdvanceToBeta}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: '#f59e0b', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Move to Beta Phase
        </button>
        <p style={{ fontSize: 11, color: T.text3, marginTop: 8 }}>
          Note: moving to Live phase requires Launch.
        </p>
      </div>

      {/* ── Build 007: Test Mode ─────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={cardTitle}>🔒 Test Mode (Build 007)</div>
        <div style={cardSub}>
          Allow testers to enter the deployed app with a PIN without a real account.
        </div>
        <ToggleRow
          label="Enable Test Mode"
          sub="Shows 'Enter Test Mode' link on the deployed app login screen"
          checked={testModeEnabled}
          onChange={handleTestModeToggle}
          testId="test-mode-toggle"
        />
        {testModeEnabled && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: T.text2, marginBottom: 6 }}>
              Set or change PIN (4–6 digits):
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinDraft}
                onChange={e => setPinDraft(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter PIN"
                data-testid="pin-input"
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8,
                  border: `1px solid ${T.border2}`,
                  background: T.surface3, color: T.text, fontSize: 14, outline: 'none',
                }}
              />
              <button
                data-testid="save-pin-btn"
                onClick={handleSetPin}
                disabled={pinSaving || pinDraft.length < 4}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: T.accent, color: '#fff',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  opacity: pinDraft.length < 4 ? 0.5 : 1,
                }}
              >
                {pinSaving ? 'Saving…' : 'Save PIN'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: T.text3, marginTop: 6 }}>
              Session-only · no data persists · clears when tester closes tab
            </p>
          </div>
        )}
      </div>

      {/* ── Build 008: Onboarding Tour ───────────────────────────────── */}
      <div style={cardStyle}>
        <div style={cardTitle}>🗺 Onboarding Tour (Build 008)</div>
        <div style={cardSub}>
          AI-generated spotlight tour shown to first-time users in the deployed app.
        </div>
        <ToggleRow
          label="Enable Onboarding Tour"
          sub="Shows '?' FAB in deployed app; auto-launches on first login"
          checked={tourEnabled}
          onChange={handleTourToggle}
          testId="tour-toggle"
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            data-testid="tour-preview-btn"
            onClick={() => {
              const url = `${window.location.origin}/projects?tour_preview=true`;
              window.open(url, '_blank');
            }}
            style={{
              padding: '7px 14px', borderRadius: 8, border: `1px solid ${T.border2}`,
              background: 'transparent', color: T.text2, fontSize: 13, cursor: 'pointer',
            }}
          >
            Preview Tour ↗
          </button>
          <button
            data-testid="tour-regenerate-btn"
            onClick={handleTourRegenerate}
            disabled={regenLoading}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: T.surface3, color: T.text,
              fontSize: 13, cursor: regenLoading ? 'not-allowed' : 'pointer',
              opacity: regenLoading ? 0.6 : 1,
            }}
          >
            {regenLoading ? 'Generating…' : '✦ Regenerate'}
          </button>
        </div>

        {/* Tour steps list */}
        {!tourLoading && tourSteps.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 10 }}>
              Tour Steps ({tourSteps.length})
            </div>
            {tourSteps.map(step => (
              <div key={step.id} style={{
                background: T.surface3, borderRadius: 8, padding: '10px 12px',
                marginBottom: 8, border: `1px solid ${T.border}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <span style={{ fontSize: 10, color: T.text3, fontWeight: 600 }}>
                      Step {step.step_order}
                    </span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                      {step.title}
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingStep(step.id); setStepDraft(step.description); }}
                    style={{ fontSize: 11, background: 'none', border: 'none', color: T.text2, cursor: 'pointer' }}
                  >
                    ✏️ Edit
                  </button>
                </div>
                {editingStep === step.id ? (
                  <div>
                    <textarea
                      value={stepDraft}
                      onChange={e => setStepDraft(e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: T.surface2, border: `1px solid ${T.border2}`,
                        borderRadius: 6, color: T.text, fontSize: 12, padding: '8px',
                        outline: 'none', resize: 'vertical', minHeight: 72,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button onClick={() => setEditingStep(null)} style={btn(T.surface3, T.text2)}>Cancel</button>
                      <button onClick={() => handleSaveStep(step.id)} style={btn(T.accent, '#fff')}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: T.text2 }}>{step.description}</div>
                )}
                {step.target_selector && (
                  <div style={{ fontSize: 10, color: T.text3, marginTop: 4, fontFamily: 'monospace' }}>
                    {step.target_selector}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {tourLoading && <div style={{ fontSize: 12, color: T.text2, marginTop: 12 }}>Loading steps…</div>}
        {!tourLoading && tourSteps.length === 0 && (
          <div style={{ fontSize: 12, color: T.text3, marginTop: 12 }}>
            No tour steps yet — generates at Launch.
          </div>
        )}
      </div>

      {/* ── Build 009: What's New ─────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={cardTitle}>✨ What's New (Build 009)</div>
        <div style={cardSub}>
          AI-generated release notes shown in the deployed app's What's New screen.
        </div>
        <ToggleRow
          label="Enable What's New"
          sub="Shows 'What's New' nav item in deployed app"
          checked={wnEnabled}
          onChange={handleWnToggle}
          testId="whats-new-toggle"
        />

        {/* Release notes list */}
        {!wnLoading && releases.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 10 }}>
              Release Notes ({releases.length})
            </div>
            {releases.map(release => (
              <div key={release.id} style={{
                background: T.surface3, borderRadius: 8, padding: '10px 12px',
                marginBottom: 10, border: `1px solid ${T.border}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>
                  {new Date(release.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
                {release.items.map(item => (
                  <div key={item.id} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flex: 1 }}>
                        <span style={{ fontSize: 10, color: item.item_type === 'feature' ? '#5b5bd6' : T.text3, fontWeight: 600, paddingTop: 2 }}>
                          {item.item_type === 'feature' ? '▲' : '⏱'}
                        </span>
                        {editingItem === item.id ? (
                          <div style={{ flex: 1 }}>
                            <input
                              value={itemDraft}
                              onChange={e => setItemDraft(e.target.value)}
                              style={{
                                width: '100%', boxSizing: 'border-box',
                                background: T.surface2, border: `1px solid ${T.border2}`,
                                borderRadius: 6, color: T.text, fontSize: 12, padding: '5px 8px',
                                outline: 'none',
                              }}
                            />
                            <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                              <button onClick={() => setEditingItem(null)} style={btn(T.surface3, T.text2)}>Cancel</button>
                              <button onClick={() => handleSaveItem(item.id)} style={btn(T.accent, '#fff')}>Save</button>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: T.text2, flex: 1 }}>{item.content}</span>
                        )}
                      </div>
                      {editingItem !== item.id && (
                        <button
                          onClick={() => { setEditingItem(item.id); setItemDraft(item.content); }}
                          style={{ fontSize: 11, background: 'none', border: 'none', color: T.text3, cursor: 'pointer', flexShrink: 0 }}
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {wnLoading && <div style={{ fontSize: 12, color: T.text2, marginTop: 12 }}>Loading entries…</div>}
        {!wnLoading && releases.length === 0 && (
          <div style={{ fontSize: 12, color: T.text3, marginTop: 12 }}>
            No releases yet — generates at Launch.
          </div>
        )}
      </div>

      {/* ── Build 011: Waitlist ───────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={cardTitle}>📋 Waitlist (Build 011)</div>
        <div style={cardSub}>
          Public waitlist landing page for pre-launch signups. Approve users to send invite emails.
        </div>
        <ToggleRow
          label="Enable Waitlist"
          sub="Enables the /waitlist route in the deployed app; signups accepted via API"
          checked={waitlistEnabled}
          onChange={handleWaitlistToggle}
          testId="waitlist-toggle"
        />

        {/* Feature Highlights editor */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>
              Feature Highlights ({highlights.length}/3)
            </div>
            {!hlEditing && (
              <button
                onClick={startEditHighlights}
                style={{ fontSize: 12, background: 'none', border: 'none', color: T.accent, cursor: 'pointer' }}
              >
                {highlights.length === 0 ? '+ Add highlights' : 'Edit'}
              </button>
            )}
          </div>

          {hlLoading && <div style={{ fontSize: 12, color: T.text2 }}>Loading…</div>}

          {!hlLoading && !hlEditing && highlights.map(h => (
            <div key={h.id} style={{
              background: T.surface3, borderRadius: 8, padding: '10px 12px',
              marginBottom: 8, border: `1px solid ${T.border}`,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{h.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{h.title}</div>
                <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{h.description}</div>
              </div>
              <button
                onClick={() => handleDeleteHighlight(h.id)}
                style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 12 }}
              >✕</button>
            </div>
          ))}

          {hlEditing && (
            <div>
              {hlDrafts.map((d, i) => (
                <div key={i} style={{
                  background: T.surface3, borderRadius: 8, padding: '10px 12px',
                  marginBottom: 8, border: `1px solid ${T.border2}`,
                }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input
                      value={d.icon}
                      onChange={e => setHlDrafts(prev => prev.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))}
                      maxLength={2}
                      placeholder="✨"
                      style={{ width: 40, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 6, color: T.text, fontSize: 14, padding: '5px 8px', outline: 'none', textAlign: 'center' }}
                    />
                    <input
                      value={d.title}
                      onChange={e => setHlDrafts(prev => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                      placeholder="Highlight title"
                      style={{ flex: 1, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 6, color: T.text, fontSize: 13, padding: '5px 8px', outline: 'none' }}
                    />
                  </div>
                  <input
                    value={d.description}
                    onChange={e => setHlDrafts(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                    placeholder="One sentence description"
                    style={{ width: '100%', boxSizing: 'border-box', background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 6, color: T.text, fontSize: 12, padding: '5px 8px', outline: 'none' }}
                  />
                </div>
              ))}
              {hlDrafts.length < 3 && (
                <button
                  onClick={() => setHlDrafts(prev => [...prev, { icon: '✨', title: '', description: '' }])}
                  style={{ fontSize: 12, background: 'none', border: 'none', color: T.accent, cursor: 'pointer', marginBottom: 10 }}
                >
                  + Add another
                </button>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setHlEditing(false)} style={btn(T.surface3, T.text2)}>Cancel</button>
                <button onClick={saveHighlights} style={btn(T.accent, '#fff')}>Save highlights</button>
              </div>
            </div>
          )}
        </div>

        {/* Link to signups table */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          <button
            data-testid="view-waitlist-signups-btn"
            onClick={() => setShowWaitlistSignups(true)}
            style={{
              padding: '7px 14px', borderRadius: 8, border: `1px solid ${T.border2}`,
              background: 'transparent', color: T.text2, fontSize: 13, cursor: 'pointer',
            }}
          >
            View Signups ↗
          </button>
        </div>
      </div>

      {/* ── Build 056: AI Settings ───────────────────────────────────────── */}
      <div style={cardStyle} data-testid="ai-settings-section">
        <div style={cardTitle}>🤖 AI Settings (Build 056)</div>
        <div style={cardSub}>Configure the AI model powering your features.</div>

        {/* Claude API Key */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>
            Claude API Key
          </div>
          <div style={{ fontSize: 11, color: T.text2, marginBottom: 10 }}>
            Your API key from{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer"
              style={{ color: T.accent, textDecoration: 'none' }}>
              console.anthropic.com
            </a>. Never shared.
          </div>

          {/* Input row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                data-testid="claude-api-key-input"
                type={apiKeyVisible ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setApiKeyStatus('idle'); }}
                placeholder="sk-ant-..."
                style={{
                  width: '100%', height: 44, padding: '0 40px 0 12px',
                  background: T.surface3, border: `1.5px solid ${T.border2}`,
                  borderRadius: 8, color: T.text, fontSize: 13,
                  outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'monospace',
                }}
                onFocus={(e)  => { e.currentTarget.style.borderColor = T.accent; }}
                onBlur={(e)   => { e.currentTarget.style.borderColor = T.border2; }}
              />
              {/* Show/hide toggle */}
              <button
                data-testid="api-key-visibility-toggle"
                onClick={() => setApiKeyVisible(v => !v)}
                title={apiKeyVisible ? 'Hide key' : 'Show key'}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: T.text2, fontSize: 15, padding: 2,
                }}
              >
                {apiKeyVisible ? '🙈' : '👁'}
              </button>
            </div>

            {/* Save button */}
            <button
              data-testid="save-api-key-btn"
              onClick={handleSaveApiKey}
              disabled={apiKeySaving}
              style={{
                width: 72, height: 44, borderRadius: 8, border: 'none',
                background: apiKeySavedOk ? T.green : T.accent,
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: apiKeySaving ? 'not-allowed' : 'pointer',
                opacity: apiKeySaving ? 0.7 : 1, flexShrink: 0,
                transition: 'background 0.2s',
              }}
            >
              {apiKeySavedOk ? 'Saved ✓' : apiKeySaving ? '…' : 'Save'}
            </button>
          </div>

          {/* Test key row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <button
              data-testid="test-api-key-btn"
              onClick={handleTestKey}
              disabled={!apiKey.trim() || apiKeyStatus === 'testing'}
              style={{
                background: 'none', border: 'none', cursor: apiKey.trim() ? 'pointer' : 'not-allowed',
                color: apiKey.trim() ? T.accent : T.text3, fontSize: 13, padding: 0,
                opacity: apiKey.trim() ? 1 : 0.5,
              }}
            >
              {apiKeyStatus === 'testing' ? 'Testing…' : 'Test key →'}
            </button>

            {apiKeyStatus === 'connected' && (
              <span data-testid="api-key-status-connected"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: T.green }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.green, display: 'inline-block' }} />
                Connected
              </span>
            )}
            {apiKeyStatus === 'invalid' && (
              <span data-testid="api-key-status-invalid"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: T.red }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.red, display: 'inline-block' }} />
                Invalid key
              </span>
            )}
          </div>
        </div>

        {/* Default Model */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 12 }}>
            Default Model
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {([
              { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5',   tagline: 'Fastest & most affordable', cost: '~$0.01 / feature' },
              { id: 'claude-sonnet-4-6',         name: 'Sonnet 4.6',  tagline: 'Best balance of speed & quality', cost: '~$0.05 / feature', recommended: true as const },
              { id: 'claude-opus-4-6',           name: 'Opus 4.6',    tagline: 'Most capable', cost: '~$0.20 / feature' },
            ] as Array<{ id: string; name: string; tagline: string; cost: string; recommended?: true }>).map((m) => {
              const selected = defaultModel === m.id;
              return (
                <div
                  key={m.id}
                  data-testid={`model-card-${m.id}`}
                  onClick={() => !modelSaving && handleSaveModel(m.id)}
                  style={{
                    position: 'relative',
                    padding: '14px 16px',
                    borderRadius: 10, cursor: 'pointer',
                    border: selected ? `2px solid #4338ca` : `1.5px solid ${T.border2}`,
                    background: selected ? '#1e1b4b' : T.surface3,
                    transition: 'all 0.15s',
                  }}
                >
                  {m.recommended && (
                    <span style={{
                      position: 'absolute', top: 8, right: 8,
                      background: T.accent, color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    }}>
                      Recommended
                    </span>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: 11, color: T.text2, marginBottom: 2 }}>{m.tagline}</div>
                  <div style={{ fontSize: 11, color: T.text3 }}>{m.cost}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Build 059: Deploy History ─────────────────────────────────────── */}
      <div style={cardStyle} data-testid="deploy-history-section">
        <div style={cardTitle}>🚀 Deploy History (Build 059)</div>
        <div style={cardSub}>All deploys for this project, newest first.</div>

        {deployLogsLoading ? (
          <div style={{ fontSize: 13, color: T.text2 }}>Loading…</div>
        ) : deployLogs.length === 0 ? (
          <div
            style={{ fontSize: 13, color: T.text2, textAlign: 'center', padding: '12px 0' }}
            data-testid="deploy-history-empty"
          >
            No deploys yet. Deploy features from the Feature Board.
          </div>
        ) : (
          <>
            <div>
              {deployLogs
                .slice(0, deployLogsPage * DEPLOY_LOGS_PER_PAGE)
                .map((log, idx) => {
                  const isExpanded = expandedLogIds.has(log.id);
                  const names      = log.feature_names ?? log.feature_ids.map(() => '…');
                  const shown      = isExpanded ? names : names.slice(0, 2);
                  const overflow   = names.length - 2;

                  const targetColors: Record<string, { bg: string; color: string }> = {
                    alpha:      { bg: '#eef0ff', color: '#4338ca' },
                    beta:       { bg: '#e0f2fe', color: '#0284c7' },
                    production: { bg: '#f0fdf4', color: '#16a34a' },
                  };
                  const tc = targetColors[log.target] ?? { bg: T.surface3, color: T.text2 };

                  const absTime  = new Date(log.deployed_at).toLocaleString();
                  const relTime  = (() => {
                    const diffMs  = Date.now() - new Date(log.deployed_at).getTime();
                    const diffMin = Math.floor(diffMs / 60000);
                    const diffHr  = Math.floor(diffMin / 60);
                    const diffDay = Math.floor(diffHr / 24);
                    if (diffMin < 2)  return 'just now';
                    if (diffMin < 60) return `${diffMin}m ago`;
                    if (diffHr  < 24) return `${diffHr}h ago`;
                    return `${diffDay}d ago`;
                  })();

                  return (
                    <div
                      key={log.id}
                      style={{
                        borderBottom: idx < Math.min(deployLogs.length, deployLogsPage * DEPLOY_LOGS_PER_PAGE) - 1
                          ? `1px solid ${T.border}` : 'none',
                        padding: '10px 0',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        fontSize: 13,
                      }}
                      data-testid={`deploy-log-row-${idx}`}
                    >
                      {/* Timestamp */}
                      <div
                        style={{ color: T.text2, minWidth: 70, flexShrink: 0 }}
                        title={absTime}
                      >
                        {relTime}
                      </div>

                      {/* Target badge */}
                      <div
                        style={{
                          padding: '2px 8px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background: tc.bg,
                          color: tc.color,
                          flexShrink: 0,
                          textTransform: 'capitalize',
                        }}
                        data-testid={`deploy-log-target-${idx}`}
                      >
                        {log.target}
                      </div>

                      {/* Feature names */}
                      <div style={{ flex: 1, color: T.text, lineHeight: 1.5 }}>
                        {shown.join(', ')}
                        {!isExpanded && overflow > 0 && (
                          <>
                            {' '}
                            <button
                              onClick={() => setExpandedLogIds(prev => new Set([...prev, log.id]))}
                              style={{
                                background: 'none', border: 'none',
                                color: T.accent, cursor: 'pointer',
                                fontSize: 12, padding: 0,
                              }}
                            >
                              + {overflow} more
                            </button>
                          </>
                        )}
                      </div>

                      {/* Netlify status code (faint) */}
                      {log.netlify_response_code && (
                        <div style={{ color: T.text3, fontSize: 11, flexShrink: 0 }}>
                          {log.netlify_response_code === 200 ? '✓' : `HTTP ${log.netlify_response_code}`}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {deployLogs.length > deployLogsPage * DEPLOY_LOGS_PER_PAGE && (
              <button
                onClick={() => setDeployLogsPage(p => p + 1)}
                style={{
                  marginTop: 10,
                  background: 'none',
                  border: 'none',
                  color: T.accent,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
                data-testid="deploy-history-show-more"
              >
                Show more
              </button>
            )}
          </>
        )}
      </div>

      {/* Waitlist signups sheet (replaces the card view) */}
      {showWaitlistSignups && (
        <div style={{
          position: 'fixed', inset: 0, background: T.bg, zIndex: 40,
          display: 'flex', flexDirection: 'column',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <WaitlistSignupsTab
            projectId={projectId}
            onBack={() => setShowWaitlistSignups(false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Main AdminScreen ──────────────────────────────────────────────────────

export default function AdminScreen() {
  if (!ADMIN_ENABLED) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Admin Console</div>
          <div style={{ color: T.text2, fontSize: 14 }}>Not available in this environment.</div>
        </div>
      </div>
    );
  }

  const [tab,          setTab]          = useState<'users' | 'audit' | 'platform'>('users');
  // Build 006–009: the Platform Features tab requires a project_id context.
  // In the Admin Console, we default to the first project owned by the current user.
  // A real implementation would add a project selector; v1 uses a prompt approach.
  const [platformProjectId, setPlatformProjectId] = useState('');
  const [users,        setUsers]        = useState<AdminUserProfile[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'suspended' | 'all'>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(null);
  const { showToast }                   = useToast();

  useEffect(() => {
    (async () => {
      try {
        const data = await listAdminUsers();
        setUsers(data);
      } catch (err) {
        showToast(extractErrorMessage(err, 'Failed to load users'), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = filterUsers(users, search, roleFilter, statusFilter);

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding:      '4px 12px',
    borderRadius:  20,
    fontSize:      12,
    fontWeight:    active ? 600 : 400,
    background:    active ? T.accent : T.surface2,
    color:         active ? '#fff' : T.text2,
    border:        'none',
    cursor:        'pointer',
  });

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding:         '10px 0',
    color:           active ? T.text : T.text2,
    background:      'none',
    border:          'none',
    borderBottom:    active ? `2px solid ${T.accent}` : '2px solid transparent',
    cursor:          'pointer',
    fontSize:         14,
    fontWeight:       active ? 600 : 400,
    marginRight:      24,
  });

  return (
    <div style={{
      minHeight:   '100vh',
      background:   T.bg,
      color:        T.text,
      fontFamily:  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display:     'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 0', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Admin Console</h1>
          <span style={{ background: T.surface3, color: T.text2, borderRadius: 20, fontSize: 12, padding: '4px 12px' }}>
            Shipyard
          </span>
        </div>
        <div>
          <button data-testid="admin-tab-users" style={tabStyle(tab === 'users')} onClick={() => setTab('users')}>Users</button>
          <button data-testid="admin-tab-audit" style={tabStyle(tab === 'audit')} onClick={() => setTab('audit')}>Audit Log</button>
          <button data-testid="admin-tab-platform" style={tabStyle(tab === 'platform')} onClick={() => setTab('platform')}>Platform Features</button>
        </div>
      </div>

      {tab === 'platform' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!platformProjectId ? (
            <div style={{ padding: '32px 28px' }}>
              <p style={{ fontSize: 14, color: T.text2, marginBottom: 12 }}>
                Enter a Project ID to manage its Platform Features:
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  data-testid="platform-project-id-input"
                  placeholder="Paste project UUID…"
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 8,
                    border: `1px solid ${T.border2}`,
                    background: T.surface2, color: T.text, fontSize: 14, outline: 'none',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) setPlatformProjectId(val);
                    }
                  }}
                />
                <button
                  data-testid="platform-project-id-submit"
                  onClick={e => {
                    const input = (e.currentTarget.previousSibling as HTMLInputElement);
                    if (input?.value.trim()) setPlatformProjectId(input.value.trim());
                  }}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 14, cursor: 'pointer' }}
                >
                  Load
                </button>
              </div>
            </div>
          ) : (
            <PlatformFeaturesTab projectId={platformProjectId} />
          )}
        </div>
      ) : tab === 'audit' ? (
        <AuditLogTab />
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* User list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* Search + filters */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                data-testid="admin-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                style={{
                  background: T.surface2, border: `1px solid ${T.border2}`,
                  borderRadius: 10, color: T.text, fontSize: 14, padding: '8px 12px',
                  outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(['all', 'owner', 'admin', 'member', 'viewer'] as const).map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)} style={pillStyle(roleFilter === r)}>
                    {r === 'all' ? 'All roles' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
                <div style={{ width: 1, height: 20, background: T.border, margin: '0 4px' }} />
                {(['all', 'active', 'suspended'] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} style={pillStyle(statusFilter === s)}>
                    {s === 'all' ? 'All status' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: T.text3 }}>
                  {filtered.length} user{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: T.text2 }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: T.text2 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  No users match your search.
                </div>
              ) : (
                filtered.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    selected={selectedUser?.id === u.id}
                    onClick={() => setSelectedUser(u)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Detail panel */}
          {selectedUser && (
            <UserDetailPanel
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
              onUserUpdated={updated => {
                setUsers(us => us.map(u => u.id === updated.id ? updated : u));
                setSelectedUser(updated);
              }}
              onUserDeleted={id => {
                setUsers(us => us.filter(u => u.id !== id));
                setSelectedUser(null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
