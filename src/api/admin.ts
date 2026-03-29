/**
 * Admin API — Build 003
 *
 * All write operations call Netlify Edge Functions (server-side auth).
 * Read operations use the Supabase JS client with session JWT.
 */

import { supabase }           from '../lib/supabase';
import type {
  AdminUserProfile,
  AuditLogEntry,
  AuditAction,
  UserRole,
} from '../types/db';

// ── Users ─────────────────────────────────────────────────────────────────

export async function listAdminUsers(): Promise<AdminUserProfile[]> {
  const res = await fetch('/api/admin/users', {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list users: ${res.status}`);
  return res.json();
}

export function filterUsers(
  users:   AdminUserProfile[],
  search:  string,
  role:    UserRole | 'all',
  status:  'active' | 'suspended' | 'all',
): AdminUserProfile[] {
  return users.filter(u => {
    const matchesSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole   = role   === 'all' || u.role   === role;
    const matchesStatus = status === 'all' || u.status === status;
    return matchesSearch && matchesRole && matchesStatus;
  });
}

export async function changeUserRole(userId: string, role: UserRole): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/role`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body:    JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`Failed to change role: ${res.status}`);
}

export async function suspendUser(userId: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/suspend`, {
    method:  'PATCH',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to suspend user: ${res.status}`);
}

export async function unsuspendUser(userId: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/unsuspend`, {
    method:  'PATCH',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to unsuspend user: ${res.status}`);
}

export async function sendPasswordReset(userId: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
    method:  'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to send reset email: ${res.status}`);
}

export async function startImpersonation(userId: string): Promise<string> {
  const res = await fetch('/api/admin/impersonate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body:    JSON.stringify({ target_user_id: userId }),
  });
  if (!res.ok) throw new Error(`Failed to start impersonation: ${res.status}`);
  const { token } = await res.json();
  return token as string;
}

/**
 * Returns the signed download URL for the user's data export.
 * Caller should open the URL in a new tab (5-min TTL).
 */
export async function exportUserData(userId: string): Promise<string> {
  const res = await fetch(`/api/admin/users/${userId}/export`, {
    method:  'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to export: ${res.status}`);
  const { download_url } = await res.json();
  return download_url as string;
}

export async function deleteUserRTBF(userId: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method:  'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete user: ${res.status}`);
}

// ── Audit Log ─────────────────────────────────────────────────────────────

export interface AuditLogFilters {
  from?:    string;  // ISO date
  to?:      string;  // ISO date
  actions?: AuditAction[];
  adminId?: string;
}

export async function listAuditLog(
  filters: AuditLogFilters = {},
  page    = 0,
  perPage = 50,
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  // Join profiles to get admin name + email alongside each log entry
  let query = supabase
    .from('admin_audit_log')
    .select('*, admin:profiles!admin_audit_log_admin_user_id_fkey(name, email)', { count: 'exact' })
    .order('performed_at', { ascending: false })
    .range(page * perPage, (page + 1) * perPage - 1);

  if (filters.from)               query = query.gte('performed_at', filters.from);
  if (filters.to)                 query = query.lte('performed_at', filters.to);
  if (filters.actions?.length)    query = query.in('action', filters.actions);
  if (filters.adminId)            query = query.eq('admin_user_id', filters.adminId);

  const { data, error, count } = await query;
  if (error) throw error;
  return { entries: data as AuditLogEntry[], total: count ?? 0 };
}

// ── Helper ────────────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token    = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
