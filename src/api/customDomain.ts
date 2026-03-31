/**
 * Custom Domain API — Build 018
 *
 * Manages custom domain configuration and DNS verification.
 * Status lifecycle: not_configured → dns_pending → connected
 *
 * Domain type detection (client-side):
 *   - domain.split('.').length === 2 → apex domain (A record)
 *   - else → subdomain (CNAME record)
 *
 * Contract: contracts/018-custom-domain-READY.md
 */

import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export type DomainStatus = 'not_configured' | 'dns_pending' | 'connected';
export type DomainType = 'apex' | 'subdomain';

export interface DnsInstructions {
  type: DomainType;
  record_type: 'A' | 'CNAME';
  host: string;    // '@' for apex, subdomain name for subdomain
  value: string;   // IP or CNAME target
}

export interface CustomDomainConfig {
  custom_domain: string | null;
  domain_status: DomainStatus;
}

// ── Constants ──────────────────────────────────────────────────────────────

const NETLIFY_IP = '75.2.60.5';

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch custom domain configuration for a project.
 */
export async function getDomainConfig(
  projectId: string
): Promise<CustomDomainConfig> {
  const { data, error } = await supabase
    .from('projects')
    .select('custom_domain, domain_status')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return {
    custom_domain: data.custom_domain || null,
    domain_status: (data.domain_status || 'not_configured') as DomainStatus,
  };
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Save a custom domain and set status to dns_pending.
 * Normalizes the domain (lowercase, no protocol).
 */
export async function saveCustomDomain(
  projectId: string,
  domain: string
): Promise<void> {
  const normalized = domain.toLowerCase().trim();

  const { error } = await supabase
    .from('projects')
    .update({
      custom_domain: normalized,
      domain_status: 'dns_pending',
    })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Remove custom domain and reset status to not_configured.
 */
export async function removeCustomDomain(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      custom_domain: null,
      domain_status: 'not_configured',
    })
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Trigger domain status verification via Edge Function (verify-custom-domain).
 * The Edge Function checks DNS records and updates domain_status accordingly.
 */
export async function checkDomainStatus(projectId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('verify-custom-domain', {
    body: { project_id: projectId },
  });

  if (error) throw error;
}

// ── Client-side helper ─────────────────────────────────────────────────────

/**
 * Derive DNS instructions based on domain type and netlify subdomain.
 * Pure function — no DB access.
 *
 * Apex domain (example.com):
 *   - Record type: A
 *   - Host: @
 *   - Value: 75.2.60.5
 *
 * Subdomain (blog.example.com):
 *   - Record type: CNAME
 *   - Host: blog
 *   - Value: [netlifySubdomain].netlify.app
 */
export function deriveDnsInstructions(
  domain: string,
  netlifySubdomain: string
): DnsInstructions {
  const parts = domain.split('.');
  const isApex = parts.length === 2;

  if (isApex) {
    return {
      type: 'apex',
      record_type: 'A',
      host: '@',
      value: NETLIFY_IP,
    };
  } else {
    // Extract the subdomain part (first segment)
    const subdomain = parts[0];
    return {
      type: 'subdomain',
      record_type: 'CNAME',
      host: subdomain,
      value: `${netlifySubdomain}.netlify.app`,
    };
  }
}
